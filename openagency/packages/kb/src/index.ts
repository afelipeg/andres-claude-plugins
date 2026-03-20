// ─── @openagency/kb ─────────────────────────────────────────────────
// Knowledge Base — R2 storage, folders, documents, chunks, vector search.

export {
  KBFolderRepo,
  KBDocumentRepo,
  KBChunkRepo,
  type KBFolder,
  type KBDocument,
  type KBChunk,
  type KBStats,
  type DocumentFilter,
} from './repos.js';

export {
  upload,
  download,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  deleteObject,
  listObjects,
  buildR2Key,
  type R2Config,
  type R2Object,
} from './r2-client.js';

export {
  ensureSystemFolders,
  getOrCreateRunFolder,
} from './folder-manager.js';

export {
  startAutoSaver,
  type AutoSaverDeps,
  type MeshRunLike,
  type StageResultLike,
} from './auto-saver.js';

// ─── AI Layer: Chunking, Embedding, RAG, Indexing ────────────────────

export { chunkDocument, splitByTokens, estimateTokens } from './chunker.js';
export type { Chunk } from './chunker.js';

export { embedTexts, embedQuery, EMBEDDING_DIMS } from './embedder.js';

export { searchKB } from './rag.js';
export type { RAGResult } from './rag.js';

export { enqueueIndexing, startIndexingWorker, indexDocument } from './indexer.js';
