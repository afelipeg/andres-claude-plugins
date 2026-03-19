// ─── Federation Log Repository ─────────────────────────────────────
// Persists A2A interaction history for the Super Admin dashboard.

export interface FederationLogRow {
  id: string;
  direction: 'inbound' | 'outbound';
  peer_url: string;
  peer_name: string | null;
  engine_id: string | null;
  skill_id: string | null;
  status: 'success' | 'failed' | 'timeout';
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export class FederationLogRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  async insert(entry: Omit<FederationLogRow, 'created_at'>): Promise<void> {
    await this.sql.unsafe(
      `INSERT INTO federation_log
        (id, direction, peer_url, peer_name, engine_id, skill_id, status, duration_ms, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.id,
        entry.direction,
        entry.peer_url,
        entry.peer_name ?? null,
        entry.engine_id ?? null,
        entry.skill_id ?? null,
        entry.status,
        entry.duration_ms ?? null,
        entry.error ?? null,
      ],
    );
  }

  async list(opts?: { limit?: number; offset?: number; direction?: string }): Promise<FederationLogRow[]> {
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;
    const parts = ['SELECT * FROM federation_log'];
    const params: unknown[] = [];

    if (opts?.direction) {
      params.push(opts.direction);
      parts.push(`WHERE direction = $${params.length}`);
    }

    parts.push('ORDER BY created_at DESC');
    params.push(limit);
    parts.push(`LIMIT $${params.length}`);
    params.push(offset);
    parts.push(`OFFSET $${params.length}`);

    const rows = await this.sql.unsafe(parts.join(' '), params);
    return rows as unknown as FederationLogRow[];
  }

  async countByDay(days = 30): Promise<Array<{ date: string; inbound: number; outbound: number }>> {
    const rows = await this.sql.unsafe(
      `SELECT created_at::date AS date,
              COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound,
              COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound
       FROM federation_log
       WHERE created_at >= CURRENT_DATE - $1::int
       GROUP BY created_at::date ORDER BY date DESC`,
      [days],
    );
    return rows as unknown as Array<{ date: string; inbound: number; outbound: number }>;
  }

  async peerSummary(): Promise<Array<{ peer_url: string; peer_name: string | null; total: number; success: number; failed: number; last_call: string }>> {
    const rows = await this.sql.unsafe(
      `SELECT peer_url, MAX(peer_name) AS peer_name,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'success')::int AS success,
              COUNT(*) FILTER (WHERE status != 'success')::int AS failed,
              MAX(created_at) AS last_call
       FROM federation_log
       GROUP BY peer_url ORDER BY total DESC`,
      [],
    );
    return rows as unknown as Array<{ peer_url: string; peer_name: string | null; total: number; success: number; failed: number; last_call: string }>;
  }
}
