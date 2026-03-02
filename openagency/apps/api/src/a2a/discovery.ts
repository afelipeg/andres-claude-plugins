// ─── A2A Discovery Endpoint ─────────────────────────────────────────

import { Hono } from 'hono';
import { generateAgentCard } from './agent-card.js';

export function a2aDiscoveryRoute() {
  const app = new Hono();

  app.get('/.well-known/agent.json', (c) => {
    const baseUrl =
      process.env['API_BASE_URL'] ??
      `http://localhost:${process.env['PORT'] ?? '3100'}`;
    const card = generateAgentCard(baseUrl);
    return c.json(card);
  });

  return app;
}
