-- 019: Knowledge Base tables — folders, documents, vector chunks
-- Requires pgvector extension (already created in 003_pgvector.sql)

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Folders (hierarchical, with system folders per client) ──────────

CREATE TABLE IF NOT EXISTS kb_folders (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_folder_id TEXT REFERENCES kb_folders(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, parent_folder_id, name)
);

CREATE INDEX IF NOT EXISTS idx_kb_folders_client ON kb_folders(client_id);

-- ─── Documents (metadata + R2 pointer) ─────────────────────────────

CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES kb_folders(id) ON DELETE CASCADE,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  r2_key VARCHAR(1000) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  run_id TEXT,
  run_type VARCHAR(50),
  connector_platform VARCHAR(50),
  engine_name VARCHAR(50),
  skill_name VARCHAR(100),
  embedding_status VARCHAR(20) DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_client ON kb_documents(client_id, source_type);
CREATE INDEX IF NOT EXISTS idx_kb_documents_run ON kb_documents(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON kb_documents(embedding_status) WHERE embedding_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_kb_documents_folder ON kb_documents(folder_id);

-- ─── Chunks (text segments with vector embeddings) ─────────────────

CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1024),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_client ON kb_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document ON kb_chunks(document_id);

-- IVFFlat index for cosine similarity search
-- Note: requires at least 100 rows to be effective; falls back to sequential scan when fewer
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
