// ─── Goal Repository ────────────────────────────────────────────────

import type {
  Goal,
  GoalStatus,
  GoalType,
  GoalConstraints,
  SubTask,
} from '@openagency/types';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

function mapRowToGoal(row: Record<string, unknown>): Goal {
  return {
    id: row['id'] as string,
    agent_id: (row['agent_id'] as string) ?? undefined,
    parent_goal_id: (row['parent_goal_id'] as string) ?? undefined,
    name: row['name'] as string,
    description: row['description'] as string,
    type: row['type'] as GoalType,
    target_metric: row['target_metric'] as string,
    target_value: Number(row['target_value']),
    current_value: row['current_value'] != null ? Number(row['current_value']) : undefined,
    deadline: (row['deadline'] as string) ?? undefined,
    priority: Number(row['priority'] ?? 5),
    status: row['status'] as GoalStatus,
    constraints: (row['constraints'] as GoalConstraints) ?? {},
    sub_tasks: (row['sub_tasks'] as SubTask[]) ?? [],
    progress_pct: Number(row['progress_pct'] ?? 0),
    created_at: row['created_at'] as string,
    updated_at: row['updated_at'] as string,
  };
}

export class GoalRepo {
  constructor(private sql: unknown) {}

  async create(goal: Goal): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO goals (
        id, agent_id, parent_goal_id, name, description, type,
        target_metric, target_value, current_value, deadline,
        priority, status, constraints, sub_tasks, progress_pct,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        goal.id,
        goal.agent_id ?? null,
        goal.parent_goal_id ?? null,
        goal.name,
        goal.description,
        goal.type,
        goal.target_metric,
        goal.target_value,
        goal.current_value ?? null,
        goal.deadline ?? null,
        goal.priority,
        goal.status,
        JSON.stringify(goal.constraints),
        JSON.stringify(goal.sub_tasks),
        goal.progress_pct,
        goal.created_at,
        goal.updated_at,
      ],
    );
  }

  async get(id: string): Promise<Goal | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM goals WHERE id = $1',
      [id],
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    return mapRowToGoal(rows[0]!);
  }

  async listActive(agentId?: string): Promise<Goal[]> {
    const db = this.sql as Db;
    if (agentId) {
      const rows = (await db.unsafe(
        `SELECT * FROM goals
         WHERE status = 'active' AND agent_id = $1
         ORDER BY priority ASC, created_at ASC`,
        [agentId],
      )) as Array<Record<string, unknown>>;
      return rows.map(mapRowToGoal);
    }
    const rows = (await db.unsafe(
      `SELECT * FROM goals
       WHERE status = 'active'
       ORDER BY priority ASC, created_at ASC`,
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRowToGoal);
  }

  async updateProgress(id: string, currentValue: number, progressPct: number): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE goals
       SET current_value = $1, progress_pct = $2, updated_at = now()
       WHERE id = $3`,
      [currentValue, progressPct, id],
    );
  }

  async complete(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE goals
       SET status = 'completed', progress_pct = 100, updated_at = now()
       WHERE id = $1`,
      [id],
    );
  }

  async fail(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE goals SET status = 'failed', updated_at = now() WHERE id = $1`,
      [id],
    );
  }

  async getSubGoals(parentId: string): Promise<Goal[]> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      `SELECT * FROM goals
       WHERE parent_goal_id = $1
       ORDER BY priority ASC, created_at ASC`,
      [parentId],
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRowToGoal);
  }

  async updateStatus(id: string, status: GoalStatus): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE goals SET status = $1, updated_at = now() WHERE id = $2',
      [status, id],
    );
  }
}
