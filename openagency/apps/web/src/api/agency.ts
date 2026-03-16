import {
  LeakDetectorEngine,
  MediaArchitectEngine,
  CampaignOpsEngine,
  ExecutiveBridgeEngine,
} from '@openagency/engines';
import type { Engine, EngineResult } from '@openagency/types';

// ─── API Mode ──────────────────────────────────────────────────────
// When VITE_API_URL is set, route all engine calls through the API server.
// Otherwise, fall back to direct in-browser engine execution.

const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

// ─── Direct Engine Mode (default) ──────────────────────────────────

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

async function runEngineLocal<T>(
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

// ─── API Client Mode ───────────────────────────────────────────────

async function runEngineRemote<T>(
  engineId: string,
  skillId: string,
  input: unknown,
): Promise<EngineResult<T>> {
  const url = `${API_URL}/v1/engines/${engineId}/skills/${skillId}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const token = localStorage.getItem('plinth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? `API error ${res.status}`,
    );
  }

  return (await res.json()) as EngineResult<T>;
}

// ─── Public API (auto-selects mode) ────────────────────────────────

export async function runEngine<T = unknown>(
  engineId: string,
  skillId: string,
  input: unknown,
): Promise<EngineResult<T>> {
  if (API_URL) return runEngineRemote<T>(engineId, skillId, input);
  return runEngineLocal<T>(engineId, skillId, input);
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

/** Whether the web app is using API mode */
export function isApiMode(): boolean {
  return !!API_URL;
}
