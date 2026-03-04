// ─── File Upload Route ──────────────────────────────────────────────
// POST /v1/upload — accepts multipart/form-data with a file,
// parses it using the core file parser, and returns structured data
// with platform detection. Enables A2A file ingestion.

import { Hono } from 'hono';
import { parseFile } from '@openagency/core/data/file-parser';
import { detectPlatform } from '@openagency/core/data/platform-detect';

export function uploadRoutes(): Hono {
  const app = new Hono();

  app.post('/v1/upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json(
        { error: 'bad_request', message: 'Missing "file" field in multipart form data' },
        400,
      );
    }

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseFile(buffer, file.name);
      const mapping = detectPlatform(result.columns);

      return c.json({
        format: result.format,
        platform: mapping.platform,
        confidence: mapping.confidence,
        columns: result.columns,
        rows: result.data.length,
        column_map: mapping.columnMap,
        data: result.data.slice(0, 100), // Cap preview at 100 rows
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse error';
      return c.json({ error: 'parse_error', message }, 422);
    }
  });

  return app;
}
