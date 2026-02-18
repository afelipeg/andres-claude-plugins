// ─── Engine Framework Types ─────────────────────────────────────────

export interface Engine {
  id: string;
  name: string;
  description: string;
  skills: string[];
  run(skill: string, input: unknown): Promise<unknown>;
}

export interface EngineResult<T = unknown> {
  engine: string;
  skill: string;
  data: T;
  timestamp: string;
  duration_ms: number;
}

export interface SkillMetadata {
  name: string;
  description: string;
  commands: string[];
}
