import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid invite link. No token found.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Failed to accept invite. The link may be expired.');
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col">
      {/* Nav */}
      <div className="border-b border-white/[0.06]" style={{ backdropFilter: 'blur(16px)', background: 'rgba(9,9,11,0.8)' }}>
        <div className="container flex items-center justify-between h-16 max-w-6xl mx-auto px-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#09090B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7l4 4-4 4" /><path d="M12 7l4 4-4 4" /><line x1="20" y1="7" x2="20" y2="15" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-lg tracking-tight">Plinth</span>
              <span className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">by Polanyi</span>
            </div>
          </Link>
          <Link to="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Sign in →
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">Set up your account</h1>
            <p className="mt-2 text-sm text-zinc-400">Create your password to get started with Plinth</p>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Account created successfully</p>
              <p className="mt-1 text-xs text-zinc-400">Redirecting to sign in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                  Invalid invite link. Please check the URL or contact your administrator.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Full Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#00e5a0]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#00e5a0]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#00e5a0]/50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#00e5a0] text-black hover:bg-[#00c98d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-zinc-600">
            Already have an account?{' '}
            <Link to="/login" className="text-zinc-400 hover:text-white underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
