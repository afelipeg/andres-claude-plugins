// ─── Knowledge Base Repositories ────────────────────────────────────
// PostgreSQL repos for kb_folders, kb_documents, kb_chunks.
// Uses porsager/postgres tagged-template pattern (db typed as unknown).

import { ulid } from 'ulid';

// ─── Types ──────────────────────────────────────────────────────────

export interface KBFolder {
  id: string;
  agency_id: string;
  client_id: string;
  name: string;
  parent_folder_id: string | null;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KBDocument {
  id: string;
  folder_id: string;
  agency_id: string;
  client_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  r2_key: string;
  source_type: string;
  run_id: string | null;
  run_type: string | null;
  connector_platform: string | null;
  engine_name: string | null;
  skill_name: string | null;
  embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KBChunk {
  id: string;
  document_id: string;
  client_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KBStats {
  total_documents: number;
  total_chunks: number;
  indexed_pct: number;
  total_size_bytes: number;
}

export interface DocumentFilter {
  folder_id?: string;
  source_type?: string;
  embedding_status?: string;
  limit?: number;
  offset?: number;
}

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

// ─── Row mappers ────────────────────────────────────────────────────

function mapFolder(r: Record<string, unknown>): KBFolder {
  return {
    id: r['id'] as string,
    agency_id: r['agency_id'] as string,
    client_id: r['client_id'] as string,
    name: r['name'] as string,
    parent_folder_id: (r['parent_folder_id'] as string) ?? null,
    is_system: Boolean(r['is_system']),
    created_by: (r['created_by'] as string) ?? null,
    created_at: String(r['created_at']),
    updated_at: String(r['updated_at']),
  };
}

function mapDocument(r: Record<string, unknown>): KBDocument {
  return {
    id: r['id'] as string,
    folder_id: r['folder_id'] as string,
    agency_id: r['agency_id'] as string,
    client_id: r['client_id'] as string,
    filename: r['filename'] as string,
    mime_type: (r['mime_type'] as string) ?? null,
    size_bytes: r['size_bytes'] != null ? Number(r['size_bytes']) : null,
    r2_key: r['r2_key'] as string,
    source_type: r['source_type'] as string,
    run_id: (r['run_id'] as string) ?? null,
    run_type: (r['run_type'] as string) ?? null,
    connector_platform: (r['connector_platform'] as string) ?? null,
    engine_name: (r['engine_name'] as string) ?? null,
    skill_name: (r['skill_name'] as string) ?? null,
    embedding_status: (r['embedding_status'] as KBDocument['embedding_status']) ?? 'pending',
    chunk_count: Number(r['chunk_count'] ?? 0),
    metadata: (r['metadata'] as Record<string, unknown>) ?? {},
    created_by: (r['created_by'] as string) ?? null,
    created_at: String(r['created_at']),
    updated_at: String(r['updated_at']),
  };
}

function mapChunk(r: Record<string, unknown>): KBChunk {
  return {
    id: r['id'] as string,
    document_id: r['document_id'] as string,
    client_id: r['client_id'] as string,
    chunk_index: Number(r['chunk_index']),
    content: r['content'] as string,
    token_count: r['token_count'] != null ? Number(r['token_count']) : null,
    embedding: (r['embedding'] as number[]) ?? null,
    metadata: (r['metadata'] as Record<string, unknown>) ?? {},
    created_at: String(r['created_at']),
  };
}

// ═══════════════════════════════════════════════════════════════════
// KBFolderRepo
// ═══════════════════════════════════════════════════════════════════

export class KBFolderRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  async create(folder: {
    agency_id: string;
    client_id: string;
    name: string;
    parent_folder_id?: string | null;
    is_system?: boolean;
    created_by?: string | null;
  }): Promise<KBFolder> {
    const id = ulid();
    const rows = await this.sql.unsafe(
      `INSERT INTO kb_folders (id, agency_id, client_id, name, parent_folder_id, is_system, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        folder.agency_id,
        folder.client_id,
        folder.name,
        folder.parent_folder_id ?? null,
        folder.is_system ?? false,
        folder.created_by ?? null,
      ],
    );
    return mapFolder((rows as Array<Record<string, unknown>>)[0]);
  }

  async findById(id: string): Promise<KBFolder | null> {
    const rows = await this.sql.unsafe('SELECT * FROM kb_folders WHERE id = $1', [id]);
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapFolder(r) : null;
  }

  async listByClient(clientId: string): Promise<KBFolder[]> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM kb_folders WHERE client_id = $1 ORDER BY is_system DESC, name ASC',
      [clientId],
    );
    return (rows as Array<Record<string, unknown>>).map(mapFolder);
  }

  async rename(id: string, name: string): Promise<KBFolder | null> {
    const rows = await this.sql.unsafe(
      `UPDATE kb_folders SET name = $1, updated_at = NOW() WHERE id = $2 AND is_system = false RETURNING *`,
      [name, id],
    );
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapFolder(r) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.sql.unsafe(
      'DELETE FROM kb_folders WHERE id = $1 AND is_system = false RETURNING id',
      [id],
    );
    return (rows as unknown[]).length > 0;
  }

  /**
   * Find a system folder by name for a given client.
   */
  async findSystemFolder(clientId: string, name: string): Promise<KBFolder | null> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM kb_folders WHERE client_id = $1 AND name = $2 AND is_system = true AND parent_folder_id IS NULL',
      [clientId, name],
    );
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapFolder(r) : null;
  }

  /**
   * Create 4 system folders idempotently.
   */
  async ensureSystemFolders(agencyId: string, clientId: string): Promise<KBFolder[]> {
    const names = ['Engine Outputs', 'External Reports', 'Uploads', 'Benchmarks'];
    const results: KBFolder[] = [];

    for (const name of names) {
      const existing = await this.findSystemFolder(clientId, name);
      if (existing) {
        results.push(existing);
      } else {
        const folder = await this.create({
          agency_id: agencyId,
          client_id: clientId,
          name,
          parent_folder_id: null,
          is_system: true,
        });
        results.push(folder);
      }
    }

    return results;
  }
}

// ═══════════════════════════════════════════════════════════════════
// KBDocumentRepo
// ═══════════════════════════════════════════════════════════════════

export class KBDocumentRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  async create(doc: {
    folder_id: string;
    agency_id: string;
    client_id: string;
    filename: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    r2_key: string;
    source_type: string;
    run_id?: string | null;
    run_type?: string | null;
    connector_platform?: string | null;
    engine_name?: string | null;
    skill_name?: string | null;
    metadata?: Record<string, unknown>;
    created_by?: string | null;
  }): Promise<KBDocument> {
    const id = ulid();
    const rows = await this.sql.unsafe(
      `INSERT INTO kb_documents (id, folder_id, agency_id, client_id, filename, mime_type, size_bytes, r2_key, source_type, run_id, run_type, connector_platform, engine_name, skill_name, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        id,
        doc.folder_id,
        doc.agency_id,
        doc.client_id,
        doc.filename,
        doc.mime_type ?? null,
        doc.size_bytes ?? null,
        doc.r2_key,
        doc.source_type,
        doc.run_id ?? null,
        doc.run_type ?? null,
        doc.connector_platform ?? null,
        doc.engine_name ?? null,
        doc.skill_name ?? null,
        JSON.stringify(doc.metadata ?? {}),
        doc.created_by ?? null,
      ],
    );
    return mapDocument((rows as Array<Record<string, unknown>>)[0]);
  }

  async findById(id: string): Promise<KBDocument | null> {
    const rows = await this.sql.unsafe('SELECT * FROM kb_documents WHERE id = $1', [id]);
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapDocument(r) : null;
  }

  async listByFolder(folderId: string, limit = 100, offset = 0): Promise<KBDocument[]> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM kb_documents WHERE folder_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [folderId, limit, offset],
    );
    return (rows as Array<Record<string, unknown>>).map(mapDocument);
  }

