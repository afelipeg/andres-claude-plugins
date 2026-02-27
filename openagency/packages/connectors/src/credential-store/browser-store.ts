// ─── Browser Credential Store ───────────────────────────────────────
// Web Crypto API + IndexedDB. AES-256-GCM, passphrase set once per session.
// Same encryption format as Node store — same passphrase decrypts on either.

import type { PlatformCredentials, ConnectorPlatform } from '@openagency/types';

const DB_NAME = 'openagency';
const DB_VERSION = 2;
const STORE_NAME = 'credentials';
const PBKDF2_ITERATIONS = 100_000;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 stores
      if (!db.objectStoreNames.contains('reports')) {
        const reports = db.createObjectStore('reports', { keyPath: 'id' });
        reports.createIndex('engine', 'engineId', { unique: false });
        reports.createIndex('timestamp', 'timestamp', { unique: false });
      }
      // v2 stores
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'platform' });
      }
      if (!db.objectStoreNames.contains('syncs')) {
        const syncs = db.createObjectStore('syncs', { keyPath: 'id', autoIncrement: true });
        syncs.createIndex('platform', 'platform', { unique: false });
        syncs.createIndex('synced_at', 'synced_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptData(data: string, passphrase: string): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data),
  );
  // Combine: salt(32) + iv(16) + encrypted(includes GCM tag)
  const result = new Uint8Array(32 + 16 + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, 32);
  result.set(new Uint8Array(encrypted), 48);
  return result.buffer;
}

async function decryptData(buffer: ArrayBuffer, passphrase: string): Promise<string> {
  const arr = new Uint8Array(buffer);
  const salt = arr.slice(0, 32);
  const iv = arr.slice(32, 48);
  const encrypted = arr.slice(48);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
}

interface EncryptedRecord {
  platform: ConnectorPlatform;
  data: ArrayBuffer;
}

export class BrowserCredentialStore {
  constructor(private passphrase: string) {}

  async get(platform: ConnectorPlatform): Promise<PlatformCredentials | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(platform);
      req.onsuccess = async () => {
        const record = req.result as EncryptedRecord | undefined;
        if (!record) return resolve(undefined);
        try {
          const json = await decryptData(record.data, this.passphrase);
          resolve(JSON.parse(json) as PlatformCredentials);
        } catch {
          resolve(undefined);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(): Promise<PlatformCredentials[]> {
    const db = await openDB();
    const records = await new Promise<EncryptedRecord[]>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as EncryptedRecord[]);
      req.onerror = () => reject(req.error);
    });

    const results: PlatformCredentials[] = [];
    for (const record of records) {
      try {
        const json = await decryptData(record.data, this.passphrase);
        results.push(JSON.parse(json) as PlatformCredentials);
      } catch {
        // Skip corrupted entries
      }
    }
    return results;
  }

  async set(credentials: PlatformCredentials): Promise<void> {
    const db = await openDB();
    const data = await encryptData(JSON.stringify(credentials), this.passphrase);
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
        platform: credentials.platform,
        data,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async remove(platform: ConnectorPlatform): Promise<boolean> {
    const db = await openDB();
    const exists = await this.get(platform);
    if (!exists) return false;
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(platform);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async platforms(): Promise<ConnectorPlatform[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => resolve(req.result as ConnectorPlatform[]);
      req.onerror = () => reject(req.error);
    });
  }
}
