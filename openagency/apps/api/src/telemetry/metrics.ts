// ─── Metrics (no-op when OTLP endpoint not set) ────────────────────

// Placeholder for Phase 1 — full metrics implementation in Phase 2.
// When OTEL_EXPORTER_OTLP_ENDPOINT is set, this would initialize
// MeterProvider with request count, latency histogram, and error rate.

export function initMetrics(): void {
  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  if (!endpoint) return;
  console.log('[telemetry] Metrics endpoint configured (full implementation in Phase 2)');
}
