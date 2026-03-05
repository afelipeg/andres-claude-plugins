// ─── Platform Writer Mock Tests ─────────────────────────────────────
// Tests all 6 platform writers with mocked fetch: budget update (incl.
// unit conversion), pause/enable, bid adjustment, and failure paths.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleAdsWriter } from '../platforms/google-ads/google-ads-writer.js';
import { MetaWriter } from '../platforms/meta/meta-writer.js';
import { DV360Writer } from '../platforms/dv360/dv360-writer.js';
import { TikTokAdsWriter } from '../platforms/tiktok-ads/tiktok-ads-writer.js';
import { TikTokShopWriter } from '../platforms/tiktok-shop/tiktok-shop-writer.js';
import { AmazonAdsWriter } from '../platforms/amazon-ads/amazon-ads-writer.js';
import type { PlatformCredentials, OAuthTokens } from '@openagency/types';

const mockFetch = vi.fn();

const validTokens: OAuthTokens = {
  access_token: 'test_access_token',
  refresh_token: 'test_refresh_token',
  token_type: 'Bearer',
  expires_at: Date.now() + 7_200_000,
  scope: 'ads_write',
};

function okResponse(body: unknown = {}): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function errorResponse(status = 400, body = 'Bad Request'): Response {
  return { ok: false, status, json: async () => ({ code: 1, message: body }), text: async () => body } as Response;
}

// ─── Google Ads Writer ──────────────────────────────────────────────

describe('GoogleAdsWriter', () => {
  let writer: GoogleAdsWriter;
  const creds: PlatformCredentials = {
    platform: 'google_ads',
    tokens: validTokens,
    account_id: 'cust-123',
    connected_at: new Date().toISOString(),
  };

  beforeEach(() => {
    writer = new GoogleAdsWriter({ clientId: 'c', clientSecret: 's', developerToken: 'dev' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('updateCampaignBudget converts to micros', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'camp-1', new_budget: 5000 });

    expect(result.success).toBe(true);
    expect(result.platform).toBe('google_ads');
    expect(result.operation).toBe('budget_update');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operations[0].update.amountMicros).toBe('5000000000'); // 5000 * 1_000_000
  });

  it('updateCampaignBudget failure returns success=false', async () => {
    mockFetch.mockResolvedValue(errorResponse(403, 'Forbidden'));
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'camp-1', new_budget: 500 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('pauseCampaign sends PAUSED status', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.pauseCampaign(creds, 'camp-1');

    expect(result.success).toBe(true);
    expect(result.operation).toBe('campaign_pause');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operations[0].update.status).toBe('PAUSED');
  });

  it('enableCampaign sends ENABLED status', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.enableCampaign(creds, 'camp-1');

    expect(result.success).toBe(true);
    expect(result.operation).toBe('campaign_enable');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operations[0].update.status).toBe('ENABLED');
  });

  it('adjustBid converts to micros', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.adjustBid(creds, { ad_set_id: 'ag-1', new_bid: 2.5 });

    expect(result.success).toBe(true);
    expect(result.operation).toBe('bid_adjustment');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.operations[0].update.cpcBidMicros).toBe('2500000'); // 2.5 * 1_000_000
  });
});

// ─── Meta Writer ────────────────────────────────────────────────────

describe('MetaWriter', () => {
  let writer: MetaWriter;
  const creds: PlatformCredentials = {
    platform: 'meta_ads',
    tokens: validTokens,
    connected_at: new Date().toISOString(),
  };

  beforeEach(() => {
    writer = new MetaWriter({ appId: 'app', appSecret: 'secret' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('updateCampaignBudget converts to cents', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'camp-1', new_budget: 150, budget_type: 'daily' });

    expect(result.success).toBe(true);
    expect(result.platform).toBe('meta_ads');

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('daily_budget')).toBe('15000'); // 150 * 100
  });

  it('updateCampaignBudget uses lifetime_budget for lifetime type', async () => {
    mockFetch.mockResolvedValue(okResponse());
    await writer.updateCampaignBudget(creds, { campaign_id: 'camp-1', new_budget: 10000, budget_type: 'lifetime' });

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('lifetime_budget')).toBe('1000000'); // 10000 * 100
  });

  it('updateCampaignBudget failure', async () => {
    mockFetch.mockResolvedValue(errorResponse(400, 'Invalid budget'));
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'camp-1', new_budget: 50 });
    expect(result.success).toBe(false);
  });

  it('pauseCampaign sends PAUSED', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.pauseCampaign(creds, 'camp-2');
    expect(result.success).toBe(true);
    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('status')).toBe('PAUSED');
  });

  it('enableCampaign sends ACTIVE', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.enableCampaign(creds, 'camp-2');
    expect(result.success).toBe(true);
    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('status')).toBe('ACTIVE');
  });

  it('adjustBid converts to cents', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.adjustBid(creds, { ad_set_id: 'as-1', new_bid: 3.75 });
    expect(result.success).toBe(true);
    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get('bid_amount')).toBe('375'); // 3.75 * 100
  });
});

// ─── DV360 Writer ───────────────────────────────────────────────────

