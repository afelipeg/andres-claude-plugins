// ─── Node.js Credential Store ───────────────────────────────────────
// AES-256-GCM encrypted file at ~/.openagency/credentials.enc
// Uses PBKDF2 to derive encryption key from passphrase.

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { PlatformCredentials, ConnectorPlatform } from '@openagency/types';

const CRED_DIR = '.openagency';
const CRED_FILE = 'credentials.enc';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

function getCredPath(): string {
  return join(homedir(), CRED_DIR, CRED_FILE);
}

function ensureDir(): void {
  const dir = join(homedir(), CRED_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encrypt(data: string, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: salt (32) + iv (16) + tag (16) + encrypted data
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decrypt(buffer: Buffer, passphrase: string): string {
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf-8');
}

export class NodeCredentialStore {
  constructor(private passphrase: string) {}

  private load(): Map<ConnectorPlatform, PlatformCredentials> {
    const credPath = getCredPath();
    if (!existsSync(credPath)) return new Map();

    try {
      const raw = readFileSync(credPath);
      const json = decrypt(raw, this.passphrase);
      const entries = JSON.parse(json) as Array<[ConnectorPlatform, PlatformCredentials]>;
      return new Map(entries);
    } catch {
      throw new Error('Failed to decrypt credentials. Wrong passphrase?');
    }
  }

  private save(creds: Map<ConnectorPlatform, PlatformCredentials>): void {
    ensureDir();
    const json = JSON.stringify(Array.from(creds.entries()));
    const encrypted = encrypt(json, this.passphrase);
    writeFileSync(getCredPath(), encrypted, { mode: 0o600 });
  }

  get(platform: ConnectorPlatform): PlatformCredentials | undefined {
    return this.load().get(platform);
  }

  getAll(): PlatformCredentials[] {
    return Array.from(this.load().values());
  }

  set(credentials: PlatformCredentials): void {
    const creds = this.load();
    creds.set(credentials.platform, credentials);
    this.save(creds);
  }

  remove(platform: ConnectorPlatform): boolean {
    const creds = this.load();
    const existed = creds.delete(platform);
    if (existed) this.save(creds);
    return existed;
  }

  has(platform: ConnectorPlatform): boolean {
    return this.load().has(platform);
  }

  platforms(): ConnectorPlatform[] {
    return Array.from(this.load().keys());
  }
}
