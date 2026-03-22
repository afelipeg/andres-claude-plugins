import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, XCircle, CheckCircle2, Bot } from 'lucide-react';
import { Card } from '../components/Card';
import { ReportHistory } from '../components/ReportHistory';
import { listEngines } from '../api/agency';
import { runFullDemo, DEMO_AD_SPEND } from '../api/demo';
import { GlassBadge } from '../components/ui/glass';

const ENGINE_ICONS: Record<string, string> = {
  'leak-detector': 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  'media-architect': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  'campaign-ops': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  'executive-bridge': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
};

const ENGINE_ROUTES: Record<string, string> = {
  'leak-detector': '/app/leak-detector',
  'media-architect': '/app/media-architect',
  'campaign-ops': '/app/campaign-ops',
  'executive-bridge': '/app/executive-bridge',
};

const ENGINE_COLORS: Record<string, string> = {
  'leak-detector': 'from-[#00F5FF]/20 to-[#00F5FF]/5',
  'media-architect': 'from-[#7000FF]/20 to-[#7000FF]/5',
  'campaign-ops': 'from-[#FF00FF]/20 to-[#FF00FF]/5',
  'executive-bridge': 'from-[#00F5FF]/20 to-[#7000FF]/5',
};

export function HomePage() {
  const engines = listEngines();
  const navigate = useNavigate();
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{
    id: string; status: string; pipeline_id: string; total_duration_ms?: number;
    started_at: string; hfl_decision?: { status: string };
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('plinth_token');
    if (!token) return;
    const API_URL = import.meta.env.VITE_API_URL ?? '';
    fetch(`${API_URL}/v1/mesh/runs?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { runs?: Array<{ id: string; status: string; pipeline_id: string; total_duration_ms?: number; started_at: string; hfl_decision?: { status: string } }> } | null) => {
        if (data?.runs?.[0]) setLastRun(data.runs[0]);
      })
      .catch(() => {});
  }, []);

  const handleRunDemo = async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setDemoError(null);
    try {
      await runFullDemo();
      navigate('/app/scorecard');
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Demo failed. Is the API server running?');
    } finally {
      setDemoRunning(false);
    }
  };

  const onboarded = localStorage.getItem('plinth_onboarded') === 'true';

  return (
    <div className="space-y-8">
      {/* Onboarding banner — shown only if not completed */}
      {!onboarded && (
        <div className="rounded-xl border border-[#00F5FF]/20 bg-[#00F5FF]/5 backdrop-blur-sm p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white/95">Get started with Plinth</h3>
            <p className="mt-0.5 text-xs text-white/50">Connect your ad platforms and run your first analysis in 3 simple steps.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { localStorage.setItem('plinth_onboarded', 'true'); window.location.reload(); }}
              className="rounded-lg border border-white/[0.10] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.05] transition-colors"
            >
              Dismiss
            </button>
            <Link
              to="/app/onboarding"
              className="rounded-lg bg-[#00F5FF] px-4 py-1.5 text-xs font-semibold text-[#0A0A0F] hover:bg-[#00F5FF]/90 transition-colors"
            >
              Start Onboarding
            </Link>
          </div>
        </div>
      )}

      {/* Last run card */}
      {lastRun && (
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-white/[0.10] bg-white/[0.05] backdrop-blur-xl px-5 py-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            lastRun.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
            : lastRun.status === 'running' ? 'bg-[#00F5FF]/15 text-[#00F5FF]'
            : 'bg-red-500/15 text-red-400'
          }`}>
            {lastRun.status === 'completed' ? <CheckCircle2 className="h-5 w-5" />
              : lastRun.status === 'running' ? <Loader2 className="h-5 w-5 animate-spin" />
              : <XCircle className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/95">
              Last run: {lastRun.pipeline_id} — <span className="capitalize">{lastRun.status}</span>
            </p>
            <p className="text-xs text-white/50">
              {new Date(lastRun.started_at).toLocaleString()}
              {lastRun.total_duration_ms ? ` · ${(lastRun.total_duration_ms / 1000).toFixed(1)}s` : ''}
              {lastRun.hfl_decision ? ` · HFL: ${lastRun.hfl_decision.status.replace(/_/g, ' ')}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => navigate('/app/scorecard')}
              className="rounded-lg border border-white/[0.10] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.05] transition-colors"
            >
              Scorecard
            </button>
            <button
              onClick={() => navigate('/app/assistant')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0A0A0F] bg-[#00F5FF] hover:bg-[#00F5FF]/90 transition-colors"
            >
              <Bot className="h-3.5 w-3.5" />
              Review in Assistant
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A0A0F] via-[#0A0A0F] to-[#7000FF]/20 border border-white/[0.10] p-8 text-white">
        {/* Glow accent */}
        <div aria-hidden className="absolute top-0 right-0 w-96 h-96 bg-[#00F5FF]/5 rounded-full blur-3xl" />
        <div aria-hidden className="absolute bottom-0 left-0 w-64 h-64 bg-[#FF00FF]/5 rounded-full blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-white">Plinth by Polanyi</h2>
          <p className="mt-2 max-w-xl text-white/60">
            A2A advertising intelligence infrastructure. Four autonomous engines analyze your ad spend,
            find waste, optimize channels, and deliver transparent outcome-based billing.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => void handleRunDemo()}
              disabled={demoRunning}
              className="rounded-lg bg-[#00F5FF] px-6 py-2.5 text-sm font-semibold text-[#0A0A0F] transition-colors hover:bg-[#00F5FF]/90 disabled:opacity-60 shadow-[0_0_20px_rgba(0,245,255,0.3)]"
            >
              {demoRunning ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Running all 4 engines...
                </span>
              ) : (
                `Run Full Demo ($${(DEMO_AD_SPEND / 1_000_000).toFixed(1)}M spend)`
              )}
            </button>
            <Link
              to="/app/leak-detector"
              className="rounded-lg bg-white/[0.08] border border-white/[0.10] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
            >
              Run Waste Analysis
            </Link>
            <Link
              to="/app/command-center"
              className="rounded-lg bg-white/[0.08] border border-white/[0.10] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
            >
              Command Center
            </Link>
          </div>
          {demoError && (
            <p className="mt-3 rounded-lg bg-red-500/15 border border-red-400/20 px-4 py-2 text-sm text-red-300">{demoError}</p>
          )}
          <p className="mt-4 text-xs text-white/30">
            Demo runs 8 campaigns across Meta, Google, DV360, TikTok, and Amazon through all 4 engines.
          </p>
        </div>
      </div>

      {/* Engine Cards */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white/95">Engines</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {engines.map((engine) => (
            <Link key={engine.id} to={ENGINE_ROUTES[engine.id] ?? '/'} className="group">
              <Card className="transition-all group-hover:border-[#00F5FF]/20">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ENGINE_COLORS[engine.id] ?? 'from-white/10 to-white/5'} border border-white/[0.10]`}
                  >
                    <svg className="h-6 w-6 text-[#00F5FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={ENGINE_ICONS[engine.id] ?? ''} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-white/95 group-hover:text-[#00F5FF] transition-colors">
                      {engine.name}
                    </h4>
                    <p className="mt-1 text-sm text-white/50">{engine.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {engine.skills.map((skill) => (
                        <GlassBadge key={skill} variant="default" className="text-[10px] px-2 py-0">
                          {skill}
                        </GlassBadge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Saved Reports */}
      <ReportHistory />

      {/* Quick Start */}
      <Card title="Quick Start">
        <div className="space-y-3 text-sm text-white/60">
          <p>
            <span className="font-medium text-white/95">1.</span> Choose an engine from the sidebar
            or click an engine card above.
          </p>
          <p>
            <span className="font-medium text-white/95">2.</span> Upload a CSV (auto-detects Google Ads,
            Meta Ads, TikTok Ads) or paste data directly.
          </p>
          <p>
            <span className="font-medium text-white/95">3.</span> Explore results with interactive
            charts, then export as PDF or find them in your saved reports.
          </p>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-white/25">
        Plinth by Polanyi v3.2.0 &mdash; 5 engines, 39 skills
      </p>
    </div>
  );
}
