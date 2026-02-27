// ─── Connector Store (Zustand) ──────────────────────────────────────
// Manages connected platforms, credentials, and sync results for the web UI.

import { create } from 'zustand';
import type {
  ConnectorPlatform,
  ConnectionStatus,
  SyncInterval,
  SyncResult,
  NormalizedCampaignRow,
} from '@openagency/types';

export interface PlatformState {
  platform: ConnectorPlatform;
  status: ConnectionStatus;
  syncInterval: SyncInterval;
  lastSync?: SyncResult;
  rows: NormalizedCampaignRow[];
  error?: string;
}

interface ConnectorStore {
  platforms: Map<ConnectorPlatform, PlatformState>;
  passphrase: string | null;

  setPassphrase: (passphrase: string) => void;
  setStatus: (platform: ConnectorPlatform, status: ConnectionStatus) => void;
  setSyncInterval: (platform: ConnectorPlatform, interval: SyncInterval) => void;
  setSyncResult: (result: SyncResult) => void;
  connect: (platform: ConnectorPlatform) => void;
  disconnect: (platform: ConnectorPlatform) => void;
  getPlatform: (platform: ConnectorPlatform) => PlatformState | undefined;
  getConnectedPlatforms: () => PlatformState[];
  getAllRows: () => NormalizedCampaignRow[];
}

const DEFAULT_STATE = (platform: ConnectorPlatform): PlatformState => ({
  platform,
  status: 'disconnected',
  syncInterval: '1h',
  rows: [],
});

export const useConnectorStore = create<ConnectorStore>((set, get) => ({
  platforms: new Map(),
  passphrase: null,

  setPassphrase: (passphrase) => {
    set({ passphrase });
    // Store in sessionStorage for the session
    sessionStorage.setItem('oa_passphrase', passphrase);
  },

  setStatus: (platform, status) => {
    set((state) => {
      const platforms = new Map(state.platforms);
      const existing = platforms.get(platform) ?? DEFAULT_STATE(platform);
      platforms.set(platform, { ...existing, status });
      return { platforms };
    });
  },

  setSyncInterval: (platform, interval) => {
    set((state) => {
      const platforms = new Map(state.platforms);
      const existing = platforms.get(platform) ?? DEFAULT_STATE(platform);
      platforms.set(platform, { ...existing, syncInterval: interval });
      return { platforms };
    });
  },

  setSyncResult: (result) => {
    set((state) => {
      const platforms = new Map(state.platforms);
      const existing = platforms.get(result.platform) ?? DEFAULT_STATE(result.platform);
      platforms.set(result.platform, {
        ...existing,
        lastSync: result,
        rows: result.status === 'success' ? result.rows : existing.rows,
        status: result.status === 'error' ? 'error' : 'connected',
        error: result.error,
      });
      return { platforms };
    });
  },

  connect: (platform) => {
    set((state) => {
      const platforms = new Map(state.platforms);
      platforms.set(platform, {
        ...(platforms.get(platform) ?? DEFAULT_STATE(platform)),
        status: 'connected',
      });
      return { platforms };
    });
  },

  disconnect: (platform) => {
    set((state) => {
      const platforms = new Map(state.platforms);
      platforms.delete(platform);
      return { platforms };
    });
  },

  getPlatform: (platform) => get().platforms.get(platform),

  getConnectedPlatforms: () =>
    Array.from(get().platforms.values()).filter(
      (p) => p.status === 'connected' || p.status === 'expired',
    ),

  getAllRows: () =>
    Array.from(get().platforms.values()).flatMap((p) => p.rows),
}));
