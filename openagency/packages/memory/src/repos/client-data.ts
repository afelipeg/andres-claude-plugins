// ─── ClientDataRepo ────────────────────────────────────────────────
// PostgreSQL persistence for human-uploaded first-party batch data.
// Stores sell-in, sell-out, digital sales, platform exports per client.

import { ulid } from 'ulid';

export interface ClientDataRecord {
  id: string;
  client_id: string;
  data_type: string;
  file_name: string;
  platform: string | null;
  format: string;
  row_count: number;
  columns: string[];
  column_map: Record<string, string> | null;
  data: Record<string, unknown>[];
  summary: Record<string, unknown> | null;
  uploaded_at: string;
  expires_at: string | null;
}

interface DbRow {
  id: string;
  client_id: string;
  data_type: string;
  file_name: string;
  platform: string | null;
  format: string;
  row_count: number;
  columns: string[];
  column_map: Record<string, string> | null;
  data: Record<string, unknown>[];
  summary: Record<string, unknown> | null;
  uploaded_at: string;
  expires_at: string | null;
}

export class ClientDataRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async save(record: Omit<ClientDataRecord, 'id' | 'uploaded_at'>): Promise<ClientDataRecord> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<unknown[]> };
    const id = ulid();
    const uploadedAt = new Date().toISOString();

    await db.unsafe(
      `INSERT INTO client_data
         (id, client_id, data_type, file_name, platform, format, row_count, columns, column_map, data, summary, uploaded_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13)`,
      [
        id,
        record.client_id,
        record.data_type,
        record.file_name,
        record.platform,
        record.format,
        record.row_count,
        JSON.stringify(record.columns),
        record.column_map ? JSON.stringify(record.column_map) : null,
        JSON.stringify(record.data),
        record.summary ? JSON.stringify(record.summary) : null,
        uploadedAt,
        record.expires_at,
      ],
    );

    return { ...record, id, uploaded_at: uploadedAt };
  }

  async findById(id: string): Promise<ClientDataRecord | null> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<DbRow[]> };
    const rows = await db.unsafe('SELECT * FROM client_data WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async listByClient(clientId: string, opts?: { data_type?: string; limit?: number }): Promise<ClientDataRecord[]> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<DbRow[]> };
    const parts = ['SELECT * FROM client_data WHERE client_id = $1'];
    const params: unknown[] = [clientId];

    if (opts?.data_type) {
      params.push(opts.data_type);
      parts.push(`AND data_type = $${params.length}`);
    }

    parts.push('ORDER BY uploaded_at DESC');
    params.push(opts?.limit ?? 50);
    parts.push(`LIMIT $${params.length}`);

    return db.unsafe(parts.join(' '), params);
  }

  /** Get the latest batch data for a client, aggregated by data_type */
  async getLatestBatchContext(clientId: string): Promise<Record<string, unknown>> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<DbRow[]> };

    // Get the most recent record per data_type
    const rows = await db.unsafe(
      `SELECT DISTINCT ON (data_type) *
       FROM client_data
       WHERE client_id = $1
       ORDER BY data_type, uploaded_at DESC`,
      [clientId],
    );

    const batch: Record<string, unknown> = {};
    for (const row of rows) {
      // Use summary if available, otherwise full data
      batch[row.data_type] = row.summary ?? {
        file_name: row.file_name,
        platform: row.platform,
        row_count: row.row_count,
        columns: row.columns,
        data: row.data,
      };
    }

    return batch;
  }

  async delete(id: string): Promise<boolean> {
    const db = this.db as { unsafe: (q: string, p: unknown[]) => Promise<unknown[]> };
    const result = await db.unsafe('DELETE FROM client_data WHERE id = $1 RETURNING id', [id]);
    return (result as unknown[]).length > 0;
  }
}
