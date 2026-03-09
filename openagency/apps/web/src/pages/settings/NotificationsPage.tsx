// ─── Notification Settings (Placeholder) ────────────────────────────

export function NotificationsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        <p className="mt-1 text-sm text-gray-500">Configure alert preferences and email notifications.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">Coming Soon</h3>
        <p className="mt-1 text-xs text-gray-500">
          Configure when you receive alerts: HFL escalations, pipeline failures, anomaly detection, and daily digest emails.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">In-App Alerts (Active)</h3>
        <div className="space-y-2">
          {['HFL Escalations', 'Pipeline Failures', 'Waste Anomalies'].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-700">{label}</span>
              <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Enabled</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
