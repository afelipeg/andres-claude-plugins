// ─── OpenAgency Orchestrator ────────────────────────────────────────

import type { OpenAgencyConfig, EngineResult } from '@openagency/types';
import { EngineRegistry } from './engine-registry.js';
import { loadConfig } from './config.js';

export class OpenAgency {
  readonly config: OpenAgencyConfig;
  readonly engines: EngineRegistry;

  constructor(config?: Partial<OpenAgencyConfig>) {
    const savedConfig = loadConfig();
    this.config = { ...savedConfig, ...config };
    this.engines = new EngineRegistry();
  }

  /**
   * Run a specific skill within an engine.
   * Returns typed result with timing metadata.
   */
  async run<T = unknown>(
    engineId: string,
    skillId: string,
    input: unknown,
  ): Promise<EngineResult<T>> {
    const engine = this.engines.get(engineId);
    const start = Date.now();

    const data = (await engine.run(skillId, input)) as T;

    return {
      engine: engineId,
      skill: skillId,
      data,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
    };
  }

  /**
   * List all available engines with their skills.
   */
  listEngines(): Array<{ id: string; name: string; description: string; skills: string[] }> {
    return this.engines.list().map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      skills: e.skills,
    }));
  }
}
