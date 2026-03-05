// ─── MCP Client Registry Tests ─────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpClientRegistry } from '../federation/mcp-client.js';

const mockFetch = vi.fn();

describe('McpClientRegistry', () => {
  let registry: McpClientRegistry;

  beforeEach(() => {
    registry = new McpClientRegistry();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('connect()', () => {
    it('initializes and discovers tools from remote MCP server', async () => {
      // Mock initialize response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'test' } },
        }),
        headers: new Headers({ 'mcp-session-id': 'sess-123' }),
      });

      // Mock tools/list response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            tools: [
              { name: 'analyze_data', description: 'Analyze dataset', inputSchema: { type: 'object' } },
              { name: 'generate_report', description: 'Generate report' },
            ],
          },
        }),
      });

      const server = await registry.connect('test-server', 'https://mcp.example.com/v1/mcp');

      expect(server.name).toBe('test-server');
      expect(server.url).toBe('https://mcp.example.com/v1/mcp');
      expect(server.tools).toHaveLength(2);
      expect(server.tools[0].name).toBe('analyze_data');
      expect(server.connected_at).toBeTruthy();

      // Verify it's listed
      expect(registry.listServers()).toHaveLength(1);
    });

    it('throws on failed init', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });
      await expect(registry.connect('bad', 'https://bad.example.com')).rejects.toThrow('MCP init failed');
    });
  });

  describe('callTool()', () => {
    beforeEach(async () => {
      // Setup: connect a server first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
        headers: new Headers(),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: { tools: [{ name: 'my_tool', description: 'test' }] },
        }),
      });
      await registry.connect('srv', 'https://mcp.example.com');
      mockFetch.mockReset();
    });

    it('calls tool and returns result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{"answer": 42}' }] },
        }),
      });

      const result = await registry.callTool('srv', 'my_tool', { query: 'test' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('42');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe('tools/call');
      expect(body.params.name).toBe('my_tool');
    });

    it('throws for unknown server', async () => {
      await expect(registry.callTool('unknown', 'tool', {})).rejects.toThrow('not connected');
    });

    it('returns error from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid params' },
        }),
      });

      const result = await registry.callTool('srv', 'my_tool', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Invalid params');
    });
  });

  describe('disconnect()', () => {
    it('removes a connected server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
        headers: new Headers(),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 2, result: { tools: [] } }),
      });

      await registry.connect('srv', 'https://mcp.example.com');
      expect(registry.listServers()).toHaveLength(1);

      expect(registry.disconnect('srv')).toBe(true);
      expect(registry.listServers()).toHaveLength(0);
    });

    it('returns false for unknown server', () => {
      expect(registry.disconnect('nope')).toBe(false);
    });
  });
});
