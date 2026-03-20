// ─── Knowledge Base Routes ──────────────────────────────────────────
// CRUD for folders and documents, semantic search, file upload to R2.
//
// POST   /v1/kb/folders                    — Create folder
// GET    /v1/kb/folders?client_id=         — List folders (tree)
// PATCH  /v1/kb/folders/:id                — Rename
// DELETE /v1/kb/folders/:id                — Delete + cascade R2
//
// POST   /v1/kb/documents/upload           — Multipart upload -> R2 + db row
// GET    /v1/kb/documents?client_id=       — List documents
// GET    /v1/kb/documents/:id              — Detail with chunks
// GET    /v1/kb/documents/:id/download     — 302 -> presigned R2 URL
// DELETE /v1/kb/documents/:id              — Delete doc + chunks + R2
//
// GET    /v1/kb/search?client_id=&q=       — Semantic search
// GET    /v1/kb/stats?client_id=           — Storage stats

import { Hono } from 'hono';
import type { AuthPayload } from '@openagency/types';
import type {
  KBFolderRepo,
  KBDocumentRepo,
  KBChunkRepo,
} from '@openagency/kb';
import {
  upload as r2Upload,
  deleteObject as r2Delete,
  getPresignedDownloadUrl,
  buildR2Key,
  searchKB,
  enqueueIndexing,
} from '@openagency/kb';

// Role hierarchy for RBAC checks
const ROLE_LEVELS: Record<string, number> = {
  super_admin: 100,
  admin: 90,
  agency_admin: 80,
  account_manager: 60,
  engine_user: 40,
  viewer: 20,
  readonly: 10,
  agent: 5,
};

function hasMinRole(auth: AuthPayload | undefined, minRole: string): boolean {
  if (!auth) return false;
  return (ROLE_LEVELS[auth.role] ?? 0) >= (ROLE_LEVELS[minRole] ?? 999);
}

export interface KBRouteDeps {
  folderRepo: KBFolderRepo;
  documentRepo: KBDocumentRepo;
  chunkRepo: KBChunkRepo;
  /** Raw postgres db for RAG search queries */
  db: unknown;
  /** Optional Redis for indexing queue */
  redis?: unknown;
}

