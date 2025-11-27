import { useState } from 'react';
import { Button } from './ui/button';
import UserRoleSelector from './UserRoleSelector';
import DisableUserButton from './DisableUserButton';
import DeleteUserButton from './DeleteUserButton';

export default function UserRow({ user, token, onUpdated }: { user: any, token?: string, onUpdated: () => void }) {
  const [changing, setChanging] = useState(false);

  return (
    <tr className="hover:bg-muted">
      <td className="px-4 py-3 align-top">{user.user_metadata?.full_name || user.email || user.id}</td>
      <td className="px-4 py-3 align-top">{user.email}</td>
      <td className="px-4 py-3 align-top">
        <UserRoleSelector user={user} token={token} onSaved={() => onUpdated()} />
      </td>
      <td className="px-4 py-3 align-top">{user.is_active ? 'Activo' : 'Deshabilitado'}</td>
      <td className="px-4 py-3 align-top">
        <div className="flex gap-2">
          <DisableUserButton user={user} token={token} onSaved={() => onUpdated()} />
          <DeleteUserButton user={user} token={token} onDeleted={() => onUpdated()} />
        </div>
      </td>
    </tr>
  );
}
