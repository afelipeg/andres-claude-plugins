// ─── Scorecard DB Repository ──────────────────────────────────────────
// Persists scorecard records to PostgreSQL (replaces in-memory Map).

export interface ScorecardDbRecord {
  id: string;
  run_id?: string;
  client_id?: string;
  agency_id?: string;
  run_type: string;
  ad_spend: number;
  billing: Record<string, unknown>;
  engine_outputs: Record<string, unknown>;
  engine_results: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  feedback?: string;
  created_at: string;
  updated_at: string;
}

export class ScorecardDbRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async save(record: ScorecardDbRecord): Promise<void> {
    await this.db`
      INSERT INTO scorecards
        (id, run_id, client_id, agency_id, run_type, ad_spend, billing, engine_outputs, engine_results, status, feedback, created_at, updated_at)
      VALUES (
        ${record.id}, ${record.run_id ?? null}, ${record.client_id ?? null},
        ${record.agency_id ?? null},
        ${record.run_type}, ${record.ad_spend},
        ${JSON.stringify(record.billing)}, ${JSON.stringify(record.engine_outputs)},
        ${JSON.stringify(record.engine_results)},
        ${record.status}, ${record.feedback ?? null},
        ${record.created_at}, ${record.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        feedback = EXCLUDED.feedback,
        billing = EXCLUDED.billing,
        updated_at = EXCLUDED.updated_at
    `;
  }

  async findLatest(limit = 20): Promise<ScorecardDbRecord[]> {
    const rows = await this.db`
      SELECT id, run_id, client_id, run_type, ad_spend, billing, engine_outputs,
             engine_results, status, feedback, created_at, updated_at
      FROM scorecards
      ORDER BY created_at DESC
      LIMIT ${limit}
    ` as Array<{
      id: string; run_id: string | null; client_id: string | null; run_type: string;
      ad_spend: number | string; billing: unknown; engine_outputs: unknown;
      engine_results: unknown; status: 'pending' | 'accepted' | 'rejected';
      feedback: string | null; created_at: Date; updated_at: Date;
    }>;

    return rows.map((r) => this.deserialize(r));
  }

  async findById(id: string): Promise<ScorecardDbRecord | null> {
    const rows = await this.db`
      SELECT id, run_id, client_id, run_type, ad_spend, billing, engine_outputs,
             engine_results, status, feedback, created_at, updated_at
      FROM scorecards WHERE id = ${id}
    ` as Array<{
      id: string; run_id: string | null; client_id: string | null; run_type: string;
      ad_spend: number | string; billing: unknown; engine_outputs: unknown;
      engine_results: unknown; status: 'pending' | 'accepted' | 'rejected';
      feedback: string | null; created_at: Date; updated_at: Date;
    }>;
    const r = rows[0];
    if (!r) return null;
    return this.deserialize(r);
  }

  async findByRunId(runId: string): Promise<ScorecardDbRecord | null> {
    const rows = await this.db`
      SELECT id, run_id, client_id, run_type, ad_spend, billing, engine_outputs,
             engine_results, status, feedback, created_at, updated_at
      FROM scorecards WHERE run_id = ${runId}
      ORDER BY created_at DESC LIMIT 1
    ` as Array<{
      id: string; run_id: string | null; client_id: string | null; run_type: string;
      ad_spend: number | string; billing: unknown; engine_outputs: unknown;
      engine_results: unknown; status: 'pending' | 'accepted' | 'rejected';
      feedback: string | null; created_at: Date; updated_at: Date;
    }>;
    const r = rows[0];
    if (!r) return null;
    return this.deserialize(r);
  }

  async getLatestByClient(clientId: string, runType?: string): Promise<ScorecardDbRecord | null> {
    const rows = runType
      ? await this.db`
          SELECT id, run_id, client_id, run_type, ad_spend, billing, engine_outputs,
                 engine_results, status, feedback, created_at, updated_at
          FROM scorecards WHERE client_id = ${clientId} AND run_type = ${runType}
          ORDER BY created_at DESC LIMIT 1
        ` as Array<{
          id: string; run_id: string | null; client_id: string | null; run_type: string;
          ad_spend: number | string; billing: unknown; engine_outputs: unknown;
          engine_results: unknown; status: 'pending' | 'accepted' | 'rejected';
          feedback: string | null; created_at: Date; updated_at: Date;
        }>
      : await this.db`
          SELECT id, run_id, client_id, run_type, ad_spend, billing, engine_outputs,
                 engine_results, status, feedback, created_at, updated_at
          FROM scorecards WHERE client_id = ${clientId}
          ORDER BY created_at DESC LIMIT 1
        ` as Array<{
          id: string; run_id: string | null; client_id: string | null; run_type: string;
          ad_spend: number | string; billing: unknown; engine_outputs: unknown;
          engine_results: unknown; status: 'pending' | 'accepted' | 'rejected';
          feedback: string | null; created_at: Date; updated_at: Date;
        }>;
    const r = rows[0];
    if (!r) return null;
    return this.deserialize(r);
  }

  async updateStatus(id: string, status: 'accepted' | 'rejected', feedback?: string): Promise<void> {
    await this.db`
      UPDATE scorecards
      SET status = ${status}, feedback = ${feedback ?? null}, updated_at = now()
      WHERE id = ${id}
    `;
  }

  private deserialize(r: {
    id: string; run_id: string | null; client_id: string | null; run_type: string;
    ad_spend: number | string; billing: unknown; engine_outputs: unknown;
    engine_results: unknown; status: 'pending' | 'accepted' | 'rejected';
    feedback: string | null; created_at: Date; updated_at: Date;
  }): ScorecardDbRecord {
    return {
      id: r.id,
      run_id: r.run_id ?? undefined,
      client_id: r.client_id ?? undefined,
      run_type: r.run_type,
      ad_spend: Number(r.ad_spend),
      billing: (r.billing as Record<string, unknown>) ?? {},
      engine_outputs: (r.engine_outputs as Record<string, unknown>) ?? {},
      engine_results: (r.engine_results as Record<string, unknown>) ?? {},
      status: r.status,
      feedback: r.feedback ?? undefined,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }
}
