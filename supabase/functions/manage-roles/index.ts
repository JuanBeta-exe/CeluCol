import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = client();

    if (req.method === "GET") {
      // List roles with their permissions
      const { data: roles, error: rolesError } = await supabase.from('roles').select('*').order('created_at', { ascending: false });
      if (rolesError) throw rolesError;

      // For each role, fetch permissions
      const result = [];
      for (const role of roles) {
        const { data: rp, error: rpErr } = await supabase.from('role_permissions').select('permission_id').eq('role_id', role.id);
        if (rpErr) throw rpErr;
        const permIds = rp.map((r: any) => r.permission_id);
        let permissions = [];
        if (permIds.length) {
          const { data: perms, error: permsErr } = await supabase.from('permissions').select('*').in('id', permIds);
          if (permsErr) throw permsErr;
          permissions = perms;
        }
        result.push({ ...role, permissions });
      }

      return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { name, description, permissions = [] } = body;
      if (!name) return new Response(JSON.stringify({ error: 'Missing role name' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

      // create role
      const { data: inserted, error: insertErr } = await supabase.from('roles').insert({ name, description }).select('*').maybeSingle();
      if (insertErr) throw insertErr;

      const roleId = inserted.id;

      // ensure permissions exist (by name); accept array of names or ids
      const permNames = permissions.filter((p: any) => typeof p === 'string');
      const permIdsFromBody = permissions.filter((p: any) => typeof p === 'object' && p.id).map((p: any) => p.id);

      if (permNames.length) {
        // upsert permissions by name
        const upserts = permNames.map((n: string) => ({ name: n }));
        const { error: upsertErr } = await supabase.from('permissions').upsert(upserts, { onConflict: ['name'] });
        if (upsertErr) throw upsertErr;
      }

      // collect permission ids
      let permIds: string[] = [];
      if (permNames.length) {
        const { data: perms, error: permsErr } = await supabase.from('permissions').select('id').in('name', permNames);
        if (permsErr) throw permsErr;
        permIds = permIds.concat(perms.map((p: any) => p.id));
      }
      permIds = permIds.concat(permIdsFromBody);

      if (permIds.length) {
        const mappings = permIds.map((pid) => ({ role_id: roleId, permission_id: pid }));
        const { error: mapErr } = await supabase.from('role_permissions').upsert(mappings, { onConflict: ['role_id', 'permission_id'] });
        if (mapErr) throw mapErr;
      }

      return new Response(JSON.stringify({ data: { role: inserted } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const { id, name, description, permissions = [] } = body;
      if (!id) return new Response(JSON.stringify({ error: 'Missing role id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

      const { error: updateErr } = await supabase.from('roles').update({ name, description }).eq('id', id);
      if (updateErr) throw updateErr;

      // handle permissions: remove existing mappings and insert new ones (idempotent)
      const { error: delErr } = await supabase.from('role_permissions').delete().eq('role_id', id);
      if (delErr) throw delErr;

      // upsert permissions by name
      const permNames = permissions.filter((p: any) => typeof p === 'string');
      const permIdsFromBody = permissions.filter((p: any) => typeof p === 'object' && p.id).map((p: any) => p.id);

      if (permNames.length) {
        const upserts = permNames.map((n: string) => ({ name: n }));
        const { error: upsertErr } = await supabase.from('permissions').upsert(upserts, { onConflict: ['name'] });
        if (upsertErr) throw upsertErr;
      }

      let permIds: string[] = [];
      if (permNames.length) {
        const { data: perms, error: permsErr } = await supabase.from('permissions').select('id').in('name', permNames);
        if (permsErr) throw permsErr;
        permIds = permIds.concat(perms.map((p: any) => p.id));
      }
      permIds = permIds.concat(permIdsFromBody);

      if (permIds.length) {
        const mappings = permIds.map((pid) => ({ role_id: id, permission_id: pid }));
        const { error: mapErr } = await supabase.from('role_permissions').upsert(mappings, { onConflict: ['role_id', 'permission_id'] });
        if (mapErr) throw mapErr;
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      const { id, hard = false } = body;
      if (!id) return new Response(JSON.stringify({ error: 'Missing role id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

      // check user associations
      const { data: users, error: userErr } = await supabase.from('user_roles').select('user_id').eq('role_id', id).limit(1);
      if (userErr) throw userErr;
      if (users && users.length && hard) {
        return new Response(JSON.stringify({ error: 'Role has associated users; cannot hard-delete' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      if (hard) {
        const { error: delRP } = await supabase.from('role_permissions').delete().eq('role_id', id);
        if (delRP) throw delRP;
        const { error: delRole } = await supabase.from('roles').delete().eq('id', id);
        if (delRole) throw delRole;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // soft-delete: mark disabled
      const { error: softErr } = await supabase.from('roles').update({ disabled: true }).eq('id', id);
      if (softErr) throw softErr;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 });
  } catch (error) {
    console.error('manage-roles error', error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
