// ─── Agent Memory Repository ────────────────────────────────────────
// v2: Auto-generates embeddings on store(), adds searchSimilar() for
// semantic search via pgvector cosine distance, with keyword fallback.

import { generateEmbedding } from '../vector/embeddings.js';
import { buildKeywordQuery } from '../vector/fallback.js';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export interface MemoryEntry {
  id: string;
  agent_id: string;
  content: string;
  content_type: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export class MemoryRepo {
  private hasPgVector: boolean | null = null;

  constructor(private sql: unknown) {}

  private async checkPgVector(): Promise<boolean> {
    if (this.hasPgVector !== null) return this.hasPgVector;
    try {
      const db = this.sql as Db;
      const rows = (await db.unsafe(
        "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
      )) as unknown[];
      this.hasPgVector = rows.length > 0;
    } catch {
      this.hasPgVector = false;
    }
    return this.hasPgVector;
  }

  /**
   * Store a memory entry. If pgvector is available and no embedding is
   * provided, automatically generates one via Voyage AI.
   */
  async store(entry: MemoryEntry): Promise<void> {
    const db = this.sql as Db;
    const pgvector = await this.checkPgVector();

    // Auto-generate embedding if not provided and pgvector is available
    let embedding = entry.embedding;
    if (pgvector && !embedding) {
      try {
        embedding = (await generateEmbedding(entry.content)) ?? undefined;
      } catch {
        // Non-critical — store without embedding
      }
    }

    if (pgvector && embedding) {
      // Store with vector embedding
      const embeddingStr = `[${embedding.join(',')}]`;
      await db.unsafe(
        `INSERT INTO agent_memory (id, agent_id, content, content_type, metadata, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::vector, now())`,
        [
          entry.id,
          entry.agent_id,
          entry.content,
          entry.content_type,
          JSON.stringify(entry.metadata),
          embeddingStr,
        ],
      );
    } else {
      // Store without embedding
      await db.unsafe(
        `INSERT INTO agent_memory (id, agent_id, content, content_type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [
          entry.id,
          entry.agent_id,
          entry.content,
          entry.content_type,
          JSON.stringify(entry.metadata),
        ],
      );
    }
  }

  /**
   * Search for memories similar to a query using pgvector cosine distance.
   * Falls back to keyword search if embedding generation fails,
   * and to getRecent() if keyword search yields no results.
   */
  async search(agentId: string, query: string, limit = 10): Promise<unknown[]> {
    const db = this.sql as Db;
    const pgvector = await this.checkPgVector();

    if (pgvector) {
      // Try vector similarity search
      const embedding = await generateEmbedding(query);
      if (embedding) {
        const embeddingStr = `[${embedding.join(',')}]`;
        return db.unsafe(
          `SELECT *, (embedding <=> $1::vector) AS distance
           FROM agent_memory
           WHERE agent_id = $2 AND embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector
           LIMIT $3`,
          [embeddingStr, agentId, limit],
        );
      }
    }

    // Fallback: PostgreSQL full-text search
    const tsquery = buildKeywordQuery(query);
    if (!tsquery) {
      return this.getRecent(agentId, limit);
    }
    return db.unsafe(
      `SELECT *, ts_rank(to_tsvector('english', content), to_tsquery('english', $1)) AS rank
       FROM agent_memory
       WHERE agent_id = $2
         AND to_tsvector('english', content) @@ to_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $3`,
      [tsquery, agentId, limit],
    );
  }

  /**
   * Alias for search() — semantic similarity search with fallbacks.
   * Provided as a more descriptive method name.
   */
  async searchSimilar(query: string, agentId: string, limit = 10): Promise<unknown[]> {
    return this.search(agentId, query, limit);
  }

  async getRecent(agentId: string, limit = 20): Promise<unknown[]> {
    const db = this.sql as Db;
    return db.unsafe(
      'SELECT * FROM agent_memory WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit],
    );
  }
}