  async listByClient(clientId: string, filters?: DocumentFilter): Promise<KBDocument[]> {
    let query = 'SELECT * FROM kb_documents WHERE client_id = $1';
    const params: unknown[] = [clientId];
    let idx = 2;

    if (filters?.folder_id) {
      query += ` AND folder_id = $${idx++}`;
      params.push(filters.folder_id);
    }
    if (filters?.source_type) {
      query += ` AND source_type = $${idx++}`;
      params.push(filters.source_type);
    }
    if (filters?.embedding_status) {
      query += ` AND embedding_status = $${idx++}`;
      params.push(filters.embedding_status);
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${idx++}`;
    params.push(filters?.limit ?? 100);
    query += ` OFFSET $${idx++}`;
    params.push(filters?.offset ?? 0);

    const rows = await this.sql.unsafe(query, params);
    return (rows as Array<Record<string, unknown>>).map(mapDocument);
  }

  async delete(id: string): Promise<KBDocument | null> {
    const rows = await this.sql.unsafe(
      'DELETE FROM kb_documents WHERE id = $1 RETURNING *',
      [id],
    );
    const r = (rows as Array<Record<string, unknown>>)[0];
    return r ? mapDocument(r) : null;
  }

  async updateEmbeddingStatus(
    id: string,
    status: KBDocument['embedding_status'],
    chunkCount?: number,
  ): Promise<void> {
    if (chunkCount !== undefined) {
      await this.sql.unsafe(
        'UPDATE kb_documents SET embedding_status = $1, chunk_count = $2, updated_at = NOW() WHERE id = $3',
        [status, chunkCount, id],
      );
    } else {
      await this.sql.unsafe(
        'UPDATE kb_documents SET embedding_status = $1, updated_at = NOW() WHERE id = $2',
        [status, id],
      );
    }
  }

  async getByRunId(runId: string): Promise<KBDocument[]> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM kb_documents WHERE run_id = $1 ORDER BY created_at ASC',
      [runId],
    );
    return (rows as Array<Record<string, unknown>>).map(mapDocument);
  }

  async getStats(clientId: string): Promise<KBStats> {
    const rows = await this.sql.unsafe(
      `SELECT
         COUNT(*)::int AS total_documents,
         COALESCE(SUM(chunk_count), 0)::int AS total_chunks,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(COUNT(*) FILTER (WHERE embedding_status = 'completed')::numeric / COUNT(*)::numeric * 100, 1)
         END AS indexed_pct,
         COALESCE(SUM(size_bytes), 0)::bigint AS total_size_bytes
       FROM kb_documents
       WHERE client_id = $1`,
      [clientId],
    );
    const r = (rows as Array<Record<string, unknown>>)[0] ?? {};
    return {
      total_documents: Number(r['total_documents'] ?? 0),
      total_chunks: Number(r['total_chunks'] ?? 0),
      indexed_pct: Number(r['indexed_pct'] ?? 0),
      total_size_bytes: Number(r['total_size_bytes'] ?? 0),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// KBChunkRepo
// ═══════════════════════════════════════════════════════════════════

export class KBChunkRepo {
  constructor(private db: unknown) {}

  private get sql(): Db {
    return this.db as Db;
  }

  /**
   * Bulk insert chunks with optional embeddings.
   */
  async insertBatch(
    chunks: Array<{
      document_id: string;
      client_id: string;
      chunk_index: number;
      content: string;
      token_count?: number | null;
      embedding?: number[] | null;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Build a multi-row INSERT for performance
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const chunk of chunks) {
      const id = ulid();
      const embeddingStr = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::vector, $${idx++}::jsonb)`,
      );
      values.push(
        id,
        chunk.document_id,
        chunk.client_id,
        chunk.chunk_index,
        chunk.content,
        chunk.token_count ?? null,
        embeddingStr,
        JSON.stringify(chunk.metadata ?? {}),
      );
    }

