-- ─── OpenAgency Phase 3: pgvector for Semantic Memory ────────────────
-- Conditional: only runs if the vector extension is available.
-- Voyage AI voyage-3 produces 1024-dim embeddings.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS embedding vector(1024);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding
      ON agent_memory USING ivfflat (embedding vector_cosine_ops);
  END IF;
END $$;
