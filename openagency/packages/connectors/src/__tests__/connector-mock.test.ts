// ─── Platform Connector Mock Tests ─────────────────────────────────
// Tests connector interface compliance using mock HTTP responses.
// Each platform's core operations are tested without real API calls.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleAdsConnector } from '../platforms/google-ads/google-ads-connector.js';
import { MetaConnector } from '../platforms/meta/meta-connector.js';
import { TikTokAdsConnector } from '../platforms/tiktok-ads/tiktok-ads-connector.js';
import { DV360Connector } from '../platforms/dv360/dv360-connector.js';
import { AmazonAdsConnector } from '../platforms/amazon-ads/amazon-ads-connector.js';
import { TikTokShopConnector } from '../platforms/tiktok-shop/tiktok-shop-connector.js';
import type { OAuthTokens, NormalizedCampaignRow, PlatformAccount } from '@openagency/types';

const mockFetch = vi.fn();

const validTokens: OAuthTokens = {
  access_token: 'test_access_token',
  refresh_token: 'test_refresh_token',
  token_type: 'Bearer',
  expires_at: Date.now() + 7_200_000, // 2 hours (Meta needs >1hr buffer)
  scope: 'ads_read',
};

const expiredTokens: OAuthTokens = {
  ...validTokens,
  expires_at: Date.now() - 1000,
};

// ─── Google Ads ────────────────────────────────────────────────────

describe('GoogleAdsConnector', () => {
  let connector: GoogleAdsConnector;

  beforeEach(() => {
    connector = new GoogleAdsConnector({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      developerToken: 'test_dev_token',
    });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates correct OAuth URL', () => {
    const url = connector.getAuthUrl('https://localhost/callback');
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=test_client_id');
    expect(url).toContain('redirect_uri=');
  });

  it('detects valid tokens', () => {
    expect(connector.isTokenValid(validTokens)).toBe(true);
    expect(connector.isTokenValid(expiredTokens)).toBe(false);
  });

  it('exchanges auth code for tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const tokens = await connector.exchangeCode('auth_code_123', 'https://localhost/callback');
    expect(tokens.access_token).toBe('new_access');
    expect(tokens.refresh_token).toBe('new_refresh');
    expect(tokens.expires_at).toBeGreaterThan(Date.now());
  });

  it('refreshes expired tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'refreshed_access',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const tokens = await connector.refreshTokens(expiredTokens);
    expect(tokens.access_token).toBe('refreshed_access');
    expect(tokens.refresh_token).toBe(expiredTokens.refresh_token);
  });

  it('lists customer accounts', async () => {
    // Google Ads listAccessibleCustomers returns resourceNames
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        resourceNames: ['customers/123456', 'customers/789012'],
      }),
    });

    const accounts = await connector.listAccounts(validTokens);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({ id: '123456', name: '123456' });
  });

  it('fetches campaigns with normalized data', async () => {
    // Google Ads searchStream returns array of batches
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          results: [
            {
              campaign: { id: 'c1', name: 'Brand Campaign', status: 'ENABLED' },
              metrics: {
                costMicros: 500000000,
                impressions: 1000000,
                clicks: 10000,
                conversions: 100,
                conversionsValue: 50000,
                ctr: 0.01,
                averageCpm: 500000,
              },
              segments: { date: '2024-01-15' },
            },
          ],
        },
      ]),
    });

    const credentials = { platform: 'google_ads' as const, tokens: validTokens, account_id: '123456', developer_token: 'test_dev_token', connected_at: new Date().toISOString() };
    const rows = await connector.fetchCampaigns(credentials, { start: '2024-01-01', end: '2024-01-31' });

    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row.platform).toBe('google_ads');
    expect(row.campaign_id).toBe('c1');
    expect(typeof row.spend).toBe('number');
    expect(typeof row.impressions).toBe('number');
  });
});

// ─── Meta Ads ──────────────────────────────────────────────────────

describe('MetaConnector', () => {
  let connector: MetaConnector;

  beforeEach(() => {
    connector = new MetaConnector({ appId: 'test_app_id', appSecret: 'test_app_secret' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates correct OAuth URL', () => {
    const url = connector.getAuthUrl('https://localhost/callback');
    expect(url).toContain('facebook.com');
    expect(url).toContain('client_id=test_app_id');
  });

  it('detects token validity', () => {
    expect(connector.isTokenValid(validTokens)).toBe(true);
    expect(connector.isTokenValid(expiredTokens)).toBe(false);
  });

  it('exchanges code for tokens (short-lived + long-lived)', async () => {
    // Meta makes 2 fetch calls: 1) OAuth2 short-lived, 2) exchange for long-lived
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'short_lived_token',
        token_type: 'bearer',
        expires_in: 3600,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'meta_long_lived',
        expires_in: 5184000,
      }),
    });

    const tokens = await connector.exchangeCode('fb_code', 'https://localhost/callback');
    expect(tokens.access_token).toBe('meta_long_lived');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('lists ad accounts', async () => {
    // Meta returns accounts with id field (not account_id)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'act_111', name: 'Meta Ad Account 1', currency: 'USD', timezone_name: 'US/Pacific', account_status: 1 },
          { id: 'act_222', name: 'Meta Ad Account 2', currency: 'EUR', timezone_name: 'Europe/London', account_status: 1 },
        ],
      }),
    });

    const accounts = await connector.listAccounts(validTokens);
    expect(accounts).toHaveLength(2);
    expect(accounts[0].name).toBe('Meta Ad Account 1');
  });
});

