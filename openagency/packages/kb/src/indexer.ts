// ─── KB Indexing Worker ──────────────────────────────────────────────
// Redis-based job queue for chunking + embedding documents.
// BLPOP loop: fetch document -> chunk -> embed -> store in kb_chunks.

import { chunkDocument } from './chunker.js';
import { embedTexts } from './embedder.js';

const QUEUE_KEY = 'kb:indexing:queue';
const BLPOP_TIMEOUT = 5; // seconds

// Simple ULID generator (avoid external dep issues — ulid is already in package.json)
function makeId(): string {
  const ts = Date.now().toString(36).padStart(10, '0');
  const rand = Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('');
  return (ts + rand).toUpperCase().slice(0, 26);
}

// Type for porsager/postgres sql
type SqlFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<Record<string, unknown>>>;

// Minimal R2/S3 client interface (duck-typed)
interface R2ClientLike {
  getObject(key: string): Promise<{ body: ArrayBuffer | Uint8Array | string } | null>;
}

// Minimal Redis interface (ioredis)
interface RedisLike {
  lpush(key: string, ...values: string[]): Promise<number>;
  blpop(key: string, timeout: number): Promise<[string, string] | null>;
}

interface DocumentRow {
  id: string;
  client_id: string;
  filename: string;
  source_type: string;
  r2_key: string | null;
  content_inline: string | null;
  metadata: Record<string, unknown> | string | null;
  run_id: string | null;
}

// ─── Enqueue ─────────────────────────────────────────────────────────

/**
 * Push a document ID onto the indexing queue.
 */
export async function enqueueIndexing(
  redis: unknown,
  documentId: string,
): Promise<void> {
  const r = redis as RedisLike;
  await r.lpush(QUEUE_KEY, documentId);
}

// ─── Worker ──────────────────────────────────────────────────────────

/**
 * Start a BLPOP loop that processes indexing jobs.
 * Runs indefinitely until the process exits.
 */
export async function startIndexingWorker(
  redis: unknown,
  db: unknown,
  r2Client: unknown,
): Promise<void> {
  const r = redis as RedisLike;
  const sql = db as SqlFn;
  const r2 = r2Client as R2ClientLike | null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const item = await r.blpop(QUEUE_KEY, BLPOP_TIMEOUT);
      if (!item) continue; // timeout, loop again

      const documentId = item[1];
      await indexDocument(sql, r2, documentId);
    } catch (err) {
      // Log but don't crash the worker
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[kb:indexer] Worker error: ${msg}`);
      // Brief pause before retrying to avoid tight error loops
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// ─── Single document indexer ─────────────────────────────────────────

/**
 * Index a single document by ID. Can be called directly (bypassing Redis queue).
 */
export async function indexDocument(
  db: unknown,
  r2Client: unknown,
  documentId: string,
): Promise<void> {
  const sql = db as SqlFn;
  const r2 = r2Client as R2ClientLike | null;

  // 1. Fetch document row
  const rawRows = await sql`
    SELECT id, client_id, filename, source_type, r2_key, content_inline, metadata, run_id
    FROM kb_documents
    WHERE id = ${documentId}
  `;

  if (rawRows.length === 0) {
    console.warn(`[kb:indexer] Document not found: ${documentId}`);
    return;
  }

  const doc = rawRows[0] as unknown as DocumentRow;

  try {
    // 2. Get content (inline or from R2)
    let rawContent: string;

    if (doc.content_inline) {
      rawContent = doc.content_inline;
    } else if (doc.r2_key && r2) {
      const obj = await r2.getObject(doc.r2_key);
      if (!obj) {
        throw new Error(`R2 object not found: ${doc.r2_key}`);
      }
      if (typeof obj.body === 'string') {
        rawContent = obj.body;
      } else {
        const decoder = new TextDecoder();
        rawContent = decoder.decode(obj.body);
      }
    } else {
      throw new Error('No content_inline and no r2_key/r2Client');
    }

    // 3. Parse metadata
    const metadata = parseMetadata(doc.metadata);

    // 4. Determine content type and parse if JSON
    let content: string | Record<string, unknown> = rawContent;
    if (
      doc.source_type === 'engine_output' ||
      doc.source_type === 'benchmark_snapshot'
    ) {
      try {
        content = JSON.parse(rawContent) as Record<string, unknown>;
      } catch {
        // Not valid JSON — use as string
      }
    }

    // 5. Chunk
    const chunks = chunkDocument(content, doc.source_type, {
      ...metadata,
      filename: doc.filename,
      document_id: doc.id,
      client_id: doc.client_id,
      run_id: doc.run_id,
    });

    if (chunks.length === 0) {
      await sql`
        UPDATE kb_documents
        SET embedding_status = 'indexed', chunk_count = 0, indexed_at = NOW()
        WHERE id = ${documentId}
      `;
      return;
    }

    // 6. Embed all chunk texts
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedTexts(texts);

    // 7. Insert chunks into kb_chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i];
      const chunkId = makeId();

      // If embedding is empty (no API key), store NULL
      const hasEmbedding = embedding && embedding.length > 0;
      const vectorStr = hasEmbedding ? `[${embedding.join(',')}]` : null;

      if (vectorStr) {
        await sql`
          INSERT INTO kb_chunks (id, document_id, chunk_index, content, token_count, metadata, embedding)
          VALUES (
            ${chunkId},
            ${documentId},
            ${chunk.chunk_index},
            ${chunk.content},
            ${chunk.token_count},
            ${JSON.stringify(chunk.metadata)},
            ${vectorStr}::vector
          )
        `;
      } else {
        await sql`
          INSERT INTO kb_chunks (id, document_id, chunk_index, content, token_count, metadata)
          VALUES (
            ${chunkId},
            ${documentId},
            ${chunk.chunk_index},
            ${chunk.content},
            ${chunk.token_count},
            ${JSON.stringify(chunk.metadata)}
          )
        `;
      }
    }

    // 8. Update document status
    await sql`
      UPDATE kb_documents
      SET embedding_status = 'indexed', chunk_count = ${chunks.length}, indexed_at = NOW()
      WHERE id = ${documentId}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[kb:indexer] Failed to index ${documentId}: ${msg}`);

    await sql`
      UPDATE kb_documents
      SET embedding_status = 'failed', error_message = ${msg}
      WHERE id = ${documentId}
    `.catch(() => {});
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseMetadata(
  raw: Record<string, unknown> | string | null,
): Record<string, unknown> {
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
