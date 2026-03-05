// ─── Seed Script ──────────────────────────────────────────────────
// Pre-loads demo data for development and demo environments.
// Usage: pnpm seed (or: node dist/db/seed.js)

import { getDb, closeDb } from './client.js';

async function seed() {
  const sql = await getDb();
  if (!sql) {
    console.error('[seed] DATABASE_URL not set — cannot seed.');
    process.exit(1);
  }

  const db = sql as { unsafe: (q: string, params?: unknown[]) => Promise<unknown> };
  console.log('[seed] Starting seed...');

  // ─── 1. Agent State ─────────────────────────────────────────────
  const engines = [
    { agent_id: 'leak-detector', engine_id: 'leak-detector' },
    { agent_id: 'media-architect', engine_id: 'media-architect' },
    { agent_id: 'campaign-ops', engine_id: 'campaign-ops' },
    { agent_id: 'executive-bridge', engine_id: 'executive-bridge' },
  ];

  for (const e of engines) {
    await db.unsafe(
      `INSERT INTO agent_state (agent_id, engine_id, status, cycles_completed, configuration)
       VALUES ($1, $2, 'idle', 0, '{"cycle_interval_ms":60000,"min_cycle_interval_ms":5000,"max_actions_per_cycle":5,"max_budget_change_pct":20,"approval_threshold_usd":5000,"writable_platforms":[],"dry_run":true}')
       ON CONFLICT (agent_id) DO NOTHING`,
      [e.agent_id, e.engine_id],
    );
  }
  console.log('[seed] Agent states created');

  // ─── 2. Demo Goals ──────────────────────────────────────────────
  const goals = [
    {
      id: 'goal_demo_waste',
      agent_id: 'leak-detector',
      name: 'Reduce waste to 15%',
      description: 'Reduce total ad waste from current 22% to 15% of gross spend across all platforms.',
      type: 'minimize',
      target_metric: 'waste_pct',
      target_value: 15,
      current_value: 22,
      priority: 1,
    },
    {
      id: 'goal_demo_roas',
      agent_id: 'media-architect',
      name: 'Achieve 4x ROAS',
      description: 'Optimize channel mix to achieve 4x return on ad spend through MMM-driven reallocation.',
      type: 'maximize',
      target_metric: 'roas',
      target_value: 4.0,
      current_value: 2.8,
      priority: 1,
    },
    {
      id: 'goal_demo_cpa',
      agent_id: 'campaign-ops',
      name: 'CPA under $40',
      description: 'Reduce average cost per acquisition to under $40 through pacing and budget optimization.',
      type: 'minimize',
      target_metric: 'cpa',
      target_value: 40,
      current_value: 58,
      priority: 2,
    },
  ];

  for (const g of goals) {
    const progress = g.type === 'minimize'
      ? Math.max(0, Math.min(100, ((g.current_value! - g.target_value) / (g.current_value! - g.target_value + 1)) * 50))
      : Math.max(0, Math.min(100, (g.current_value! / g.target_value) * 100));

    await db.unsafe(
      `INSERT INTO goals (id, agent_id, name, description, type, target_metric, target_value, current_value, priority, status, progress_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
       ON CONFLICT (id) DO NOTHING`,
      [g.id, g.agent_id, g.name, g.description, g.type, g.target_metric, g.target_value, g.current_value, g.priority, Math.round(progress)],
    );
  }
  console.log('[seed] Demo goals created');

  // ─── 3. Demo API Key ───────────────────────────────────────────
  await db.unsafe(
    `INSERT INTO api_keys (id, prefix, hash, name, role, scopes)
     VALUES ('seed_dev_key', 'oa_test_', 'dev_default_key_for_local_testing', 'Development Key', 'admin', '["*"]')
     ON CONFLICT (id) DO NOTHING`,
  );
  console.log('[seed] Dev API key ensured');

  console.log('[seed] Seed complete.');
  await closeDb();
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
