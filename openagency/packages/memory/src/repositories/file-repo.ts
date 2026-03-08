// ─── Delivery File Repository ────────────────────────────────────────
// PostgreSQL repository for delivery_files table (migration 005_files.sql).

import type { DeliveryFileRecord, DeliveryFileType } from '@openagency/types';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

const TTL_DAYS = 90;

function mapRow(row: Record<string, unknown>): DeliveryFileRecord {
  return {
    id: row['id'] as string,
    client_id: row['client_id'] as string,
    skill_id: row['skill_id'] as string,
    run_id: row['run_id'] as string,
    file_type: row['file_type'] as DeliveryFileType,
    file_path: row['file_path'] as string,
    size_bytes: Number(row['size_bytes'] ?? 0),
    created_at: row['created_at'] as string,
    expires_at: row['expires_at'] as string,
  };
}

export class FileRepo {
  constructor(private sql: unknown) {}

  async create(record: DeliveryFileRecord): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO delivery_files
         (id, client_id, skill_id, run_id, file_type, file_path, size_bytes, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        record.id,
        record.client_id,
        record.skill_id,
        record.run_id,
        record.file_type,
        record.file_path,
        record.size_bytes,
        record.created_at,
        record.expires_at,
      ],
    );
  }

  async get(fileId: string): Promise<DeliveryFileRecord | null> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      'SELECT * FROM delivery_files WHERE id = $1',
      [fileId],
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    return mapRow(rows[0]!);
  }

  async listByClient(
    clientId: string,
    limit = 50,
    offset = 0,
  ): Promise<DeliveryFileRecord[]> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      `SELECT * FROM delivery_files
       WHERE client_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [clientId, limit, offset],
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  }

  async listByRun(runId: string): Promise<DeliveryFileRecord[]> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      `SELECT * FROM delivery_files WHERE run_id = $1 ORDER BY created_at ASC`,
      [runId],
    )) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  }

  async delete(fileId: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe('DELETE FROM delivery_files WHERE id = $1', [fileId]);
  }

  /** Hard-delete all rows where expires_at < NOW(). Returns count deleted. */
  async deleteExpired(): Promise<number> {
    const db = this.sql as Db;
    const rows = (await db.unsafe(
      `DELETE FROM delivery_files WHERE expires_at < NOW() RETURNING id`,
    )) as Array<Record<string, unknown>>;
    return rows.length;
  }

  /** Build an expires_at value for a new file (TTL_DAYS from now). */
  static expiresAt(): string {
    const d = new Date();
    d.setDate(d.getDate() + TTL_DAYS);
    return d.toISOString();
  }
}
