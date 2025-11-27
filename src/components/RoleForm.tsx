import React, { useState, useEffect } from 'react';
import { projectId } from '@/utils/supabase/info';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner@2.0.3';

type Permission = { id?: string; name: string };

export default function RoleForm({ role, onCancel, onSaved, token }: { role?: any; onCancel: () => void; onSaved: (r: any) => void; token?: string }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ? role.permissions.map((p: any) => p.name) : []);
  const [permissionInput, setPermissionInput] = useState('');
  const [saving, setSaving] = useState(false);

  const envUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const FUNCTIONS_URL = envUrl || `https://${projectId}.supabase.co/functions/v1`;

  useEffect(() => {
    if (role?.permissions) {
      setPermissions(role.permissions.map((p: any) => p.name));
    }
  }, [role]);

  const handleAddPermission = (value?: string) => {
    const v = (value ?? permissionInput).trim();
    if (!v) return;
    if (!permissions.includes(v)) setPermissions(prev => [...prev, v]);
    setPermissionInput('');
  };

  const handleRemovePermission = (p: string) => {
    setPermissions(prev => prev.filter(x => x !== p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, description, permissions };
    setSaving(true);
    try {
      if (!FUNCTIONS_URL) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not configured');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      let res: Response;
      if (role?.id) {
        res = await fetch(`${FUNCTIONS_URL}/manage-roles`, { method: 'PUT', headers, body: JSON.stringify({ id: role.id, ...payload }) });
      } else {
        res = await fetch(`${FUNCTIONS_URL}/manage-roles`, { method: 'POST', headers, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Save failed: ${res.status} ${res.statusText} - ${txt}`);
      }
      onSaved(true);
    } catch (err) {
      console.error(err);
      alert('Error saving role: ' + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-md border">
      <h3 className="text-lg font-semibold mb-4">{role ? 'Editar rol' : 'Nuevo rol'}</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="block text-sm mb-1">Nombre</label>
          <Input value={name} onChange={e => setName(e.target.value)} required disabled={saving} />
        </div>

        <div className="mb-3">
          <label className="block text-sm mb-1">Descripción</label>
          <Input value={description} onChange={e => setDescription(e.target.value)} disabled={saving} />
        </div>

        <div className="mb-3">
          <label className="block text-sm mb-2">Permisos</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {permissions.map(p => (
              <Badge key={p} className="flex items-center gap-2">
                <span className="text-xs">{p}</span>
                <button type="button" onClick={() => { handleRemovePermission(p); toast('Permiso eliminado'); }} disabled={saving} className="text-muted-foreground">✕</button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input placeholder="Agregar permiso y presionar Enter" value={permissionInput} onChange={e => setPermissionInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPermission(); toast.success('Permiso agregado'); } }} disabled={saving} />
            <Button type="button" variant="outline" size="sm" onClick={() => { handleAddPermission(); toast.success('Permiso agregado'); }} disabled={saving}>Agregar</Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !name}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
