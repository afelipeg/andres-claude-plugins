// ─── MCP Client Registry ───────────────────────────────────────────
// Connects to and invokes tools on external MCP servers.

import { createLogger } from '@openagency/core';
import type { ExternalMcpServer } from './types.js';

const log = createLogger('federation:mcp');

interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class McpClientRegistry {
  private servers = new Map<string, ExternalMcpServer>();

  /**
   * Connect to an external MCP server via StreamableHTTP.
   * Discovers available tools and caches them.
   */
  async connect(name: string, url: string): Promise<ExternalMcpServer> {
    log.info({ name, url }, 'Connecting to external MCP server');

    // Use StreamableHTTP to discover tools
    const initRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'openagency-federation', version: '3.1.0' },
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
