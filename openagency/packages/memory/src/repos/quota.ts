// ─── Quota Repository ──────────────────────────────────────────────
// Tracks monthly run quotas per agency and assistant session quotas per user.
// Quota = brand_count × 8 runs/month (4 initial + 4 optimization).
// Assistant = 10 new conversations per user per month.
// Non-accumulative, resets on 1st of each calendar month.

export interface AgencyQuotaUsageRow {
  id: string;
  agency_id: string;
  month: string;
  initial_runs_used: number;
  optimization_runs_used: number;
  extra_runs_granted: number;
  created_at: string;
  updated_at: string;
}

export interface UserAssistantUsageRow {
  id: string;
  user_id: string;
  month: string;
  sessions_used: number;
  created_at: string;
  updated_at: string;
}

export interface QuotaRequestRow {
  id: string;
  agency_id: string;
  requested_by: string;
  month: string;
  extra_runs_requested: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // Joined fields from listPendingRequests()
  agency_name?: string;
  requester_email?: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  month: string;
  reason?: string;
}

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function computeMonthlyRunLimit(brandCount: number, extraGranted: number): number {
  return (brandCount * 8) + extraGranted;
}

export function computeRunTypeLimit(brandCount: number): number {
  return brandCount * 4;
}

const ASSISTANT_SESSION_LIMIT = 10;

