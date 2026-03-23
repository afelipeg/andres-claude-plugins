// ─── Google Service Account JWT Auth ────────────────────────────────
// Creates JWT assertions signed with RS256 for service account auth.
// Uses native Node.js crypto — no external dependencies.

import { createSign } from 'node:crypto';

export interface GoogleServiceAccountKey {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
  [key: string]: unknown;
}

interface ServiceAccountTokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Parse and validate a service account JSON string.
 */
export function parseServiceAccountJson(json: string): GoogleServiceAccountKey {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (parsed.type !== 'service_account') {
    throw new Error('Invalid service account JSON: type must be "service_account"');
  }
  if (!parsed.private_key || typeof parsed.private_key !== 'string') {
    throw new Error('Invalid service account JSON: missing private_key');
  }
  if (!parsed.client_email || typeof parsed.client_email !== 'string') {
    throw new Error('Invalid service account JSON: missing client_email');
  }
  return parsed as unknown as GoogleServiceAccountKey;
}

/**
 * Create a signed JWT assertion for Google OAuth2 service account flow.
 */
function createJwtAssertion(sa: GoogleServiceAccountKey, scopes: string[]): string {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: scopes.join(' '),
    aud: sa.token_uri || TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const segments = [
    base64urlEncode(JSON.stringify(header)),
    base64urlEncode(JSON.stringify(payload)),
  ];

  const signingInput = segments.join('.');
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(sa.private_key, 'base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Exchange a service account JWT for an access token.
 * Returns { access_token, token_type, expires_in }.
 */
export async function getServiceAccountToken(
  sa: GoogleServiceAccountKey,
  scopes: string[],
): Promise<ServiceAccountTokenResult> {
  const assertion = createJwtAssertion(sa, scopes);

  const res = await fetch(sa.token_uri || TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Service account token exchange failed (${res.status}): ${err}`);
  }

  return (await res.json()) as ServiceAccountTokenResult;
}

function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64url');
}
