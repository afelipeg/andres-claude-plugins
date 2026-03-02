import { Command } from 'commander';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { scanCommand } from './commands/scan.js';
import { runCommand } from './commands/run.js';
import { reportCommand } from './commands/report.js';
import { initCommand } from './commands/init.js';
import { dashboardCommand } from './commands/dashboard.js';
import { connectCommand } from './commands/connect.js';
import { syncCommand } from './commands/sync.js';
import { disconnectCommand } from './commands/disconnect.js';
import { serveCommand } from './commands/serve.js';

const VERSION = '1.0.0';

const BANNER = `
${chalk.bold.cyan('   ╔═══════════════════════════════════════════════════╗')}
${chalk.bold.cyan('   ║')}                                                   ${chalk.bold.cyan('║')}
${chalk.bold.cyan('   ║')}   ${chalk.bold.white('OpenAgency')} ${chalk.dim('v' + VERSION)}                            ${chalk.bold.cyan('║')}
${chalk.bold.cyan('   ║')}   ${chalk.dim('Open-source agency tools for solo marketers')}    ${chalk.bold.cyan('║')}
${chalk.bold.cyan('   ║')}                                                   ${chalk.bold.cyan('║')}
${chalk.bold.cyan('   ╚═══════════════════════════════════════════════════╝')}
`;

async function interactiveMenu(): Promise<void> {
  console.log(BANNER);

  const action = await select({
    message: 'What do you want to do?',
    choices: [
      {
        value: 'scan-demo',
        name: `${chalk.bold('See a demo')} — waste waterfall for a $500K budget`,
      },
      {
        value: 'scan-budget',
        name: `${chalk.bold('Quick scan')} — estimate waste from your budget`,
      },
      {
        value: 'scan-file',
        name: `${chalk.bold('Analyze file')} — scan your real ad spend data`,
      },
      {
        value: 'report',
        name: `${chalk.bold('Executive report')} — AI-powered narrative analysis`,
      },
      {
        value: 'connect',
        name: `${chalk.bold('Connect platform')} — link Google, Meta, TikTok, Amazon via OAuth`,
      },
      {
        value: 'sync',
        name: `${chalk.bold('Sync data')} — pull campaign data from connected platforms`,
      },
      {
        value: 'init',
        name: `${chalk.bold('Setup')} — configure LLM and preferences`,
      },
    ],
  });

  // Build argv to re-dispatch through Commander
  switch (action) {
    case 'scan-demo':
      process.argv = ['node', 'openagency', 'scan', '--demo'];
      createProgram().parse();
      break;

    case 'scan-budget': {
      const { input } = await import('@inquirer/prompts');
      const budget = await input({
        message: 'Total monthly ad budget ($):',
        default: '100000',
        validate: (v) => {
          const n = parseFloat(v);
          return isNaN(n) || n <= 0 ? 'Enter a positive number' : true;
        },
      });
      const industry = await select({
        message: 'Industry:',
        choices: [
          { value: 'retail', name: 'Retail / E-commerce' },
          { value: 'fmcg', name: 'FMCG / CPG' },
          { value: 'automotive', name: 'Automotive' },
          { value: 'financial', name: 'Financial Services' },
          { value: 'telecom', name: 'Telecom' },
        ],
      });
      process.argv = ['node', 'openagency', 'scan', '--budget', budget, '--industry', industry];
      createProgram().parse();
      break;
    }

    case 'scan-file': {
      const { input } = await import('@inquirer/prompts');
      const filePath = await input({
        message: 'Path to JSON file:',
      });
      process.argv = ['node', 'openagency', 'scan', '--file', filePath];
      createProgram().parse();
      break;
    }

    case 'report':
      process.argv = ['node', 'openagency', 'report', 'leak-detector', '--demo', '--no-llm'];
      createProgram().parse();
      break;

    case 'connect':
      process.argv = ['node', 'openagency', 'connect'];
      createProgram().parse();
      break;

    case 'sync':
      process.argv = ['node', 'openagency', 'sync'];
      createProgram().parse();
      break;

    case 'init':
      process.argv = ['node', 'openagency', 'init'];
      createProgram().parse();
      break;
  }
}

export function createProgram(): Command {
  const program = new Command()
    .name('openagency')
    .description(
      'Open-source advertising agency toolkit for solo marketers.\n' +
      'Find where your ad budget leaks money.',
    )
    .version(VERSION);

  program.addCommand(initCommand());
  program.addCommand(scanCommand());
  program.addCommand(runCommand());
  program.addCommand(reportCommand());
  program.addCommand(dashboardCommand());
  program.addCommand(connectCommand());
  program.addCommand(syncCommand());
  program.addCommand(disconnectCommand());
  program.addCommand(serveCommand());

  // Zero-arg: launch interactive menu
  program.action(async () => {
    await interactiveMenu();
  });

  return program;
}
