// ─── A2A Client ────────────────────────────────────────────────────
// Discovers and invokes skills on remote OpenAgency instances via A2A protocol.

import { createLogger } from '@openagency/core';
import type {
  AgentCard,
  RemoteSkillInvocation,
  RemoteSkillResult,
  FederationDiscoveryResult,
} from './types.js';

const log = createLogger('federation:a2a');

export class A2AClient {
  private discovered = new Map<string, FederationDiscoveryResult>();

  /** Discover a remote agent by fetching its /.well-known/agent.json */
  async discover(baseUrl: string): Promise<FederationDiscoveryResult> {
    const url = baseUrl.replace(/\/+$/, '');
    const wellKnown = `${url}/.well-known/agent.json`;

    log.info({ url: wellKnown }, 'Discovering remote agent');

    const res = await fetch(wellKnown, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Discovery failed: ${res.status} ${res.statusText}`);
    }

    const card = (await res.json()) as AgentCard;
    const result: FederationDiscoveryResult = {
      url,
      card,
      discovered_at: new Date().toISOString(),
    };

    this.discovered.set(url, result);
    log.info({ name: card.name, version: card.version, capabilities: card.capabilities.length }, 'Agent discovered');

    return result;
  }

  /** Invoke a skill on a remote agent via REST */
  async invokeSkill(invocation: RemoteSkillInvocation): Promise<RemoteSkillResult> {
    const { base_url, engine_id, skill_id, input, api_key } = invocation;
    const url = `${base_url.replace(/\/+$/, '')}/v1/engines/${engine_id}/skills/${skill_id}`;

    log.info({ url, engine_id, skill_id }, 'Invoking remote skill');
    const start = Date.now();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (api_key) headers['X-API-Key'] = api_key;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30_000),
      });

      const duration_ms = Date.now() - start;

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        log.warn({ status: res.status, engine_id, skill_id }, 'Remote skill failed');
        return { success: false, error: `HTTP ${res.status}: ${text}`, duration_ms, source: base_url };
      }

      const data = await res.json();
      log.info({ engine_id, skill_id, duration_ms }, 'Remote skill completed');

      return { success: true, data, duration_ms, source: base_url };
    } catch (err) {
      const duration_ms = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message, engine_id, skill_id }, 'Remote skill error');
      return { success: false, error: message, duration_ms, source: base_url };
    }
  }

  /** List all discovered agents */
  listDiscovered(): FederationDiscoveryResult[] {
    return Array.from(this.discovered.values());
  }

  /** Get a specific discovered agent */
  getDiscovered(url: string): FederationDiscoveryResult | undefined {
    return this.discovered.get(url.replace(/\/+$/, ''));
  }

  /** Remove a discovered agent */
  forget(url: string): boolean {
    return this.discovered.delete(url.replace(/\/+$/, ''));
  }
}
