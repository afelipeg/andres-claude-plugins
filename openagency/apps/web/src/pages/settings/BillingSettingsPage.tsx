// ─── Billing Settings (Placeholder) ─────────────────────────────────

export function BillingSettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
        <p className="mt-1 text-sm text-gray-500">Manage your plan, usage, and invoices.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">Coming Soon</h3>
        <p className="mt-1 text-xs text-gray-500">
          Billing integration with the waste-recovery pricing model will be available here.
          Plan tiers, usage tracking, and invoice history.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700">Current Plan</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">Starter</span>
          <span className="text-sm text-gray-500">Waste-recovery pricing</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">Recovery: 3-5% | Lift: 10-20% | Efficiency: 5-10%</p>
      </div>
    </div>
  );
}
