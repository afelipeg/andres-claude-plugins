import { create } from 'zustand';
import {
  getReports,
  saveReport,
  deleteReport,
  clearReports,
  type SavedReport,
} from '../lib/db';

interface HistoryState {
  reports: SavedReport[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (report: Omit<SavedReport, 'id'>) => Promise<SavedReport>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  reports: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    const reports = await getReports();
    set({ reports, loaded: true });
  },

  save: async (partial) => {
    const report: SavedReport = { ...partial, id: genId() };
    await saveReport(report);
    set((state) => ({ reports: [report, ...state.reports] }));
    return report;
  },

  remove: async (id) => {
    await deleteReport(id);
    set((state) => ({ reports: state.reports.filter((r) => r.id !== id) }));
  },

  clearAll: async () => {
    await clearReports();
    set({ reports: [] });
  },
}));