describe('DV360Writer', () => {
  let writer: DV360Writer;
  const creds: PlatformCredentials = {
    platform: 'dv360',
    tokens: validTokens,
    account_id: 'adv-123',
    connected_at: new Date().toISOString(),
  };

  beforeEach(() => {
    writer = new DV360Writer({ clientId: 'c', clientSecret: 's' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('updateCampaignBudget converts to micros', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'li-1', new_budget: 8000 });

    expect(result.success).toBe(true);
    expect(result.platform).toBe('dv360');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.budget.maxAmount).toBe('8000000000'); // 8000 * 1_000_000
  });

  it('updateCampaignBudget failure', async () => {
    mockFetch.mockResolvedValue(errorResponse());
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'li-1', new_budget: 100 });
    expect(result.success).toBe(false);
  });

  it('pauseCampaign sends ENTITY_STATUS_PAUSED', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.pauseCampaign(creds, 'li-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.entityStatus).toBe('ENTITY_STATUS_PAUSED');
  });

  it('enableCampaign sends ENTITY_STATUS_ACTIVE', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.enableCampaign(creds, 'li-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.entityStatus).toBe('ENTITY_STATUS_ACTIVE');
  });

  it('adjustBid converts to micros', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.adjustBid(creds, { ad_set_id: 'li-2', new_bid: 1.25 });
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.bidStrategy.fixedBid.bidAmountMicros).toBe('1250000'); // 1.25 * 1_000_000
  });
});

// ─── TikTok Ads Writer ─────────────────────────────────────────────

describe('TikTokAdsWriter', () => {
  let writer: TikTokAdsWriter;
  const creds: PlatformCredentials = {
    platform: 'tiktok_ads',
    tokens: validTokens,
    account_id: 'adv-tt',
    connected_at: new Date().toISOString(),
  };

  beforeEach(() => {
    writer = new TikTokAdsWriter({ appId: 'a', secret: 's' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('updateCampaignBudget sends budget directly (no conversion)', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'tc-1', new_budget: 2000 });

    expect(result.success).toBe(true);
    expect(result.platform).toBe('tiktok_ads');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.budget).toBe(2000);
    expect(body.advertiser_id).toBe('adv-tt');
  });

  it('updateCampaignBudget fails on code != 0', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 40001, message: 'Invalid budget' }));
    // Note: res.ok is true but data.code != 0 → success = false
    // Need to make res.ok = true for this path
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 40001, message: 'Invalid budget' }), text: async () => '' } as Response);
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'tc-1', new_budget: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid budget');
  });

  it('pauseCampaign sends DISABLE', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.pauseCampaign(creds, 'tc-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.opt_status).toBe('DISABLE');
    expect(body.campaign_ids).toEqual(['tc-1']);
  });

  it('enableCampaign sends ENABLE', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.enableCampaign(creds, 'tc-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.opt_status).toBe('ENABLE');
  });

  it('adjustBid sends bid directly', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.adjustBid(creds, { ad_set_id: 'ag-1', new_bid: 4.5 });
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.bid).toBe(4.5);
    expect(body.adgroup_id).toBe('ag-1');
  });
});

// ─── TikTok Shop Writer ────────────────────────────────────────────

describe('TikTokShopWriter', () => {
  let writer: TikTokShopWriter;
  const creds: PlatformCredentials = {
    platform: 'tiktok_shop',
    tokens: validTokens,
    account_id: 'shop-123',
    connected_at: new Date().toISOString(),
  };

  beforeEach(() => {
    writer = new TikTokShopWriter({ appKey: 'k', appSecret: 's' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('updateCampaignBudget sends budget directly', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'sc-1', new_budget: 3000 });
    expect(result.success).toBe(true);
    expect(result.platform).toBe('tiktok_shop');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.budget).toBe(3000);
    expect(body.shop_id).toBe('shop-123');
  });

  it('pauseCampaign sends DISABLE', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.pauseCampaign(creds, 'sc-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.opt_status).toBe('DISABLE');
  });

  it('enableCampaign sends ENABLE', async () => {
    mockFetch.mockResolvedValue(okResponse({ code: 0, message: 'OK' }));
    const result = await writer.enableCampaign(creds, 'sc-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.opt_status).toBe('ENABLE');
  });

  it('adjustBid returns not supported', async () => {
    const result = await writer.adjustBid(creds, { ad_set_id: 'x', new_bid: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not supported');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Amazon Ads Writer ──────────────────────────────────────────────

describe('AmazonAdsWriter', () => {
  let writer: AmazonAdsWriter;
  const creds: PlatformCredentials = {
    platform: 'amazon_ads',
    tokens: validTokens,
    account_id: 'profile-456',
    connected_at: new Date().toISOString(),
  };

  beforeEach(() => {
    writer = new AmazonAdsWriter({ clientId: 'c', clientSecret: 's' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('updateCampaignBudget sends budget directly', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'ac-1', new_budget: 7500 });

    expect(result.success).toBe(true);
    expect(result.platform).toBe('amazon_ads');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.campaigns[0].budget.budget).toBe(7500);
  });

  it('updateCampaignBudget failure', async () => {
    mockFetch.mockResolvedValue(errorResponse(422, 'Unprocessable'));
    const result = await writer.updateCampaignBudget(creds, { campaign_id: 'ac-1', new_budget: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unprocessable');
  });

  it('pauseCampaign sends PAUSED state', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.pauseCampaign(creds, 'ac-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.campaigns[0].state).toBe('PAUSED');
  });

  it('enableCampaign sends ENABLED state', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.enableCampaign(creds, 'ac-1');
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.campaigns[0].state).toBe('ENABLED');
  });

  it('adjustBid sends defaultBid directly', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const result = await writer.adjustBid(creds, { ad_set_id: 'adg-1', new_bid: 1.75 });
    expect(result.success).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.adGroups[0].defaultBid).toBe(1.75);
  });
});
