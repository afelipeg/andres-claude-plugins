// ─── Health & Readiness Routes ──────────────────────────────────────

import { Hono } from 'hono';
import type { OpenAgency } from '@openagency/core';

let _seedStatus: { seeded: boolean; role?: string; error?: string } = { seeded: false };

export function setSeedStatus(status: typeof _seedStatus) {
  _seedStatus = status;
}

export function healthRoutes(startTime: number, agency: OpenAgency) {
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      version: '1.0.0',
      uptime_s: Math.floor((Date.now() - startTime) / 1000),
      seed: _seedStatus,
    }),
  );

  app.get('/ready', (c) => {
    const engines = agency.listEngines();
    const ready = engines.length > 0;
    return c.json(
      {
        status: ready ? 'ok' : 'degraded',
        engines: engines.length,
        skills: engines.reduce((n, e) => n + e.skills.length, 0),
      },
      ready ? 200 : 503,
    );
  });

  // ─── System stats (for Architecture page) ───────────────────────
  app.get('/v1/system/stats', (c) => {
    const engines = agency.listEngines();
    const totalSkills = engines.reduce((n, e) => n + e.skills.length, 0);
    const uptimeMs = Date.now() - startTime;

    return c.json({
      engines: engines.length,
      skills: totalSkills,
      protocols: 4, // MCP, A2A, REST, Event Bus
      platforms: 6, // google_ads, meta_ads, dv360, tiktok_ads, tiktok_shop, amazon_ads
      avg_latency_ms: 0, // populated by request tracking middleware
      uptime_pct: 100,
      uptime_ms: uptimeMs,
      version: '1.0.0',
    });
  });

  return app;
}
