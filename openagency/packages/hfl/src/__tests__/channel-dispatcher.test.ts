import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelDispatcher } from '../channel-dispatcher.js';
import type { ChannelConfig, RenderOutput } from '../types.js';

function makeChannel(overrides?: Partial<ChannelConfig>): ChannelConfig {
  return {
    id: 'test-channel',
    type: 'webhook',
    url: 'https://hooks.slack.com/services/T00/B00/xxx',
    render_level: 'rich',
    active: true,
    ...overrides,
  };
}

function makePayload(): RenderOutput {
  return {
    format: 'text',
    content: 'Test payload',
    actions: [{ label: 'Approve', url: '/approve', method: 'POST' }],
  };
}

describe('ChannelDispatcher', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches successfully on 200', async () => {
    mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const dispatcher = new ChannelDispatcher({ max_retries: 0, retry_delay_ms: 10, timeout_ms: 5000 });
    const result = await dispatcher.dispatch(makeChannel(), makePayload());

    expect(result.success).toBe(true);
    expect(result.status_code).toBe(200);
    expect(result.retries).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns failure for inactive channel', async () => {
    const dispatcher = new ChannelDispatcher();
    const result = await dispatcher.dispatch(makeChannel({ active: false }), makePayload());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Channel is inactive');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips dispatch for mcp_callback type', async () => {
    const dispatcher = new ChannelDispatcher();
    const result = await dispatcher.dispatch(
      makeChannel({ type: 'mcp_callback' }),
      makePayload(),
    );

    expect(result.success).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries on 500 error', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const dispatcher = new ChannelDispatcher({ max_retries: 2, retry_delay_ms: 10, timeout_ms: 5000 });
    const result = await dispatcher.dispatch(makeChannel(), makePayload());

    expect(result.success).toBe(true);
    expect(result.retries).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx errors', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));

    const dispatcher = new ChannelDispatcher({ max_retries: 3, retry_delay_ms: 10, timeout_ms: 5000 });
    const result = await dispatcher.dispatch(makeChannel(), makePayload());

    expect(result.success).toBe(false);
    expect(result.status_code).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles network errors with retry', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const dispatcher = new ChannelDispatcher({ max_retries: 1, retry_delay_ms: 10, timeout_ms: 5000 });
    const result = await dispatcher.dispatch(makeChannel(), makePayload());

    expect(result.success).toBe(true);
    expect(result.retries).toBe(1);
  });

  it('fails after exhausting retries', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const dispatcher = new ChannelDispatcher({ max_retries: 2, retry_delay_ms: 10, timeout_ms: 5000 });
    const result = await dispatcher.dispatch(makeChannel(), makePayload());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
    expect(result.retries).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('sends correct payload format', async () => {
    mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const dispatcher = new ChannelDispatcher({ max_retries: 0, retry_delay_ms: 10, timeout_ms: 5000 });
    await dispatcher.dispatch(makeChannel(), makePayload(), { decision_id: 'd-1' });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/services/T00/B00/xxx');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body as string);
    expect(body.payload.content).toBe('Test payload');
    expect(body.metadata.decision_id).toBe('d-1');
  });
});
