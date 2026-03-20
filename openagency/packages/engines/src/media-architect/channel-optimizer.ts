// ─── Channel Optimizer ──────────────────────────────────────────────
// Budget optimization using Hill saturation curves with greedy marginal allocation.
// Greedy marginal allocation with Hill saturation curves

import { hillResponse, marginalResponse, round } from '@openagency/core/utils/math';
import { getChannelDefaults } from './benchmarks.js';
import type {
  ChannelOptimizerInput,
  ChannelOptimizerOutput,
  ChannelOptResult,
} from '@openagency/types';

interface InternalAllocation {
  spend: number;
  max_response: number;
  alpha: number;
  ec50: number;
  min_spend: number;
  max_spend: number;
}

export function optimize(data: ChannelOptimizerInput): ChannelOptimizerOutput {
  const totalBudget = data.total_budget;
  const channels = data.channels;
  const step = data.step_size ?? totalBudget / 100;

  const allocation: Record<string, InternalAllocation> = {};

  for (const ch of channels) {
    const name = ch.name;
    const spend = ch.spend ?? 0;
    const defaults = getChannelDefaults(name);
    const minSpend = ch.min_spend ?? 0;

    allocation[name] = {
      spend: minSpend,
      max_response:
        ch.max_response ??
        Math.max(spend, totalBudget / channels.length) * defaults.max_mult,
      alpha: ch.alpha ?? defaults.alpha,
      ec50:
        ch.ec50 ??
        Math.max(spend, totalBudget / channels.length) * defaults.ec50_ratio,
      min_spend: minSpend,
      max_spend: ch.max_spend ?? totalBudget,
    };
  }

  let allocated = Object.values(allocation).reduce((s, a) => s + a.spend, 0);
  let remaining = totalBudget - allocated;

  // Greedy marginal allocation
  while (remaining >= step) {
    let bestChannel: string | null = null;
    let bestMarginal = -1;

    for (const [name, a] of Object.entries(allocation)) {
      if (a.spend >= a.max_spend) continue;
      const mr = marginalResponse(a.spend, a.max_response, a.alpha, a.ec50, step);
      if (mr > bestMarginal) {
        bestMarginal = mr;
        bestChannel = name;
      }
    }

    if (bestChannel === null) break;
    allocation[bestChannel].spend += step;
    remaining -= step;
  }

  // Build results
  const results: ChannelOptResult[] = [];
  let totalResponse = 0;

  for (const [name, a] of Object.entries(allocation)) {
    const response = hillResponse(a.spend, a.max_response, a.alpha, a.ec50);
    const mr = marginalResponse(a.spend, a.max_response, a.alpha, a.ec50, step);
    totalResponse += response;

    results.push({
      channel: name,
      spend: round(a.spend),
      spend_pct: round((a.spend / totalBudget) * 100, 1),
      expected_response: round(response, 4),
      marginal_roi: round(mr, 6),
      saturation_pct: a.max_response > 0 ? round((response / a.max_response) * 100, 1) : 0,
    });
  }

  results.sort((a, b) => b.spend - a.spend);

  return {
    total_budget: totalBudget,
    total_allocated: round(totalBudget - remaining),
    total_expected_response: round(totalResponse, 4),
    channels: results,
  };
}

export interface ScenarioInput {
  total_budget: number;
  channels: ChannelOptimizerInput['channels'];
  multipliers?: number[];
  labels?: string[];
}

export interface ScenarioOutput {
  scenarios: Array<{
    label: string;
    budget: number;
    result: ChannelOptimizerOutput;
  }>;
}

export function scenarioAnalysis(data: ScenarioInput): ScenarioOutput {
  const baseBudget = data.total_budget;
  const channels = data.channels;
  const multipliers = data.multipliers ?? [0.8, 1.0, 1.2, 1.5];
  const labels = data.labels ?? ['-20%', 'Current', '+20%', '+50%'];

  const scenarios: ScenarioOutput['scenarios'] = [];

  for (let i = 0; i < multipliers.length; i++) {
    const mult = multipliers[i];
    const result = optimize({ total_budget: baseBudget * mult, channels });
    const label = i < labels.length ? labels[i] : `${mult}x`;
    scenarios.push({
      label,
      budget: round(baseBudget * mult),
      result,
    });
  }

  return { scenarios };
}
