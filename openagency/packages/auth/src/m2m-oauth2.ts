// ─── Machine-to-Machine OAuth2 Client Credentials ──────────────────

import { randomBytes, createHash } from 'node:crypto';
import type { M2MClient, Role } from '@openagency/types';
import { signToken } from './jwt.js';

// ─── In-Memory Client Store ─────────────────────────────────────────

const clients = new Map<string, M2MClient>();

export function registerM2MClient(
  name: string,
  role: Role,
  scopes: string[],
): { client_id: string; client_secret: string } {
  const client_id = `oa_m2m_${randomBytes(12).toString('hex')}`;
  const client_secret = `oa_secret_${randomBytes(32).toString('base64url')}`;
  const client_secret_hash = createHash('sha256')
    .update(client_secret)
    .digest('hex');

  clients.set(client_id, {
    client_id,
    client_secret_hash,
    name,
    role,
    scopes,
  });

  return { client_id, client_secret };
}

export async function clientCredentialsGrant(
  client_id: string,
  client_secret: string,
): Promise<{ access_token: string; token_type: string; expires_in: number } | null> {
  const client = clients.get(client_id);
  if (!client) return null;

  const hash = createHash('sha256').update(client_secret).digest('hex');
  if (hash !== client.client_secret_hash) return null;

  const expiresIn = 3600; // 1 hour
  const access_token = await signToken(
    { sub: client_id, role: client.role, scopes: client.scopes },
    { expiresIn: `${expiresIn}s` },
  );

  return { access_token, token_type: 'Bearer', expires_in: expiresIn };
}

export function getM2MClient(client_id: string): M2MClient | undefined {
  return clients.get(client_id);
}

export function listM2MClients(): M2MClient[] {
  return [...clients.values()];
}
