// ─── Shapley Attribution ────────────────────────────────────────────
// Multi-touch attribution using Shapley values from game theory.
// Coalition-based Shapley value attribution

import { factorial, round } from '@openagency/core/utils/math';
import type { ShapleyInput, ShapleyOutput, ShapleyChannelResult } from '@openagency/types';

function* combinations(arr: string[], k: number): Generator<string[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

function computeShapley(
  channels: string[],
  coalitionConversions: Record<string, number>,
): Record<string, number> {
  const n = channels.length;
  const shapleyValues: Record<string, number> = {};
  for (const ch of channels) shapleyValues[ch] = 0;

  for (const ch of channels) {
    const others = channels.filter((c) => c !== ch);
    for (let size = 0; size < n; size++) {
      for (const subset of combinations(others, size)) {
        const subsetSet = new Set(subset);
        const withKey = [...subsetSet, ch].sort().join('+');
        const withoutKey = subset.length > 0 ? [...subset].sort().join('+') : '';

        const vWith = coalitionConversions[withKey] ?? 0;
        const vWithout = coalitionConversions[withoutKey] ?? 0;
        const marginal = vWith - vWithout;

        const s = subsetSet.size;
        const weight = (factorial(s) * factorial(n - s - 1)) / factorial(n);
        shapleyValues[ch] += weight * marginal;
      }
    }
  }

  return shapleyValues;
}

export function attribute(data: ShapleyInput): ShapleyOutput | { error: string } {
  const channels = data.channels ?? [];
  const coalitionConversions = data.coalition_conversions ?? {};
  const totalConversions = data.total_conversions ?? 0;

  if (channels.length === 0) return { error: 'No channels provided' };

  const shapleyValues = computeShapley(channels, coalitionConversions);
  const shapleyTotal = Object.values(shapleyValues).reduce((s, v) => s + v, 0);

  const soloTotal = channels.reduce((s, ch) => s + (coalitionConversions[ch] ?? 0), 0);

  const results: ShapleyChannelResult[] = [];
  for (const ch of channels) {
    const sv = shapleyValues[ch];
    const svPct = shapleyTotal > 0 ? (sv / shapleyTotal) * 100 : 0;
    const lc = coalitionConversions[ch] ?? 0;
    const lcPct = soloTotal > 0 ? (lc / soloTotal) * 100 : 0;
    const diff = svPct - lcPct;

    let creditStatus: ShapleyChannelResult['credit_status'];
    if (diff > 5) creditStatus = 'under-credited by last-click';
    else if (diff < -5) creditStatus = 'over-credited by last-click';
    else creditStatus = 'fairly credited';

    results.push({
      channel: ch,
      shapley_value: round(sv),
      shapley_share_pct: round(svPct, 1),
      last_click_conversions: lc,
      last_click_share_pct: round(lcPct, 1),
      difference_pct: round(diff, 1),
      credit_status: creditStatus,
    });
  }

  results.sort((a, b) => b.shapley_value - a.shapley_value);

  return {
    total_conversions: totalConversions,
    shapley_total: round(shapleyTotal),
    channels: results,
  };
}

export interface CompareChannelInput {
  name: string;
  shapley_share: number;
  last_click_share: number;
  spend: number;
}

export function compare(data: { channels: CompareChannelInput[] }) {
  const results = data.channels.map((ch) => {
    const spend = ch.spend ?? 0;
    const shapleyEfficiency = spend > 0 ? ch.shapley_share / (spend / 100000) : 0;
    const lcEfficiency = spend > 0 ? ch.last_click_share / (spend / 100000) : 0;
    const diff = ch.shapley_share - ch.last_click_share;

    let recommendation: string;
    if (diff > 0.05) recommendation = 'Increase budget: channel is under-credited by last-click';
    else if (diff < -0.05) recommendation = 'Investigate: channel may be over-credited by last-click';
    else recommendation = 'Maintain current allocation';

    return {
      channel: ch.name,
      spend,
      shapley_share: ch.shapley_share,
      last_click_share: ch.last_click_share,
      shapley_efficiency: round(shapleyEfficiency, 4),
      last_click_efficiency: round(lcEfficiency, 4),
      recommendation,
    };
  });

  return { comparison: results };
}