    await this.sql.unsafe(
      `INSERT INTO kb_chunks (id, document_id, client_id, chunk_index, content, token_count, embedding, metadata)
       VALUES ${placeholders.join(', ')}`,
      values,
    );
  }

  /**
   * Delete all chunks for a document.
   */
  async deleteByDocumentId(documentId: string): Promise<number> {
    const rows = await this.sql.unsafe(
      'DELETE FROM kb_chunks WHERE document_id = $1 RETURNING id',
      [documentId],
    );
    return (rows as unknown[]).length;
  }

  /**
   * Semantic similarity search using cosine distance (<=>).
   */
  async searchSimilar(
    clientId: string,
    embedding: number[],
    limit = 8,
  ): Promise<Array<KBChunk & { similarity: number }>> {
    const embeddingStr = `[${embedding.join(',')}]`;
    const rows = await this.sql.unsafe(
      `SELECT *,
              1 - (embedding <=> $1::vector) AS similarity
       FROM kb_chunks
       WHERE client_id = $2
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [embeddingStr, clientId, limit],
    );
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      ...mapChunk(r),
      similarity: Number(r['similarity'] ?? 0),
    }));
  }

  /**
   * List chunks for a document.
   */
  async listByDocumentId(documentId: string): Promise<KBChunk[]> {
    const rows = await this.sql.unsafe(
      'SELECT * FROM kb_chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [documentId],
    );
    return (rows as Array<Record<string, unknown>>).map(mapChunk);
  }
}
