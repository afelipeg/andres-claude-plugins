// ─── Action Log Repository ──────────────────────────────────────────

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export interface ActionLogEntry {
  id: string;
  decision_id: string;
  agent_id: string;
  action_type: string;
  target_platform?: string;
  target_id?: string;
  parameters: Record<string, unknown>;
  previous_value?: unknown;
  new_value?: unknown;
  status: string;
  dry_run: boolean;
  duration_ms: number;
}

export class ActionLogRepo {
  constructor(private sql: unknown) {}

  async create(entry: ActionLogEntry): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO action_log (
        id, decision_id, agent_id, action_type, target_platform,
        target_id, parameters, previous_value, new_value,
        status, dry_run, duration_ms, executed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
      [
        entry.id,
        entry.decision_id,
        entry.agent_id,
        entry.action_type,
        entry.target_platform ?? null,
        entry.target_id ?? null,
        JSON.stringify(entry.parameters),
        entry.previous_value !== undefined ? JSON.stringify(entry.previous_value) : null,
        entry.new_value !== undefined ? JSON.stringify(entry.new_value) : null,
        entry.status,
        entry.dry_run,
        entry.duration_ms,
      ],
    );
  }

  async getById(id: string): Promise<Record<string, unknown> | null> {
    const db = this.sql as Db;
    const rows = await db.unsafe(
      'SELECT * FROM action_log WHERE id = $1 LIMIT 1',
      [id],
    );
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async listByDecision(decisionId: string): Promise<unknown[]> {
    const db = this.sql as Db;
    return db.unsafe(
      'SELECT * FROM action_log WHERE decision_id = $1 ORDER BY executed_at ASC',
      [decisionId],
    );
  }

  async listByAgent(agentId: string, limit = 50): Promise<unknown[]> {
    const db = this.sql as Db;
    return db.unsafe(
      'SELECT * FROM action_log WHERE agent_id = $1 ORDER BY executed_at DESC LIMIT $2',
      [agentId, limit],
    );
  }

  async countTodayByPlatform(platform: string): Promise<number> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      `SELECT COUNT(*)::int AS cnt FROM action_log
       WHERE target_platform = $1
         AND executed_at >= CURRENT_DATE`,
      [platform],
    )) as Array<Record<string, unknown>>;
    return Number(rows[0]?.['cnt'] ?? 0);
  }
}
