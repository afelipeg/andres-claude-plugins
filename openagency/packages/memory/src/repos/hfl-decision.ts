// ─── HFL Decision Repository ──────────────────────────────────────
// PostgreSQL persistence for Human Feedback Loop decisions.
// Survives redeploys — no more in-memory-only state.

export interface HFLDecisionRow {
  id: string;
  run_id: string | null;
  client_id: string | null;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  reasons: unknown[];
  rendered_payload: Record<string, unknown>;
  channel: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  feedback: string | null;
}

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

function mapRow(r: Record<string, unknown>): HFLDecisionRow {
  return {
    id: r['id'] as string,
    run_id: (r['run_id'] as string) ?? null,
    client_id: (r['client_id'] as string) ?? null,
    status: (r['status'] as string) ?? 'pending',
    risk_score: r['risk_score'] != null ? Number(r['risk_score']) : null,
    risk_level: (r['risk_level'] as string) ?? null,
    reasons: Array.isArray(r['reasons']) ? r['reasons'] : (r['reasons'] as unknown[] ?? []),
    rendered_payload: (r['rendered_payload'] as Record<string, unknown>) ?? {},
    channel: (r['channel'] as string) ?? null,
    created_at: String(r['created_at']),
    resolved_at: r['resolved_at'] ? String(r['resolved_at']) : null,
    resolved_by: (r['resolved_by'] as string) ?? null,
    feedback: (r['feedback'] as string) ?? null,
  };
}

export class HFLDecisionRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  async save(row: HFLDecisionRow): Promise<void> {
    await this.sql.unsafe(
      `INSERT INTO hfl_decisions (id, run_id, client_id, status, risk_score, risk_level, reasons, rendered_payload, channel, created_at, resolved_at, resolved_by, feedback)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         risk_score = EXCLUDED.risk_score,
         risk_level = EXCLUDED.risk_level,
         reasons = EXCLUDED.reasons,
         rendered_payload = EXCLUDED.rendered_payload,
         channel = EXCLUDED.channel,
         resolved_at = EXCLUDED.resolved_at,
         resolved_by = EXCLUDED.resolved_by,
         feedback = EXCLUDED.feedback`,
      [
        row.id,
        row.run_id,
        row.client_id,
        row.status,
        row.risk_score,
        row.risk_level,
        JSON.stringify(row.reasons),
        JSON.stringify(row.rendered_payload),
        row.channel,
        row.created_at,
        row.resolved_at,
        row.resolved_by,
        row.feedback,
      ],
    );
  }

  async findByRunId(runId: string): Promise<HFLDecisionRow | null> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM hfl_decisions WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1',
      [runId],
    );
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapRow(r) : null;
  }

  async listPending(): Promise<HFLDecisionRow[]> {
    const rows = await this.sql.unsafe(
      "SELECT * FROM hfl_decisions WHERE status = 'escalated' ORDER BY created_at DESC",
      [],
    );
    return (rows as Array<Record<string, unknown>>).map(mapRow);
  }

  async updateStatus(
    id: string,
    status: string,
    resolvedBy?: string,
    feedback?: string,
  ): Promise<void> {
    await this.sql.unsafe(
      'UPDATE hfl_decisions SET status = $1, resolved_at = NOW(), resolved_by = $2, feedback = $3 WHERE id = $4',
      [status, resolvedBy ?? null, feedback ?? null, id],
    );
  }

  async list(limit = 50): Promise<HFLDecisionRow[]> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM hfl_decisions ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    return (rows as Array<Record<string, unknown>>).map(mapRow);
  }

  async findById(id: string): Promise<HFLDecisionRow | null> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM hfl_decisions WHERE id = $1',
      [id],
    );
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapRow(r) : null;
  }
}
