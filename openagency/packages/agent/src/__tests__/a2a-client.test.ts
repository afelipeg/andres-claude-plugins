// ─── A2A Client Tests ──────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { A2AClient } from '../federation/a2a-client.js';

const mockFetch = vi.fn();

describe('A2AClient', () => {
  let client: A2AClient;

  beforeEach(() => {
    client = new A2AClient();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('discover()', () => {
    it('fetches /.well-known/agent.json and caches result', async () => {
      const card = {
        name: 'Remote Agency',
        version: '1.0.0',
        url: 'https://remote.example.com',
        capabilities: ['waste-detection'],
        protocols: ['a2a', 'mcp'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => card,
      });

      const result = await client.discover('https://remote.example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://remote.example.com/.well-known/agent.json',
        expect.objectContaining({ headers: { Accept: 'application/json' } }),
      );
      expect(result.card.name).toBe('Remote Agency');
      expect(result.url).toBe('https://remote.example.com');
      expect(result.discovered_at).toBeTruthy();

      // Cached
      const discovered = client.listDiscovered();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].card.name).toBe('Remote Agency');
    });

    it('strips trailing slashes from URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test', version: '1.0', url: '', capabilities: [], protocols: [] }),
      });

      await client.discover('https://example.com///');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/.well-known/agent.json',
        expect.anything(),
      );
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(client.discover('https://bad.example.com')).rejects.toThrow('Discovery failed: 404 Not Found');
    });
  });

  describe('invokeSkill()', () => {
    it('posts to remote skill endpoint and returns result', async () => {
      const remoteResult = { waste_summary: { total_waste: 50000 } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteResult,
      });

      const result = await client.invokeSkill({
        base_url: 'https://remote.example.com',
        engine_id: 'leak-detector',
        skill_id: 'waste-waterfall',
        input: { gross_spend: 100000 },
        api_key: 'oa_test_key',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(remoteResult);
      expect(result.source).toBe('https://remote.example.com');
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://remote.example.com/v1/engines/leak-detector/skills/waste-waterfall');
      expect(opts.method).toBe('POST');
      expect(opts.headers['X-API-Key']).toBe('oa_test_key');
    });

    it('returns error on non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      const result = await client.invokeSkill({
        base_url: 'https://remote.example.com',
        engine_id: 'leak-detector',
        skill_id: 'waste-waterfall',
        input: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('handles fetch failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.invokeSkill({
        base_url: 'https://unreachable.example.com',
        engine_id: 'leak-detector',
        skill_id: 'waste-waterfall',
        input: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('forget()', () => {
    it('removes a discovered agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test', version: '1', url: '', capabilities: [], protocols: [] }),
      });

      await client.discover('https://example.com');
      expect(client.listDiscovered()).toHaveLength(1);

      expect(client.forget('https://example.com')).toBe(true);
      expect(client.listDiscovered()).toHaveLength(0);
    });
  });
});
