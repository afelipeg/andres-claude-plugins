// ─── Shared Google OAuth2 Client ─────────────────────────────────────
// Used by both Google Ads and DV360 connectors.

import { OAuth2Client, type OAuth2Tokens } from '../../auth/oauth2-client.js';
import type { OAuthTokens } from '@openagency/types';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function createGoogleOAuth(
  clientId: string,
  clientSecret: string,
  scopes: string[],
): OAuth2Client {
  return new OAuth2Client({
    authUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    clientId,
    clientSecret,
    scopes,
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });
}

export function googleTokensToOAuth(tokens: OAuth2Tokens): OAuthTokens {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type || 'Bearer',
    expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    scope: tokens.scope,
  };
}
