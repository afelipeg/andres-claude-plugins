// Database singleton for Next.js — uses globalThis to survive hot reloads
// Wraps the existing getDb() from @openagency/api

const globalForDb = globalThis as unknown as {
  dbPool: unknown | null;
  dbInitialized: boolean;
};

export async function getDb() {
  if (globalForDb.dbPool) return globalForDb.dbPool;

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) return null;

  const postgres = (await import('postgres')).default;
  globalForDb.dbPool = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  return globalForDb.dbPool;
}
