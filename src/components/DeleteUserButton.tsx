import { useState } from 'react';
import { projectId } from '@/utils/supabase/info';
import { Button } from './ui/button';

export default function DeleteUserButton({ user, token, onDeleted }: { user: any, token?: string, onDeleted?: () => void }) {
  const [loading, setLoading] = useState(false);
  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  const remove = async () => {
    if (!confirm('Eliminar usuario permanentemente? Esta acción es irreversible.')) return;
    try {
      setLoading(true);
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users/delete`, { method: 'DELETE', headers, body: JSON.stringify({ user_id: user.id }) });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt); }
      onDeleted && onDeleted();
    } catch (e) { alert('Error eliminando usuario: ' + (e as any).message); }
    finally { setLoading(false); }
  };

  return (
    <Button size="sm" variant="destructive" onClick={remove} disabled={loading}>Eliminar</Button>
  );
}
