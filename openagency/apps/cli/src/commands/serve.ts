// ─── Serve Command ──────────────────────────────────────────────────

import { Command } from 'commander';
import chalk from 'chalk';

export function serveCommand(): Command {
  return new Command('serve')
    .description('Start the OpenAgency API server')
    .option('-p, --port <port>', 'Port to listen on', '3100')
    .action(async (opts: { port: string }) => {
      const port = parseInt(opts.port, 10);
      process.env['PORT'] = String(port);

      console.log(chalk.cyan('\n  Starting OpenAgency API server...\n'));

      try {
        // Dynamic import so the api package is only loaded when serve is called
        const { createApp } = await import('@openagency/api/app');
        const { serve } = await import('@hono/node-server');

        const app = await createApp();
        serve({ fetch: app.fetch, port }, () => {
          console.log(chalk.green(`  API server running on http://localhost:${port}`));
          console.log(chalk.dim(`  Health:     http://localhost:${port}/health`));
          console.log(chalk.dim(`  OpenAPI:    http://localhost:${port}/v1/openapi.json`));
          console.log(chalk.dim(`  Agent Card: http://localhost:${port}/.well-known/agent.json`));
          console.log(chalk.dim(`  MCP:        http://localhost:${port}/v1/mcp`));
          console.log('');
        });
      } catch (err) {
        console.error(
          chalk.red('  Failed to start API server:'),
          err instanceof Error ? err.message : err,
        );
        console.log(
          chalk.dim('\n  Make sure @openagency/api is built: pnpm build --filter=@openagency/api\n'),
        );
        process.exit(1);
      }
    });
}
