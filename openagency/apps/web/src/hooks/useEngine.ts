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
  // Use individual selectors — Zustand 5 + React 19 returns a new object
  // reference when called without a selector, causing maximum update depth
  // exceeded (React error #185) due to infinite re-render loops.
  const loading = useEngineStore((s) => s.loading);
  const error = useEngineStore((s) => s.error);
  const results = useEngineStore((s) => s.results);
  const setLoading = useEngineStore((s) => s.setLoading);
  const setError = useEngineStore((s) => s.setError);
  const setResult = useEngineStore((s) => s.setResult);
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
