// ─── Onboarding Wizard ──────────────────────────────────────────────
// 3-step wizard: Connect Platforms → Select Rates → Run First Pipeline

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { markOnboarded, getConnectorStatus } from '../api/onboarding';
import { executePipeline } from '../api/agents';
import { getAuthUrl, exchangeOAuthCode, openOAuthPopup } from '../api/connectors';
import { PLATFORMS as PLATFORM_CONFIGS } from '../components/platform-logos';

const RATE_OPTIONS = [
  { value: 0.005, label: '0.5%' },
  { value: 0.0075, label: '0.75%' },
  { value: 0.01, label: '1.0%' },
  { value: 0.0125, label: '1.25%' },
  { value: 0.015, label: '1.5%' },
];

// ─── Step Indicator ───────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ['Connect Platforms', 'Select Rates', 'First Analysis'];
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              i < current ? 'bg-green-500 text-white' :
              i === current ? 'bg-zinc-900 text-white ring-2 ring-zinc-700' :
              'bg-zinc-100 text-zinc-400'
            }`}>
              {i < current ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs font-medium ${i <= current ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</span>
          </div>
          {i < steps.length - 1 && <div className="w-8 h-px bg-zinc-200" />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Connect Platforms ────────────────────────────────────

function ConnectStep({ onNext }: { onNext: () => void }) {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showSkipModal, setShowSkipModal] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getConnectorStatus();
      const map: Record<string, boolean> = {};
      for (const s of status) map[s.platform] = s.connected;
      setStatuses(map);
    } catch {
      // No connectors available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const connectedCount = Object.values(statuses).filter(Boolean).length;

  const handleConnect = async (platformId: string) => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { auth_url } = await getAuthUrl(platformId, redirectUri, platformId);
      const { code } = await openOAuthPopup(auth_url);
      await exchangeOAuthCode(platformId, code, redirectUri);
      void loadStatus();
    } catch {
      // Fallback: redirect to integrations page
      window.location.href = `/app/integrations`;
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <Card title="Connect Your Ad Platforms">
      <p className="text-sm text-gray-500 mb-4">
        Link your advertising accounts to pull live campaign data into the analysis engines.
        Connect at least one platform, or skip to use synthetic data.
      </p>

      {/* MCP Option */}
      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">
            MCP
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Connect via MCP</p>
            <p className="text-[11px] text-gray-500">Use Claude Desktop, Cursor, or any MCP-compatible agent to interact with all 63 tools.</p>
          </div>
          <a
            href="/app/integrations"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            View MCP Setup
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_CONFIGS.map((p) => {
          const connected = statuses[p.platform] ?? false;
          return (
            <div
              key={p.platform}
              className={`group rounded-xl border p-4 transition-all ${
                connected
                  ? 'border-green-200 bg-green-50/40'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
              }`}
              onClick={() => !connected && void handleConnect(p.platform)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                  <p.Logo className="h-6 w-6" />
                </div>
                {connected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900">{p.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
              {!connected && (
                <button
                  onClick={(e) => { e.stopPropagation(); void handleConnect(p.platform); }}
                  className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-gray-500">{connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected</span>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSkipModal(true)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Skip — use synthetic data
          </button>
          <button
            onClick={onNext}
            disabled={connectedCount === 0}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-30"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Skip confirmation modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Continue with synthetic data?</h3>
                <p className="mt-1.5 text-sm text-gray-600">
                  Without connecting an ad platform, Plinth will analyze <strong>synthetic benchmark data</strong> instead of your real campaigns. Scorecard results, recovery amounts, and AI recommendations will not reflect your actual performance.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  You can connect platforms later from <strong>Integrations</strong> in the sidebar.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowSkipModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Go Back — Connect Platform
              </button>
              <button
                onClick={() => { setShowSkipModal(false); onNext(); }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Continue with Synthetic Data
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Step 2: Select Rates ─────────────────────────────────────────

function RateStep({ liftRate, setLiftRate, efficiencyRate, setEfficiencyRate, onNext, onBack }: {
  liftRate: number;
  setLiftRate: (r: number) => void;
  efficiencyRate: number;
  setEfficiencyRate: (r: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <Card title="Select Your Fee Rates">
      <p className="text-sm text-gray-500 mb-6">
        Choose the percentage you'd like to pay for Lift and Efficiency value delivered.
        Recovery is automatic (3-5% based on your spend tier).
      </p>

      <div className="space-y-5">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-green-800">Recovery Fee</h4>
              <p className="text-xs text-green-600 mt-0.5">% of waste eliminated (budget, quality, supply chain)</p>
            </div>
            <span className="text-lg font-bold text-green-700">3–5%</span>
          </div>
          <p className="text-[11px] text-green-600 mt-2">Automatic — decreases as your spend increases</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="text-sm font-semibold text-zinc-800 mb-1">Lift Fee</h4>
            <p className="text-xs text-zinc-500 mb-3">% of performance improvement (ROAS, ROI, Media-Driven Sales)</p>
            <select
              value={liftRate}
              onChange={(e) => setLiftRate(parseFloat(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              {RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <h4 className="text-sm font-semibold text-purple-800 mb-1">Efficiency Fee</h4>
            <p className="text-xs text-purple-500 mb-3">% of execution savings (CPC, CPM, CTR, viewability)</p>
            <select
              value={efficiencyRate}
              onChange={(e) => setEfficiencyRate(parseFloat(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              {RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          Back
        </button>
        <button onClick={onNext} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
          Continue
        </button>
      </div>
    </Card>
  );
}

// ─── Step 3: First Pipeline Run ───────────────────────────────────

function RunStep({ liftRate, efficiencyRate, onBack }: {
  liftRate: number;
  efficiencyRate: number;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const handleRun = async () => {
    setRunning(true);
    setError('');
    try {
      const run = await executePipeline('full-optimization', undefined, 'onboarding') as unknown as Record<string, unknown>;
      setResult(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleFinish = () => {
    markOnboarded();
    navigate('/app/scorecard');
  };

  const scorecard = result?.scorecard as Record<string, unknown> | undefined;

  return (
    <Card title="Run Your First Analysis">
      <p className="text-sm text-gray-500 mb-6">
        Run the full 4-engine optimization pipeline. This will analyze your connected ad data
        (or synthetic data if no platforms connected) and generate your first Recovery Scorecard.
      </p>

      {!result && !running && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-7 w-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700 mb-1">Ready to analyze</p>
          <p className="text-xs text-zinc-500 mb-4">4 engines will run: Leak Detector, Media Architect, Campaign Ops, Executive Bridge</p>
          <p className="text-xs text-zinc-400 mb-4">
            Lift rate: {(liftRate * 100).toFixed(1)}% | Efficiency rate: {(efficiencyRate * 100).toFixed(1)}%
          </p>
          <button
            onClick={() => void handleRun()}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Run First Analysis
          </button>
        </div>
      )}

      {running && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
          <Spinner />
          <p className="mt-3 text-sm font-medium text-zinc-700">Running 4 engines...</p>
          <p className="text-xs text-zinc-500">This typically takes 2-3 minutes</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => void handleRun()}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold text-green-800">Pipeline completed</span>
              <StatusBadge status={result.status as string} />
            </div>

            {scorecard && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-xs text-gray-500">Total Fee</p>
                  <p className="text-lg font-bold text-gray-900">${((scorecard.total_fee as number) ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-xs text-gray-500">Value Delivered</p>
                  <p className="text-lg font-bold text-green-600">${((scorecard.value_delivered as number) ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-white p-3 text-center">
                  <p className="text-xs text-gray-500">ROI on Fee</p>
                  <p className="text-lg font-bold text-zinc-900">{((scorecard.roi_on_fee as number) ?? 0).toFixed(1)}x</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleFinish}
            className="w-full rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Go to Scorecard Dashboard
          </button>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          Back
        </button>
        {!result && (
          <button
            onClick={handleFinish}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Skip for now
          </button>
        )}
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [liftRate, setLiftRate] = useState(0.01);
  const [efficiencyRate, setEfficiencyRate] = useState(0.01);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Plinth</h2>
        <p className="mt-1 text-sm text-gray-500">Let's get you set up in 3 simple steps</p>
      </div>

      <StepIndicator current={step} />

      {step === 0 && <ConnectStep onNext={() => setStep(1)} />}
      {step === 1 && (
        <RateStep
          liftRate={liftRate}
          setLiftRate={setLiftRate}
          efficiencyRate={efficiencyRate}
          setEfficiencyRate={setEfficiencyRate}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <RunStep
          liftRate={liftRate}
          efficiencyRate={efficiencyRate}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  );
}
