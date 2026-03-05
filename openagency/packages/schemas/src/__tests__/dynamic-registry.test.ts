// ─── Dynamic Skill Registry Tests ──────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DynamicSkillRegistry } from '../dynamic-registry.js';

describe('DynamicSkillRegistry', () => {
  let registry: DynamicSkillRegistry;

  beforeEach(() => {
    registry = new DynamicSkillRegistry();
  });

  describe('register()', () => {
    it('registers a skill with a local handler', () => {
      registry.register({
        engineId: 'custom',
        skillId: 'my-skill',
        name: 'My Skill',
        description: 'A test skill',
        inputSchema: { type: 'object' },
        handler: async (input) => ({ result: input }),
      });

      const skill = registry.get('custom', 'my-skill');
      expect(skill).toBeDefined();
      expect(skill!.name).toBe('My Skill');
    });

    it('registers a skill with a remote URL', () => {
      registry.register({
        engineId: 'remote-engine',
        skillId: 'remote-skill',
        name: 'Remote Skill',
        description: 'Calls external endpoint',
        inputSchema: {},
        remoteUrl: 'https://api.example.com/v1/skill',
      });

      expect(registry.get('remote-engine', 'remote-skill')).toBeDefined();
    });

    it('throws if neither handler nor remoteUrl', () => {
      expect(() => {
        registry.register({
          engineId: 'bad',
          skillId: 'bad',
          name: 'Bad',
          description: '',
          inputSchema: {},
        });
      }).toThrow('must have either a handler or a remoteUrl');
    });
  });

  describe('unregister()', () => {
    it('removes a registered skill', () => {
      registry.register({
        engineId: 'x',
        skillId: 'y',
        name: 'XY',
        description: '',
        inputSchema: {},
        handler: async () => ({}),
      });

      expect(registry.unregister('x', 'y')).toBe(true);
      expect(registry.get('x', 'y')).toBeUndefined();
    });

    it('returns false for non-existent skill', () => {
      expect(registry.unregister('nope', 'nada')).toBe(false);
    });
  });

  describe('listAll() / listByEngine()', () => {
    beforeEach(() => {
      registry.register({ engineId: 'a', skillId: 's1', name: 'S1', description: '', inputSchema: {}, handler: async () => ({}) });
      registry.register({ engineId: 'a', skillId: 's2', name: 'S2', description: '', inputSchema: {}, handler: async () => ({}) });
      registry.register({ engineId: 'b', skillId: 's3', name: 'S3', description: '', inputSchema: {}, handler: async () => ({}) });
    });

    it('lists all skills', () => {
      expect(registry.listAll()).toHaveLength(3);
    });

    it('filters by engine', () => {
      expect(registry.listByEngine('a')).toHaveLength(2);
      expect(registry.listByEngine('b')).toHaveLength(1);
      expect(registry.listByEngine('c')).toHaveLength(0);
    });
  });

  describe('has()', () => {
    it('returns true for dynamic skills', () => {
      registry.register({ engineId: 'x', skillId: 'y', name: 'XY', description: '', inputSchema: {}, handler: async () => ({}) });
      expect(registry.has('x', 'y')).toBe(true);
    });

    it('returns true for built-in skills', () => {
      expect(registry.has('leak-detector', 'waste-waterfall')).toBe(true);
    });

    it('returns false for unknown skills', () => {
      expect(registry.has('unknown', 'skill')).toBe(false);
    });
  });

  describe('execute()', () => {
    it('executes local handler', async () => {
      registry.register({
        engineId: 'test',
        skillId: 'echo',
        name: 'Echo',
        description: 'Echoes input',
        inputSchema: {},
        handler: async (input) => ({ echo: input }),
      });

      const result = await registry.execute('test', 'echo', { message: 'hello' });
      expect(result).toEqual({ echo: { message: 'hello' } });
    });

    it('executes remote skill via fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ remote_result: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      registry.register({
        engineId: 'remote',
        skillId: 'analyze',
        name: 'Remote Analyze',
        description: '',
        inputSchema: {},
        remoteUrl: 'https://api.example.com/v1/analyze',
        remoteApiKey: 'secret-key',
      });

      const result = await registry.execute('remote', 'analyze', { data: [1, 2, 3] });

      expect(result).toEqual({ remote_result: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/analyze',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-API-Key': 'secret-key' }),
        }),
      );

      vi.unstubAllGlobals();
    });

    it('throws for non-existent skill', async () => {
      await expect(registry.execute('nope', 'nada', {})).rejects.toThrow('Dynamic skill not found');
    });

    it('throws on remote failure', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });
      vi.stubGlobal('fetch', mockFetch);

      registry.register({
        engineId: 'bad',
        skillId: 'fail',
        name: 'Fail',
        description: '',
        inputSchema: {},
        remoteUrl: 'https://bad.example.com',
      });

      await expect(registry.execute('bad', 'fail', {})).rejects.toThrow('Remote skill failed: 500');

      vi.unstubAllGlobals();
    });
  });
});
