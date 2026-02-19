import { useCallback } from 'react';
import { useEngineStore } from '../stores/engine-store';
import { runEngine } from '../api/agency';
import type { EngineResult } from '@openagency/types';

export function useEngine<T = unknown>(engineId: string, skillId: string) {
  const { loading, error, results, setLoading, setError, setResult } =
    useEngineStore();

  const key = `${engineId}:${skillId}`;
  const result = results[key] as EngineResult<T> | undefined;

  const run = useCallback(
    async (input: unknown) => {
      setLoading(true);
      setError(null);
      try {
        const res = await runEngine<T>(engineId, skillId, input);
        setResult(key, res as EngineResult<unknown>);
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [engineId, skillId, key, setLoading, setError, setResult],
  );

  return { run, result, loading, error };
}