// ─── TikTok Ads ────────────────────────────────────────────────────

describe('TikTokAdsConnector', () => {
  let connector: TikTokAdsConnector;

  beforeEach(() => {
    connector = new TikTokAdsConnector({ appId: 'tt_app_id', secret: 'tt_secret' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates correct OAuth URL', () => {
    const url = connector.getAuthUrl('https://localhost/callback');
    expect(url).toContain('tiktok');
    expect(url).toContain('app_id=tt_app_id');
  });

  it('detects token validity', () => {
    expect(connector.isTokenValid(validTokens)).toBe(true);
  });

  it('exchanges code for tokens', async () => {
    // TikTok Ads expects { code: 0, data: { access_token, ... } }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'OK',
        data: {
          access_token: 'tt_access',
          advertiser_ids: ['adv_123'],
          scope: 1,
        },
      }),
    });

    const tokens = await connector.exchangeCode('tt_auth_code', 'https://localhost/callback');
    expect(tokens.access_token).toBe('tt_access');
  });
});

// ─── DV360 ─────────────────────────────────────────────────────────

describe('DV360Connector', () => {
  let connector: DV360Connector;

  beforeEach(() => {
    connector = new DV360Connector({ clientId: 'dv_client', clientSecret: 'dv_secret' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates correct OAuth URL', () => {
    const url = connector.getAuthUrl('https://localhost/callback');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=dv_client');
  });

  it('detects token validity', () => {
    expect(connector.isTokenValid(validTokens)).toBe(true);
    expect(connector.isTokenValid(expiredTokens)).toBe(false);
  });

  it('exchanges code for tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'dv_access',
        refresh_token: 'dv_refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const tokens = await connector.exchangeCode('dv_code', 'https://localhost/callback');
    expect(tokens.access_token).toBe('dv_access');
  });
});

// ─── Amazon Ads ────────────────────────────────────────────────────

describe('AmazonAdsConnector', () => {
  let connector: AmazonAdsConnector;

  beforeEach(() => {
    connector = new AmazonAdsConnector({ clientId: 'amz_client', clientSecret: 'amz_secret' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates correct OAuth URL', () => {
    const url = connector.getAuthUrl('https://localhost/callback');
    expect(url).toContain('amazon.com');
    expect(url).toContain('client_id=amz_client');
  });

  it('detects token validity', () => {
    expect(connector.isTokenValid(validTokens)).toBe(true);
    expect(connector.isTokenValid(expiredTokens)).toBe(false);
  });

  it('exchanges code for tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'amz_access',
        refresh_token: 'amz_refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const tokens = await connector.exchangeCode('amz_code', 'https://localhost/callback');
    expect(tokens.access_token).toBe('amz_access');
  });
});

// ─── TikTok Shop ──────────────────────────────────────────────────

describe('TikTokShopConnector', () => {
  let connector: TikTokShopConnector;

  beforeEach(() => {
    connector = new TikTokShopConnector({ appKey: 'shop_key', appSecret: 'shop_secret' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates correct OAuth URL', () => {
    const url = connector.getAuthUrl('https://localhost/callback');
    expect(url).toContain('tiktok');
  });

  it('detects token validity', () => {
    expect(connector.isTokenValid(validTokens)).toBe(true);
  });

  it('exchanges code for tokens', async () => {
    // TikTok Shop expects { code: 0, data: { access_token, refresh_token, access_token_expire_in } }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'Success',
        data: {
          access_token: 'shop_access',
          refresh_token: 'shop_refresh',
          access_token_expire_in: 86400,
          refresh_token_expire_in: 5184000,
        },
      }),
    });

    const tokens = await connector.exchangeCode('shop_code', 'https://localhost/callback');
    expect(tokens.access_token).toBe('shop_access');
  });
});

// ─── Cross-Platform Compliance ─────────────────────────────────────

describe('Cross-platform interface compliance', () => {
  const connectors = [
    { name: 'GoogleAds', instance: new GoogleAdsConnector({ clientId: 'x', clientSecret: 'x', developerToken: 'x' }) },
    { name: 'Meta', instance: new MetaConnector({ appId: 'x', appSecret: 'x' }) },
    { name: 'TikTokAds', instance: new TikTokAdsConnector({ appId: 'x', secret: 'x' }) },
    { name: 'DV360', instance: new DV360Connector({ clientId: 'x', clientSecret: 'x' }) },
    { name: 'AmazonAds', instance: new AmazonAdsConnector({ clientId: 'x', clientSecret: 'x' }) },
    { name: 'TikTokShop', instance: new TikTokShopConnector({ appKey: 'x', appSecret: 'x' }) },
  ];

  for (const { name, instance } of connectors) {
    it(`${name} implements getAuthUrl()`, () => {
      const url = instance.getAuthUrl('https://localhost/callback');
      expect(typeof url).toBe('string');
      expect(url.startsWith('https://')).toBe(true);
    });

    it(`${name} implements isTokenValid()`, () => {
      expect(typeof instance.isTokenValid(validTokens)).toBe('boolean');
    });

    it(`${name} has exchangeCode()`, () => {
      expect(typeof instance.exchangeCode).toBe('function');
    });

    it(`${name} has refreshTokens()`, () => {
      expect(typeof instance.refreshTokens).toBe('function');
    });

    it(`${name} has listAccounts()`, () => {
      expect(typeof instance.listAccounts).toBe('function');
    });

    it(`${name} has fetchCampaigns()`, () => {
      expect(typeof instance.fetchCampaigns).toBe('function');
    });
  }
});
