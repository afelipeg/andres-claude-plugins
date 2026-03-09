// ─── E2E Smoke Tests (Live) ──────────────────────────────────────────
// Integration tests hitting the live Railway API.
// Run with: LIVE_API_URL=https://polanyi-plinth-production.up.railway.app vitest run apps/api/src/__tests__/e2e-smoke-live.test.ts
//
// Skipped by default if LIVE_API_URL is not set.

import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env['LIVE_API_URL'];
const ADMIN_EMAIL = 'dedalo@polanyi.tech';
const ADMIN_PASSWORD = process.env['LIVE_ADMIN_PASSWORD'] ?? '';

const skip = !API_URL || !ADMIN_PASSWORD;

describe.skipIf(skip)('E2E Smoke: Live API', () => {
  let token = '';

  // ─── Health ──────────────────────────────────────────────────────

  it('GET /health returns ok', async () => {
    const res = await fetch(`${API_URL}/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  // ─── Auth ────────────────────────────────────────────────────────

  it('POST /v1/auth/login returns JWT', async () => {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(ADMIN_EMAIL);
    expect(body.user.role).toBe('admin');
    expect(body.token).toBeDefined();

    token = body.token;
  });

  it('POST /v1/auth/login rejects bad password', async () => {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /v1/auth/register is closed (403)', async () => {
    const res = await fetch(`${API_URL}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test123', name: 'Test' }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /v1/auth/me returns current user', async () => {
    const res = await fetch(`${API_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(ADMIN_EMAIL);
  });

  // ─── Engines ─────────────────────────────────────────────────────

  it('GET /v1/engines lists all engines', async () => {
    const res = await fetch(`${API_URL}/v1/engines`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.engines).toBeDefined();
    expect(body.engines.length).toBeGreaterThanOrEqual(4);

    const ids = body.engines.map((e: { id: string }) => e.id);
    expect(ids).toContain('leak-detector');
    expect(ids).toContain('media-architect');
    expect(ids).toContain('campaign-ops');
    expect(ids).toContain('executive-bridge');
  });

  it('GET /v1/engines/leak-detector returns engine detail', async () => {
    const res = await fetch(`${API_URL}/v1/engines/leak-detector`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('leak-detector');
    expect(body.skills).toBeDefined();
    expect(body.skills.length).toBeGreaterThan(0);
  });

  // ─── Skill Execution: Waste Waterfall ────────────────────────────

  it('POST leak-detector/waste-waterfall runs successfully', async () => {
    const input = {
      gross_spend: 1_000_000,
      industry: 'retail',
      actual_revenue: 2_000_000,
      non_working: { agency_fees: 80_000, tech_fees: 40_000, data_costs: 20_000 },
      supply_chain: { dsp_fees: 50_000, ssp_fees: 30_000, hidden_margins: 10_000 },
      quality: { fraud: 40_000, non_viewable: 30_000, brand_unsafe: 10_000, mfa: 30_000 },
      audience: { off_target: 50_000, frequency_waste: 20_000, duplication: 10_000 },
      optimization: { poor_pacing: 20_000, stale_creative: 15_000, wrong_bids: 15_000 },
      measurement: { misattributed: 15_000, overcounted: 15_000 },
    };

    const res = await fetch(`${API_URL}/v1/engines/leak-detector/skills/waste-waterfall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.trace_id).toBeDefined();
    expect(body.waste_summary).toBeDefined();
    expect(typeof body.waste_summary.total_waste).toBe('number');
    expect(typeof body.waste_summary.waste_pct).toBe('number');

    // Waste + productive = gross_spend (tolerance < $1)
    const totalWaste = body.waste_summary.total_waste;
    const productive = body.productive_spend?.amount ?? 0;
    expect(Math.abs(totalWaste + productive - 1_000_000)).toBeLessThan(1);
  });

  // ─── Skill Execution: Media Quality Score ────────────────────────

  it('POST leak-detector/media-quality-score runs successfully', async () => {
    const input = {
      channels: [
        { name: 'Meta Ads', spend: 400_000, ivt_rate_pct: 8, viewability_pct: 55, brand_safety_incidents: 200, brand_safety_impressions: 20_000_000, mfa_rate_pct: 12 },
        { name: 'Google Ads', spend: 350_000, ivt_rate_pct: 3, viewability_pct: 72, brand_safety_incidents: 50, brand_safety_impressions: 15_000_000, mfa_rate_pct: 5 },
      ],
    };

    const res = await fetch(`${API_URL}/v1/engines/leak-detector/skills/media-quality-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.trace_id).toBeDefined();
    expect(body.channels).toBeDefined();
    expect(body.channels.length).toBe(2);

    for (const ch of body.channels) {
      expect(ch.composite_score).toBeDefined();
      expect(ch.composite_score).toBeGreaterThanOrEqual(0);
      expect(ch.composite_score).toBeLessThanOrEqual(100);
    }

    expect(body.summary).toBeDefined();
    expect(body.summary.average_composite_score).toBeDefined();
  });

  // ─── Mesh Pipelines ─────────────────────────────────────────────

  it('GET /v1/mesh/pipelines lists registered pipelines', async () => {
    const res = await fetch(`${API_URL}/v1/mesh/pipelines`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pipelines).toBeDefined();
    expect(Array.isArray(body.pipelines)).toBe(true);
  });

  it('GET /v1/mesh/runs returns paginated runs', async () => {
    const res = await fetch(`${API_URL}/v1/mesh/runs?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  // ─── Validation: rejects invalid input ────────────────────────

  it('POST waste-waterfall rejects invalid input', async () => {
    const res = await fetch(`${API_URL}/v1/engines/leak-detector/skills/waste-waterfall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invalid: true }),
    });
    expect(res.status).toBe(400);
  });

  // ─── Auth: rejects unauthenticated ───────────────────────────

  it('GET /v1/engines rejects without token', async () => {
    const res = await fetch(`${API_URL}/v1/engines`);
    expect([401, 403]).toContain(res.status);
  });
});
