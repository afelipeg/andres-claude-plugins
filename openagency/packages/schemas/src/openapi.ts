// ─── OpenAPI 3.1 Spec Generation ────────────────────────────────────

import { allSkillJsonSchemas } from './json-schema.js';
import { listEngineIds, getEngineSkills } from './registry.js';

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  security: Array<Record<string, unknown>>;
}

export function generateOpenApiSpec(baseUrl = 'http://localhost:3100'): OpenApiSpec {
  const schemas = allSkillJsonSchemas();
  const paths: Record<string, unknown> = {};
  const componentSchemas: Record<string, unknown> = {};

  // Health + readiness
  paths['/health'] = {
    get: {
      summary: 'Liveness probe',
      operationId: 'health',
      tags: ['System'],
      responses: { '200': { description: 'OK' } },
    },
  };

  paths['/ready'] = {
    get: {
      summary: 'Readiness probe',
      operationId: 'ready',
      tags: ['System'],
      responses: { '200': { description: 'OK' } },
    },
  };

  // Engine listing
  paths['/v1/engines'] = {
    get: {
      summary: 'List all engines and their skills',
      operationId: 'listEngines',
      tags: ['Engines'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      responses: { '200': { description: 'Engine list' } },
    },
  };

  // Skill execution endpoints
  for (const schema of schemas) {
    const path = `/v1/engines/${schema.engineId}/skills/${schema.skillId}`;
    const schemaKey = `${schema.engineId}_${schema.skillId}`.replace(/-/g, '_');

    componentSchemas[`${schemaKey}_input`] = schema.inputSchema;
    componentSchemas[`${schemaKey}_output`] = schema.outputSchema;

    paths[path] = {
      post: {
        summary: schema.name,
        description: schema.description,
        operationId: `${schema.engineId}_${schema.skillId}`.replace(/-/g, '_'),
        tags: [schema.engineId],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${schemaKey}_input` },
            },
          },
        },
        responses: {
          '200': {
            description: 'Skill execution result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    engine: { type: 'string' },
                    skill: { type: 'string' },
                    data: {
                      $ref: `#/components/schemas/${schemaKey}_output`,
                    },
                    timestamp: { type: 'string' },
                    duration_ms: { type: 'number' },
                    trace_id: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Rate limited' },
        },
      },
    };

    // Schema endpoint (public)
    paths[`/v1/schemas/${schema.engineId}/${schema.skillId}`] = {
      get: {
        summary: `JSON Schema for ${schema.name}`,
        operationId: `schema_${schemaKey}`,
        tags: ['Schemas'],
        responses: {
          '200': {
            description: 'JSON Schema',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'OpenAgency API',
      version: '1.0.0',
      description:
        'OpenAgency exposes 4 ad-tech engines and 29 skills as REST, MCP, and A2A endpoints. Every engine is consumable by any AI agent.',
    },
    servers: [{ url: baseUrl, description: 'Default' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: componentSchemas,
    },
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  };
}
