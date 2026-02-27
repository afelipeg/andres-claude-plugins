// ─── IndexedDB Persistence Layer ────────────────────────────────────
// Lightweight wrapper around IndexedDB for saving/loading analysis results.
// No external dependencies.

const DB_NAME = 'openagency';
const DB_VERSION = 2;
const STORE_NAME = 'reports';

export interface SavedReport {
  id: string;
  engineId: string;
  skillId: string;
  timestamp: string;
  label: string;
  data: unknown;
  duration_ms?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1: reports store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('engine', 'engineId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      // v2: credentials + syncs stores (for platform connectors)
      if (!db.objectStoreNames.contains('credentials')) {
        db.createObjectStore('credentials', { keyPath: 'platform' });
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

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function saveReport(report: SavedReport): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(report);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getReports(): Promise<SavedReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').index('timestamp').getAll();
    req.onsuccess = () => {
      // Reverse to get newest first
      resolve((req.result as SavedReport[]).reverse());
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getReport(id: string): Promise<SavedReport | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').get(id);
    req.onsuccess = () => resolve(req.result as SavedReport | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReport(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearReports(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
