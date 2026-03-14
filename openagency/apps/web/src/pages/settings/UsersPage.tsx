// ─── User Management Page ────────────────────────────────────────────

import { useState, useEffect, FormEvent } from 'react';
import { UserPlus, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  last_login_at?: string;
  created_at?: string;
}

function statusVariant(status: string) {
  if (status === 'active') return 'success' as const;
  if (status === 'invited') return 'info' as const;
  return 'secondary' as const;
}

function roleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteName, setInviteName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const token = localStorage.getItem('plinth_token') ?? '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function loadUsers() {
    try {
      const res = await fetch(`${API_URL}/v1/users`, { headers });
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setMsg(''); setError(''); setInviteLink('');
    const res = await fetch(`${API_URL}/v1/auth/invite`, {
      method: 'POST', headers,
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, name: inviteName }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Invited ${inviteEmail}`);
      // Build the accept-invite link from the token returned by the backend
      const token = data.token ?? data.invite_token ?? '';
      const acceptUrl = token
        ? `${window.location.origin}/accept-invite?token=${token}`
        : data.invite_url ?? '';
      setInviteLink(acceptUrl);
      setInviteEmail(''); setInviteName('');
      setShowInvite(false);
      loadUsers();
    } else {
      setError(data.message ?? 'Failed to invite user');
    }
  }

  async function handleDeactivate(id: string) {
    await fetch(`${API_URL}/v1/users/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ status: 'deactivated' }),
    });
    loadUsers();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`${API_URL}/v1/users/${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      setError(data.message ?? 'Failed to delete user');
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Team Members</h2>
          <p className="text-sm text-zinc-500">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          variant="dark"
          size="sm"
          onClick={() => setShowInvite(!showInvite)}
          className="gap-1.5"
        >
          {showInvite ? (
            <>
              <ChevronDown className="h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" /> Invite User
            </>
          )}
        </Button>
      </div>

      {/* Alerts */}
      {msg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {inviteLink && (
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
          <div className="flex items-center gap-3">
            <span className="shrink-0">Invite link:</span>
            <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs font-mono truncate flex-1">{inviteLink}</code>
            <button
              onClick={() => void navigator.clipboard.writeText(inviteLink)}
              className="shrink-0 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Copy
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">Send this link to the invited user to set up their account.</p>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-900 mb-4">New Invitation</p>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="user@agency.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Name</label>
                <Input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Role</label>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="engine_user">Engine User</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
            </div>
            <Button type="submit" variant="dark" size="sm">
              Send Invite
            </Button>
          </form>
        </Card>
      )}

      {/* Users table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-zinc-900">{user.name || '—'}</TableCell>
                <TableCell className="text-zinc-600">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {roleLabel(user.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(user.status)} className="capitalize">
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-500">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {user.status === 'active' && (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
