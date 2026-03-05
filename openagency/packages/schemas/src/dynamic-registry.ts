// ─── Dynamic Skill Registry ────────────────────────────────────────
// Manages dynamically registered skills (both local handlers and remote endpoints).
// Complements the static SKILL_SCHEMAS with runtime-registered skills.

import type { z } from 'zod';
import type { SkillSchemaEntry } from './registry.js';
import { SKILL_SCHEMA_MAP } from './registry.js';

export interface DynamicSkillDef {
  engineId: string;
  skillId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler?: (input: Record<string, unknown>) => Promise<unknown>;
  remoteUrl?: string;
  remoteApiKey?: string;
}

export class DynamicSkillRegistry {
  private skills = new Map<string, DynamicSkillDef>();

  /** Register a dynamic skill (local handler or remote endpoint) */
  register(skill: DynamicSkillDef): void {
    if (!skill.handler && !skill.remoteUrl) {
      throw new Error('Skill must have either a handler or a remoteUrl');
    }
    const key = `${skill.engineId}:${skill.skillId}`;
    this.skills.set(key, skill);
  }

  /** Unregister a dynamic skill */
  unregister(engineId: string, skillId: string): boolean {
    return this.skills.delete(`${engineId}:${skillId}`);
  }

  /** Get a dynamic skill by engine/skill IDs */
  get(engineId: string, skillId: string): DynamicSkillDef | undefined {
    return this.skills.get(`${engineId}:${skillId}`);
  }

  /** Check if a skill exists (dynamic or built-in) */
  has(engineId: string, skillId: string): boolean {
    const key = `${engineId}:${skillId}`;
    return this.skills.has(key) || SKILL_SCHEMA_MAP.has(key);
  }

  /** List all dynamic skills */
  listAll(): DynamicSkillDef[] {
    return Array.from(this.skills.values());
  }

  /** List dynamic skills for an engine */
  listByEngine(engineId: string): DynamicSkillDef[] {
    return this.listAll().filter((s) => s.engineId === engineId);
  }

  /** Execute a dynamic skill */
  async execute(engineId: string, skillId: string, input: Record<string, unknown>): Promise<unknown> {
    const skill = this.get(engineId, skillId);
    if (!skill) {
      throw new Error(`Dynamic skill not found: ${engineId}:${skillId}`);
    }

    // Local handler
    if (skill.handler) {
      return skill.handler(input);
    }

    // Remote endpoint
    if (skill.remoteUrl) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (skill.remoteApiKey) headers['X-API-Key'] = skill.remoteApiKey;

      const res = await fetch(skill.remoteUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Remote skill failed: ${res.status} ${text}`);
      }

      return res.json();
    }

    throw new Error(`Skill ${engineId}:${skillId} has no handler or remote URL`);
  }
}
