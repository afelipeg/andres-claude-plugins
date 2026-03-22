// ─── Profile Settings ────────────────────────────────────────────────

import { useState, useEffect, FormEvent } from 'react';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassButton,
  GlassInput,
} from '../../components/ui/glass';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('plinth_token') ?? '';

  useEffect(() => {
    fetch(`${API_URL}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const u = data.user ?? data;
        setProfile(u);
        setName(u.name ?? '');
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleUpdateName(e: FormEvent) {
    e.preventDefault();
    setMsg(''); setError('');
    const res = await fetch(`${API_URL}/v1/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setMsg('Name updated.');
      const data = await res.json();
      if (data.user) setProfile(data.user);
    } else {
      const data = await res.json();
      setError(data.message ?? 'Failed to update name');
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setMsg(''); setError('');
    const res = await fetch(`${API_URL}/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (res.ok) {
      setMsg('Password updated.');
      setCurrentPassword(''); setNewPassword('');
    } else {
      const data = await res.json();
      setError(data.message ?? 'Failed to change password');
    }
  }

  if (loading) return <p className="text-sm text-white/50">Loading...</p>;

  return (
    <div className="space-y-6 max-w-xl">
      {msg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Profile info */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Profile</GlassCardTitle>
          <p className="text-xs text-white/50 mt-1">Update your display name.</p>
        </GlassCardHeader>
        <GlassCardContent>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
              <GlassInput type="email" value={profile?.email ?? ''} disabled />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Name</label>
              <GlassInput
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Role</label>
              <GlassInput type="text" value={profile?.role ?? ''} disabled className="capitalize" />
            </div>
            <GlassButton type="submit" variant="primary" size="sm">Save Changes</GlassButton>
          </form>
        </GlassCardContent>
      </GlassCard>

      {/* Change password */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Change Password</GlassCardTitle>
          <p className="text-xs text-white/50 mt-1">Update your account password.</p>
        </GlassCardHeader>
        <GlassCardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Current Password</label>
              <GlassInput
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">New Password</label>
              <GlassInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <GlassButton type="submit" variant="primary" size="sm">Change Password</GlassButton>
          </form>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
