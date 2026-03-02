// ─── Agent State Repository ─────────────────────────────────────────

import type {
  AgentState,
  AgentStatus,
  AgentConfiguration,
  OodaPhase,
} from '@openagency/types';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

function mapRowToAgentState(row: Record<string, unknown>): AgentState {
  return {
    agent_id: row['agent_id'] as string,
    engine_id: row['engine_id'] as string,
    status: row['status'] as AgentStatus,
    current_phase: (row['current_phase'] as OodaPhase) ?? null,
    active_goals: (row['active_goals'] as string[]) ?? [],
    last_cycle: (row['last_cycle'] as string) ?? null,
    cycles_completed: Number(row['cycles_completed'] ?? 0),
    configuration: row['configuration'] as AgentConfiguration,
    started_at: (row['started_at'] as string) ?? null,
  };
}

export class AgentStateRepo {
  constructor(private sql: unknown) {}

  async get(agentId: string): Promise<AgentState | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM agent_state WHERE agent_id = $1',
      [agentId],
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    return mapRowToAgentState(rows[0]!);
  }

  async upsert(state: AgentState): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO agent_state (
        agent_id, engine_id, status, current_phase, active_goals,
        last_cycle, cycles_completed, configuration, started_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      ON CONFLICT (agent_id) DO UPDATE SET
        engine_id = EXCLUDED.engine_id,
        status = EXCLUDED.status,
        current_phase = EXCLUDED.current_phase,
        active_goals = EXCLUDED.active_goals,
        last_cycle = EXCLUDED.last_cycle,
        cycles_completed = EXCLUDED.cycles_completed,
        configuration = EXCLUDED.configuration,
        started_at = EXCLUDED.started_at,
        updated_at = now()`,
      [
        state.agent_id,
        state.engine_id,
        state.status,
        state.current_phase,
        JSON.stringify(state.active_goals),
        state.last_cycle,
        state.cycles_completed,
        JSON.stringify(state.configuration),
        state.started_at,
      ],
    );
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE agent_state SET status = $1, updated_at = now() WHERE agent_id = $2',
      [status, agentId],
    );
  }

  async incrementCycles(agentId: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `UPDATE agent_state
       SET cycles_completed = cycles_completed + 1,
           last_cycle = now(),
           updated_at = now()
       WHERE agent_id = $1`,
      [agentId],
    );
  }

  async listAll(): Promise<AgentState[]> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM agent_state ORDER BY updated_at DESC',
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRowToAgentState);
  }
}
