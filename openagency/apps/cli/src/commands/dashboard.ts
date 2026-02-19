// ─── Dashboard Command ─────────────────────────────────────────────
// Launches the web dashboard dev server or shows build instructions.

import { Command } from 'commander';
import chalk from 'chalk';

export function dashboardCommand(): Command {
  const cmd = new Command('dashboard')
    .description('Launch the web dashboard')
    .action(() => {
      console.log(`
  ${chalk.bold.cyan('📊 OpenAgency Web Dashboard')}

  The web dashboard is available in the ${chalk.bold('apps/web')} package.

  ${chalk.bold('Development:')}
    ${chalk.cyan('cd apps/web && pnpm dev')}    Start the dev server

  ${chalk.bold('Production:')}
    ${chalk.cyan('cd apps/web && pnpm build')}  Build for deployment
    ${chalk.cyan('cd apps/web && pnpm preview')}  Preview the production build

  ${chalk.bold('Features:')}
    • Interactive waste waterfall charts (Recharts)
    • Channel optimization with budget allocation visuals
    • Campaign DAG timeline with sprint tracking
    • Revenue bridge with L1/L2/L3 financial metrics
    • Shapley attribution analysis
    • Demo data buttons for all 4 engines
    • File upload for your own data (JSON/CSV)

  ${chalk.dim('Docs: https://github.com/openagency/openagency')}
`);
    });

  return cmd;
}
