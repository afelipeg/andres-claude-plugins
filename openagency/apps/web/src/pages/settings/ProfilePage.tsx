// ─── Profile Settings ────────────────────────────────────────────────

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

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

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="space-y-6 max-w-xl">
      {msg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email</label>
              <Input type="email" value={profile?.email ?? ''} disabled />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Role</label>
              <Input type="text" value={profile?.role ?? ''} disabled className="capitalize" />
            </div>
            <Button type="submit" variant="dark" size="sm">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" variant="dark" size="sm">Change Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
