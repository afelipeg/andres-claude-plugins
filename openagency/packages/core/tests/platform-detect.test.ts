import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  toWasteInput,
  toChannelInput,
  toOptimizationInput,
  toRevenueBridgeInput,
} from '../src/data/platform-detect';

describe('detectPlatform', () => {
  it('detects Google Ads from unique headers', () => {
    const cols = ['Campaign', 'Impr.', 'Clicks', 'Cost', 'Conv.', 'Conv. value', 'Avg. CPC'];
    const result = detectPlatform(cols);
    expect(result.platform).toBe('google_ads');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.columnMap.campaign).toBe('Campaign');
    expect(result.columnMap.spend).toBe('Cost');
    expect(result.columnMap.impressions).toBe('Impr.');
  });

  it('detects Google Ads API column format', () => {
    const cols = ['campaign.name', 'metrics.cost_micros', 'metrics.impressions', 'metrics.clicks'];
    const result = detectPlatform(cols);
    expect(result.platform).toBe('google_ads');
    expect(result.columnMap.spend).toBe('metrics.cost_micros');
  });

  it('detects Meta Ads from unique headers', () => {
    const cols = ['Campaign Name', 'Amount Spent', 'Impressions', 'Clicks (all)', 'CTR (all)', 'Reach', 'Frequency'];
    const result = detectPlatform(cols);
    expect(result.platform).toBe('meta_ads');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.columnMap.spend).toBe('Amount Spent');
    expect(result.columnMap.clicks).toBe('Clicks (all)');
  });

  it('detects TikTok Ads from unique headers', () => {
    const cols = ['Campaign Name', 'Spend', 'Impressions', 'Clicks', 'CVR', 'Total Complete Payment'];
    const result = detectPlatform(cols);
    expect(result.platform).toBe('tiktok_ads');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.columnMap.spend).toBe('Spend');
  });

  it('returns generic for unknown headers', () => {
    const cols = ['foo', 'bar', 'baz'];
    const result = detectPlatform(cols);
    expect(result.platform).toBe('generic');
    expect(result.confidence).toBe(0);
  });

  it('generic fallback matches lowercase common headers', () => {
    const cols = ['campaign', 'spend', 'impressions', 'clicks'];
    const result = detectPlatform(cols);
    expect(result.platform).toBe('generic');
    expect(result.columnMap.campaign).toBe('campaign');
    expect(result.columnMap.spend).toBe('spend');
  });
});

describe('toWasteInput', () => {
  it('aggregates spend and revenue from Google Ads rows', () => {
    const rows = [
      { Campaign: 'Brand', Cost: '$5,000.00', 'Conv. value': '$15,000.00' },
      { Campaign: 'Non-Brand', Cost: '$3,000.00', 'Conv. value': '$6,000.00' },
    ];
    const result = toWasteInput(rows, {
      platform: 'google_ads',
      columnMap: { campaign: 'Campaign', spend: 'Cost', revenue: 'Conv. value' },
    });
    expect(result.gross_spend).toBe(8000);
    expect(result.actual_revenue).toBe(21000);
    expect(result.industry).toBe('retail');
  });

  it('handles cost_micros format', () => {
    const rows = [{ 'metrics.cost_micros': 5000000000 }];
    const result = toWasteInput(rows, {
      platform: 'google_ads',
      columnMap: { spend: 'metrics.cost_micros' },
    });
    expect(result.gross_spend).toBe(5000);
  });
});

describe('toChannelInput', () => {
  it('creates channels from Meta Ads rows', () => {
    const rows = [
      { 'Campaign Name': 'Brand', 'Amount Spent': '2500' },
      { 'Campaign Name': 'Retarget', 'Amount Spent': '1500' },
    ];
    const result = toChannelInput(rows, {
      platform: 'meta_ads',
      columnMap: { campaign: 'Campaign Name', spend: 'Amount Spent' },
    });
    expect(result.total_budget).toBe(4000);
    expect(result.channels).toHaveLength(2);
    expect(result.channels[0].name).toBe('Brand');
    expect(result.channels[1].spend).toBe(1500);
  });
});

describe('toOptimizationInput', () => {
  it('produces campaigns array with default targets', () => {
    const rows = [
      { Campaign: 'Search', Cost: '10000', Impressions: '500000', Clicks: '25000', Conversions: '750' },
    ];
    const result = toOptimizationInput(rows, {
      platform: 'google_ads',
      columnMap: {
        campaign: 'Campaign',
        spend: 'Cost',
        impressions: 'Impressions',
        clicks: 'Clicks',
        conversions: 'Conversions',
      },
    });
    expect(result.campaigns).toHaveLength(1);
    expect(result.campaigns[0].name).toBe('Search');
    expect(result.campaigns[0].spend).toBe(10000);
    expect(result.campaigns[0].budget).toBe(12000); // 1.2x
    expect(result.campaigns[0].cpa_target).toBe(100);
  });
});

describe('toRevenueBridgeInput', () => {
  it('produces channels with all metrics', () => {
    const rows = [
      {
        'Campaign Name': 'Social',
        Spend: '5000',
        Impressions: '1000000',
        Clicks: '20000',
        Conversions: '200',
        'Conversion Value': '30000',
      },
    ];
    const result = toRevenueBridgeInput(rows, {
      platform: 'tiktok_ads',
      columnMap: {
        campaign: 'Campaign Name',
        spend: 'Spend',
        impressions: 'Impressions',
        clicks: 'Clicks',
        conversions: 'Conversions',
        revenue: 'Conversion Value',
      },
    });
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0].name).toBe('Social');
    expect(result.channels[0].spend).toBe(5000);
    expect(result.channels[0].revenue).toBe(30000);
  });
});
