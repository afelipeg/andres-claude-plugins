// ─── Report Command ─────────────────────────────────────────────────
// Runs engine computation + LLM narrative interpretation.
// Falls back to structured JSON if no LLM configured.

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  OpenAgency,
  SAMPLE_WASTE_MEDIUM,
  callLLM,
  detectLLMConfig,
  parseInput,
} from '@openagency/core';
import {
  LeakDetectorEngine,
  MediaArchitectEngine,
  CampaignOpsEngine,
  ExecutiveBridgeEngine,
} from '@openagency/engines';
import type { LLMConfig, LLMMessage } from '@openagency/types';
import { renderWaterfall } from '../renderers/waterfall.js';
import { readFileSync, existsSync } from 'node:fs';

const REPORT_PROMPTS: Record<string, string> = {
  'leak-detector': `You are an advertising efficiency analyst. Analyze the waste waterfall data below and write a concise executive report. Include:
1. Key findings (top 3 waste areas)
2. Severity assessment
3. Prioritized action plan with estimated savings
4. One-paragraph C-Suite summary

Be direct, use specific numbers from the data. No fluff.`,

  'media-architect': `You are a media strategy consultant. Analyze the budget optimization data below and write a concise executive report. Include:
1. Current allocation assessment
2. Recommended reallocation with rationale
3. Expected ROI improvement
4. Channel-specific recommendations

Be specific with numbers and actionable recommendations.`,

  'campaign-ops': `You are a campaign performance analyst. Analyze the campaign optimization data below and write a concise report. Include:
1. Critical alerts requiring immediate action
2. Pacing and budget assessment
3. Creative performance insights
4. Recommended next steps

Prioritize by severity. Be actionable.`,

  'executive-bridge': `You are a CFO-level marketing analyst. Analyze the revenue bridge data below and write an executive financial report. Include:
1. Marketing ROI and efficiency assessment
2. CLV:CAC analysis
3. Channel-level performance ranking
4. Financial recommendations

Use financial language. Be precise with numbers.`,
};

export function reportCommand(): Command {
  const cmd = new Command('report')
    .description('Generate an AI-powered executive report from your data')
    .argument('<engine>', 'Engine: leak-detector, media-architect, campaign-ops, executive-bridge')
    .argument('[skill]', 'Skill to run (defaults to primary skill per engine)')
    .option('-f, --file <path>', 'Path to JSON input file')
    .option('-d, --demo', 'Use demo data')
    .option('--provider <type>', 'LLM provider: anthropic, deepseek, ollama')
    .option('--model <name>', 'Model name (e.g. claude-sonnet-4-20250514, gpt-4o)')
    .option('--no-llm', 'Skip LLM, output structured data only')
    .option('--json', 'Output raw JSON')
    .action(async (engineId: string, skillId: string | undefined, opts) => {
      const agency = new OpenAgency();
      agency.engines.register(new LeakDetectorEngine());
      agency.engines.register(new MediaArchitectEngine());
      agency.engines.register(new CampaignOpsEngine());
      agency.engines.register(new ExecutiveBridgeEngine());

      // Default skills per engine
      const defaultSkills: Record<string, string> = {
        'leak-detector': 'waste-waterfall',
        'media-architect': 'channel-optimize',
        'campaign-ops': 'optimization-analyze',
        'executive-bridge': 'revenue-translate',
      };
      const skill = skillId ?? defaultSkills[engineId];
      if (!skill) {
        console.error(chalk.red(`  Unknown engine: ${engineId}`));
        process.exit(1);
      }

      // Resolve input
      let input: unknown;
      if (opts.demo) {
        if (engineId === 'leak-detector') {
          input = SAMPLE_WASTE_MEDIUM;
        } else {
          console.error(chalk.red('  --demo only available for leak-detector. Use --file for other engines.'));
          process.exit(1);
        }
      } else if (opts.file) {
        if (!existsSync(opts.file)) {
          console.error(chalk.red(`  File not found: ${opts.file}`));
          process.exit(1);
        }
        const raw = readFileSync(opts.file, 'utf-8');
        const parsed = parseInput(raw);
        input = parsed.data.length === 1 ? parsed.data[0] : parsed.data;
      } else {
        console.error(chalk.red('  Provide --file <path> or --demo'));
        process.exit(1);
      }

      // Run engine
      const spinner = ora(`Running ${engineId}/${skill}...`).start();
      let result;
      try {
        result = await agency.run(engineId, skill, input);
      } catch (err) {
        spinner.stop();
        console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
      spinner.stop();

      // Output structured data
      if (opts.json) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }

      // Show waterfall renderer for leak-detector
      if (engineId === 'leak-detector' && skill === 'waste-waterfall') {
        console.log(renderWaterfall(result.data as Parameters<typeof renderWaterfall>[0]));
      }

      // LLM narrative
      if (opts.llm === false) {
        if (engineId !== 'leak-detector') {
          console.log(JSON.stringify(result.data, null, 2));
        }
        console.log(chalk.dim(`\n  Computed in ${result.duration_ms}ms\n`));
        return;
      }

      // Detect LLM config
      let llmConfig: LLMConfig | null = null;
      if (opts.provider) {
        llmConfig = {
          provider: opts.provider,
          model: opts.model ?? undefined,
        } as LLMConfig;
      } else {
        llmConfig = detectLLMConfig() ?? agency.config.llm ?? null;
      }

      if (!llmConfig) {
        console.log(chalk.yellow('\n  No LLM configured. Showing structured data only.'));
        console.log(chalk.dim('  Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY for AI-powered narratives.'));
        if (engineId !== 'leak-detector') {
          console.log(JSON.stringify(result.data, null, 2));
        }
        console.log(chalk.dim(`\n  Computed in ${result.duration_ms}ms\n`));
        return;
      }

      // Generate narrative
      const narrativeSpinner = ora('Generating executive narrative...').start();
      const systemPrompt = REPORT_PROMPTS[engineId] ?? 'Analyze the following data and provide an executive summary.';

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(result.data, null, 2) },
      ];

      try {
        const llmResult = await callLLM(llmConfig, messages);
        narrativeSpinner.stop();

        console.log('');
        console.log(chalk.bold.white('  EXECUTIVE REPORT'));
        console.log(chalk.dim('  ═══════════════════════════════════════════════════════════'));
        console.log('');
        // Indent each line
        for (const line of llmResult.content.split('\n')) {
          console.log(`  ${line}`);
        }
        console.log('');
        console.log(chalk.dim(`  Engine: ${result.duration_ms}ms | LLM: ${llmResult.model}`));
        if (llmResult.usage) {
          console.log(chalk.dim(`  Tokens: ${llmResult.usage.input_tokens} in / ${llmResult.usage.output_tokens} out`));
        }
        console.log('');
      } catch (err) {
        narrativeSpinner.stop();
        console.log(chalk.yellow(`\n  LLM error: ${err instanceof Error ? err.message : String(err)}`));
        console.log(chalk.dim('  Showing structured data instead:\n'));
        if (engineId !== 'leak-detector') {
          console.log(JSON.stringify(result.data, null, 2));
        }
      }
    });

  return cmd;
}
