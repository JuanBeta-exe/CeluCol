import { useState } from 'react';
import { projectId } from '@/utils/supabase/info';
import { Button } from './ui/button';

export default function DisableUserButton({ user, token, onSaved }: { user: any, token?: string, onSaved?: () => void }) {
  const [loading, setLoading] = useState(false);
  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  const toggle = async () => {
    try {
      setLoading(true);
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_URL}/manage-roles/manage-users/disable`, { method: 'PATCH', headers, body: JSON.stringify({ user_id: user.id, is_active: !user.is_active }) });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt); }
      onSaved && onSaved();
    } catch (e) { alert('Error actualizando estado: ' + (e as any).message); }
    finally { setLoading(false); }
  };

  return (
    <Button size="sm" variant="outline" onClick={toggle} disabled={loading}>
      {user.is_active ? 'Deshabilitar' : 'Habilitar'}
    </Button>
  );
}
