import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEmbedding } from '../vector/embeddings.js';

describe('generateEmbedding', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null without VOYAGE_API_KEY', async () => {
    delete process.env['VOYAGE_API_KEY'];
    const result = await generateEmbedding('test text');
    expect(result).toBeNull();
  });

  it('calls Voyage AI endpoint when key exists', async () => {
    process.env['VOYAGE_API_KEY'] = 'voy-test-key';

    const mockEmbedding = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    } as Response);

    const result = await generateEmbedding('test text');

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://api.voyageai.com/v1/embeddings');
    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.model).toBe('voyage-3');
    expect(body.input).toBe('test text');
    expect(result).toEqual(mockEmbedding);
  });

  it('returns null on API error (graceful fallback)', async () => {
    process.env['VOYAGE_API_KEY'] = 'voy-test-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await generateEmbedding('test text');
    expect(result).toBeNull();
  });

  it('returns null on fetch exception (graceful fallback)', async () => {
    process.env['VOYAGE_API_KEY'] = 'voy-test-key';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await generateEmbedding('test text');
    expect(result).toBeNull();
  });
});
