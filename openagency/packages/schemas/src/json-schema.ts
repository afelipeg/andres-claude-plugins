// ─── JSON Schema Generation ─────────────────────────────────────────
// Converts Zod schemas to JSON Schema 2020-12 for external consumers.

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import { SKILL_SCHEMAS, type SkillSchemaEntry } from './registry.js';

export interface SkillJsonSchema {
  engineId: string;
  skillId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

function toJsonSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(zodSchema, { target: 'openApi3' }) as Record<
    string,
    unknown
  >;
}

export function skillToJsonSchema(entry: SkillSchemaEntry): SkillJsonSchema {
  return {
    engineId: entry.engineId,
    skillId: entry.skillId,
    name: entry.name,
    description: entry.description,
    inputSchema: toJsonSchema(entry.inputSchema),
    outputSchema: toJsonSchema(entry.outputSchema),
  };
}

export function allSkillJsonSchemas(): SkillJsonSchema[] {
  return SKILL_SCHEMAS.map(skillToJsonSchema);
}

export function getSkillJsonSchema(
  engineId: string,
  skillId: string,
): SkillJsonSchema | undefined {
  const entry = SKILL_SCHEMAS.find(
    (s) => s.engineId === engineId && s.skillId === skillId,
  );
  return entry ? skillToJsonSchema(entry) : undefined;
}
