// ─── Decision Repository ────────────────────────────────────────────

import type {
  Decision,
  DecisionStatus,
  PlannedAction,
} from '@openagency/types';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

function mapRowToDecision(row: Record<string, unknown>): Decision {
  return {
    id: row['id'] as string,
    agent_id: row['agent_id'] as string,
    goal_id: (row['goal_id'] as string) ?? undefined,
    actions: (row['actions'] as PlannedAction[]) ?? [],
    reasoning: row['reasoning'] as string,
    confidence: Number(row['confidence'] ?? 0),
    risk_level: row['risk_level'] as Decision['risk_level'],
    requires_approval: Boolean(row['requires_approval']),
    orientation_id: (row['orientation_id'] as string) ?? undefined,
    status: row['status'] as DecisionStatus,
    created_at: row['created_at'] as string,
    approved_at: (row['approved_at'] as string) ?? undefined,
    approved_by: (row['approved_by'] as string) ?? undefined,
  };
}

export class DecisionRepo {
  constructor(private sql: unknown) {}

  async create(decision: Decision): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO decisions (
        id, agent_id, goal_id, actions, reasoning, confidence,
        risk_level, requires_approval, status, orientation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        decision.id,
        decision.agent_id,
        decision.goal_id ?? null,
        JSON.stringify(decision.actions),
        decision.reasoning,
        decision.confidence,
        decision.risk_level,
        decision.requires_approval,
        decision.status,
        decision.orientation_id ?? null,
        decision.created_at,
      ],
    );
  }

  async get(id: string): Promise<Decision | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM decisions WHERE id = $1',
      [id],
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    return mapRowToDecision(rows[0]!);
  }

  async listByAgent(agentId: string, limit = 50): Promise<Decision[]> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM decisions WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit],
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRowToDecision);
  }

  async listPendingApproval(agentId?: string): Promise<Decision[]> {
    const db = this.sql as Db;
    if (agentId) {
      const rows = (await db.unsafe(
        `SELECT * FROM decisions
         WHERE status = 'pending_approval' AND agent_id = $1
         ORDER BY created_at ASC`,
        [agentId],
      )) as Array<Record<string, unknown>>;
      return rows.map(mapRowToDecision);
    }
    const rows = (await db.unsafe(
      `SELECT * FROM decisions
       WHERE status = 'pending_approval'
       ORDER BY created_at ASC`,
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRowToDecision);
  }

  async approve(id: string, approvedBy: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE decisions
       SET status = 'approved', approved_at = now(), approved_by = $1
       WHERE id = $2`,
      [approvedBy, id],
    );
  }

  async reject(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE decisions SET status = 'rejected' WHERE id = $1`,
      [id],
    );
  }

  async updateStatus(id: string, status: DecisionStatus): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE decisions SET status = $1 WHERE id = $2',
      [status, id],
    );
  }
}
