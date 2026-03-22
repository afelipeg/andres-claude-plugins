// ─── Usage & Limits Settings Page ──────────────────────────────────
import { useState, useEffect } from 'react';
import { getQuotaStatus, updateBrandCount, requestExtraRuns, getQuotaRequests, type QuotaStatus, type QuotaRequest } from '../../api/quota';
import {
  GlassCard,
  GlassCardContent,
  GlassButton,
  GlassBadge,

} from '../../components/ui/glass';

function ProgressBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-white/50 mb-1">
        <span>{used} / {limit}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-white/10">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

export function UsageLimitsPage() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [requests, setRequests] = useState<QuotaRequest[]>([]);
  const [brandInput, setBrandInput] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [extraRuns, setExtraRuns] = useState(8);
  const [reason, setReason] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    void getQuotaStatus().then((data) => {
      setQuota(data);
      setBrandInput(data.brand_count);
    }).catch(() => {});
    void getQuotaRequests().then((data) => setRequests(data.requests)).catch(() => {});
  }, []);

  const handleSaveBrands = async () => {
    setSaving(true);
    try {
      await updateBrandCount(brandInput);
      const updated = await getQuotaStatus();
      setQuota(updated);
    } catch (err) {
      alert('Failed to update: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleRequestRuns = async () => {
    setRequesting(true);
    try {
      await requestExtraRuns(extraRuns, reason);
      setShowModal(false);
      setReason('');
      const updated = await getQuotaRequests();
      setRequests(updated.requests);
    } catch (err) {
      alert('Failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRequesting(false);
    }
  };

  if (!quota) {
    return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#00F5FF]" /></div>;
  }

  const resetDate = new Date(quota.resets_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-8">
      {/* Brand Configuration */}
      <GlassCard>
        <GlassCardContent>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-1">Brands / Clients</h3>
          <p className="text-xs text-white/30 mb-4">How many brands does your agency manage in Plinth?</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              value={brandInput}
              onChange={(e) => setBrandInput(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center focus:border-[#00F5FF]/50 focus:outline-none"
            />
            <span className="text-sm text-white/50">brands</span>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => void handleSaveBrands()}
              disabled={saving || brandInput === quota.brand_count}
            >
              {saving ? 'Saving...' : 'Save'}
            </GlassButton>
          </div>
          <div className="mt-3 rounded-lg bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-sm text-white/70">
              Monthly run quota: <strong className="text-white/95">{quota.runs.total.limit} runs</strong>
              <span className="text-white/40 ml-1">({quota.brand_count} brands x 8 runs{quota.runs.extra_granted > 0 ? ` + ${quota.runs.extra_granted} extra` : ''})</span>
            </p>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* This Month's Usage */}
      <GlassCard>
        <GlassCardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">This Month's Usage</h3>
            <span className="text-xs text-white/30">{quota.month}</span>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-white/70 mb-1">Initial runs</p>
              <ProgressBar used={quota.runs.initial.used} limit={quota.runs.initial.limit} color="#6366f1" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/70 mb-1">Optimization runs</p>
              <ProgressBar used={quota.runs.optimization.used} limit={quota.runs.optimization.limit} color="#00F5FF" />
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-sm font-medium text-white/70 mb-1">Total runs</p>
              <ProgressBar used={quota.runs.total.used} limit={quota.runs.total.limit} color="#3b82f6" />
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-sm font-medium text-white/70 mb-1">Assistant conversations</p>
              <ProgressBar used={quota.assistant.used} limit={quota.assistant.limit} color="#8b5cf6" />
            </div>
          </div>

          <p className="mt-4 text-xs text-white/30">Resets {resetDate}. Unused runs do not carry over.</p>

          <GlassButton
            variant="outline"
            className="mt-4 border-[#00F5FF]/30 text-[#00F5FF] hover:bg-[#00F5FF]/10"
            onClick={() => setShowModal(true)}
          >
            Request additional runs
          </GlassButton>
        </GlassCardContent>
      </GlassCard>

      {/* Previous Requests */}
      {requests.length > 0 && (
        <GlassCard>
          <GlassCardContent>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-3">Your Requests</h3>
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-4 py-2">
                  <div>
                    <span className="text-sm text-white/70">{r.extra_runs_requested} extra runs</span>
                    <span className="text-xs text-white/30 ml-2">{r.month}</span>
                  </div>
                  <GlassBadge variant={r.status === 'approved' ? 'success' : r.status === 'denied' ? 'destructive' : 'warning'}>
                    {r.status}
                  </GlassBadge>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[#0A0A0F] border border-white/10 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Request Additional Runs</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
                  How many extra runs do you need?
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={extraRuns}
                  onChange={(e) => setExtraRuns(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#00F5FF]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#00F5FF]/50 focus:outline-none"
                  placeholder="Why do you need additional runs this month?"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <GlassButton variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={() => void handleRequestRuns()}
                disabled={requesting}
              >
                {requesting ? 'Sending...' : 'Submit Request'}
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
