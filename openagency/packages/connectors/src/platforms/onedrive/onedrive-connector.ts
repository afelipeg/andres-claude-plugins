// ─── OneDrive Connector ────────────────────────────────────────────
// Imports batch files (CSV, Excel, PDF) from Microsoft OneDrive / SharePoint.
// Uses Microsoft Graph API v1.0 — OAuth2 via MSAL pattern.
// Designed for human batch data (sell-in, sell-out, digital sales, reports).

import type { OAuthTokens } from '@openagency/types';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

const SCOPES = ['Files.Read', 'Files.Read.All', 'offline_access'];

export interface OneDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl?: string;
}

export interface OneDriveConfig {
  clientId: string;
  clientSecret: string;
  tenantId?: string; // defaults to 'common'
}

export class OneDriveConnector {
  readonly platform = 'onedrive' as const;
  private config: OneDriveConfig;

  constructor(config: OneDriveConfig) {
    this.config = config;
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      response_mode: 'query',
      ...(state ? { state } : {}),
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OneDrive token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || 'Bearer',
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    if (!tokens.refresh_token) throw new Error('No refresh token available');

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`OneDrive refresh failed: ${res.status}`);

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      token_type: data.token_type || 'Bearer',
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now() + 60_000;
  }

  /** List files in OneDrive root or specific folder */
  async listFiles(
    tokens: OAuthTokens,
    opts?: { folderId?: string; limit?: number },
  ): Promise<OneDriveFile[]> {
    const limit = opts?.limit ?? 50;
    const path = opts?.folderId
      ? `/me/drive/items/${opts.folderId}/children`
      : '/me/drive/root/children';

    const url = `${GRAPH_API}${path}?$top=${limit}&$orderby=lastModifiedDateTime desc&$select=id,name,file,size,createdDateTime,lastModifiedDateTime,webUrl`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OneDrive list failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        file?: { mimeType: string };
        size: number;
        createdDateTime: string;
        lastModifiedDateTime: string;
        webUrl?: string;
      }>;
    };

    return (data.value ?? [])
      .filter((item) => item.file) // Only files, not folders
      .map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.file!.mimeType,
        size: item.size,
        createdDateTime: item.createdDateTime,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
      }));
  }

  /** Download file content as ArrayBuffer */
  async downloadFile(tokens: OAuthTokens, fileId: string): Promise<{ buffer: ArrayBuffer; name: string; mimeType: string }> {
    // Get metadata
    const metaRes = await fetch(`${GRAPH_API}/me/drive/items/${fileId}?$select=name,file,size`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!metaRes.ok) throw new Error(`OneDrive metadata failed: ${metaRes.status}`);
    const meta = (await metaRes.json()) as { name: string; file?: { mimeType: string }; size: number };

    // Download content
    const dataRes = await fetch(`${GRAPH_API}/me/drive/items/${fileId}/content`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!dataRes.ok) throw new Error(`OneDrive download failed: ${dataRes.status}`);

    const buffer = await dataRes.arrayBuffer();
    return { buffer, name: meta.name, mimeType: meta.file?.mimeType ?? 'application/octet-stream' };
  }
}
