// ─── Init Command ──────────────────────────────────────────────────
// Interactive onboarding: configure LLM, run first scan.

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { select, input, password, confirm } from '@inquirer/prompts';
import { saveConfig, loadConfig, getConfigPath, detectLLMConfig } from '@openagency/core';
import type { OpenAgencyConfig, LLMProviderType } from '@openagency/types';
import { existsSync } from 'node:fs';

export function initCommand(): Command {
  const cmd = new Command('init')
    .description('Interactive setup — configure LLM and run your first scan')
    .action(async () => {
      console.log(`
${chalk.bold.cyan('  ┌─────────────────────────────────────────────┐')}
${chalk.bold.cyan('  │')}  ${chalk.bold.white('OpenAgency')} ${chalk.dim('— Setup Wizard')}               ${chalk.bold.cyan('│')}
${chalk.bold.cyan('  │')}  ${chalk.dim('Open-source agency tools for solo marketers')} ${chalk.bold.cyan('│')}
${chalk.bold.cyan('  └─────────────────────────────────────────────┘')}
`);

      // Check for existing config
      const configExists = existsSync(getConfigPath());
      if (configExists) {
        const overwrite = await confirm({
          message: 'Existing configuration found. Overwrite?',
          default: false,
        });
        if (!overwrite) {
          console.log(chalk.dim('\n  Keeping existing config. Run `openagency scan --demo` to try it out.\n'));
          return;
        }
      }

      // Auto-detect LLM
      const detected = detectLLMConfig();
      if (detected) {
        console.log(chalk.green(`  ✓ Detected ${detected.provider} API key from environment\n`));
      }

      // LLM setup
      const setupLLM = await confirm({
        message: 'Configure an LLM for AI-powered reports? (optional — all engines work without it)',
        default: !!detected,
      });

      const config: OpenAgencyConfig = {};

      if (setupLLM) {
        const provider = await select<LLMProviderType>({
          message: 'Which LLM provider?',
          choices: [
            { value: 'anthropic' as const, name: 'Anthropic (Claude)', description: 'Best for marketing analysis' },
            { value: 'deepseek' as const, name: 'DeepSeek (Chat)', description: 'Fast and affordable fallback' },
            { value: 'ollama' as const, name: 'Ollama (Local)', description: 'Free, runs on your machine' },
          ],
          default: detected?.provider ?? 'anthropic',
        });

        if (provider === 'ollama') {
          const baseUrl = await input({
            message: 'Ollama URL:',
            default: 'http://localhost:11434',
          });
          const model = await input({
            message: 'Model name:',
            default: 'llama3',
          });
          config.llm = { provider, model, baseUrl };
        } else {
          const envKey = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'DEEPSEEK_API_KEY';
          const hasEnv = provider === 'anthropic'
            ? !!process.env.ANTHROPIC_API_KEY
            : !!process.env.DEEPSEEK_API_KEY;

          if (hasEnv) {
            console.log(chalk.green(`  ✓ Using ${envKey} from environment`));
          } else {
            const apiKey = await password({
              message: `${envKey}:`,
              mask: '*',
            });
            if (apiKey) {
              // Set it for this session only — never write to disk, never echo back
              process.env[envKey] = apiKey;
              console.log(chalk.green(`\n  ✓ Key set for this session.`));
              console.log(chalk.yellow(`  For persistence, add to your shell profile:`));
              console.log(chalk.dim(`  export ${envKey}="your-key-here"`));
              console.log(chalk.dim(`  We will NOT store the key in any file.\n`));
            }
          }

          if (!config.llm) {
            config.llm = {
              provider,
              model: provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'deepseek-chat',
            };
          }
        }
      }

      // Save config
      const spinner = ora('Saving configuration...').start();
      saveConfig(config);
      spinner.succeed('Configuration saved to .openagency/config.json');

      // Offer demo
      console.log('');
      const runDemo = await confirm({
        message: 'Run a demo scan now? (shows a $500K waste waterfall)',
        default: true,
      });

      if (runDemo) {
        console.log(chalk.dim('\n  Running: openagency scan --demo\n'));
        // Dynamic import to avoid circular deps
        const { OpenAgency, SAMPLE_WASTE_MEDIUM } = await import('@openagency/core');
        const { LeakDetectorEngine } = await import('@openagency/engines');
        const { renderWaterfall } = await import('../renderers/waterfall.js');

        const agency = new OpenAgency();
        agency.engines.register(new LeakDetectorEngine());

        const demoSpinner = ora('Analyzing demo ad spend...').start();
        const result = await agency.run('leak-detector', 'waste-waterfall', SAMPLE_WASTE_MEDIUM);
        demoSpinner.stop();

        console.log(renderWaterfall(result.data as Parameters<typeof renderWaterfall>[0]));
        console.log(chalk.dim(`  Computed in ${result.duration_ms}ms\n`));
      }

      // Next steps
      console.log(`
${chalk.bold('  What\'s next?')}

    ${chalk.cyan('openagency scan --file data.json')}    Analyze your real ad spend
    ${chalk.cyan('openagency scan --budget 250000')}     Quick estimate from budget
    ${chalk.cyan('openagency report leak-detector -d')}  AI-powered executive report
    ${chalk.cyan('openagency run --help')}               Run any engine skill directly
`);
    });

  return cmd;
}
