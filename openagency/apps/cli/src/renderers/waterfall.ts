// ─── ASCII Waste Waterfall Renderer ─────────────────────────────────

import chalk from 'chalk';
import type { WasteWaterfallOutput } from '@openagency/types';

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function benchmarkTag(vs: string): string {
  if (vs === 'above') return chalk.red('[ABOVE benchmark]');
  if (vs === 'below') return chalk.green('[below benchmark]');
  return chalk.dim('[at benchmark]');
}

export function renderWaterfall(result: WasteWaterfallOutput): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.white('  WASTE WATERFALL'));
  lines.push(chalk.dim('  ═══════════════════════════════════════════════════════════'));
  lines.push('');

  // Gross spend header
  lines.push(
    `  ${chalk.bold('Gross Spend')}` +
    `${fmtMoney(result.gross_spend).padStart(40)}`,
  );
  lines.push('');

  // Waterfall stages
  for (const stage of result.waterfall) {
    const wasteColor = stage.vs_benchmark === 'above' ? chalk.red : chalk.yellow;
    const bar = '█'.repeat(Math.max(1, Math.round(stage.waste_pct / 2)));

    lines.push(
      `  ${chalk.dim('├─')} ${stage.label.padEnd(24)}` +
      `${wasteColor('- ' + fmtMoney(stage.waste_amount)).padStart(18)}` +
      `  ${chalk.dim(fmtPct(stage.waste_pct).padStart(7))}` +
      `  ${benchmarkTag(stage.vs_benchmark)}`,
    );
    lines.push(`  ${chalk.dim('│')}  ${wasteColor(bar)}`);
  }

  lines.push(chalk.dim('  ═══════════════════════════════════════════════════════════'));

  // Productive spend
  const productiveColor = result.productive_spend.pct >= 50 ? chalk.green : chalk.red;
  lines.push(
    `  ${chalk.bold('Productive Spend')}` +
    `${productiveColor(fmtMoney(result.productive_spend.amount)).padStart(35)}` +
    `  ${productiveColor(fmtPct(result.productive_spend.pct).padStart(7))}`,
  );

  lines.push('');

  // Summary
  lines.push(
    chalk.dim('  Total Waste: ') +
    chalk.red(fmtMoney(result.waste_summary.total_waste)) +
    chalk.dim(` (${fmtPct(result.waste_summary.waste_pct)})`),
  );

  // ROI impact
  if (result.roi_impact) {
    lines.push('');
    lines.push(chalk.bold.white('  ROI IMPACT'));
    lines.push(
      chalk.dim('  Current ROAS: ') + chalk.yellow(result.roi_impact.current_roas.toFixed(2) + 'x') +
      chalk.dim('  →  Productive ROAS: ') + chalk.green(result.roi_impact.productive_roas.toFixed(2) + 'x') +
      chalk.dim('  (') + chalk.green('+' + fmtPct(result.roi_impact.improvement_potential_pct)) + chalk.dim(' potential)'),
    );
  }

  // Recovery roadmap
  if (result.recovery_roadmap.length > 0) {
    lines.push('');
    lines.push(chalk.bold.white('  RECOVERY ROADMAP'));
    lines.push(chalk.dim('  ───────────────────────────────────────────────────────────'));

    for (let i = 0; i < Math.min(result.recovery_roadmap.length, 5); i++) {
      const r = result.recovery_roadmap[i];
      const diffColor = r.difficulty === 'easy' ? chalk.green : r.difficulty === 'medium' ? chalk.yellow : chalk.red;
      lines.push(
        `  ${chalk.dim((i + 1) + '.')} Save ${chalk.green(fmtMoney(r.estimated_savings))}` +
        ` ${chalk.dim('|')} ${diffColor(r.difficulty)} ${chalk.dim('|')} ${r.timeline}`,
      );
      lines.push(`     ${chalk.dim(r.action)}`);
    }
  }

  // C-Suite
  lines.push('');
  lines.push(chalk.bold.white('  C-SUITE SUMMARY'));
  lines.push(chalk.dim('  ───────────────────────────────────────────────────────────'));
  lines.push(`  ${chalk.bold('CEO:')} ${result.csuite_summary.ceo}`);
  lines.push('');
  lines.push(`  ${chalk.bold('CFO:')} ${result.csuite_summary.cfo}`);
  lines.push('');
  lines.push(`  ${chalk.bold('CMO:')} ${result.csuite_summary.cmo}`);
  lines.push('');

  return lines.join('\n');
}
