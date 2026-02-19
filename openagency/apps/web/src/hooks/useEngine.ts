import { useCallback } from 'react';
import { useEngineStore } from '../stores/engine-store';
import { useHistoryStore } from '../stores/history-store';
import { runEngine } from '../api/agency';
import type { EngineResult } from '@openagency/types';

const ENGINE_LABELS: Record<string, string> = {
  'leak-detector': 'Leak Detector',
  'media-architect': 'Media Architect',
  'campaign-ops': 'Campaign Ops',
  'executive-bridge': 'Executive Bridge',
};

export function useEngine<T = unknown>(engineId: string, skillId: string) {
  const { loading, error, results, setLoading, setError, setResult } =
    useEngineStore();
  const saveHistory = useHistoryStore((s) => s.save);

  const key = `${engineId}:${skillId}`;
  const result = results[key] as EngineResult<T> | undefined;

  const run = useCallback(
    async (input: unknown) => {
      setLoading(true);
      setError(null);
      try {
        const res = await runEngine<T>(engineId, skillId, input);
        setResult(key, res as EngineResult<unknown>);

        // Auto-save to IndexedDB
        saveHistory({
          engineId,
          skillId,
          timestamp: res.timestamp,
          label: `${ENGINE_LABELS[engineId] ?? engineId} - ${skillId}`,
          data: res.data,
          duration_ms: res.duration_ms,
        }).catch(() => {
          // Silently fail — persistence is best-effort
        });

        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [engineId, skillId, key, setLoading, setError, setResult, saveHistory],
  );

  return { run, result, loading, error };
}
