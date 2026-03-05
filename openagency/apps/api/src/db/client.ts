// ─── Database Client ────────────────────────────────────────────────
// Uses porsager/postgres when DATABASE_URL is set, otherwise no-op.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let sql: unknown = null;
let initialized = false;

export async function getDb() {
  if (sql) return sql;

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) return null;

  const postgres = (await import('postgres')).default;
  sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  if (!initialized) {
    await runMigrations();
    initialized = true;
  }

  return sql;
}

async function runMigrations() {
  if (!sql) return;
  const db = sql as { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // 1. Ensure tracking table exists
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 2. Get already-applied migrations
  const applied = new Set<string>();
  try {
    const rows = await db.unsafe('SELECT name FROM _migrations');
    for (const row of rows) applied.add((row as { name: string }).name);
  } catch {
    // Table might not exist yet in edge cases
  }

  // 3. Always run schema.sql first (idempotent CREATE IF NOT EXISTS)
  const schemaPath = join(__dirname, 'schema.sql');
  if (existsSync(schemaPath)) {
    try {
      const schema = readFileSync(schemaPath, 'utf-8');
      await db.unsafe(schema);
      if (!applied.has('001_schema.sql')) {
        await db.unsafe('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', ['001_schema.sql']);
      }
      console.log('[db] schema.sql applied');
    } catch (err) {
      console.error('[db] Migration error (schema.sql):', err);
    }
  }

  // 4. Auto-discover and run all migrations/*.sql in sorted order
  const migrationsDir = join(__dirname, 'migrations');
  if (!existsSync(migrationsDir)) return;

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    try {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      await db.unsafe(content);
      await db.unsafe('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      console.log(`[db] Migration applied: ${file}`);
    } catch (err) {
      console.error(`[db] Migration error (${file}):`, err);
      break; // Stop on first failure to prevent out-of-order state
    }
  }
}

export async function closeDb() {
  if (sql) {
    await (sql as { end: () => Promise<void> }).end();
    sql = null;
  }
}
