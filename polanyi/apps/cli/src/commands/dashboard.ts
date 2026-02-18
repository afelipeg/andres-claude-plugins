// ─── Dashboard Command ─────────────────────────────────────────────
// Placeholder for web dashboard launcher (v0.2.0)

import { Command } from 'commander';
import chalk from 'chalk';

export function dashboardCommand(): Command {
  const cmd = new Command('dashboard')
    .description('Launch the web dashboard (coming in v0.2.0)')
    .action(() => {
      console.log(`
  ${chalk.bold.yellow('⚡ Web Dashboard — Coming Soon')}

  The interactive web dashboard with charts and drag-drop data
  upload is planned for v0.2.0.

  ${chalk.bold('For now, use the CLI:')}
    ${chalk.cyan('openagency scan --demo')}              Visual waste waterfall
    ${chalk.cyan('openagency report leak-detector -d')}  AI executive report
    ${chalk.cyan('openagency run --help')}               All engine skills

  ${chalk.dim('Track progress: https://github.com/openagency/openagency')}
`);
    });

  return cmd;
}
