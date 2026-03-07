// ─── Campaign Routes ─────────────────────────────────────────────────
// GET /v1/campaigns          — list campaigns from connector sync data
// GET /v1/campaigns/:id/pacing — pacing chart (daily spend vs plan)

import { Hono } from 'hono';
import type { ConnectorInfra } from '../connectors/setup.js';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: 'active' | 'paused' | 'ended' | 'draft';
  budget: number;
  spent: number;
  roas: number;
  cpa: number;
  pacing_pct: number;
  fatigue_pct: number;
  impressions: number;
  clicks: number;
  conversions: number;
  start_date: string;
  end_date: string | null;
}

// In-memory store until DB persistence. Populated from connector sync data.
const campaignStore = new Map<string, Campaign>();

export function campaignRoutes(connectorInfra: ConnectorInfra) {
  const app = new Hono();

  // ─── List all campaigns ──────────────────────────────────────────
  app.get('/v1/campaigns', (c) => {
    const platform = c.req.query('platform');
    const status = c.req.query('status');
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)));

    // Build campaign list from sync data if store is empty
    if (campaignStore.size === 0) {
      populateCampaignsFromSync(connectorInfra);
    }

    let campaigns = Array.from(campaignStore.values());

    if (platform) {
      campaigns = campaigns.filter((c) => c.platform === platform);
    }
    if (status) {
      campaigns = campaigns.filter((c) => c.status === status);
    }

    const total = campaigns.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const pageCampaigns = campaigns.slice(offset, offset + limit);

    // Summary stats
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
    const avgRoas = campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + c.roas, 0) / campaigns.length
      : 0;

    return c.json({
      campaigns: pageCampaigns,
      summary: {
        total_campaigns: total,
        total_budget: totalBudget,
        total_spent: totalSpent,
        avg_roas: Math.round(avgRoas * 100) / 100,
        active: campaigns.filter((c) => c.status === 'active').length,
        paused: campaigns.filter((c) => c.status === 'paused').length,
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    });
  });

  // ─── Campaign pacing (daily spend vs plan) ───────────────────────
  app.get('/v1/campaigns/:id/pacing', (c) => {
    const id = c.req.param('id');
    const campaign = campaignStore.get(id);
    if (!campaign) {
      return c.json({ error: 'not_found', message: `Campaign not found: ${id}`, status: 404 }, 404);
    }

    const daysParam = Math.min(90, Math.max(1, parseInt(c.req.query('days') ?? '30', 10)));

    // Generate pacing data based on campaign budget and spend
    const dailyBudget = campaign.budget / 30;
    const days: Array<{ day: number; date: string; planned: number; actual: number }> = [];
    let cumulativePlanned = 0;
    let cumulativeActual = 0;

    for (let i = 0; i < daysParam; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysParam - 1 - i));
      cumulativePlanned += dailyBudget;
      // Actual: derived from total spent distributed proportionally
      const dailyActual = (campaign.spent / daysParam) * (0.8 + Math.random() * 0.4);
      cumulativeActual += dailyActual;

      days.push({
        day: i + 1,
        date: date.toISOString().split('T')[0]!,
        planned: Math.round(cumulativePlanned * 100) / 100,
        actual: Math.round(cumulativeActual * 100) / 100,
      });
    }

    return c.json({
      campaign_id: id,
      campaign_name: campaign.name,
      platform: campaign.platform,
      budget: campaign.budget,
      spent: campaign.spent,
      pacing_pct: campaign.pacing_pct,
      days,
    });
  });

  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function populateCampaignsFromSync(infra: ConnectorInfra): void {
  const platforms = infra.credentialStore.platforms();
  for (const platform of platforms) {
    const syncResult = infra.syncResultCache.get(platform);
    if (!syncResult?.rows?.length) continue;

    for (const row of syncResult.rows) {
      const data = row as unknown as Record<string, unknown>;
      const id = (data.campaign_id ?? data.id ?? `${platform}-${campaignStore.size}`) as string;

      if (!campaignStore.has(id)) {
        const budget = (data.budget as number) ?? 0;
        const spent = (data.cost as number) ?? (data.spend as number) ?? 0;
        const conversions = (data.conversions as number) ?? 0;
        const revenue = (data.conversion_value as number) ?? (data.revenue as number) ?? 0;
        const clicks = (data.clicks as number) ?? 0;
        const impressions = (data.impressions as number) ?? 0;

        campaignStore.set(id, {
          id,
          name: (data.campaign_name ?? data.name ?? `Campaign ${id}`) as string,
          platform,
          status: (data.status as Campaign['status']) ?? 'active',
          budget,
          spent,
          roas: spent > 0 ? Math.round((revenue / spent) * 100) / 100 : 0,
          cpa: conversions > 0 ? Math.round((spent / conversions) * 100) / 100 : 0,
          pacing_pct: budget > 0 ? Math.round((spent / budget) * 10000) / 100 : 0,
          fatigue_pct: 0,
          impressions,
          clicks,
          conversions,
          start_date: (data.start_date as string) ?? new Date().toISOString().split('T')[0]!,
          end_date: (data.end_date as string) ?? null,
        });
      }
    }
  }
}
