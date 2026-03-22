// ─── User Management Page ────────────────────────────────────────────

import { useState, useEffect, FormEvent } from 'react';
import { UserPlus, ChevronDown } from 'lucide-react';
import {
  GlassCard,
  GlassCardContent,
  GlassButton,
  GlassInput,
  GlassBadge,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from '../../components/ui/glass';

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

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    agency_admin: 'Admin',
    account_manager: 'Engine User',
    viewer: 'Viewer',
    admin: 'Admin',
    engine_user: 'Engine User',
  };
  return labels[role] ?? role.replace(/_/g, ' ');
}

const JOB_TITLES = [
  'Account Director',
  'AdOps',
  'Strategist',
  'Trader',
  'Analyst',
  'Custom',
];

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteName, setInviteName] = useState('');
  const [inviteJobTitle, setInviteJobTitle] = useState('');
  const [inviteAdvAccess, setInviteAdvAccess] = useState<string[]>([]);
  const [availableAdvertisers, setAvailableAdvertisers] = useState<Array<{ id: string; name: string }>>([]);
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

  useEffect(() => {
    if (inviteRole !== 'account_manager' && inviteRole !== 'engine_user') return;
    void fetch(`${API_URL}/v1/agency/connections`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then(async (data: { connections: Array<{ platform: string }> } | null) => {
        if (!data?.connections) return;
        const all: Array<{ id: string; name: string }> = [];
        for (const conn of data.connections) {
          try {
            const res = await fetch(`${API_URL}/v1/agency/connections/${conn.platform}/advertisers`, { headers });
            if (res.ok) {
              const d = (await res.json()) as { advertisers: Array<{ advertiser_id: string; advertiser_name: string }> };
              for (const a of d.advertisers ?? []) {
                all.push({ id: `${conn.platform}:${a.advertiser_id}`, name: `${a.advertiser_name || a.advertiser_id} (${conn.platform})` });
              }
            }
          } catch { /* skip */ }
        }
        setAvailableAdvertisers(all);
      })
      .catch(() => {});
  }, [inviteRole]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setMsg(''); setError(''); setInviteLink('');
    const payload: Record<string, unknown> = { email: inviteEmail, role: inviteRole, name: inviteName };
    if (inviteRole === 'account_manager' || inviteRole === 'engine_user') {
      if (inviteJobTitle) payload.job_title = inviteJobTitle;
      if (inviteAdvAccess.length > 0) payload.advertiser_access = inviteAdvAccess;
    }
    const res = await fetch(`${API_URL}/v1/auth/invite`, {
      method: 'POST', headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Invited ${inviteEmail}`);
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

  if (loading) return <p className="text-sm text-white/50">Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Team Members</h2>
          <p className="text-sm text-white/50">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <GlassButton
          variant="primary"
          size="sm"
          onClick={() => setShowInvite(!showInvite)}
          className="gap-1.5"
        >
          {showInvite ? (
            <><ChevronDown className="h-4 w-4" /> Cancel</>
          ) : (
            <><UserPlus className="h-4 w-4" /> Invite User</>
          )}
        </GlassButton>
      </div>

      {/* Alerts */}
      {msg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>
      )}
      {inviteLink && (
        <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/70">
          <div className="flex items-center gap-3">
            <span className="shrink-0">Invite link:</span>
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono truncate flex-1 text-white/90">{inviteLink}</code>
            <button
              onClick={() => void navigator.clipboard.writeText(inviteLink)}
              className="shrink-0 rounded-md bg-[#00F5FF]/20 px-2.5 py-1 text-xs font-medium text-[#00F5FF] hover:bg-[#00F5FF]/30"
            >
              Copy
            </button>
          </div>
          <p className="mt-1.5 text-xs text-white/40">Send this link to the invited user to set up their account.</p>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <GlassCard>
          <GlassCardContent>
            <p className="text-sm font-semibold text-white/95 mb-4">New Invitation</p>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
                  <GlassInput type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="user@agency.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Name</label>
                  <GlassInput type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => { setInviteRole(e.target.value); setInviteJobTitle(''); setInviteAdvAccess([]); }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/95 focus:border-[#00F5FF]/50 focus:outline-none"
                  >
                    <option value="viewer" className="bg-[#0A0A0F]">Viewer (read-only)</option>
                    <option value="account_manager" className="bg-[#0A0A0F]">Engine User</option>
                    <option value="agency_admin" className="bg-[#0A0A0F]">Admin</option>
                  </select>
                </div>
              </div>

              {(inviteRole === 'account_manager' || inviteRole === 'engine_user') && (
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Job Title</label>
                    <select value={inviteJobTitle} onChange={(e) => setInviteJobTitle(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/95 focus:border-[#00F5FF]/50 focus:outline-none">
                      <option value="" className="bg-[#0A0A0F]">Select...</option>
                      {JOB_TITLES.map((t) => <option key={t} value={t} className="bg-[#0A0A0F]">{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Advertiser Access</label>
                    {availableAdvertisers.length > 0 ? (
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
                        {availableAdvertisers.map((adv) => (
                          <label key={adv.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
                            <input
                              type="checkbox"
                              checked={inviteAdvAccess.includes(adv.id)}
                              onChange={(e) => {
                                if (e.target.checked) setInviteAdvAccess([...inviteAdvAccess, adv.id]);
                                else setInviteAdvAccess(inviteAdvAccess.filter((a) => a !== adv.id));
                              }}
                              className="h-3.5 w-3.5 rounded border-white/30"
                            />
                            <span className="text-white/70 truncate">{adv.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 py-2">No advertisers configured yet. Connect a platform first.</p>
                    )}
                  </div>
                </div>
              )}

              <GlassButton type="submit" variant="primary" size="sm">Send Invite</GlassButton>
            </form>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Users table */}
      <GlassCard className="overflow-hidden">
        <GlassCardContent className="p-0">
          <GlassTable>
            <GlassTableHeader>
              <GlassTableRow>
                <GlassTableHead>Name</GlassTableHead>
                <GlassTableHead>Email</GlassTableHead>
                <GlassTableHead>Role</GlassTableHead>
                <GlassTableHead>Status</GlassTableHead>
                <GlassTableHead>Last Login</GlassTableHead>
                <GlassTableHead className="text-right">Actions</GlassTableHead>
              </GlassTableRow>
            </GlassTableHeader>
            <GlassTableBody>
              {users.map((user) => (
                <GlassTableRow key={user.id}>
                  <GlassTableCell className="font-medium text-white/95">{user.name || '--'}</GlassTableCell>
                  <GlassTableCell className="text-white/70">{user.email}</GlassTableCell>
                  <GlassTableCell>
                    <GlassBadge className="capitalize">{roleLabel(user.role)}</GlassBadge>
                  </GlassTableCell>
                  <GlassTableCell>
                    <GlassBadge variant={user.status === 'active' ? 'success' : user.status === 'invited' ? 'info' : 'default'} className="capitalize">
                      {user.status}
                    </GlassBadge>
                  </GlassTableCell>
                  <GlassTableCell className="text-white/50">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </GlassTableCell>
                  <GlassTableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.status === 'active' && (
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </GlassTableCell>
                </GlassTableRow>
              ))}
            </GlassTableBody>
          </GlassTable>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
