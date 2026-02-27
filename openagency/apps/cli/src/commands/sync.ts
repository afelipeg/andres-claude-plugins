// ─── Sync Command ───────────────────────────────────────────────────
// Pull campaign data from connected platforms.
// Load encrypted creds → refresh tokens → fetch campaigns → normalize → print.

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { select, password } from '@inquirer/prompts';
import type { ConnectorPlatform } from '@openagency/types';
import {
  getConnector,
  registerConnector,
  MetaConnector,
  GoogleAdsConnector,
  DV360Connector,
  TikTokAdsConnector,
  TikTokShopConnector,
  AmazonAdsConnector,
  apiToWasteInput,
  apiToChannelInput,
  apiToOptimizationInput,
  apiToMMMInput,
  apiToRevenueBridgeInput,
} from '@openagency/connectors';
import { NodeCredentialStore } from '@openagency/connectors/credential-store';

const PLATFORM_LABELS: Record<ConnectorPlatform, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  dv360: 'DV360',
  tiktok_ads: 'TikTok Ads',
  tiktok_shop: 'TikTok Shop',
  amazon_ads: 'Amazon Ads',
};

export function syncCommand(): Command {
  const cmd = new Command('sync')
    .description('Pull campaign data from connected platforms')
    .option('-p, --platform <platform>', 'Platform to sync')
    .option('-d, --days <days>', 'Date range in days', '30')
    .option('-e, --engine <engine>', 'Run engine on synced data (leak-detector, media-architect, campaign-ops, executive-bridge)')
    .action(async (opts) => {
      console.log(chalk.bold.cyan('\n  Platform Sync\n'));

      // Get passphrase
      const passphrase = await password({
        message: 'Encryption passphrase:',
        mask: '*',
      });
      if (!passphrase) {
        console.log(chalk.red('  Passphrase required.'));
        return;
      }

      const store = new NodeCredentialStore(passphrase);
      const platforms = store.platforms();

      if (platforms.length === 0) {
        console.log(chalk.yellow('  No platforms connected. Run: openagency connect'));
        return;
      }

      // Select platform
      const platform: ConnectorPlatform = opts.platform
        ? (opts.platform as ConnectorPlatform)
        : platforms.length === 1
          ? platforms[0]
          : await select({
              message: 'Which platform to sync?',
              choices: [
                { value: 'all' as ConnectorPlatform, name: 'All connected platforms' },
                ...platforms.map((p) => ({
                  value: p,
                  name: PLATFORM_LABELS[p] ?? p,
                })),
              ],
            });

      const days = parseInt(opts.days) || 30;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const dateRange = {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };

      const platformsToSync = platform === ('all' as ConnectorPlatform) ? platforms : [platform];

      for (const p of platformsToSync) {
        const credentials = store.get(p);
        if (!credentials) {
          console.log(chalk.yellow(`  ${PLATFORM_LABELS[p] ?? p}: no credentials found`));
          continue;
        }

        // Initialize connector
        try {
          initializeConnector(p);
        } catch (err) {
          console.log(chalk.yellow(`  ${PLATFORM_LABELS[p]}: ${err instanceof Error ? err.message : String(err)}`));
          continue;
        }

        const connector = getConnector(p);
        const spinner = ora(`Syncing ${PLATFORM_LABELS[p] ?? p}...`).start();

        try {
          // Refresh tokens if needed
          let activeCredentials = credentials;
          if (!connector.isTokenValid(credentials.tokens)) {
            const newTokens = await connector.refreshTokens(credentials.tokens);
            activeCredentials = { ...credentials, tokens: newTokens };
            store.set({ ...activeCredentials, last_sync_at: new Date().toISOString() });
          }

          const rows = await connector.fetchCampaigns(activeCredentials, dateRange);
          spinner.succeed(`${PLATFORM_LABELS[p]}: ${rows.length} campaign-days fetched (${dateRange.start} → ${dateRange.end})`);

          // Print summary
          const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
          const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
          const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);
          const uniqueCampaigns = new Set(rows.map((r) => r.campaign_name)).size;

          console.log(chalk.dim(`    Campaigns: ${uniqueCampaigns}  |  Spend: $${totalSpend.toLocaleString()}  |  Revenue: $${totalRevenue.toLocaleString()}  |  Conversions: ${totalConversions.toLocaleString()}`));

          // Run engine if requested
          if (opts.engine) {
            await runEngine(opts.engine, rows);
          }

          // Update last_sync_at
          store.set({ ...activeCredentials, last_sync_at: new Date().toISOString() });

        } catch (err) {
          spinner.fail(`${PLATFORM_LABELS[p]}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      console.log('');
    });

  return cmd;
}

async function runEngine(
  engineId: string,
  rows: import('@openagency/types').NormalizedCampaignRow[],
): Promise<void> {
  const { OpenAgency } = await import('@openagency/core');
  const engines = await import('@openagency/engines');

  const agency = new OpenAgency();

  switch (engineId) {
    case 'leak-detector': {
      agency.engines.register(new engines.LeakDetectorEngine());
      const input = apiToWasteInput(rows);
      const result = await agency.run('leak-detector', 'waste-waterfall', input);
      console.log(chalk.dim(`    Engine result: ${JSON.stringify(result.data).slice(0, 200)}...`));
      break;
    }
    case 'media-architect': {
      agency.engines.register(new engines.MediaArchitectEngine());
      const input = apiToChannelInput(rows);
      const result = await agency.run('media-architect', 'channel-optimizer', input);
      console.log(chalk.dim(`    Engine result: ${JSON.stringify(result.data).slice(0, 200)}...`));
      break;
    }
    case 'campaign-ops': {
      agency.engines.register(new engines.CampaignOpsEngine());
      const input = apiToOptimizationInput(rows);
      const result = await agency.run('campaign-ops', 'optimization-engine', input);
      console.log(chalk.dim(`    Engine result: ${JSON.stringify(result.data).slice(0, 200)}...`));
      break;
    }
    case 'executive-bridge': {
      agency.engines.register(new engines.ExecutiveBridgeEngine());
      const input = apiToRevenueBridgeInput(rows);
      const result = await agency.run('executive-bridge', 'revenue-bridge', input);
      console.log(chalk.dim(`    Engine result: ${JSON.stringify(result.data).slice(0, 200)}...`));
      break;
    }
    default:
      console.log(chalk.yellow(`    Unknown engine: ${engineId}`));
  }
}

function initializeConnector(platform: ConnectorPlatform): void {
  const env = (key: string) => process.env[key] ?? '';

  switch (platform) {
    case 'meta_ads':
      registerConnector(new MetaConnector({ appId: env('META_APP_ID'), appSecret: env('META_APP_SECRET') }));
      break;
    case 'google_ads':
      registerConnector(new GoogleAdsConnector({ clientId: env('GOOGLE_CLIENT_ID'), clientSecret: env('GOOGLE_CLIENT_SECRET'), developerToken: env('GOOGLE_ADS_DEVELOPER_TOKEN') }));
      break;
    case 'dv360':
      registerConnector(new DV360Connector({ clientId: env('GOOGLE_CLIENT_ID'), clientSecret: env('GOOGLE_CLIENT_SECRET') }));
      break;
    case 'tiktok_ads':
      registerConnector(new TikTokAdsConnector({ appId: env('TIKTOK_ADS_APP_ID'), secret: env('TIKTOK_ADS_SECRET') }));
      break;
    case 'tiktok_shop':
      registerConnector(new TikTokShopConnector({ appKey: env('TIKTOK_SHOP_APP_KEY'), appSecret: env('TIKTOK_SHOP_APP_SECRET') }));
      break;
    case 'amazon_ads':
      registerConnector(new AmazonAdsConnector({ clientId: env('AMAZON_ADS_CLIENT_ID'), clientSecret: env('AMAZON_ADS_CLIENT_SECRET') }));
      break;
  }
}
