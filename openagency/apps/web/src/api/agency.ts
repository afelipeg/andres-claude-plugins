import {
  LeakDetectorEngine,
  MediaArchitectEngine,
  CampaignOpsEngine,
  ExecutiveBridgeEngine,
} from '@openagency/engines';
import type { Engine, EngineResult } from '@openagency/types';

const engines: Record<string, Engine> = {};

function getEngine(id: string): Engine {
  if (!engines[id]) {
    switch (id) {
      case 'leak-detector':
        engines[id] = new LeakDetectorEngine();
        break;
      case 'media-architect':
        engines[id] = new MediaArchitectEngine();
        break;
      case 'campaign-ops':
        engines[id] = new CampaignOpsEngine();
        break;
      case 'executive-bridge':
        engines[id] = new ExecutiveBridgeEngine();
        break;
      default:
        throw new Error(`Unknown engine: ${id}`);
    }
  }
  return engines[id];
}

export async function runEngine<T = unknown>(
  engineId: string,
  skillId: string,
  input: unknown,
): Promise<EngineResult<T>> {
  const engine = getEngine(engineId);
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

export function listEngines() {
  const all: Engine[] = [
    getEngine('leak-detector'),
    getEngine('media-architect'),
    getEngine('campaign-ops'),
    getEngine('executive-bridge'),
  ];
  return all.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    skills: e.skills,
  }));
}
