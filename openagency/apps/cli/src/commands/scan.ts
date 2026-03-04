// ─── Scan Command ───────────────────────────────────────────────────
// THE HOOK: paste ad data -> instant waste waterfall

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { OpenAgency, SAMPLE_WASTE_MEDIUM, parseInput, parseFile } from '@openagency/core';
import { LeakDetectorEngine } from '@openagency/engines';
import type { WasteWaterfallInput, WasteWaterfallOutput } from '@openagency/types';
import { renderWaterfall } from '../renderers/waterfall.js';
import { readFileSync, existsSync } from 'node:fs';

export function scanCommand(): Command {
  const cmd = new Command('scan')
    .description('Scan your ad spend for waste and money leaks')
    .option('-f, --file <path>', 'Path to data file (JSON, CSV, Excel, PDF)')
    .option('-d, --demo', 'Use built-in demo data ($500K retail budget)')
    .option('-b, --budget <amount>', 'Quick scan: just provide your total budget', parseFloat)
    .option('-i, --industry <type>', 'Industry for benchmarks (automotive|fmcg|financial|retail|telecom)', 'retail')
    .option('--json', 'Output raw JSON instead of formatted display')
    .action(async (opts) => {
      const agency = new OpenAgency();
      agency.engines.register(new LeakDetectorEngine());

      let input: WasteWaterfallInput;

      if (opts.demo) {
        console.log(chalk.dim('\n  Using demo data: $500K retail budget\n'));
        input = SAMPLE_WASTE_MEDIUM;
      } else if (opts.file) {
        if (!existsSync(opts.file)) {
          console.error(chalk.red(`  File not found: ${opts.file}`));
          process.exit(1);
        }
        const buf = readFileSync(opts.file);
        const parsed = await parseFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), opts.file);
        input = parsed.data[0] as unknown as WasteWaterfallInput;
      } else if (opts.budget) {
        // Quick scan: estimate from budget + industry
        input = { gross_spend: opts.budget, industry: opts.industry };
        const spinner = ora('Estimating waste from industry benchmarks...').start();
        const result = await agency.run<WasteWaterfallOutput>(
          'leak-detector',
          'waste-estimate',
          input,
        );
        spinner.stop();

        if ('error' in result.data) {
          console.error(chalk.red(`  Error: ${(result.data as { error: string }).error}`));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log(renderWaterfall(result.data as WasteWaterfallOutput));
          console.log(chalk.dim(`  Computed in ${result.duration_ms}ms\n`));
        }
        return;
      } else {
        // No input: show help with demo suggestion
        console.log(`
  ${chalk.bold('OpenAgency Leak Detector')}
  Find where your ad budget leaks money.

  ${chalk.bold('Quick start:')}
    ${chalk.cyan('openagency scan --demo')}              Use demo data ($500K retail)
    ${chalk.cyan('openagency scan --budget 100000')}      Estimate waste for $100K budget
    ${chalk.cyan('openagency scan --file data.json')}     Analyze your actual spend data (also .csv, .xlsx, .pdf)

  ${chalk.bold('JSON input format:')}
    {
      "gross_spend": 500000,
      "industry": "retail",
      "non_working": { "agency_fees": 40000, "tech_fees": 20000 },
      "supply_chain": { "dsp_fees": 25000, "ssp_fees": 15000 },
      "quality": { "fraud": 20000, "non_viewable": 15000 },
      "audience": { "off_target": 25000, "frequency_waste": 10000 },
      "optimization": { "poor_pacing": 10000, "stale_creative": 7500 },
      "measurement": { "misattributed": 7500 }
    }
`);
        return;
      }

      const spinner = ora('Analyzing your ad spend for waste...').start();

      const result = await agency.run<WasteWaterfallOutput>(
        'leak-detector',
        'waste-waterfall',
        input,
      );

      spinner.stop();

      if ('error' in result.data) {
        console.error(chalk.red(`  Error: ${(result.data as { error: string }).error}`));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.log(renderWaterfall(result.data as WasteWaterfallOutput));
        console.log(chalk.dim(`  Computed in ${result.duration_ms}ms\n`));
      }
    });

  return cmd;
}
