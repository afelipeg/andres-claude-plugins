// ─── Billing Settings (Placeholder) ─────────────────────────────────
import {
  GlassCard,
  GlassCardContent,
} from '../../components/ui/glass';

export function BillingSettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Billing</h2>
        <p className="mt-1 text-sm text-white/50">Manage your plan, usage, and invoices.</p>
      </div>

      <GlassCard>
        <GlassCardContent>
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white/70">Coming Soon</h3>
            <p className="mt-1 text-xs text-white/50">
              Billing integration with the waste-recovery pricing model will be available here.
              Plan tiers, usage tracking, and invoice history.
            </p>
          </div>
        </GlassCardContent>
      </GlassCard>

      <GlassCard>
        <GlassCardContent>
          <h3 className="text-sm font-semibold text-white/70">Current Plan</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">Starter</span>
            <span className="text-sm text-white/50">Waste-recovery pricing</span>
          </div>
          <p className="mt-1 text-xs text-white/50">Recovery: 3-5% (tiered) | Lift: 0.5-1.5% (selectable) | Efficiency: 0.5-1.5% (selectable)</p>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
