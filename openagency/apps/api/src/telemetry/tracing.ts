// ─── OpenTelemetry Tracing (no-op when OTLP endpoint not set) ───────

let tracingEnabled = false;

export async function initTracing(): Promise<void> {
  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  if (!endpoint) {
    console.log('[telemetry] OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled');
    return;
  }

  try {
    // Dynamic require-style imports — these are optional deps.
    // If they're not installed, tracing simply stays disabled.
    const sdkMod = await import('@opentelemetry/sdk-node' as string) as Record<string, unknown>;
    const NodeSDK = sdkMod['NodeSDK'] as new (opts: unknown) => { start(): void };

    const exporterMod = await import('@opentelemetry/exporter-trace-otlp-http' as string) as Record<string, unknown>;
    const OTLPTraceExporter = exporterMod['OTLPTraceExporter'] as new (opts: unknown) => unknown;

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      serviceName: 'openagency-api',
    });

    sdk.start();
    tracingEnabled = true;
    console.log(`[telemetry] Tracing enabled, exporting to ${endpoint}`);
  } catch {
    console.warn('[telemetry] OTel SDK not available, tracing disabled');
  }
}

export function isTracingEnabled(): boolean {
  return tracingEnabled;
}
