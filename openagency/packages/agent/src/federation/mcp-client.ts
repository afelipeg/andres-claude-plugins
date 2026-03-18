// ─── MCP Client Registry ───────────────────────────────────────────
// Connects to and invokes tools on external MCP servers.
// Supports optional DB persistence via McpConnectionRepo.

import { createLogger } from '@openagency/core';
import type { ExternalMcpServer } from './types.js';
import type { McpConnectionRepo } from '@openagency/memory';
import type { McpProcessManager } from './mcp-process-manager.js';

const log = createLogger('federation:mcp');

interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export interface RespawnOpts {
  decryptFn: (token: string) => string;
  envMapperFn: (catalogId: string, fields: Record<string, string>) => Record<string, string>;
}

export class McpClientRegistry {
  private servers = new Map<string, ExternalMcpServer>();
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private healthFailures = new Map<string, number>(); // consecutive failure count per server

  constructor(
    private repo?: McpConnectionRepo,
    private processManager?: McpProcessManager,
  ) {}

  /**
   * Connect to an external MCP server via StreamableHTTP.
   * Discovers available tools and caches them.
   */
  async connect(
    name: string,
    url: string,
    authToken?: string,
    clientId?: string,
  ): Promise<ExternalMcpServer> {
    log.info({ name, url }, 'Connecting to external MCP server');

    const authHeaders: Record<string, string> = {};
    if (authToken) authHeaders['Authorization'] = `Bearer ${authToken}`;

    // Initialize
    const initRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'openagency-federation', version: '3.2.0' },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!initRes.ok) {
      throw new Error(`MCP init failed: ${initRes.status} ${initRes.statusText}`);
    }

    // List tools
    const toolsRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(initRes.headers.get('mcp-session-id')
          ? { 'mcp-session-id': initRes.headers.get('mcp-session-id')! }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!toolsRes.ok) {
      throw new Error(`MCP tools/list failed: ${toolsRes.status}`);
    }

    const toolsBody = (await toolsRes.json()) as {
      result?: { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> };
    };

    const tools = (toolsBody.result?.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? {},
    }));

    const server: ExternalMcpServer = {
      name,
      url,
      connected_at: new Date().toISOString(),
      tools,
    };

    this.servers.set(name, server);
    log.info({ name, tools: tools.length }, 'MCP server connected');

    return server;
  }

  /** Call a tool on a connected MCP server */
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not connected`);
    }

    log.info({ server: serverName, tool: toolName }, 'Calling remote MCP tool');
    const start = Date.now();

    const res = await fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`MCP tool call failed: ${res.status}`);
    }

    const body = (await res.json()) as { result?: McpToolResult; error?: { message: string } };
    const duration = Date.now() - start;

    if (body.error) {
      log.warn({ server: serverName, tool: toolName, error: body.error.message }, 'MCP tool error');
      return { content: [{ type: 'text', text: body.error.message }], isError: true };
    }

    log.info({ server: serverName, tool: toolName, duration }, 'MCP tool completed');
    return body.result ?? { content: [{ type: 'text', text: '{}' }] };
  }

  /** Load persisted connections from DB. Marks stale if process is dead. Optionally auto-respawns. */
  async loadFromDb(clientId?: string, respawnOpts?: RespawnOpts): Promise<void> {
    if (!this.repo) return;

    const rows = clientId
      ? await this.repo.listByClient(clientId)
      : await this.repo.listAll();

    const staleRows: typeof rows = [];

    for (const row of rows) {
      // Check if non-hosted process is still alive
      if (row.process_pid && !row.catalog_id?.endsWith('_hosted')) {
        const alive = this.processManager?.isProcessAlive(row.process_pid) ?? false;
        if (!alive) {
          log.warn({ name: row.name, pid: row.process_pid }, 'MCP process dead — marking stale');
          await this.repo.updateStatus(row.id, 'stale', 'Process not running. Respawn pending.');
          staleRows.push(row);
          continue;
        }
      }

      if (row.status === 'stale') {
        staleRows.push(row);
        continue;
      }

      if (row.status === 'connected') {
        this.servers.set(row.name, {
          name: row.name,
          url: row.url,
          connected_at: row.connected_at,
          tools: row.tools,
        });
      }
    }

    log.info({ loaded: this.servers.size, stale: staleRows.length, total: rows.length }, 'Loaded MCP connections from DB');

    // Auto-respawn stale connections if opts provided
    if (staleRows.length > 0 && respawnOpts && this.processManager) {
      log.info({ count: staleRows.length }, 'Attempting to respawn stale MCP connections');
      const result = await this.respawnStaleConnections(respawnOpts);
      log.info(result, 'MCP respawn completed');
    }
  }

  /**
   * Attempt to respawn all stale MCP connections.
   * Idempotent: skips if PID still alive or server already in registry.
   */
  async respawnStaleConnections(
    opts: RespawnOpts,
  ): Promise<{ respawned: string[]; failed: string[] }> {
    if (!this.repo || !this.processManager) {
      return { respawned: [], failed: [] };
    }

    const rows = await this.repo.listAll();
    const staleRows = rows.filter(
      (r) => r.status === 'stale' && r.catalog_id && !r.catalog_id.endsWith('_hosted'),
    );

    const respawned: string[] = [];
    const failed: string[] = [];

    for (const row of staleRows) {
      // Idempotency: skip if already in registry
      if (this.servers.has(row.name)) {
        log.info({ name: row.name }, 'MCP server already in registry — skipping respawn');
        continue;
      }

      // Idempotency: skip if PID is actually alive
      if (row.process_pid && this.processManager.isProcessAlive(row.process_pid)) {
        log.info({ name: row.name, pid: row.process_pid }, 'MCP process still alive — reconnecting');
        try {
          await this.connect(row.name, row.url);
          await this.repo.updateStatus(row.id, 'connected');
          respawned.push(row.name);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.warn({ name: row.name, error: msg }, 'Failed to reconnect to alive MCP process');
          failed.push(row.name);
        }
        continue;
      }

      // Need to respawn: decrypt auth token → build env → spawn → connect
      if (!row.auth_token || !row.catalog_id) {
        log.warn({ name: row.name }, 'Cannot respawn MCP — missing auth_token or catalog_id');
        failed.push(row.name);
        continue;
      }

      try {
        const authFieldsJson = opts.decryptFn(row.auth_token);
        const authFields = JSON.parse(authFieldsJson) as Record<string, string>;
        const env = opts.envMapperFn(row.catalog_id, authFields);

        const { url, pid } = await this.processManager.spawnMcpServer(row.id, row.catalog_id, env);
        await this.connect(row.name, url);
        await this.repo.updateStatus(row.id, 'connected');
        await this.repo.updatePid(row.id, pid);

        log.info({ name: row.name, pid, url }, 'MCP connection respawned successfully');
        respawned.push(row.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ name: row.name, catalog: row.catalog_id, error: msg }, 'Failed to respawn MCP connection');
        await this.repo.updateStatus(row.id, 'stale', `Respawn failed: ${msg}`).catch(() => {});
        failed.push(row.name);
      }
    }

    return { respawned, failed };
  }

  /**
   * Start periodic health monitor. Checks all connected servers every intervalMs.
   * Marks stale after 2 consecutive failures (Railway cold starts take 8-12s).
   * Uses 12s timeout per health check.
   */
  startHealthMonitor(intervalMs: number, respawnOpts: RespawnOpts): void {
    if (this.healthTimer) return; // Already running

    log.info({ intervalMs }, 'Starting MCP health monitor');

    this.healthTimer = setInterval(() => {
      void this.runHealthCheck(respawnOpts);
    }, intervalMs);
  }

  /** Stop health monitor */
  stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
      log.info('MCP health monitor stopped');
    }
  }

  private async runHealthCheck(respawnOpts: RespawnOpts): Promise<void> {
    const servers = Array.from(this.servers.entries());
    if (servers.length === 0) return;

    let staleDetected = false;

    for (const [name, server] of servers) {
      try {
        const res = await fetch(server.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 0,
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'plinth-healthcheck', version: '1.0.0' },
            },
          }),
          signal: AbortSignal.timeout(12_000), // 12s for Railway cold starts
        });

        if (res.ok) {
          // Reset failure counter on success
          this.healthFailures.delete(name);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        const failures = (this.healthFailures.get(name) ?? 0) + 1;
        this.healthFailures.set(name, failures);

        const msg = err instanceof Error ? err.message : String(err);
        log.warn({ name, failures, error: msg }, 'MCP health check failed');

        // Only mark stale after 2 consecutive failures
        if (failures >= 2) {
          log.warn({ name, failures }, 'MCP server unresponsive after 2 checks — marking stale');
          this.servers.delete(name);
          this.healthFailures.delete(name);
          staleDetected = true;

          // Mark stale in DB
          if (this.repo) {
            const rows = await this.repo.listAll();
            const row = rows.find((r) => r.name === name && r.status === 'connected');
            if (row) {
              await this.repo.updateStatus(row.id, 'stale', 'Health check failed (2 consecutive)').catch(() => {});
            }
          }
        }
      }
    }

    // Attempt respawn if any connections went stale
    if (staleDetected && this.processManager) {
      log.info('Health monitor detected stale connections — attempting respawn');
      const result = await this.respawnStaleConnections(respawnOpts);
      log.info(result, 'Health monitor respawn completed');
    }
  }

  /** List all connected servers */
  listServers(): ExternalMcpServer[] {
    return Array.from(this.servers.values());
  }

  /** Get a specific server */
  getServer(name: string): ExternalMcpServer | undefined {
    return this.servers.get(name);
  }

  /** Disconnect from a server */
  disconnect(name: string): boolean {
    const removed = this.servers.delete(name);
    if (removed) log.info({ name }, 'MCP server disconnected');
    return removed;
  }
}
