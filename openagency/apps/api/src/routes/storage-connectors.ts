// ─── Storage Connector Routes ───────────────────────────────────────
// Google Drive and OneDrive integration for batch file imports.
// POST /v1/storage/:provider/auth-url    — get OAuth URL
// POST /v1/storage/:provider/callback    — exchange code for tokens
// GET  /v1/storage/:provider/files       — list files
// POST /v1/storage/:provider/import      — download file → parse → persist to client_data

import { Hono } from 'hono';
import { GoogleDriveConnector } from '@openagency/connectors';
import { OneDriveConnector } from '@openagency/connectors';
import { parseFile } from '@openagency/core/data/file-parser';
import { detectPlatform } from '@openagency/core/data/platform-detect';
import type { OAuthTokens } from '@openagency/types';
import type { ClientDataRepo } from '@openagency/memory';

// In-memory token store per user session (production: use credential store)
const tokenStore = new Map<string, OAuthTokens>();

export function storageConnectorRoutes(clientDataRepo?: ClientDataRepo) {
  const app = new Hono();

  // ─── Google Drive ─────────────────────────────────────────────────

  const gdClientId = process.env['GOOGLE_DRIVE_CLIENT_ID'] ?? process.env['GOOGLE_ADS_CLIENT_ID'];
  const gdClientSecret = process.env['GOOGLE_DRIVE_CLIENT_SECRET'] ?? process.env['GOOGLE_ADS_CLIENT_SECRET'];
  const gdrive = gdClientId && gdClientSecret
    ? new GoogleDriveConnector({ clientId: gdClientId, clientSecret: gdClientSecret })
    : null;

  // ─── OneDrive ─────────────────────────────────────────────────────

  const odClientId = process.env['ONEDRIVE_CLIENT_ID'] ?? process.env['MICROSOFT_CLIENT_ID'];
  const odClientSecret = process.env['ONEDRIVE_CLIENT_SECRET'] ?? process.env['MICROSOFT_CLIENT_SECRET'];
  const onedrive = odClientId && odClientSecret
    ? new OneDriveConnector({ clientId: odClientId, clientSecret: odClientSecret })
    : null;

  // ─── List available storage providers ────────────────────────────
  app.get('/v1/storage/providers', (c) => {
    return c.json({
      providers: [
        { id: 'google_drive', available: !!gdrive, name: 'Google Drive' },
        { id: 'onedrive', available: !!onedrive, name: 'Microsoft OneDrive' },
      ],
    });
  });

  // ─── Get auth URL ─────────────────────────────────────────────────
  app.post('/v1/storage/:provider/auth-url', async (c) => {
    const provider = c.req.param('provider');
    let body: { redirect_uri: string; state?: string };
    try {
      body = await c.req.json<{ redirect_uri: string; state?: string }>();
    } catch {
      return c.json({ error: 'bad_request', message: 'JSON body with redirect_uri required' }, 400);
    }

    const connector = getConnector(provider, gdrive, onedrive);
    if (!connector) {
      return c.json({ error: 'not_available', message: `Storage provider "${provider}" not configured` }, 503);
    }

    const url = connector.getAuthUrl(body.redirect_uri, body.state);
    return c.json({ auth_url: url, provider });
  });

  // ─── OAuth callback ───────────────────────────────────────────────
  app.post('/v1/storage/:provider/callback', async (c) => {
    const provider = c.req.param('provider');
    let body: { code: string; redirect_uri: string };
    try {
      body = await c.req.json<{ code: string; redirect_uri: string }>();
    } catch {
      return c.json({ error: 'bad_request', message: 'JSON body with code + redirect_uri required' }, 400);
    }

    const connector = getConnector(provider, gdrive, onedrive);
    if (!connector) {
      return c.json({ error: 'not_available', message: `Storage provider "${provider}" not configured` }, 503);
    }

    try {
      const tokens = await connector.exchangeCode(body.code, body.redirect_uri);
      tokenStore.set(provider, tokens);
      return c.json({ connected: true, provider, expires_at: tokens.expires_at });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'auth_failed', message }, 400);
    }
  });

  // ─── List files ───────────────────────────────────────────────────
  app.get('/v1/storage/:provider/files', async (c) => {
    const provider = c.req.param('provider');
    const connector = getConnector(provider, gdrive, onedrive);
    if (!connector) {
      return c.json({ error: 'not_available', message: `Storage provider "${provider}" not configured` }, 503);
    }

    const tokens = tokenStore.get(provider);
    if (!tokens) {
      return c.json({ error: 'not_authenticated', message: 'Connect to this provider first via /auth-url + /callback' }, 401);
    }

    const folderId = c.req.query('folder_id');
    const limit = parseInt(c.req.query('limit') ?? '50', 10);

    try {
      const files = await connector.listFiles(tokens, { folderId: folderId ?? undefined, limit });
      return c.json({ provider, files, count: files.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'list_failed', message }, 500);
    }
  });

  // ─── Import file (download → parse → persist) ────────────────────
  app.post('/v1/storage/:provider/import', async (c) => {
    const provider = c.req.param('provider');
    const connector = getConnector(provider, gdrive, onedrive);
    if (!connector) {
      return c.json({ error: 'not_available', message: `Storage provider "${provider}" not configured` }, 503);
    }

    const tokens = tokenStore.get(provider);
    if (!tokens) {
      return c.json({ error: 'not_authenticated', message: 'Connect to this provider first' }, 401);
    }

    let body: { file_id: string; client_id: string; data_type?: string };
    try {
      body = await c.req.json<{ file_id: string; client_id: string; data_type?: string }>();
    } catch {
      return c.json({ error: 'bad_request', message: 'JSON body with file_id and client_id required' }, 400);
    }

    try {
      // Download file
      const { buffer, name, mimeType } = await connector.downloadFile(tokens, body.file_id);

      // Parse
      const result = await parseFile(buffer, name);
      const mapping = detectPlatform(result.columns);
      const dataType = body.data_type ?? (mapping.platform ? 'platform_export' : 'other');

      // Persist
      if (clientDataRepo) {
        const record = await clientDataRepo.save({
          client_id: body.client_id,
          data_type: dataType,
          file_name: name,
          platform: mapping.platform,
          format: result.format,
          row_count: result.data.length,
          columns: result.columns,
          column_map: (mapping.columnMap ?? null) as Record<string, string> | null,
          data: result.data,
          summary: { source: provider, mime_type: mimeType },
          expires_at: null,
        });

        return c.json({
          imported: true,
          record_id: record.id,
          client_id: body.client_id,
          file_name: name,
          platform: mapping.platform,
          format: result.format,
          rows: result.data.length,
          data_type: dataType,
          source: provider,
        }, 201);
      }

      // No persistence — return parsed preview
      return c.json({
        imported: false,
        hint: 'No database available — data was parsed but not stored',
        file_name: name,
        platform: mapping.platform,
        format: result.format,
        rows: result.data.length,
        data: result.data.slice(0, 50),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'import_failed', message }, 500);
    }
  });

  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getConnector(
  provider: string,
  gdrive: GoogleDriveConnector | null,
  onedrive: OneDriveConnector | null,
): (GoogleDriveConnector | OneDriveConnector) | null {
  if (provider === 'google_drive') return gdrive;
  if (provider === 'onedrive') return onedrive;
  return null;
}
