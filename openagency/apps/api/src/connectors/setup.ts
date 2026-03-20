// ─── Connector Infrastructure Setup ─────────────────────────────────
// Registers platform connectors + writers, creates credential store,
// sync scheduler, and bridges sync events to the EventBus.

import type { EventBus, ConnectorPlatform, SyncResult } from '@openagency/types';
import {
  registerConnector,
  ConnectorWriteRegistry,
  SyncScheduler,
  NodeCredentialStore,
  GoogleAdsWriter,
  MetaWriter,
  DV360Writer,
  TikTokAdsWriter,
  TikTokShopWriter,
  AmazonAdsWriter,
} from '@openagency/connectors';
import { syncCompleted, syncFailed } from '@openagency/events';

export interface ConnectorInfra {
  credentialStore: NodeCredentialStore;
  syncScheduler: SyncScheduler;
  writeRegistry: ConnectorWriteRegistry;
  syncResultCache: Map<string, SyncResult>;
}

export function setupConnectors(eventBus: EventBus): ConnectorInfra {
  const writeRegistry = new ConnectorWriteRegistry();
  const syncResultCache = new Map<string, SyncResult>();

  // ─── Google Ads ─────────────────────────────────────────────────
  const gaClientId = process.env['GOOGLE_ADS_CLIENT_ID'];
  const gaClientSecret = process.env['GOOGLE_ADS_CLIENT_SECRET'];
  const gaDevToken = process.env['GOOGLE_ADS_DEVELOPER_TOKEN'];
  if (gaClientId && gaClientSecret && gaDevToken) {
    const writer = new GoogleAdsWriter({
      clientId: gaClientId,
      clientSecret: gaClientSecret,
      developerToken: gaDevToken,
    });
    registerConnector(writer);
    writeRegistry.registerWriter(writer);
  }

  // ─── Meta Ads ───────────────────────────────────────────────────
  const metaAppId = process.env['META_APP_ID'];
  const metaAppSecret = process.env['META_APP_SECRET'];
  if (metaAppId && metaAppSecret) {
    const writer = new MetaWriter({ appId: metaAppId, appSecret: metaAppSecret });
    registerConnector(writer);
    writeRegistry.registerWriter(writer);
  }

  // ─── DV360 ──────────────────────────────────────────────────────
  const dv360ClientId = process.env['DV360_CLIENT_ID'];
  const dv360ClientSecret = process.env['DV360_CLIENT_SECRET'];
  if (dv360ClientId && dv360ClientSecret) {
    const writer = new DV360Writer({ clientId: dv360ClientId, clientSecret: dv360ClientSecret });
    registerConnector(writer);
    writeRegistry.registerWriter(writer);
  }

  // ─── TikTok Ads ─────────────────────────────────────────────────
  const ttAdsAppId = process.env['TIKTOK_ADS_APP_ID'];
  const ttAdsSecret = process.env['TIKTOK_ADS_SECRET'];
  if (ttAdsAppId && ttAdsSecret) {
    const writer = new TikTokAdsWriter({ appId: ttAdsAppId, secret: ttAdsSecret });
    registerConnector(writer);
    writeRegistry.registerWriter(writer);
  }

  // ─── TikTok Shop ───────────────────────────────────────────────
  const ttShopAppKey = process.env['TIKTOK_SHOP_APP_KEY'];
  const ttShopAppSecret = process.env['TIKTOK_SHOP_APP_SECRET'];
  if (ttShopAppKey && ttShopAppSecret) {
    const writer = new TikTokShopWriter({ appKey: ttShopAppKey, appSecret: ttShopAppSecret });
    registerConnector(writer);
    writeRegistry.registerWriter(writer);
  }

  // ─── Amazon Ads ─────────────────────────────────────────────────
  const amzClientId = process.env['AMAZON_ADS_CLIENT_ID'];
  const amzClientSecret = process.env['AMAZON_ADS_CLIENT_SECRET'];
  if (amzClientId && amzClientSecret) {
    const writer = new AmazonAdsWriter({ clientId: amzClientId, clientSecret: amzClientSecret });
    registerConnector(writer);
    writeRegistry.registerWriter(writer);
  }

  // ─── Credential store ──────────────────────────────────────────
  const credentialStore = new NodeCredentialStore(
    process.env['CREDENTIAL_PASSPHRASE'] ?? 'openagency-dev',
  );

  // ─── Sync scheduler ───────────────────────────────────────────
  const syncScheduler = new SyncScheduler();

  syncScheduler.onSync((result: SyncResult) => {
    syncResultCache.set(result.platform, result);

    if (result.status === 'error') {
      void eventBus.publish(
        syncFailed({ platform: result.platform, error: result.error ?? 'Unknown error' }),
      );
    } else {
      void eventBus.publish(
        syncCompleted({
          platform: result.platform,
          row_count: result.row_count,
          date_range: result.date_range,
        }),
      );
    }
  });

  return { credentialStore, syncScheduler, writeRegistry, syncResultCache };
}
