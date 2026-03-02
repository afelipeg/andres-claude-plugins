// ─── Agent Memory Repository ────────────────────────────────────────

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

  async store(entry: MemoryEntry): Promise<void> {
    const db = this.sql as Db;
    const pgvector = await this.checkPgVector();

    if (pgvector && entry.embedding) {
      // Store with vector embedding
      const embeddingStr = `[${entry.embedding.join(',')}]`;
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
           WHERE agent_id = $2
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

  async getRecent(agentId: string, limit = 20): Promise<unknown[]> {
    const db = this.sql as Db;
    return db.unsafe(
      'SELECT * FROM agent_memory WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit],
    );
  }
}
