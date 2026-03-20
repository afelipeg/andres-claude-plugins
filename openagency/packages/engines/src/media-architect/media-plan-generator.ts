// ─── Media Plan Generator ───────────────────────────────────────────
// Auto-generates flowcharts, insertion orders, spec sheets, and UTM taxonomy.
// Media plan generator — flowcharts, insertion orders, UTM taxonomy

import { round } from '@openagency/core/utils/math';
import { PLATFORM_SPECS } from './benchmarks.js';
import type { MediaPlanInput, MediaPlanOutput } from '@openagency/types';

function classifyMedium(channelName: string): string {
  const name = channelName.toLowerCase();
  if (name.includes('search')) return 'cpc';
  if (name.includes('social') || name.includes('meta') || name.includes('tiktok') || name.includes('facebook'))
    return 'paid_social';
  if (name.includes('display') || name.includes('programmatic')) return 'display';
  if (name.includes('video') || name.includes('youtube')) return 'video';
  if (name.includes('email')) return 'email';
  if (name.includes('native')) return 'native';
  return 'paid';
}

export function generate(data: MediaPlanInput): MediaPlanOutput {
  const campaignName = data.campaign_name ?? 'Campaign';
  const client = data.client ?? 'Client';
  const channels = data.channels ?? [];
  const startDate = data.start_date ?? new Date().toISOString().slice(0, 10);

  // Flowchart
  const flowchart: MediaPlanOutput['flowchart'] = [];
  for (const ch of channels) {
    const monthlyBudget = ch.monthly_budget ?? 0;
    const duration = ch.duration_months ?? 3;
    const months: Array<{ month: number; budget: number }> = [];
    for (let m = 0; m < duration; m++) {
      months.push({ month: m + 1, budget: round(monthlyBudget) });
    }
    flowchart.push({
      channel: ch.name,
      platform: ch.platform ?? '',
      total_budget: round(monthlyBudget * duration),
      months,
    });
  }

  const totalBudget = flowchart.reduce((s, f) => s + f.total_budget, 0);

  // Insertion Orders
  const insertionOrders: MediaPlanOutput['insertion_orders'] = [];
  for (const ch of channels) {
    insertionOrders.push({
      io_number: `IO-${campaignName.slice(0, 3).toUpperCase()}-${ch.name.slice(0, 3).toUpperCase()}-001`,
      advertiser: client,
      campaign: campaignName,
      channel: ch.name,
      platform: ch.platform ?? '',
      start_date: startDate,
      total_budget: round((ch.monthly_budget ?? 0) * (ch.duration_months ?? 3)),
      payment_terms: 'Net 30',
      buying_model: ch.buying_model ?? 'auction',
    });
  }

  // UTM Taxonomy
  const utmTaxonomy: MediaPlanOutput['utm_taxonomy'] = [];
  for (const ch of channels) {
    const utmSource = (ch.platform || ch.name).replace(/_/g, '');
    const utmMedium = classifyMedium(ch.name);
    const utmCampaign = `${client.toLowerCase().replace(/ /g, '_')}_${campaignName.toLowerCase().replace(/ /g, '_')}`;
    const utmContent = '{ad_name}';
    const utmTerm = ch.name.toLowerCase().includes('search') ? '{keyword}' : '';

    let fullUtm =
      `?utm_source=${utmSource}` +
      `&utm_medium=${utmMedium}` +
      `&utm_campaign=${utmCampaign}` +
      `&utm_content=${utmContent}`;
    if (utmTerm) fullUtm += `&utm_term=${utmTerm}`;

    utmTaxonomy.push({
      channel: ch.name,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      full_utm: fullUtm,
    });
  }

  return {
    campaign: campaignName,
    client,
    start_date: startDate,
    total_budget: round(totalBudget),
    flowchart,
    insertion_orders: insertionOrders,
    utm_taxonomy: utmTaxonomy,
  };
}
