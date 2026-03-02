// ─── Outcome Repository ─────────────────────────────────────────────

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export interface OutcomeBeforeEntry {
  id: string;
  decision_id: string;
  agent_id: string;
  metric_before: Record<string, number>;
}

export class OutcomeRepo {
  constructor(private sql: unknown) {}

  async recordBefore(entry: OutcomeBeforeEntry): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO outcomes (id, decision_id, agent_id, metric_before, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [
        entry.id,
        entry.decision_id,
        entry.agent_id,
        JSON.stringify(entry.metric_before),
      ],
    );
  }

  async measureAfter(id: string, metricAfter: Record<string, number>): Promise<void> {
    const db = this.sql as Db;
    // Calculate improvement percentage from the first shared metric key
    await db.unsafe(
      `UPDATE outcomes
       SET metric_after = $1,
           measured_at = now(),
           verdict = CASE
             WHEN metric_before IS NOT NULL THEN 'measured'
             ELSE 'no_baseline'
           END
       WHERE id = $2`,
      [JSON.stringify(metricAfter), id],
    );
  }

  async listByAgent(agentId: string, limit = 50): Promise<unknown[]> {
    const db = this.sql as Db;
    return db.unsafe(
      'SELECT * FROM outcomes WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit],
    );
  }
}
