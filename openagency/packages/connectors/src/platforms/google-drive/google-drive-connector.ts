// ─── Google Drive Connector ────────────────────────────────────────
// Imports batch files (CSV, Excel, PDF) from Google Drive into Plinth.
// Uses Google Drive API v3 — OAuth2 via shared Google OAuth module.
// Designed for human batch data (sell-in, sell-out, digital sales, reports).

import { createGoogleOAuth, googleTokensToOAuth } from '../google-shared/google-oauth.js';
import type { OAuthTokens } from '@openagency/types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
}

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
}

export class GoogleDriveConnector {
  readonly platform = 'google_drive' as const;
  private config: GoogleDriveConfig;
  private oauth;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
    this.oauth = createGoogleOAuth(config.clientId, config.clientSecret, SCOPES);
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    return this.oauth.getAuthUrl(redirectUri, state);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const tokens = await this.oauth.exchangeCode(code, redirectUri);
    return googleTokensToOAuth(tokens);
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    const refreshed = await this.oauth.refreshToken(tokens.refresh_token!);
    return googleTokensToOAuth(refreshed);
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now() + 60_000;
  }

  /** List files in a Drive folder (or root) */
  async listFiles(
    tokens: OAuthTokens,
    opts?: { folderId?: string; mimeTypes?: string[]; limit?: number },
  ): Promise<DriveFile[]> {
    const accessToken = tokens.access_token;
    const limit = opts?.limit ?? 50;

    const queryParts: string[] = ['trashed = false'];
    if (opts?.folderId) {
      queryParts.push(`'${opts.folderId}' in parents`);
    }
    if (opts?.mimeTypes?.length) {
      const mimeFilter = opts.mimeTypes.map((m) => `mimeType = '${m}'`).join(' or ');
      queryParts.push(`(${mimeFilter})`);
    }

    const q = encodeURIComponent(queryParts.join(' and '));
    const url = `${DRIVE_API}/files?q=${q}&pageSize=${limit}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,parents)&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Drive list failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { files: DriveFile[] };
    return data.files ?? [];
  }

  /** Download file content as ArrayBuffer */
  async downloadFile(tokens: OAuthTokens, fileId: string): Promise<{ buffer: ArrayBuffer; name: string; mimeType: string }> {
    const accessToken = tokens.access_token;

    // Get file metadata first
    const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=name,mimeType,size`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) throw new Error(`Drive metadata failed: ${metaRes.status}`);
    const meta = (await metaRes.json()) as DriveFile;

    // Download content
    // For Google Docs/Sheets, export as xlsx/csv; for binary files, direct download
    let downloadUrl: string;
    if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
      downloadUrl = `${DRIVE_API}/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    } else if (meta.mimeType === 'application/vnd.google-apps.document') {
      downloadUrl = `${DRIVE_API}/files/${fileId}/export?mimeType=application/pdf`;
    } else {
      downloadUrl = `${DRIVE_API}/files/${fileId}?alt=media`;
    }

    const dataRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!dataRes.ok) throw new Error(`Drive download failed: ${dataRes.status}`);

    const buffer = await dataRes.arrayBuffer();
    // Adjust name extension for exported Google formats
    let name = meta.name;
    if (meta.mimeType === 'application/vnd.google-apps.spreadsheet' && !name.endsWith('.xlsx')) {
      name += '.xlsx';
    }

    return { buffer, name, mimeType: meta.mimeType };
  }
}
