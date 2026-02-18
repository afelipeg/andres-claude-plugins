// ─── Engine Registry ────────────────────────────────────────────────

import type { Engine } from '@openagency/types';

export class EngineRegistry {
  private engines = new Map<string, Engine>();

  register(engine: Engine): void {
    this.engines.set(engine.id, engine);
  }

  get(id: string): Engine {
    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(
        `Engine "${id}" not found. Available: ${[...this.engines.keys()].join(', ')}`,
      );
    }
    return engine;
  }

  has(id: string): boolean {
    return this.engines.has(id);
  }

  list(): Engine[] {
    return [...this.engines.values()];
  }

  listIds(): string[] {
    return [...this.engines.keys()];
  }
}