export function kbRoutes(deps: KBRouteDeps): Hono {
  const { folderRepo, documentRepo, chunkRepo, db, redis } = deps;
  const app = new Hono();

  // ─── Folders ──────────────────────────────────────────────────────

  // POST /v1/kb/folders — Create folder (agency_admin+)
  app.post('/v1/kb/folders', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'agency_admin')) {
      return c.json({ error: 'forbidden', message: 'agency_admin role required' }, 403);
    }

    const body = await c.req.json<{
      client_id: string;
      agency_id?: string;
      name: string;
      parent_folder_id?: string;
    }>();

    if (!body.client_id || !body.name) {
      return c.json({ error: 'bad_request', message: 'client_id and name are required' }, 400);
    }

    try {
      const folder = await folderRepo.create({
        agency_id: body.agency_id ?? 'default',
        client_id: body.client_id,
        name: body.name,
        parent_folder_id: body.parent_folder_id ?? null,
        is_system: false,
        created_by: auth?.sub ?? null,
      });
      return c.json(folder, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return c.json({ error: 'conflict', message: 'Folder already exists at this location' }, 409);
      }
      return c.json({ error: 'internal_error', message: msg }, 500);
    }
  });

  // GET /v1/kb/folders?client_id= — List folders (viewer+)
  app.get('/v1/kb/folders', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'viewer')) {
      return c.json({ error: 'forbidden', message: 'viewer role required' }, 403);
    }

    const clientId = c.req.query('client_id');
    if (!clientId) {
      return c.json({ error: 'bad_request', message: 'client_id query param required' }, 400);
    }

    const folders = await folderRepo.listByClient(clientId);

    // Build tree structure
    const rootFolders = folders.filter((f) => !f.parent_folder_id);
    const tree = rootFolders.map((root) => ({
      ...root,
      children: folders.filter((f) => f.parent_folder_id === root.id),
    }));

    return c.json({ folders: tree });
  });

  // PATCH /v1/kb/folders/:id — Rename folder (agency_admin+)
  app.patch('/v1/kb/folders/:id', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'agency_admin')) {
      return c.json({ error: 'forbidden', message: 'agency_admin role required' }, 403);
    }

    const id = c.req.param('id');
    const body = await c.req.json<{ name: string }>();
    if (!body.name) {
      return c.json({ error: 'bad_request', message: 'name is required' }, 400);
    }

    const folder = await folderRepo.rename(id, body.name);
    if (!folder) {
      return c.json({ error: 'not_found', message: 'Folder not found or is a system folder' }, 404);
    }
    return c.json(folder);
  });

  // DELETE /v1/kb/folders/:id — Delete folder + cascade R2 objects (agency_admin+)
  app.delete('/v1/kb/folders/:id', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'agency_admin')) {
      return c.json({ error: 'forbidden', message: 'agency_admin role required' }, 403);
    }

    const id = c.req.param('id');

    // Get all documents in this folder to delete from R2
    const docs = await documentRepo.listByFolder(id, 10000);
    for (const doc of docs) {
      try {
        await r2Delete(doc.r2_key);
      } catch {
        // Best-effort R2 cleanup
      }
    }

    const deleted = await folderRepo.delete(id);
    if (!deleted) {
      return c.json({ error: 'not_found', message: 'Folder not found or is a system folder' }, 404);
    }
    return c.json({ deleted: true, documents_removed: docs.length });
  });

  // ─── Documents ────────────────────────────────────────────────────

  // POST /v1/kb/documents/upload — Multipart upload (account_manager+)
  app.post('/v1/kb/documents/upload', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'account_manager')) {
      return c.json({ error: 'forbidden', message: 'account_manager role required' }, 403);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'bad_request', message: 'Missing "file" field in multipart form data' }, 400);
    }

    const clientId = body['client_id'] as string;
    const folderId = body['folder_id'] as string;
    const agencyId = (body['agency_id'] as string) ?? 'default';
    const sourceType = (body['source_type'] as string) ?? 'manual_upload';

    if (!clientId || !folderId) {
      return c.json({ error: 'bad_request', message: 'client_id and folder_id are required' }, 400);
    }

    // Verify folder exists
    const folder = await folderRepo.findById(folderId);
    if (!folder) {
      return c.json({ error: 'not_found', message: 'Folder not found' }, 404);
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const r2Key = buildR2Key(agencyId, clientId, `uploads/${folderId}`, file.name);

      // Upload to R2
      await r2Upload(r2Key, buffer, file.type || 'application/octet-stream');

      // Create db record
      const doc = await documentRepo.create({
        folder_id: folderId,
        agency_id: agencyId,
        client_id: clientId,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: buffer.length,
        r2_key: r2Key,
        source_type: sourceType,
        created_by: auth?.sub ?? null,
      });

      // Enqueue for background indexing
      if (redis) {
        try {
          await enqueueIndexing(redis, doc.id);
        } catch {
          // Non-blocking — indexing can happen later
        }
      }

      return c.json(doc, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      return c.json({ error: 'upload_error', message: msg }, 500);
    }
  });

  // GET /v1/kb/documents?client_id=&folder_id=&source_type= — List (viewer+)
  app.get('/v1/kb/documents', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'viewer')) {
      return c.json({ error: 'forbidden', message: 'viewer role required' }, 403);
    }

    const clientId = c.req.query('client_id');
    if (!clientId) {
      return c.json({ error: 'bad_request', message: 'client_id query param required' }, 400);
    }

    const docs = await documentRepo.listByClient(clientId, {
      folder_id: c.req.query('folder_id'),
      source_type: c.req.query('source_type'),
      embedding_status: c.req.query('embedding_status'),
      limit: Number(c.req.query('limit') ?? 100),
      offset: Number(c.req.query('offset') ?? 0),
    });

    return c.json({ documents: docs, count: docs.length });
  });

  // GET /v1/kb/documents/:id — Detail with chunks (viewer+)
  app.get('/v1/kb/documents/:id', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'viewer')) {
      return c.json({ error: 'forbidden', message: 'viewer role required' }, 403);
    }

    const id = c.req.param('id');
    const doc = await documentRepo.findById(id);
    if (!doc) {
      return c.json({ error: 'not_found', message: 'Document not found' }, 404);
    }

    const chunks = await chunkRepo.listByDocumentId(id);
    return c.json({ ...doc, chunks });
  });

  // GET /v1/kb/documents/:id/download — 302 redirect to presigned R2 URL (viewer+)
  app.get('/v1/kb/documents/:id/download', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'viewer')) {
      return c.json({ error: 'forbidden', message: 'viewer role required' }, 403);
    }

    const id = c.req.param('id');
    const doc = await documentRepo.findById(id);
    if (!doc) {
      return c.json({ error: 'not_found', message: 'Document not found' }, 404);
    }

    try {
      const url = await getPresignedDownloadUrl(doc.r2_key, 3600);
      return c.redirect(url, 302);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      return c.json({ error: 'download_error', message: msg }, 500);
    }
  });

  // DELETE /v1/kb/documents/:id — Delete doc + chunks + R2 (account_manager+)
  app.delete('/v1/kb/documents/:id', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'account_manager')) {
      return c.json({ error: 'forbidden', message: 'account_manager role required' }, 403);
    }

    const id = c.req.param('id');
    const doc = await documentRepo.findById(id);
    if (!doc) {
      return c.json({ error: 'not_found', message: 'Document not found' }, 404);
    }

    // Delete from R2
    try {
      await r2Delete(doc.r2_key);
    } catch {
      // Best-effort R2 cleanup
    }

    // Delete from DB (cascade removes chunks via FK)
    await documentRepo.delete(id);
    return c.json({ deleted: true, id });
  });

  // ─── Search ───────────────────────────────────────────────────────

  // GET /v1/kb/search?client_id=&q=&limit=8 — Semantic search (viewer+)
  app.get('/v1/kb/search', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'viewer')) {
      return c.json({ error: 'forbidden', message: 'viewer role required' }, 403);
    }

    const clientId = c.req.query('client_id');
    const query = c.req.query('q');
    const limit = Number(c.req.query('limit') ?? 8);

    if (!clientId || !query) {
      return c.json({ error: 'bad_request', message: 'client_id and q query params required' }, 400);
    }

    try {
      const results = await searchKB(db, clientId, query, limit);
      return c.json({ results, query, count: results.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      return c.json({ error: 'search_error', message: msg }, 500);
    }
  });

  // ─── Stats ────────────────────────────────────────────────────────

  // GET /v1/kb/stats?client_id= — Storage stats (viewer+)
  app.get('/v1/kb/stats', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!hasMinRole(auth, 'viewer')) {
      return c.json({ error: 'forbidden', message: 'viewer role required' }, 403);
    }

    const clientId = c.req.query('client_id');
    if (!clientId) {
      return c.json({ error: 'bad_request', message: 'client_id query param required' }, 400);
    }

    const stats = await documentRepo.getStats(clientId);
    return c.json(stats);
  });

  return app;
}
