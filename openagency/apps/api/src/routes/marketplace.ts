// ─── Marketplace Routes ────────────────────────────────────────────
// Dynamic skill registration, listing, and execution.

import { Hono } from 'hono';
import type { DynamicSkillRegistry, DynamicSkillDef } from '@openagency/schemas';
import { SKILL_SCHEMAS } from '@openagency/schemas';

export function marketplaceRoutes(registry: DynamicSkillRegistry) {
  const app = new Hono();

  /** Register a new dynamic skill */
  app.post('/v1/marketplace/skills', async (c) => {
    const body = await c.req.json<{
      engine_id: string;
      skill_id: string;
      name: string;
      description: string;
      input_schema?: Record<string, unknown>;
      remote_url?: string;
      remote_api_key?: string;
    }>();

    if (!body.engine_id || !body.skill_id || !body.name) {
      return c.json({ error: 'engine_id, skill_id, and name are required' }, 400);
    }

    if (!body.remote_url) {
      return c.json({ error: 'remote_url is required for marketplace skills' }, 400);
    }

    const skill: DynamicSkillDef = {
      engineId: body.engine_id,
      skillId: body.skill_id,
      name: body.name,
      description: body.description ?? '',
      inputSchema: body.input_schema ?? {},
      remoteUrl: body.remote_url,
      remoteApiKey: body.remote_api_key,
    };

    registry.register(skill);

    return c.json({
      status: 'registered',
      key: `${skill.engineId}:${skill.skillId}`,
      name: skill.name,
    }, 201);
  });

  /** List all skills (built-in + dynamic) */
  app.get('/v1/marketplace/skills', (c) => {
    const builtIn = SKILL_SCHEMAS.map((s) => ({
      engine_id: s.engineId,
      skill_id: s.skillId,
      name: s.name,
      description: s.description,
      source: 'built-in' as const,
    }));

    const dynamic = registry.listAll().map((s) => ({
      engine_id: s.engineId,
      skill_id: s.skillId,
      name: s.name,
      description: s.description,
      source: 'dynamic' as const,
      remote_url: s.remoteUrl,
    }));

    return c.json({ skills: [...builtIn, ...dynamic], total: builtIn.length + dynamic.length });
  });

  /** Execute a dynamic skill */
  app.post('/v1/marketplace/skills/:engineId/:skillId/execute', async (c) => {
    const engineId = c.req.param('engineId');
    const skillId = c.req.param('skillId');
    const input = await c.req.json<Record<string, unknown>>();

    if (!registry.get(engineId, skillId)) {
      return c.json({ error: `Dynamic skill not found: ${engineId}:${skillId}` }, 404);
    }

    try {
      const result = await registry.execute(engineId, skillId, input);
      return c.json({ result });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Execution failed' }, 500);
    }
  });

  /** Unregister a dynamic skill */
  app.delete('/v1/marketplace/skills/:engineId/:skillId', (c) => {
    const removed = registry.unregister(c.req.param('engineId'), c.req.param('skillId'));
    return c.json({ removed });
  });

  return app;
}
