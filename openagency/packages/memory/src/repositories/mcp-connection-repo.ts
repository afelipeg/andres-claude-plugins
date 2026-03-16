// ─── MCP Connection Repository ───────────────────────────────────────

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

export interface McpConnectionRow {
  id: string;
  client_id: string;
  name: string;
  url: string;
  auth_type: string;
  auth_token: string | null;
  catalog_id: string | null;
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  status: 'connected' | 'failed' | 'stale';
  error: string | null;
  allowed_engines: string[];
  process_pid: number | null;
  connected_at: string;
  last_health: string | null;
  created_at: string;
}

function mapRow(row: Record<string, unknown>): McpConnectionRow {
  return {
    id: row['id'] as string,
    client_id: row['client_id'] as string,
    name: row['name'] as string,
    url: row['url'] as string,
    auth_type: row['auth_type'] as string,
    auth_token: (row['auth_token'] as string) ?? null,
    catalog_id: (row['catalog_id'] as string) ?? null,
    tools: (row['tools'] as McpConnectionRow['tools']) ?? [],
    status: (row['status'] as McpConnectionRow['status']) ?? 'connected',
    error: (row['error'] as string) ?? null,
    allowed_engines: (row['allowed_engines'] as string[]) ?? [],
    process_pid: row['process_pid'] != null ? Number(row['process_pid']) : null,
    connected_at: row['connected_at'] as string,
    last_health: (row['last_health'] as string) ?? null,
    created_at: row['created_at'] as string,
  };
}

export class McpConnectionRepo {
  constructor(private sql: unknown) {}

  async save(conn: Omit<McpConnectionRow, 'created_at'>): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      `INSERT INTO mcp_connections (
        id, client_id, name, url, auth_type, auth_token, catalog_id,
        tools, status, error, allowed_engines, process_pid, connected_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (client_id, name) DO UPDATE SET
        url = EXCLUDED.url,
        auth_type = EXCLUDED.auth_type,
        auth_token = EXCLUDED.auth_token,
        tools = EXCLUDED.tools,
        status = EXCLUDED.status,
        error = EXCLUDED.error,
        process_pid = EXCLUDED.process_pid,
        connected_at = EXCLUDED.connected_at`,
      [
        conn.id,
        conn.client_id,
        conn.name,
        conn.url,
        conn.auth_type,
        conn.auth_token,
        conn.catalog_id,
        JSON.stringify(conn.tools),
        conn.status,
        conn.error,
        conn.allowed_engines,
        conn.process_pid,
        conn.connected_at,
      ],
    );
  }

  async listByClient(clientId: string): Promise<McpConnectionRow[]> {
    const db = this.sql as Db;
    const rows = await db.unsafe(
      'SELECT * FROM mcp_connections WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId],
    );
    return rows.map((r) => mapRow(r as Record<string, unknown>));
  }

  async getById(id: string): Promise<McpConnectionRow | null> {
    const db = this.sql as Db;
    const rows = await db.unsafe('SELECT * FROM mcp_connections WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    return mapRow(rows[0] as Record<string, unknown>);
  }

  async listAll(): Promise<McpConnectionRow[]> {
    const db = this.sql as Db;
    const rows = await db.unsafe('SELECT * FROM mcp_connections ORDER BY created_at DESC');
    return rows.map((r) => mapRow(r as Record<string, unknown>));
  }

  async updateStatus(id: string, status: string, error?: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE mcp_connections SET status = $1, error = $2 WHERE id = $3',
      [status, error ?? null, id],
    );
  }

  async updateTools(id: string, tools: unknown[]): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe(
      'UPDATE mcp_connections SET tools = $1, last_health = NOW() WHERE id = $2',
      [JSON.stringify(tools), id],
    );
  }

  async updatePid(id: string, pid: number | null): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe('UPDATE mcp_connections SET process_pid = $1 WHERE id = $2', [pid, id]);
  }

  async delete(id: string): Promise<void> {
    const db = this.sql as Db;
    await db.unsafe('DELETE FROM mcp_connections WHERE id = $1', [id]);
  }
}
