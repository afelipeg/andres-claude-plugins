// ─── @openagency/connectors ─────────────────────────────────────────
// Platform API connectors: OAuth2, data sync, credential storage.

// Registry
export { registerConnector, getConnector, hasConnector, listConnectors } from './registry.js';

// Auth
export { OAuth2Client, type OAuth2Config, type OAuth2Tokens } from './auth/index.js';

// Utils
export { RateLimiter, PLATFORM_RATE_LIMITS } from './utils/rate-limiter.js';
export { withRetry, type RetryOptions } from './utils/retry.js';

// Transforms
export {
  apiToWasteInput,
  apiToChannelInput,
  apiToOptimizationInput,
  apiToMMMInput,
  apiToRevenueBridgeInput,
} from './transforms/api-to-engine.js';

// Platform connectors
export { MetaConnector } from './platforms/meta/meta-connector.js';
export { GoogleAdsConnector } from './platforms/google-ads/google-ads-connector.js';
export { DV360Connector } from './platforms/dv360/dv360-connector.js';
export { TikTokAdsConnector } from './platforms/tiktok-ads/tiktok-ads-connector.js';
export { TikTokShopConnector } from './platforms/tiktok-shop/tiktok-shop-connector.js';
export { AmazonAdsConnector } from './platforms/amazon-ads/amazon-ads-connector.js';

// Sync
export { SyncScheduler } from './sync/scheduler.js';

// Re-export key types for convenience
export type {
  ConnectorPlatform,
  ConnectionStatus,
  SyncInterval,
  OAuthTokens,
  PlatformCredentials,
  ConnectorConfig,
  NormalizedCampaignRow,
  SyncResult,
  PlatformConnector,
  PlatformAccount,
  RateLimitConfig,
  DataLevel,
  FetchOptions,
  AmazonAdProduct,
} from '@openagency/types';
