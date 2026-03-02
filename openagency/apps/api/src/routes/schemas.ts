// ─── Schema Routes ──────────────────────────────────────────────────

import { Hono } from 'hono';
import { getSkillJsonSchema, allSkillJsonSchemas } from '@openagency/schemas';
import { generateOpenApiSpec } from '@openagency/schemas';

export function schemaRoutes() {
  const app = new Hono();

  // ─── JSON Schema for a specific skill ───────────────────────────
  app.get('/v1/schemas/:engineId/:skillId', (c) => {
    const engineId = c.req.param('engineId');
    const skillId = c.req.param('skillId');
    const schema = getSkillJsonSchema(engineId, skillId);
    if (!schema) {
      return c.json(
        { error: 'not_found', message: `Schema for "${engineId}:${skillId}" not found`, status: 404 },
        404,
      );
    }
    return c.json(schema);
  });

  // ─── OpenAPI 3.1 spec ──────────────────────────────────────────
  app.get('/v1/openapi.json', (c) => {
    const baseUrl =
      process.env['API_BASE_URL'] ?? `http://localhost:${process.env['PORT'] ?? '3100'}`;
    const spec = generateOpenApiSpec(baseUrl);
    return c.json(spec);
  });

  return app;
}
