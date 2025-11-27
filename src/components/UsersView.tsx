import { useEffect, useState } from 'react';
import { projectId } from '@/utils/supabase/info';
import { Button } from './ui/button';
import UserRow from './UserRow';

export default function UsersView({ token }: { token?: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (!FUNCTIONS_URL) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not configured');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users`, { headers });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Fetch failed: ${res.status} ${res.statusText} - ${txt}`);
      }
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      console.error(err);
      alert('Error fetching users: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Usuarios y Roles</h2>
        <div className="flex gap-2">
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
                <UserRow key={u.id} user={u} token={token} onUpdated={() => fetchUsers()} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

