// ─── API Key Management ─────────────────────────────────────────────

import { randomBytes, createHash } from 'node:crypto';
import type { ApiKeyRecord, Role } from '@openagency/types';

const LIVE_PREFIX = 'oa_live_';
const TEST_PREFIX = 'oa_test_';
const KEY_BYTES = 32;

export function generateApiKey(mode: 'live' | 'test' = 'live'): {
  key: string;
  prefix: string;
  hash: string;
} {
  const prefix = mode === 'live' ? LIVE_PREFIX : TEST_PREFIX;
  const raw = randomBytes(KEY_BYTES).toString('base64url');
  const key = `${prefix}${raw}`;
  const hash = hashApiKey(key);
  return { key, prefix: key.slice(0, prefix.length + 8), hash };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function extractPrefix(key: string): string {
  if (key.startsWith(LIVE_PREFIX)) return key.slice(0, LIVE_PREFIX.length + 8);
  if (key.startsWith(TEST_PREFIX)) return key.slice(0, TEST_PREFIX.length + 8);
  return key.slice(0, 16);
}

export function isTestKey(key: string): boolean {
  return key.startsWith(TEST_PREFIX);
}

// ─── In-Memory Store (dev fallback) ────────────────────────────────

const inMemoryKeys = new Map<string, ApiKeyRecord>();

/** Default test key for development */
const DEV_KEY = `${TEST_PREFIX}dev_default_key_for_local_testing`;
const DEV_KEY_HASH = hashApiKey(DEV_KEY);

// Seed dev key
inMemoryKeys.set(DEV_KEY_HASH, {
  id: 'dev-default',
  prefix: extractPrefix(DEV_KEY),
  hash: DEV_KEY_HASH,
  name: 'Development default',
  role: 'admin',
  scopes: ['*'],
  created_at: new Date().toISOString(),
  revoked: false,
});

export function createApiKeyRecord(
  name: string,
  role: Role,
  scopes: string[],
  mode: 'live' | 'test' = 'live',
): { record: ApiKeyRecord; key: string } {
  const { key, prefix, hash } = generateApiKey(mode);
  const record: ApiKeyRecord = {
    id: randomBytes(8).toString('hex'),
    prefix,
    hash,
    name,
    role,
    scopes,
    created_at: new Date().toISOString(),
    revoked: false,
  };
  inMemoryKeys.set(hash, record);
  return { record, key };
}

export function validateApiKey(key: string): ApiKeyRecord | null {
  const hash = hashApiKey(key);
  const record = inMemoryKeys.get(hash);
  if (!record || record.revoked) return null;
  return record;
}

export function revokeApiKey(hash: string): boolean {
  const record = inMemoryKeys.get(hash);
  if (!record) return false;
  record.revoked = true;
  return true;
}

export function listApiKeys(): ApiKeyRecord[] {
  return [...inMemoryKeys.values()];
}

export { DEV_KEY };
