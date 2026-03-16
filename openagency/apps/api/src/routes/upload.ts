// ─── File Upload Route ──────────────────────────────────────────────
// POST /v1/upload — accepts multipart/form-data with a file,
// parses it using the core file parser, and returns structured data
// with platform detection. Persists to client_data table for pipeline injection.
// GET  /v1/upload/client/:clientId — list uploaded data for a client
// GET  /v1/upload/:id — get a specific upload

import { Hono } from 'hono';
import { parseFile } from '@openagency/core/data/file-parser';
import { detectPlatform } from '@openagency/core/data/platform-detect';
import type { ClientDataRepo } from '@openagency/memory';

export function uploadRoutes(clientDataRepo?: ClientDataRepo): Hono {
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

    // Optional metadata from form or query params
    const clientId = (body['client_id'] as string) ?? c.req.query('client_id');
    const dataType = (body['data_type'] as string) ?? c.req.query('data_type') ?? 'other';

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseFile(buffer, file.name);
      const mapping = detectPlatform(result.columns);

      const response: Record<string, unknown> = {
        format: result.format,
        platform: mapping.platform,
        confidence: mapping.confidence,
        columns: result.columns,
        rows: result.data.length,
        column_map: mapping.columnMap,
        data: result.data.slice(0, 100), // Cap preview at 100 rows
      };

      // Persist if we have a client_id and a repo
      if (clientId && clientDataRepo) {
        // Build summary for quick context injection
        const summary = buildDataSummary(result.data, mapping.platform, dataType);

        const record = await clientDataRepo.save({
          client_id: clientId,
          data_type: dataType,
          file_name: file.name,
          platform: mapping.platform,
          format: result.format,
          row_count: result.data.length,
          columns: result.columns,
          column_map: (mapping.columnMap ?? null) as Record<string, string> | null,
          data: result.data,
          summary,
          expires_at: null,
        });

        response.persisted = true;
        response.record_id = record.id;
        response.client_id = clientId;
        response.data_type = dataType;
      } else {
        response.persisted = false;
        if (!clientId) response.hint = 'Pass client_id to persist data for pipeline injection';
      }

      return c.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse error';
      return c.json({ error: 'parse_error', message }, 422);
    }
  });

  // ─── List client data ─────────────────────────────────────────────
  app.get('/v1/upload/client/:clientId', async (c) => {
    if (!clientDataRepo) {
      return c.json({ error: 'not_available', message: 'Client data storage not configured' }, 503);
    }
    const clientId = c.req.param('clientId');
    const dataType = c.req.query('data_type');
    const records = await clientDataRepo.listByClient(clientId, { data_type: dataType });

    return c.json({
      client_id: clientId,
      records: records.map((r) => ({
        id: r.id,
        data_type: r.data_type,
        file_name: r.file_name,
        platform: r.platform,
        format: r.format,
        row_count: r.row_count,
        columns: r.columns,
        uploaded_at: r.uploaded_at,
      })),
      total: records.length,
    });
  });

  // ─── Get specific upload ──────────────────────────────────────────
  app.get('/v1/upload/:id', async (c) => {
    if (!clientDataRepo) {
      return c.json({ error: 'not_available', message: 'Client data storage not configured' }, 503);
    }
    const id = c.req.param('id');
    const record = await clientDataRepo.findById(id);
    if (!record) {
      return c.json({ error: 'not_found', message: `Upload not found: ${id}` }, 404);
    }
    return c.json(record);
  });

  // ─── Delete upload ────────────────────────────────────────────────
  app.delete('/v1/upload/:id', async (c) => {
    if (!clientDataRepo) {
      return c.json({ error: 'not_available', message: 'Client data storage not configured' }, 503);
    }
    const id = c.req.param('id');
    const deleted = await clientDataRepo.delete(id);
    if (!deleted) {
      return c.json({ error: 'not_found', message: `Upload not found: ${id}` }, 404);
    }
    return c.json({ deleted: true, id });
  });

  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function buildDataSummary(
  data: Record<string, unknown>[],
  platform: string | null,
  dataType: string,
): Record<string, unknown> {
  if (!data.length) return { row_count: 0 };

  const summary: Record<string, unknown> = {
    row_count: data.length,
    platform,
    data_type: dataType,
  };

  // Auto-aggregate numeric columns
  const numericKeys = Object.keys(data[0]).filter((k) => typeof data[0][k] === 'number');
  const totals: Record<string, number> = {};
  for (const key of numericKeys) {
    totals[key] = 0;
    for (const row of data) {
      totals[key] += (row[key] as number) ?? 0;
    }
  }
  summary.totals = totals;

  // For sales data types, extract key metrics
  if (dataType === 'sell_in' || dataType === 'sell_out' || dataType === 'digital_sales') {
    summary.total_revenue = totals['revenue'] ?? totals['sales'] ?? totals['amount'] ?? 0;
    summary.total_units = totals['units'] ?? totals['quantity'] ?? 0;
  }

  return summary;
}
