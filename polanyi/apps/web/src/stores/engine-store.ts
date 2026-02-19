import { create } from 'zustand';
import type { EngineResult } from '@openagency/types';

interface EngineState {
  loading: boolean;
  error: string | null;
  results: Record<string, EngineResult<unknown>>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setResult: (key: string, result: EngineResult<unknown>) => void;
  clearResult: (key: string) => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  loading: false,
  error: null,
  results: {},
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setResult: (key, result) =>
    set((state) => ({ results: { ...state.results, [key]: result } })),
  clearResult: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.results;
      void _;
      return { results: rest };
    }),
}));
