// ─── MeshRunRepo ─────────────────────────────────────────────────────
// PostgreSQL persistence for pipeline runs.
// Uses local mirror types to avoid circular dependency (memory ↔ agent).

// Mirror of MeshStageResult from @openagency/agent (keep in sync)
export interface MeshStageResultRow {
  agent_id: string;
  status: string;
  duration_ms: number;
  skills_invoked: string[];
  output_summary?: Record<string, unknown>;
  error?: string | null;
}

// Mirror of UsageMeter from @openagency/agent (keep in sync)
interface UsageMeterRow {
  run_id: string;
  agent_client_id?: string;
  stages_executed: number;
  total_duration_ms: number;
  llm_tokens_used: { prompt: number; completion: number };
  actions_executed: number;
  outcomes: Record<string, unknown>;
}

// Mirror of MeshRun from @openagency/agent (keep in sync)
export interface MeshRunRow {
  id: string;
  pipeline_id: string;
  status: string;
  context: {
    run_id: string;
    stage_results: Map<string, MeshStageResultRow>;
    goal_id?: string;
    started_at: string;
  };
  started_at: string;
  completed_at?: string;
  total_duration_ms: number;
  usage?: UsageMeterRow;
}

interface DbRow {
  id: string;
  pipeline_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_duration_ms: number;
  goal_id: string | null;
  client_id: string | null;
  stage_results: Record<string, unknown>;
  usage: Record<string, unknown> | null;
}

function serializeStageResults(run: MeshRunRow): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of run.context.stage_results) {
    obj[k] = {
      agent_id: v.agent_id,
      status: v.status,
      duration_ms: v.duration_ms,
      skills_invoked: v.skills_invoked,
      output_summary: v.output_summary ?? {},
      error: v.error ?? null,
    };
  }
  return obj;
}

function reconstructRun(row: DbRow): MeshRunRow {
  const stageResults = new Map<string, MeshStageResultRow>();
  for (const [k, v] of Object.entries(row.stage_results)) {
    stageResults.set(k, v as MeshStageResultRow);
  }
  return {
    id: row.id,
    pipeline_id: row.pipeline_id,
    status: row.status,
    context: {
      run_id: row.id,
      stage_results: stageResults,
      goal_id: row.goal_id ?? undefined,
      started_at: row.started_at,
    },
    started_at: row.started_at,
    completed_at: row.completed_at ?? undefined,
    total_duration_ms: row.total_duration_ms,
    usage: row.usage ? (row.usage as unknown as UsageMeterRow) : undefined,
  };
}

export class MeshRunRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async save(run: MeshRunRow): Promise<void> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<unknown[]> };
    const stageResults = serializeStageResults(run);
    await db.unsafe(
      `INSERT INTO mesh_runs
         (id, pipeline_id, status, started_at, completed_at, total_duration_ms,
          goal_id, client_id, stage_results, usage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         status            = EXCLUDED.status,
         completed_at      = EXCLUDED.completed_at,
         total_duration_ms = EXCLUDED.total_duration_ms,
         stage_results     = EXCLUDED.stage_results,
         usage             = EXCLUDED.usage`,
      [
        run.id,
        run.pipeline_id,
        run.status,
        run.started_at,
        run.completed_at ?? null,
        run.total_duration_ms,
        run.context.goal_id ?? null,
        run.usage?.agent_client_id ?? null,
        JSON.stringify(stageResults),
        run.usage ? JSON.stringify(run.usage) : null,
      ],
    );
  }

  async findById(id: string): Promise<MeshRunRow | null> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<DbRow[]> };
    const rows = await db.unsafe('SELECT * FROM mesh_runs WHERE id = $1', [id]);
    if (!rows.length) return null;
    return reconstructRun(rows[0]);
  }

  async list(opts?: { limit?: number; status?: string; offset?: number }): Promise<MeshRunRow[]> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<DbRow[]> };
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;
    const parts: string[] = ['SELECT * FROM mesh_runs'];
    const params: unknown[] = [];

    if (opts?.status) {
      params.push(opts.status);
      parts.push(`WHERE status = $${params.length}`);
    }

    parts.push('ORDER BY started_at DESC');
    params.push(limit);
    parts.push(`LIMIT $${params.length}`);
    params.push(offset);
    parts.push(`OFFSET $${params.length}`);

    const rows = await db.unsafe(parts.join(' '), params);
    return rows.map(reconstructRun);
  }

  async count(opts?: { status?: string }): Promise<number> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<Array<{ count: string }>> };
    const parts = ['SELECT COUNT(*) as count FROM mesh_runs'];
    const params: unknown[] = [];
    if (opts?.status) {
      params.push(opts.status);
      parts.push(`WHERE status = $${params.length}`);
    }
    const rows = await db.unsafe(parts.join(' '), params);
    return parseInt(rows[0]?.count ?? '0', 10);
  }
}