export class QuotaRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  // ─── Agency Run Quota ──────────────────────────────────────────

  async getOrCreateMonthlyUsage(agencyId: string, month?: string): Promise<AgencyQuotaUsageRow> {
    const m = month ?? currentMonth();
    const { ulid } = await import('ulid');
    await this.sql.unsafe(
      `INSERT INTO agency_quota_usage (id, agency_id, month)
       VALUES ($1, $2, $3)
       ON CONFLICT (agency_id, month) DO NOTHING`,
      [ulid(), agencyId, m],
    );
    const rows = await this.sql.unsafe(
      'SELECT * FROM agency_quota_usage WHERE agency_id = $1 AND month = $2',
      [agencyId, m],
    );
    const r = (rows as Array<Record<string, unknown>>)[0]!;
    return {
      id: r['id'] as string,
      agency_id: r['agency_id'] as string,
      month: r['month'] as string,
      initial_runs_used: Number(r['initial_runs_used'] ?? 0),
      optimization_runs_used: Number(r['optimization_runs_used'] ?? 0),
      extra_runs_granted: Number(r['extra_runs_granted'] ?? 0),
      created_at: String(r['created_at']),
      updated_at: String(r['updated_at']),
    };
  }

  async incrementRunUsage(agencyId: string, runType: 'initial' | 'optimization'): Promise<void> {
    const m = currentMonth();
    const { ulid } = await import('ulid');
    const col = runType === 'initial' ? 'initial_runs_used' : 'optimization_runs_used';
    await this.sql.unsafe(
      `INSERT INTO agency_quota_usage (id, agency_id, month, ${col})
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (agency_id, month) DO UPDATE SET
         ${col} = agency_quota_usage.${col} + 1,
         updated_at = now()`,
      [ulid(), agencyId, m],
    );
  }

  async checkRunQuota(
    agencyId: string,
    brandCount: number,
    runType: 'initial' | 'optimization',
  ): Promise<QuotaCheckResult> {
    const m = currentMonth();
    const usage = await this.getOrCreateMonthlyUsage(agencyId, m);
    const typeLimit = computeRunTypeLimit(brandCount);
    const totalLimit = computeMonthlyRunLimit(brandCount, usage.extra_runs_granted);
    const totalUsed = usage.initial_runs_used + usage.optimization_runs_used;
    const typeUsed = runType === 'initial' ? usage.initial_runs_used : usage.optimization_runs_used;

    // Check per-type limit
    if (typeUsed >= typeLimit) {
      return {
        allowed: false,
        used: typeUsed,
        limit: typeLimit,
        month: m,
        reason: `Monthly ${runType} run limit reached (${typeUsed}/${typeLimit})`,
      };
    }

    // Check total limit
    if (totalUsed >= totalLimit) {
      return {
        allowed: false,
        used: totalUsed,
        limit: totalLimit,
        month: m,
        reason: `Monthly total run limit reached (${totalUsed}/${totalLimit})`,
      };
    }

    return { allowed: true, used: totalUsed, limit: totalLimit, month: m };
  }

  // ─── Assistant Session Quota ───────────────────────────────────

  async getOrCreateAssistantUsage(userId: string, month?: string): Promise<UserAssistantUsageRow> {
    const m = month ?? currentMonth();
    const { ulid } = await import('ulid');
    await this.sql.unsafe(
      `INSERT INTO user_assistant_usage (id, user_id, month)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, month) DO NOTHING`,
      [ulid(), userId, m],
    );
    const rows = await this.sql.unsafe(
      'SELECT * FROM user_assistant_usage WHERE user_id = $1 AND month = $2',
      [userId, m],
    );
    const r = (rows as Array<Record<string, unknown>>)[0]!;
    return {
      id: r['id'] as string,
      user_id: r['user_id'] as string,
      month: r['month'] as string,
      sessions_used: Number(r['sessions_used'] ?? 0),
      created_at: String(r['created_at']),
      updated_at: String(r['updated_at']),
    };
  }

  async incrementAssistantUsage(userId: string): Promise<void> {
    const m = currentMonth();
    const { ulid } = await import('ulid');
    await this.sql.unsafe(
      `INSERT INTO user_assistant_usage (id, user_id, month, sessions_used)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, month) DO UPDATE SET
         sessions_used = user_assistant_usage.sessions_used + 1,
         updated_at = now()`,
      [ulid(), userId, m],
    );
  }

  async checkAssistantQuota(userId: string): Promise<QuotaCheckResult> {
    const m = currentMonth();
    const usage = await this.getOrCreateAssistantUsage(userId, m);
    if (usage.sessions_used >= ASSISTANT_SESSION_LIMIT) {
      return {
        allowed: false,
        used: usage.sessions_used,
        limit: ASSISTANT_SESSION_LIMIT,
        month: m,
        reason: `You have used all ${ASSISTANT_SESSION_LIMIT} Assistant sessions for this month`,
      };
    }
    return { allowed: true, used: usage.sessions_used, limit: ASSISTANT_SESSION_LIMIT, month: m };
  }

  // ─── Extra Run Requests ────────────────────────────────────────

  async createRequest(params: {
    agencyId: string;
    requestedBy: string;
    extraRunsRequested: number;
    reason?: string;
  }): Promise<string> {
    const { ulid } = await import('ulid');
    const id = ulid();
    await this.sql.unsafe(
      `INSERT INTO quota_requests (id, agency_id, requested_by, month, extra_runs_requested, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, params.agencyId, params.requestedBy, currentMonth(), params.extraRunsRequested, params.reason ?? null],
    );
    return id;
  }

  async listPendingRequests(): Promise<QuotaRequestRow[]> {
    const rows = await this.sql.unsafe(
      `SELECT qr.*, a.name AS agency_name, u.email AS requester_email
       FROM quota_requests qr
       JOIN agencies a ON a.id = qr.agency_id
       JOIN users u ON u.id = qr.requested_by
       WHERE qr.status = 'pending'
       ORDER BY qr.created_at DESC`,
      [],
    );
    return rows as unknown as QuotaRequestRow[];
  }

  async listRequestsByAgency(agencyId: string): Promise<QuotaRequestRow[]> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM quota_requests WHERE agency_id = $1 ORDER BY created_at DESC LIMIT 20',
      [agencyId],
    );
    return rows as unknown as QuotaRequestRow[];
  }

  async approveRequest(requestId: string, reviewerId: string, grantedRuns: number): Promise<void> {
    // Update request status
    await this.sql.unsafe(
      `UPDATE quota_requests SET status = 'approved', reviewed_by = $1, reviewed_at = now() WHERE id = $2`,
      [reviewerId, requestId],
    );
    // Get the request to know agency + month
    const rows = await this.sql.unsafe('SELECT agency_id, month FROM quota_requests WHERE id = $1', [requestId]);
    const req = (rows as Array<Record<string, unknown>>)[0];
    if (!req) return;
    // Grant extra runs
    const { ulid } = await import('ulid');
    await this.sql.unsafe(
      `INSERT INTO agency_quota_usage (id, agency_id, month, extra_runs_granted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agency_id, month) DO UPDATE SET
         extra_runs_granted = agency_quota_usage.extra_runs_granted + $4,
         updated_at = now()`,
      [ulid(), req['agency_id'], req['month'], grantedRuns],
    );
  }

  async denyRequest(requestId: string, reviewerId: string): Promise<void> {
    await this.sql.unsafe(
      `UPDATE quota_requests SET status = 'denied', reviewed_by = $1, reviewed_at = now() WHERE id = $2`,
      [reviewerId, requestId],
    );
  }

  async getRequestById(id: string): Promise<QuotaRequestRow | null> {
    const rows = await this.sql.unsafe('SELECT * FROM quota_requests WHERE id = $1', [id]);
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? (r as unknown as QuotaRequestRow) : null;
  }

  async pendingCount(): Promise<number> {
    const rows = await this.sql.unsafe(
      "SELECT COUNT(*)::int AS cnt FROM quota_requests WHERE status = 'pending'",
      [],
    );
    return Number((rows as Array<Record<string, unknown>>)[0]?.['cnt'] ?? 0);
  }
}
