import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ReportHistory } from '../components/ReportHistory';
import { listEngines } from '../api/agency';
import { runFullDemo, DEMO_AD_SPEND } from '../api/demo';

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
  'leak-detector': 'from-zinc-800 to-zinc-700',
  'media-architect': 'from-zinc-700 to-zinc-600',
  'campaign-ops': 'from-zinc-700 to-zinc-600',
  'executive-bridge': 'from-zinc-800 to-zinc-700',
};

export function HomePage() {
  const engines = listEngines();
  const navigate = useNavigate();
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

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
        <div className="rounded-xl border border-[#02c98d]/30 bg-[#02c98d]/5 p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Get started with Plinth</h3>
            <p className="mt-0.5 text-xs text-gray-600">Connect your ad platforms and run your first analysis in 3 simple steps.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { localStorage.setItem('plinth_onboarded', 'true'); window.location.reload(); }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              Dismiss
            </button>
            <Link
              to="/app/onboarding"
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Start Onboarding
            </Link>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white">
        <h2 className="text-3xl font-bold">Plinth by Polanyi</h2>
        <p className="mt-2 max-w-xl text-gray-300">
          A2A advertising intelligence infrastructure. Four autonomous engines analyze your ad spend,
          find waste, optimize channels, and deliver transparent outcome-based billing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => void handleRunDemo()}
            disabled={demoRunning}
            className="rounded-lg bg-[#02c98d] px-6 py-2.5 text-sm font-semibold text-[#09090B] transition-colors hover:bg-[#00c98d] disabled:opacity-60"
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
            className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Run Waste Analysis
          </Link>
          <Link
            to="/app/command-center"
            className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Command Center
          </Link>
        </div>
        {demoError && (
          <p className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{demoError}</p>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Demo runs 8 campaigns across Meta, Google, DV360, TikTok, and Amazon through all 4 engines.
        </p>
      </div>

      {/* Engine Cards */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Engines</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {engines.map((engine) => (
            <Link key={engine.id} to={ENGINE_ROUTES[engine.id] ?? '/'} className="group">
              <Card className="transition-shadow group-hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ENGINE_COLORS[engine.id] ?? 'from-gray-500 to-gray-600'}`}
                  >
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={ENGINE_ICONS[engine.id] ?? ''} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-900 group-hover:text-zinc-700">
                      {engine.name}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">{engine.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {engine.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {skill}
                        </span>
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
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">1.</span> Choose an engine from the sidebar
            or click an engine card above.
          </p>
          <p>
            <span className="font-medium text-gray-900">2.</span> Upload a CSV (auto-detects Google Ads,
            Meta Ads, TikTok Ads) or paste data directly.
          </p>
          <p>
            <span className="font-medium text-gray-900">3.</span> Explore results with interactive
            charts, then export as PDF or find them in your saved reports.
          </p>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400">
        Plinth by Polanyi v3.2.0 &mdash; 5 engines, 39 skills
      </p>
    </div>
  );
}
