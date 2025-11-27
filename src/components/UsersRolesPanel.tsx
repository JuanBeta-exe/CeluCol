import { useEffect, useState } from 'react';
import { projectId } from '@/utils/supabase/info';
import { Button } from './ui/button';

type UserItem = {
  id: string;
  email?: string;
  role?: string | null;
  is_active?: boolean;
  user_metadata?: any;
};

export default function UsersRolesPanel({ token }: { token?: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setUsers(json.data || []);
    } catch (e) {
      console.error(e);
      alert('Error cargando usuarios: ' + (e as any).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const assignRole = async (user_id: string, role_name: string) => {
    if (!role_name) return;
    setSavingId(user_id);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users/assign-role`, { method: 'POST', headers, body: JSON.stringify({ user_id, role_name }) });
      if (!res.ok) throw new Error(await res.text());
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert('Error asignando rol: ' + (e as any).message);
    } finally { setSavingId(null); }
  };

  const toggleActive = async (user: UserItem) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users/disable`, { method: 'PATCH', headers, body: JSON.stringify({ user_id: user.id, is_active: !user.is_active }) });
      if (!res.ok) throw new Error(await res.text());
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert('Error actualizando estado: ' + (e as any).message);
    }
  };

  const deleteUser = async (user: UserItem) => {
    if (!confirm('Eliminar usuario permanentemente? Esta acción es irreversible.')) return;
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users/delete`, { method: 'DELETE', headers, body: JSON.stringify({ user_id: user.id }) });
      if (!res.ok) throw new Error(await res.text());
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert('Error eliminando usuario: ' + (e as any).message);
    }
  };

  const roleOptions = [
    { value: 'cliente', label: 'cliente' },
    { value: 'administrador', label: 'administrador' }
  ];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <div>
          <Button size="sm" variant="outline" onClick={() => fetchUsers()}>Refrescar</Button>
        </div>
      </div>

      {loading ? <div className="py-8 text-center">Cargando...</div> : (
        <div className="overflow-auto bg-card border rounded-md">
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left text-sm border-b">
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="hover:bg-muted">
                  <td className="px-4 py-3 align-top">{u.user_metadata?.full_name || u.email || u.id}</td>
                  <td className="px-4 py-3 align-top">{u.email}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <select defaultValue={u.role ?? ''} onChange={(e) => assignRole(u.id, e.target.value)} className="border rounded p-1">
                        <option value="">{u.role ?? 'Sin rol'}</option>
                        {roleOptions.map(r => (<option key={r.value} value={r.value}>{r.label}</option>))}
                      </select>
                      {savingId === u.id ? <span className="text-sm text-muted-foreground">Guardando...</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">{u.is_active ? 'Activo' : 'Deshabilitado'}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(u)}>{u.is_active ? 'Deshabilitar' : 'Habilitar'}</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
