import { useEffect, useState } from 'react';
import { projectId } from '@/utils/supabase/info';
import { Button } from './ui/button';

export default function UserRoleSelector({ user, token, onSaved }: { user: any, token?: string, onSaved?: () => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(user.role || null);
  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch(`${FUNCTIONS_URL}/manage-roles`);
        if (!res.ok) return;
        const json = await res.json();
        setRoles(json.data || []);
      } catch (e) { console.error(e); }
    };
    fetchRoles();
  }, []);

  const save = async () => {
    try {
      if (!selected) return;
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users/assign-role`, { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, role_name: selected }) });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt); }
      onSaved && onSaved();
    } catch (e) { alert('Error asignando rol: ' + (e as any).message); }
  };

  return (
    <div className="flex items-center gap-2">
      <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} className="border rounded p-1">
        <option value="">{roles.length ? 'Seleccionar rol' : 'No hay roles disponibles'}</option>
        {roles.length ? roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>)) : null}
      </select>
      <Button size="sm" onClick={save}>Asignar</Button>
    </div>
  );
}
