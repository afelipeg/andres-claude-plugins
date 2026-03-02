// ─── Database Client ────────────────────────────────────────────────
// Uses porsager/postgres when DATABASE_URL is set, otherwise no-op.

import { readFileSync } from 'node:fs';
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
  const db = sql as { unsafe: (q: string) => Promise<unknown> };
  const __dirname = dirname(fileURLToPath(import.meta.url));

  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await db.unsafe(schema);
    console.log('[db] Schema migrations applied');
  } catch (err) {
    console.error('[db] Migration error (schema.sql):', err);
  }

  try {
    const agentTables = readFileSync(
      join(__dirname, 'migrations', '002_agent_tables.sql'),
      'utf-8',
    );
    await db.unsafe(agentTables);
    console.log('[db] Agent table migrations applied');
  } catch (err) {
    console.error('[db] Migration error (002_agent_tables.sql):', err);
  }
}

export async function closeDb() {
  if (sql) {
    await (sql as { end: () => Promise<void> }).end();
    sql = null;
  }
}
