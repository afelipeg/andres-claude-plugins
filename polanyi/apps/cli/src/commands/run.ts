// ─── Run Command ────────────────────────────────────────────────────
// Generic engine runner: openagency run <engine> <skill> --file data.json

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { OpenAgency, parseInput } from '@openagency/core';
import {
  LeakDetectorEngine,
  MediaArchitectEngine,
  CampaignOpsEngine,
  ExecutiveBridgeEngine,
} from '@openagency/engines';
import { readFileSync, existsSync } from 'node:fs';

export function runCommand(): Command {
  const cmd = new Command('run')
    .description('Run a specific engine skill')
    .argument('<engine>', 'Engine ID (leak-detector, media-architect, campaign-ops, executive-bridge)')
    .argument('<skill>', 'Skill ID (e.g. waste-waterfall, channel-optimize, shapley-attribute)')
    .option('-f, --file <path>', 'Path to JSON input file')
    .action(async (engineId: string, skillId: string, opts) => {
      const agency = new OpenAgency();
      agency.engines.register(new LeakDetectorEngine());
      agency.engines.register(new MediaArchitectEngine());
      agency.engines.register(new CampaignOpsEngine());
      agency.engines.register(new ExecutiveBridgeEngine());

      if (!opts.file) {
        console.error(chalk.red('  --file is required. Provide a JSON input file.'));
        console.log(chalk.dim(`\n  Example: openagency run ${engineId} ${skillId} --file input.json\n`));
        process.exit(1);
      }

      if (!existsSync(opts.file)) {
        console.error(chalk.red(`  File not found: ${opts.file}`));
        process.exit(1);
      }

      const raw = readFileSync(opts.file, 'utf-8');
      const parsed = parseInput(raw);
      const input = parsed.data.length === 1 ? parsed.data[0] : parsed.data;

      const spinner = ora(`Running ${engineId}/${skillId}...`).start();

      try {
        const result = await agency.run(engineId, skillId, input);
        spinner.stop();
        console.log(JSON.stringify(result.data, null, 2));
        console.log(chalk.dim(`\n  Computed in ${result.duration_ms}ms\n`));
      } catch (err) {
        spinner.stop();
        console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });

  return cmd;
}
