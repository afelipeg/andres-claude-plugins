import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Authentication failed');
        return;
      }
      if (data.token) {
        localStorage.setItem('plinth_token', data.token);
      }
      navigate('/app');
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
          <Link to="/demo" className="text-sm text-zinc-400 hover:text-white transition-colors">
            View Demo →
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">Sign in to Plinth</h1>
            <p className="mt-2 text-sm text-zinc-400">Access your agency dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@agency.com"
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
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#00e5a0]/50"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#00e5a0] text-black hover:bg-[#00c98d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-600">
            By continuing you agree to Plinth's{' '}
            <a href="#" className="text-zinc-400 hover:text-white underline">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  );
}
