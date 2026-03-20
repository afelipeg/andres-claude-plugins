// ─── RAG Search ──────────────────────────────────────────────────────
// Vector similarity search over kb_chunks + kb_documents.
// Falls back to ILIKE text search when embedding fails.

import { embedQuery } from './embedder.js';

export interface RAGResult {
  document_id: string;
  filename: string;
  source_type: string;
  run_id?: string;
  date: string;
  relevance: number;
  snippet: string;
  metadata: Record<string, unknown>;
}

// Type for the postgres sql tagged template (porsager/postgres)
type SqlFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<Record<string, unknown>>>;

interface VectorRow {
  chunk_id: string;
  document_id: string;
  content: string;
  chunk_metadata: Record<string, unknown> | string | null;
  distance: number;
  filename: string;
  source_type: string;
  run_id: string | null;
  created_at: string;
}

interface TextRow {
  chunk_id: string;
  document_id: string;
  content: string;
  chunk_metadata: Record<string, unknown> | string | null;
  filename: string;
  source_type: string;
  run_id: string | null;
  created_at: string;
}

/**
 * Search the knowledge base for documents relevant to a query.
 *
 * @param db - postgres sql instance (porsager/postgres)
 * @param clientId - brand/client ID to scope the search
 * @param query - natural language search query
 * @param limit - max results (default 8)
 */
export async function searchKB(
  db: unknown,
  clientId: string,
  query: string,
  limit: number = 8,
): Promise<RAGResult[]> {
  const sql = db as SqlFn;

  // Try vector search first
  try {
    const queryEmbedding = await embedQuery(query);

    if (queryEmbedding.length > 0) {
      return await vectorSearch(sql, clientId, queryEmbedding, limit);
    }
  } catch {
    // Fall through to text search
  }

  // Fallback: text search
  return textSearch(sql, clientId, query, limit);
}

// ─── Vector similarity search (pgvector cosine) ─────────────────────

async function vectorSearch(
  sql: SqlFn,
  clientId: string,
  embedding: number[],
  limit: number,
): Promise<RAGResult[]> {
  const vectorStr = `[${embedding.join(',')}]`;

  const rows = (await sql`
    SELECT
      c.id          AS chunk_id,
      c.document_id,
      c.content,
      c.metadata    AS chunk_metadata,
      c.embedding <=> ${vectorStr}::vector AS distance,
      d.filename,
      d.source_type,
      d.run_id,
      d.created_at
    FROM kb_chunks c
    JOIN kb_documents d ON d.id = c.document_id
    WHERE d.client_id = ${clientId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `) as unknown as VectorRow[];

  return rows.map((row) => ({
    document_id: row.document_id,
    filename: row.filename,
    source_type: row.source_type,
    run_id: row.run_id ?? undefined,
    date: row.created_at,
    relevance: Math.max(0, 1 - row.distance), // cosine similarity = 1 - cosine distance
    snippet: row.content.slice(0, 1000),
    metadata: parseMetadata(row.chunk_metadata),
  }));
}

// ─── Text search fallback (ILIKE) ────────────────────────────────────

async function textSearch(
  sql: SqlFn,
  clientId: string,
  query: string,
  limit: number,
): Promise<RAGResult[]> {
  // Sanitize query for ILIKE (escape % and _)
  const safeQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');

  const rows = (await sql`
    SELECT
      c.id          AS chunk_id,
      c.document_id,
      c.content,
      c.metadata    AS chunk_metadata,
      d.filename,
      d.source_type,
      d.run_id,
      d.created_at
    FROM kb_chunks c
    JOIN kb_documents d ON d.id = c.document_id
    WHERE d.client_id = ${clientId}
      AND c.content ILIKE ${'%' + safeQuery + '%'}
    ORDER BY d.created_at DESC
    LIMIT ${limit}
  `) as unknown as TextRow[];

  return rows.map((row, i) => ({
    document_id: row.document_id,
    filename: row.filename,
    source_type: row.source_type,
    run_id: row.run_id ?? undefined,
    date: row.created_at,
    relevance: 0.5 - i * 0.02, // Decreasing relevance for text matches
    snippet: row.content.slice(0, 1000),
    metadata: parseMetadata(row.chunk_metadata),
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseMetadata(raw: Record<string, unknown> | string | null): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
}
