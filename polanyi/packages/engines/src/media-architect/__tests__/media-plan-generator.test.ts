import { describe, it, expect } from 'vitest';
import { generate } from '../media-plan-generator.js';

describe('media-plan-generator', () => {
  const baseInput = {
    campaign_name: 'Summer Launch',
    client: 'Acme Corp',
    start_date: '2026-06-01',
    channels: [
      { name: 'search', platform: 'google_ads', monthly_budget: 50000, duration_months: 3 },
      { name: 'social_meta', platform: 'meta', monthly_budget: 30000, duration_months: 3 },
      { name: 'programmatic_display', platform: 'dv360', monthly_budget: 20000, duration_months: 2 },
    ],
  };

  it('generates complete media plan', () => {
    const result = generate(baseInput);
    expect(result.campaign).toBe('Summer Launch');
    expect(result.client).toBe('Acme Corp');
    expect(result.start_date).toBe('2026-06-01');
    expect(result.flowchart).toHaveLength(3);
    expect(result.insertion_orders).toHaveLength(3);
    expect(result.utm_taxonomy).toHaveLength(3);
  });

  it('calculates correct total budget', () => {
    const result = generate(baseInput);
    // search: 50k*3=150k, social: 30k*3=90k, display: 20k*2=40k = 280k
    expect(result.total_budget).toBe(280000);
  });

  it('generates flowchart with correct months', () => {
    const result = generate(baseInput);
    const searchFlow = result.flowchart.find((f) => f.channel === 'search')!;
    expect(searchFlow.months).toHaveLength(3);
    expect(searchFlow.total_budget).toBe(150000);
    expect(searchFlow.months[0].budget).toBe(50000);

    const displayFlow = result.flowchart.find((f) => f.channel === 'programmatic_display')!;
    expect(displayFlow.months).toHaveLength(2);
    expect(displayFlow.total_budget).toBe(40000);
  });

  it('generates correct IO numbers', () => {
    const result = generate(baseInput);
    expect(result.insertion_orders[0].io_number).toBe('IO-SUM-SEA-001');
    expect(result.insertion_orders[0].advertiser).toBe('Acme Corp');
    expect(result.insertion_orders[0].payment_terms).toBe('Net 30');
  });

  it('generates correct UTM taxonomy', () => {
    const result = generate(baseInput);
    const searchUtm = result.utm_taxonomy.find((u) => u.channel === 'search')!;
    expect(searchUtm.utm_medium).toBe('cpc');
    expect(searchUtm.utm_term).toBe('{keyword}');
    expect(searchUtm.utm_campaign).toBe('acme_corp_summer_launch');

    const socialUtm = result.utm_taxonomy.find((u) => u.channel === 'social_meta')!;
    expect(socialUtm.utm_medium).toBe('paid_social');
    expect(socialUtm.utm_term).toBe('');

    const displayUtm = result.utm_taxonomy.find((u) => u.channel === 'programmatic_display')!;
    expect(displayUtm.utm_medium).toBe('display');
  });

  it('includes full UTM string', () => {
    const result = generate(baseInput);
    const searchUtm = result.utm_taxonomy.find((u) => u.channel === 'search')!;
    expect(searchUtm.full_utm).toContain('utm_source=');
    expect(searchUtm.full_utm).toContain('utm_medium=cpc');
    expect(searchUtm.full_utm).toContain('utm_campaign=');
    expect(searchUtm.full_utm).toContain('utm_term=');
  });
});
