// ─── AuditLogRepo ─────────────────────────────────────────────────────
// Records admin actions (impersonation, deletions, etc.) for compliance.

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at?: string;
}

export class AuditLogRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async log(entry: AuditLogEntry): Promise<void> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<unknown[]> };
    await db.unsafe(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::timestamptz, NOW()))`,
      [
        entry.id,
        entry.actor_id,
        entry.action,
        entry.target_type ?? null,
        entry.target_id ?? null,
        JSON.stringify(entry.details ?? {}),
        entry.ip_address ?? null,
        entry.created_at ?? null,
      ],
    );
  }

  async list(opts?: { actor_id?: string; action?: string; limit?: number }): Promise<AuditLogEntry[]> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<AuditLogEntry[]> };
    const parts: string[] = ['SELECT * FROM audit_log'];
    const params: unknown[] = [];
    const where: string[] = [];

    if (opts?.actor_id) {
      params.push(opts.actor_id);
      where.push(`actor_id = $${params.length}`);
    }
    if (opts?.action) {
      params.push(opts.action);
      where.push(`action = $${params.length}`);
    }
    if (where.length) parts.push('WHERE ' + where.join(' AND '));

    parts.push('ORDER BY created_at DESC');
    params.push(opts?.limit ?? 100);
    parts.push(`LIMIT $${params.length}`);

    return db.unsafe(parts.join(' '), params);
  }
}
