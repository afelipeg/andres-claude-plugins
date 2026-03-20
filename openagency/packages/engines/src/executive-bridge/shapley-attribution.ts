// ─── Shapley Attribution ────────────────────────────────────────────
// Multi-touch attribution using Shapley values from game theory.
// v2: Adds sampling-based approximation for 13+ channels (O(n*samples)
// instead of O(2^n)), auto-switches based on channel count.

import { factorial, round } from '@openagency/core/utils/math';
import type { ShapleyInput, ShapleyOutput, ShapleyChannelResult } from '@openagency/types';

// ─── Exact Shapley (coalition enumeration) ──────────────────────────

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

function computeShapleyExact(
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

// ─── Approximate Shapley (random permutation sampling) ──────────────

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Compute the coalition value for a set of channels.
 * Looks up the sorted key in coalitionConversions.
 */
function coalitionValue(
  channels: string[],
  coalitionConversions: Record<string, number>,
): number {
  if (channels.length === 0) return 0;
  const key = [...channels].sort().join('+');
  return coalitionConversions[key] ?? 0;
}

/**
 * Sampling-based Shapley approximation using random permutations.
 * For each sample: generate a random permutation, compute each channel's
 * marginal contribution at its position.
 *
 * Complexity: O(nSamples * n) where n = number of channels.
 * Converges to exact Shapley values as nSamples -> infinity.
 */
function computeShapleyApproximate(
  channels: string[],
  coalitionConversions: Record<string, number>,
  nSamples: number = 10000,
): Record<string, number> {
  const n = channels.length;
  const marginalSums: Record<string, number> = {};
  for (const ch of channels) marginalSums[ch] = 0;

  for (let sample = 0; sample < nSamples; sample++) {
    // Generate a random permutation
    const perm = shuffle([...channels]);
    const predecessors: string[] = [];

    for (const ch of perm) {
      // Coalition with this channel
      const withCh = [...predecessors, ch];
      const vWith = coalitionValue(withCh, coalitionConversions);
      const vWithout = coalitionValue(predecessors, coalitionConversions);

      // Marginal contribution
      marginalSums[ch] += vWith - vWithout;

      predecessors.push(ch);
    }
  }

  // Average marginal contributions
  const shapleyValues: Record<string, number> = {};
  for (const ch of channels) {
    shapleyValues[ch] = marginalSums[ch] / nSamples;
  }

  return shapleyValues;
}

// ─── Threshold for switching to approximation ───────────────────────

const EXACT_THRESHOLD = 12; // Use exact for <= 12 channels

// ─── Public API ─────────────────────────────────────────────────────

export function attribute(data: ShapleyInput): ShapleyOutput | { error: string } {
  const channels = data.channels ?? [];
  const coalitionConversions = data.coalition_conversions ?? {};
  const totalConversions = data.total_conversions ?? 0;

  if (channels.length === 0) return { error: 'No channels provided' };

  // Auto-select method based on channel count
  const useApproximation = channels.length > EXACT_THRESHOLD;
  const method: 'exact' | 'approximation' = useApproximation ? 'approximation' : 'exact';

  const shapleyValues = useApproximation
    ? computeShapleyApproximate(channels, coalitionConversions, 10000)
    : computeShapleyExact(channels, coalitionConversions);

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
    method,
  };
}

/**
 * Standalone approximate Shapley function for direct use.
 * Use when you know you have many channels and want explicit control.
 */
export function approximateShapley(
  channels: string[],
  coalitionConversions: Record<string, number>,
  nSamples: number = 10000,
): Record<string, number> {
  return computeShapleyApproximate(channels, coalitionConversions, nSamples);
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
