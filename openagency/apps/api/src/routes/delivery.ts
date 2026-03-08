// ─── Delivery Engine REST Routes ─────────────────────────────────────
// POST /v1/engines/delivery/skills/:skillId  — run a delivery skill
// GET  /v1/delivery/files                    — list files for a client
// GET  /v1/delivery/files/:fileId/download   — download file
// DELETE /v1/delivery/files/:fileId          — delete file

import { Hono } from 'hono';
import type { OpenAgency } from '@openagency/core';
import type { DeliverySkillOutput, DeliveryFileOutput } from '@openagency/types';
import { createFileStorage } from '@openagency/engines';
import type { FileRepo } from '@openagency/memory';

// Lazy storage singleton — created on first request
let _storage: ReturnType<typeof createFileStorage> | null = null;
function getStorage() {
  if (!_storage) _storage = createFileStorage();
  return _storage;
}

export function deliveryRoutes(agency: OpenAgency, fileRepo: FileRepo | null) {
  const app = new Hono();

  // ─── Execute delivery skill ──────────────────────────────────────
  app.post('/v1/engines/delivery/skills/:skillId', async (c) => {
    const skillId = c.req.param('skillId');
    let body: Record<string, unknown>;
    try {
      body = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json({ error: 'invalid_json', message: 'Request body must be valid JSON' }, 400);
    }

    try {
      const result = await agency.run('delivery', skillId, body) as unknown as DeliverySkillOutput;
      return c.json(result, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'skill_failed', message }, 500);
    }
  });

  // ─── List delivery files ─────────────────────────────────────────
  app.get('/v1/delivery/files', async (c) => {
    const clientId = c.req.query('client_id');
    const runId = c.req.query('run_id');

    if (!fileRepo) {
      return c.json({ files: [], total: 0, note: 'No database connected' });
    }

    try {
      const records = runId
        ? await fileRepo.listByRun(runId)
        : clientId
          ? await fileRepo.listByClient(clientId)
          : [];

      const storage = getStorage();
      const files: DeliveryFileOutput[] = records.map((r) => ({
        file_id: r.id,
        file_type: r.file_type,
        file_path: r.file_path,
        size_bytes: r.size_bytes,
        download_url: storage.getDownloadUrl(r.file_path, r.id),
        metadata: { client_id: r.client_id, skill_id: r.skill_id, run_id: r.run_id, created_at: r.created_at, expires_at: r.expires_at },
      }));

      return c.json({ files, total: files.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'list_failed', message }, 500);
    }
  });

  // ─── Download file ───────────────────────────────────────────────
  app.get('/v1/delivery/files/:fileId/download', async (c) => {
    const fileId = c.req.param('fileId');

    if (!fileRepo) {
      return c.json({ error: 'no_database', message: 'No database connected' }, 503);
    }

    try {
      const record = await fileRepo.get(fileId);
      if (!record) {
        return c.json({ error: 'not_found', message: 'File not found' }, 404);
      }

      const storage = getStorage();
      const buffer = await storage.readBuffer(record.file_path);

      const mimeMap: Record<string, string> = {
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      const mime = mimeMap[record.file_type] ?? 'application/octet-stream';
      const filename = `${record.skill_id}-${fileId}.${record.file_type}`;

      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      return new Response(ab, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(buffer.byteLength),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'download_failed', message }, 500);
    }
  });

  // ─── Delete file ─────────────────────────────────────────────────
  app.delete('/v1/delivery/files/:fileId', async (c) => {
    const fileId = c.req.param('fileId');

    if (!fileRepo) {
      return c.json({ error: 'no_database', message: 'No database connected' }, 503);
    }

    try {
      const record = await fileRepo.get(fileId);
      if (!record) {
        return c.json({ error: 'not_found', message: 'File not found' }, 404);
      }

      const storage = getStorage();
      await storage.delete(record.file_path);
      await fileRepo.delete(fileId);

      return c.json({ deleted: true, file_id: fileId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'delete_failed', message }, 500);
    }
  });

  return app;
}
