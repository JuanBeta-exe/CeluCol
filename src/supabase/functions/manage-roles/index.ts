import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

async function getUserIdFromToken(supabaseClient: any, token?: string) {
  try {
    if (!token) return null;
    // supabase-js v2: pass access_token
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error) return null;
    return data?.user?.id ?? null;
  } catch (e) {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = client();
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    // find subpath after manage-roles
    const idx = parts.lastIndexOf('manage-roles');
    const subpath = idx >= 0 ? parts.slice(idx + 1).join('/') : '';

    // support manage-users endpoints at /manage-users
    const usersPath = url.pathname.split('/').filter(Boolean).includes('manage-users');
    const usersIdx = parts.lastIndexOf('manage-users');
    const usersSubpath = usersIdx >= 0 ? parts.slice(usersIdx + 1).join('/') : '';

    // If request targets manage-users, handle user management endpoints
    if (usersPath) {
      // helper: get current user id from Authorization header
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      const currentUserId = await getUserIdFromToken(supabase, token);

      // GET /manage-users -> list users + roles + is_active
      if (req.method === 'GET' && (!usersSubpath || usersSubpath === '')) {
        // try admin list
        let usersList: any[] = [];
        try {
          const { data: adminData, error: adminErr } = await supabase.auth.admin.listUsers();
          if (adminErr) throw adminErr;
          usersList = adminData?.users ?? [];
        } catch (e) {
          // fallback: collect user_ids from user_roles and profiles
          const { data: ur, error: urErr } = await supabase.from('user_roles').select('user_id');
          if (urErr) throw urErr;
          const ids = [...new Set((ur || []).map((x: any) => x.user_id))];
          usersList = ids.map((id: string) => ({ id }));
        }

        // fetch roles and profiles
        const { data: userRoles, error: urErr2 } = await supabase.from('user_roles').select('user_id, role_id');
        if (urErr2) throw urErr2;
        const roleIds = [...new Set(userRoles.map((r: any) => r.role_id))];
        const { data: roles, error: rolesErr } = await supabase.from('roles').select('*').in('id', roleIds);
        if (rolesErr) throw rolesErr;
        const roleById: Record<string, any> = {};
        for (const role of roles || []) roleById[role.id] = role;

        // fetch profiles is_active
        const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('id, is_active');
        if (profilesErr) throw profilesErr;
        const profileById: Record<string, any> = {};
        for (const p of profiles || []) profileById[p.id] = p;

        const usersWithRoles = usersList.map((u: any) => {
          const assigned = (userRoles || []).filter((ur: any) => ur.user_id === u.id).map((ur: any) => roleById[ur.role_id]).filter(Boolean);
          const metadata = u.user_metadata ?? u.raw_user_meta_data ?? u.raw_user_meta_data;
          const is_active = profileById[u.id]?.is_active ?? true;
          // determine current role name: first assigned -> fallback to user metadata role
          const roleName = (assigned && assigned.length) ? assigned[0].name : (metadata?.role ?? null);
          return { id: u.id, email: u.email, roles: assigned, role: roleName, user_metadata: metadata, is_active };
        });

        return new Response(JSON.stringify({ data: usersWithRoles }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // POST /manage-users/assign-role -> assign or change role (body: user_id, role_name)
      if (req.method === 'POST' && usersSubpath.startsWith('assign-role')) {
        const body = await req.json();
        const { user_id, role_name } = body;
        if (!user_id || !role_name) return new Response(JSON.stringify({ error: 'Missing user_id or role_name' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

        // prevent non-admin from changing roles
        if (!currentUserId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });

        // find target role id
        const { data: roleRow, error: roleErr } = await supabase.from('roles').select('*').eq('name', role_name).maybeSingle();
        if (roleErr) throw roleErr;
        if (!roleRow) return new Response(JSON.stringify({ error: 'Role not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });

        const targetRoleId = roleRow.id;

        // If assigning non-admin and user currently admin, ensure not last admin
        const { data: currentUserRoles, error: curErr } = await supabase.from('user_roles').select('role_id').eq('user_id', user_id);
        if (curErr) throw curErr;

        // fetch administrador role id once (avoid using await inside callbacks)
        const { data: adminRoleRow, error: adminRoleErr } = await supabase.from('roles').select('id').eq('name', 'administrador').maybeSingle();
        if (adminRoleErr) throw adminRoleErr;
        const adminRoleId = adminRoleRow?.id;

        const isCurrentlyAdmin = adminRoleId ? (currentUserRoles || []).some((r: any) => r.role_id === adminRoleId) : false;

        if (isCurrentlyAdmin && role_name !== 'administrador') {
          // count admins
          const { data: admins, error: adminsErr } = await supabase.from('user_roles').select('user_id').eq('role_id', adminRoleId);
          if (adminsErr) throw adminsErr;
          const adminCount = (admins || []).length;
          if (adminCount <= 1) {
            return new Response(JSON.stringify({ error: 'Cannot remove role: last administrator' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
          }
        }

        // Upsert: remove existing roles for this user (we allow single role)
        const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', user_id);
        if (delErr) throw delErr;

        const { error: insErr } = await supabase.from('user_roles').insert({ user_id, role_id: targetRoleId, assigned_at: new Date().toISOString() });
        if (insErr) throw insErr;

        // Try to update auth user's metadata.role so other server functions that check user_metadata see the new role
        try {
          if (supabase.auth && supabase.auth.admin) {
            try {
              if (typeof supabase.auth.admin.updateUserById === 'function') {
                await supabase.auth.admin.updateUserById(user_id, { user_metadata: { role: role_name } });
              } else if (typeof supabase.auth.admin.updateUser === 'function') {
                await supabase.auth.admin.updateUser(user_id, { user_metadata: { role: role_name } });
              }
            } catch (e) {
              console.warn('Could not update auth.user metadata.role via admin API:', e?.message ?? e);
            }
          }
        } catch (e) {
          console.warn('Error updating auth user metadata:', e?.message ?? e);
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // PATCH /manage-users/disable -> body: user_id, is_active
      if (req.method === 'PATCH' && usersSubpath.startsWith('disable')) {
        const body = await req.json();
        const { user_id, is_active } = body;
        if (!user_id || typeof is_active !== 'boolean') return new Response(JSON.stringify({ error: 'Missing user_id or is_active' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        // cannot disable self
        if (currentUserId && currentUserId === user_id) return new Response(JSON.stringify({ error: 'Cannot disable current logged user' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

        // ensure profile exists
        const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', user_id).maybeSingle();
        if (profErr) throw profErr;
        if (!prof) {
          // create profile with is_active
          const { error: createProfErr } = await supabase.from('profiles').insert({ id: user_id, is_active });
          if (createProfErr) throw createProfErr;
        } else {
          const { error: updErr } = await supabase.from('profiles').update({ is_active }).eq('id', user_id);
          if (updErr) throw updErr;
        }

        // If disabling user, attempt to prevent future sign-ins:
        // 1) Try to mark the auth user as disabled via the admin API (if available)
        // 2) Try to delete refresh tokens from `auth.refresh_tokens` (service role required)
        if (is_active === false) {
          try {
            if (supabase.auth && supabase.auth.admin) {
              // Try common admin update function names in supabase-js
              try {
                if (typeof supabase.auth.admin.updateUserById === 'function') {
                  await supabase.auth.admin.updateUserById(user_id, { disabled: true });
                } else if (typeof supabase.auth.admin.updateUser === 'function') {
                  await supabase.auth.admin.updateUser(user_id, { disabled: true });
                }
              } catch (e) {
                // non-fatal: some SDK builds might not expose updateUser variants
                console.warn('Could not set auth user disabled flag via admin API:', e?.message ?? e);
              }
            }

            // Try to remove refresh tokens if the table exists (service role required)
            try {
              await supabase.from('auth.refresh_tokens').delete().eq('user_id', user_id);
            } catch (e) {
              console.warn('Could not delete refresh tokens from auth.refresh_tokens:', e?.message ?? e);
            }
          } catch (e) {
            console.warn('Error while attempting to fully disable user:', e?.message ?? e);
          }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // DELETE /manage-users/delete -> body: user_id
      if (req.method === 'DELETE' && usersSubpath.startsWith('delete')) {
        const body = await req.json();
        const { user_id } = body;
        if (!user_id) return new Response(JSON.stringify({ error: 'Missing user_id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        // prevent deleting self
        if (currentUserId && currentUserId === user_id) return new Response(JSON.stringify({ error: 'Cannot delete currently logged user' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

        // prevent deleting last admin
        const adminRoleRes = await supabase.from('roles').select('id').eq('name','administrador').maybeSingle();
        const adminRoleId = adminRoleRes.data?.id;
        if (adminRoleId) {
          const { data: admins, error: adminsErr } = await supabase.from('user_roles').select('user_id').eq('role_id', adminRoleId);
          if (adminsErr) throw adminsErr;
          const adminCount = (admins || []).length;
          const isTargetAdmin = (admins || []).some((a: any) => a.user_id === user_id);
          if (isTargetAdmin && adminCount <= 1) {
            return new Response(JSON.stringify({ error: 'Cannot delete the last administrator' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
          }
        }

        // delete user_roles, profile, and auth.user via admin API
        const { error: delUR } = await supabase.from('user_roles').delete().eq('user_id', user_id);
        if (delUR) throw delUR;
        const { error: delProf } = await supabase.from('profiles').delete().eq('id', user_id);
        if (delProf) throw delProf;

        // delete auth user via admin API
        try {
          const { error: delAuthErr } = await supabase.auth.admin.deleteUser(user_id);
          if (delAuthErr) throw delAuthErr;
        } catch (e) {
          throw e;
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    if (req.method === "GET" && (!subpath || subpath === '')) {
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

    // Users endpoints: /manage-roles/users
    if ((req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE') && subpath.startsWith('users')) {
      // GET /users -> list users with assigned roles
      if (req.method === 'GET') {
        // try to list users via admin API
        let usersList: any[] = [];
        try {
          const { data: adminData, error: adminErr } = await supabase.auth.admin.listUsers();
          if (adminErr) throw adminErr;
          usersList = adminData?.users ?? [];
        } catch (e) {
          // fallback: no user list available, return user_ids from user_roles
          const { data: ur, error: urErr } = await supabase.from('user_roles').select('user_id');
          if (urErr) throw urErr;
          const ids = [...new Set((ur || []).map((x: any) => x.user_id))];
          usersList = ids.map((id: string) => ({ id }));
        }

        // get roles mapping
        const { data: userRoles, error: urErr } = await supabase.from('user_roles').select('user_id, role_id');
        if (urErr) throw urErr;
        const roleIds = [...new Set(userRoles.map((r: any) => r.role_id))];
        const { data: roles, error: rolesErr } = await supabase.from('roles').select('*').in('id', roleIds);
        if (rolesErr) throw rolesErr;
        const roleById: Record<string, any> = {};
        for (const role of roles || []) roleById[role.id] = role;

        const usersWithRoles = usersList.map((u: any) => {
          const assigned = (userRoles || []).filter((ur: any) => ur.user_id === u.id).map((ur: any) => roleById[ur.role_id]).filter(Boolean);
          // Support different shapes: some projects store metadata in `user_metadata`, others in `raw_user_meta_data`.
          const metadata = u.user_metadata ?? u.raw_user_meta_data ?? u.raw_user_meta_data;
          const roleName = (assigned && assigned.length) ? assigned[0].name : (metadata?.role ?? null);
          return { id: u.id, email: u.email, user_metadata: metadata, roles: assigned, role: roleName };
        });

        return new Response(JSON.stringify({ data: usersWithRoles }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // POST /users -> assign role to user
      if (req.method === 'POST') {
        const body = await req.json();
        const { user_id, role_id } = body;
        if (!user_id || !role_id) return new Response(JSON.stringify({ error: 'Missing user_id or role_id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        const { error: insErr } = await supabase.from('user_roles').upsert({ user_id, role_id, assigned_at: new Date().toISOString() });
        if (insErr) throw insErr;

        // attempt to update auth.user metadata.role to keep user_metadata in sync
        try {
          const { data: roleRow, error: roleErr } = await supabase.from('roles').select('name').eq('id', role_id).maybeSingle();
          if (!roleErr && roleRow?.name) {
            const roleName = roleRow.name;
            if (supabase.auth && supabase.auth.admin) {
              try {
                if (typeof supabase.auth.admin.updateUserById === 'function') {
                  await supabase.auth.admin.updateUserById(user_id, { user_metadata: { role: roleName } });
                } else if (typeof supabase.auth.admin.updateUser === 'function') {
                  await supabase.auth.admin.updateUser(user_id, { user_metadata: { role: roleName } });
                }
              } catch (e) {
                console.warn('Could not update auth.user metadata.role via admin API:', e?.message ?? e);
              }
            }
          }
        } catch (e) {
          console.warn('Error updating auth user metadata after upsert by id:', e?.message ?? e);
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      // DELETE /users -> remove role from user
      if (req.method === 'DELETE') {
        const body = await req.json();
        const { user_id, role_id } = body;
        if (!user_id || !role_id) return new Response(JSON.stringify({ error: 'Missing user_id or role_id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        const { error: delErr } = await supabase.from('user_roles').delete().match({ user_id, role_id });
        if (delErr) throw delErr;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
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
