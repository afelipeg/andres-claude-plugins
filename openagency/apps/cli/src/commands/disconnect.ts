// ─── Disconnect Command ─────────────────────────────────────────────
// Remove a platform connection from the encrypted credential store.

import { Command } from 'commander';
import chalk from 'chalk';
import { select, password, confirm } from '@inquirer/prompts';
import type { ConnectorPlatform } from '@openagency/types';
import { NodeCredentialStore } from '@openagency/connectors/credential-store';

const PLATFORM_LABELS: Record<ConnectorPlatform, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  dv360: 'DV360',
  tiktok_ads: 'TikTok Ads',
  tiktok_shop: 'TikTok Shop',
  amazon_ads: 'Amazon Ads',
};

export function disconnectCommand(): Command {
  const cmd = new Command('disconnect')
    .description('Remove a platform connection')
    .argument('<platform>', 'Platform to disconnect (google_ads, meta_ads, dv360, tiktok_ads, tiktok_shop, amazon_ads)')
    .action(async (platformArg: string) => {
      const platform = platformArg as ConnectorPlatform;

      if (!PLATFORM_LABELS[platform]) {
        console.log(chalk.red(`\n  Unknown platform: ${platformArg}`));
        console.log(chalk.dim(`  Valid: ${Object.keys(PLATFORM_LABELS).join(', ')}`));
        return;
      }

      const passphrase = await password({
        message: 'Encryption passphrase:',
        mask: '*',
      });
      if (!passphrase) {
        console.log(chalk.red('  Passphrase required.'));
        return;
      }

      const store = new NodeCredentialStore(passphrase);

      if (!store.has(platform)) {
        console.log(chalk.yellow(`\n  ${PLATFORM_LABELS[platform]} is not connected.`));
        return;
      }

      const sure = await confirm({
        message: `Disconnect ${PLATFORM_LABELS[platform]}? This removes saved credentials.`,
        default: false,
      });

      if (!sure) {
        console.log(chalk.dim('\n  Cancelled.'));
        return;
      }

      store.remove(platform);
      console.log(chalk.green(`\n  Disconnected ${PLATFORM_LABELS[platform]}.`));
      console.log(chalk.dim('  Credentials removed from ~/.openagency/credentials.enc\n'));
    });

  return cmd;
}
