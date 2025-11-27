import { useEffect, useState } from 'react';
import { projectId } from '@/utils/supabase/info';
import RoleForm from './RoleForm';

import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner@2.0.3';

export default function RolesView({ token }: { token?: string }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  const fetchRoles = async () => {
    setLoading(true);
    try {
      if (!FUNCTIONS_URL) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not configured');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fetch failed: ${res.status} ${res.statusText} - ${text}`);
      }
      const json = await res.json();
      setRoles(json.data || []);
    } catch (err) {
      console.error(err);
      alert('Error fetching roles: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deshabilitar rol? Esto es reversible.')) return;
    try {
      if (!FUNCTIONS_URL) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not configured');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles`, { method: 'DELETE', headers, body: JSON.stringify({ id }) });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Delete failed: ${res.status} ${res.statusText} - ${txt}`);
      }
      await fetchRoles();
    } catch (err) {
      console.error(err);
      alert('Error deleting role: ' + (err as any).message);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Roles</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo rol</Button>
          <Button size="sm" variant="outline" onClick={() => { fetchRoles(); toast('Refrescando roles'); }}>Refrescar</Button>
        </div>
      </div>

      {loading ? <div className="py-8 text-center">Cargando...</div> : (
        <div className="overflow-auto bg-card border rounded-md">
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left text-sm border-b">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Permisos</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className={`${r.disabled ? 'opacity-50' : ''} hover:bg-muted`}> 
                  <td className="px-4 py-3 align-top">{r.name}</td>
                  <td className="px-4 py-3 align-top">{r.description}</td>
                  <td className="px-4 py-3 align-top">{(r.permissions || []).map((p:any) => <Badge key={p.name} className="mr-2">{p.name}</Badge>)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setShowForm(true); }}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => { if (confirm('Deshabilitar rol?')) { handleDelete(r.id); } }}>Deshabilitar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-[640px]">
            <RoleForm role={editing} onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchRoles(); }} token={token} />
          </div>
        </div>
      )}
    </div>
  );
}
