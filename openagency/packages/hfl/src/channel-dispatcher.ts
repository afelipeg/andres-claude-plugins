// ─── Channel Dispatcher ─────────────────────────────────────────────
// Dispatches HFL payloads to configured webhook channels.
// Fire-and-forget with retry — OpenAgency doesn't depend on Slack being up.

import { createLogger } from '@openagency/core';
import type { ChannelConfig, DispatchResult, RenderOutput } from './types.js';

const log = createLogger('hfl:dispatch');

export interface DispatchOptions {
  max_retries: number;
  retry_delay_ms: number;
  timeout_ms: number;
}

const DEFAULT_OPTIONS: DispatchOptions = {
  max_retries: 3,
  retry_delay_ms: 1000,
  timeout_ms: 10_000,
};

export class ChannelDispatcher {
  private options: DispatchOptions;

  constructor(options?: Partial<DispatchOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async dispatch(
    channel: ChannelConfig,
    payload: RenderOutput,
    metadata?: Record<string, unknown>,
  ): Promise<DispatchResult> {
    if (!channel.active) {
      return {
        channel_id: channel.id,
        success: false,
        error: 'Channel is inactive',
        retries: 0,
        dispatched_at: new Date().toISOString(),
      };
    }

    if (channel.type === 'mcp_callback') {
      // MCP callbacks are handled by the MCP transport layer
      log.info({ channel_id: channel.id }, 'MCP callback — skipping HTTP dispatch');
      return {
        channel_id: channel.id,
        success: true,
        retries: 0,
        dispatched_at: new Date().toISOString(),
      };
    }

    // Webhook dispatch with retry
    const body = JSON.stringify({
      payload,
      metadata: metadata ?? {},
      dispatched_at: new Date().toISOString(),
    });

    let lastError: string | undefined;
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt <= this.options.max_retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.options.retry_delay_ms * Math.pow(2, attempt - 1);
          await sleep(delay);
          log.info({ channel_id: channel.id, attempt }, 'Retrying dispatch');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.options.timeout_ms,
        );

        const response = await fetch(channel.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatus = response.status;

        if (response.ok) {
          log.info({ channel_id: channel.id, status: response.status }, 'Dispatch successful');
          return {
            channel_id: channel.id,
            success: true,
            status_code: response.status,
            retries: attempt,
            dispatched_at: new Date().toISOString(),
          };
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;

        // Don't retry 4xx (client errors)
        if (response.status >= 400 && response.status < 500) {
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (lastError.includes('aborted')) {
          lastError = 'Request timed out';
        }
      }
    }

    log.error({ channel_id: channel.id, error: lastError }, 'Dispatch failed after retries');

    return {
      channel_id: channel.id,
      success: false,
      status_code: lastStatus,
      error: lastError,
      retries: this.options.max_retries,
      dispatched_at: new Date().toISOString(),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
