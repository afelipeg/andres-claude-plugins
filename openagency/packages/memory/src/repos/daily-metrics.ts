// ─── Daily Metrics Repository ──────────────────────────────────────
// Persists aggregated daily metrics for the Super Admin dashboard.
// Uses ON CONFLICT upsert to accumulate counters throughout the day.

export interface DailyMetricRow {
  id: string;
  date: string;
  agency_id: string | null;
  model: string | null;
  engine_id: string | null;
  tokens_prompt: number;
  tokens_completion: number;
  llm_cost_usd: number;
  runs_started: number;
  runs_completed: number;
  runs_failed: number;
  skills_invoked: number;
  a2a_calls: number;
  mcp_calls: number;
  outcome_fees_usd: number;
  created_at: string;
}

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export class DailyMetricsRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  /** Upsert: increment counters for a given (date, agency, model, engine) tuple */
  async increment(params: {
    date: string;
    agency_id?: string;
    model?: string;
    engine_id?: string;
    tokens_prompt?: number;
    tokens_completion?: number;
    llm_cost_usd?: number;
    runs_started?: number;
    runs_completed?: number;
    runs_failed?: number;
    skills_invoked?: number;
    a2a_calls?: number;
    mcp_calls?: number;
    outcome_fees_usd?: number;
  }): Promise<void> {
    const { ulid } = await import('ulid');
    await this.sql.unsafe(
      `INSERT INTO daily_metrics
        (id, date, agency_id, model, engine_id,
         tokens_prompt, tokens_completion, llm_cost_usd,
         runs_started, runs_completed, runs_failed,
         skills_invoked, a2a_calls, mcp_calls, outcome_fees_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (date, agency_id, model, engine_id) DO UPDATE SET
         tokens_prompt     = daily_metrics.tokens_prompt     + EXCLUDED.tokens_prompt,
         tokens_completion = daily_metrics.tokens_completion + EXCLUDED.tokens_completion,
         llm_cost_usd      = daily_metrics.llm_cost_usd      + EXCLUDED.llm_cost_usd,
         runs_started      = daily_metrics.runs_started      + EXCLUDED.runs_started,
         runs_completed    = daily_metrics.runs_completed    + EXCLUDED.runs_completed,
         runs_failed       = daily_metrics.runs_failed       + EXCLUDED.runs_failed,
         skills_invoked    = daily_metrics.skills_invoked    + EXCLUDED.skills_invoked,
         a2a_calls         = daily_metrics.a2a_calls         + EXCLUDED.a2a_calls,
         mcp_calls         = daily_metrics.mcp_calls         + EXCLUDED.mcp_calls,
         outcome_fees_usd  = daily_metrics.outcome_fees_usd  + EXCLUDED.outcome_fees_usd`,
      [
        ulid(),
        params.date,
        params.agency_id ?? null,
        params.model ?? null,
        params.engine_id ?? null,
        params.tokens_prompt ?? 0,
        params.tokens_completion ?? 0,
        params.llm_cost_usd ?? 0,
        params.runs_started ?? 0,
        params.runs_completed ?? 0,
        params.runs_failed ?? 0,
        params.skills_invoked ?? 0,
        params.a2a_calls ?? 0,
        params.mcp_calls ?? 0,
        params.outcome_fees_usd ?? 0,
      ],
    );
  }

  /** Aggregate by day for a date range */
  async byDay(days = 30): Promise<DailyMetricRow[]> {
    const rows = await this.sql.unsafe(
      `SELECT date,
              SUM(tokens_prompt)::int AS tokens_prompt,
              SUM(tokens_completion)::int AS tokens_completion,
              SUM(llm_cost_usd)::numeric AS llm_cost_usd,
              SUM(runs_started)::int AS runs_started,
              SUM(runs_completed)::int AS runs_completed,
              SUM(runs_failed)::int AS runs_failed,
              SUM(skills_invoked)::int AS skills_invoked,
              SUM(a2a_calls)::int AS a2a_calls,
              SUM(mcp_calls)::int AS mcp_calls,
              SUM(outcome_fees_usd)::numeric AS outcome_fees_usd
       FROM daily_metrics
       WHERE date >= CURRENT_DATE - $1::int
       GROUP BY date ORDER BY date DESC`,
      [days],
    );
    return rows as unknown as DailyMetricRow[];
  }

  /** Aggregate by agency */
  async byAgency(days = 30): Promise<Array<{ agency_id: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number; runs_completed: number; outcome_fees_usd: number }>> {
    const rows = await this.sql.unsafe(
      `SELECT agency_id,
              SUM(tokens_prompt)::int AS tokens_prompt,
              SUM(tokens_completion)::int AS tokens_completion,
              SUM(llm_cost_usd)::numeric AS llm_cost_usd,
              SUM(runs_completed)::int AS runs_completed,
              SUM(outcome_fees_usd)::numeric AS outcome_fees_usd
       FROM daily_metrics
       WHERE date >= CURRENT_DATE - $1::int AND agency_id IS NOT NULL
       GROUP BY agency_id ORDER BY llm_cost_usd DESC`,
      [days],
    );
    return rows as unknown as Array<{ agency_id: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number; runs_completed: number; outcome_fees_usd: number }>;
  }

  /** Aggregate by model */
  async byModel(days = 30): Promise<Array<{ model: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number }>> {
    const rows = await this.sql.unsafe(
      `SELECT model,
              SUM(tokens_prompt)::int AS tokens_prompt,
              SUM(tokens_completion)::int AS tokens_completion,
              SUM(llm_cost_usd)::numeric AS llm_cost_usd
       FROM daily_metrics
       WHERE date >= CURRENT_DATE - $1::int AND model IS NOT NULL
       GROUP BY model ORDER BY llm_cost_usd DESC`,
      [days],
    );
    return rows as unknown as Array<{ model: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number }>;
  }

  /** Aggregate by engine */
  async byEngine(days = 30): Promise<Array<{ engine_id: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number; skills_invoked: number }>> {
    const rows = await this.sql.unsafe(
      `SELECT engine_id,
              SUM(tokens_prompt)::int AS tokens_prompt,
              SUM(tokens_completion)::int AS tokens_completion,
              SUM(llm_cost_usd)::numeric AS llm_cost_usd,
              SUM(skills_invoked)::int AS skills_invoked
       FROM daily_metrics
       WHERE date >= CURRENT_DATE - $1::int AND engine_id IS NOT NULL
       GROUP BY engine_id ORDER BY llm_cost_usd DESC`,
      [days],
    );
    return rows as unknown as Array<{ engine_id: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number; skills_invoked: number }>;
  }

  /** MTD totals (current month) */
  async mtdTotals(): Promise<{
    llm_cost_usd: number;
    outcome_fees_usd: number;
    runs_completed: number;
    a2a_calls: number;
    tokens_prompt: number;
    tokens_completion: number;
  }> {
    const rows = await this.sql.unsafe(
      `SELECT COALESCE(SUM(llm_cost_usd), 0)::numeric AS llm_cost_usd,
              COALESCE(SUM(outcome_fees_usd), 0)::numeric AS outcome_fees_usd,
              COALESCE(SUM(runs_completed), 0)::int AS runs_completed,
              COALESCE(SUM(a2a_calls), 0)::int AS a2a_calls,
              COALESCE(SUM(tokens_prompt), 0)::int AS tokens_prompt,
              COALESCE(SUM(tokens_completion), 0)::int AS tokens_completion
       FROM daily_metrics
       WHERE date >= date_trunc('month', CURRENT_DATE)`,
      [],
    );
    const r = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};
    return {
      llm_cost_usd: Number(r['llm_cost_usd'] ?? 0),
      outcome_fees_usd: Number(r['outcome_fees_usd'] ?? 0),
      runs_completed: Number(r['runs_completed'] ?? 0),
      a2a_calls: Number(r['a2a_calls'] ?? 0),
      tokens_prompt: Number(r['tokens_prompt'] ?? 0),
      tokens_completion: Number(r['tokens_completion'] ?? 0),
    };
  }

  /** Today's run counts */
  async todayRuns(): Promise<{ started: number; completed: number; failed: number }> {
    const rows = await this.sql.unsafe(
      `SELECT COALESCE(SUM(runs_started), 0)::int AS started,
              COALESCE(SUM(runs_completed), 0)::int AS completed,
              COALESCE(SUM(runs_failed), 0)::int AS failed
       FROM daily_metrics
       WHERE date = CURRENT_DATE`,
      [],
    );
    const r = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};
    return {
      started: Number(r['started'] ?? 0),
      completed: Number(r['completed'] ?? 0),
      failed: Number(r['failed'] ?? 0),
    };
  }
}
