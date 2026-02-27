// ─── Connect Command ────────────────────────────────────────────────
// OAuth2 flow: select platform → start local HTTP server → open browser
// → exchange code → list accounts → select → encrypt + save credentials.

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { select, password } from '@inquirer/prompts';
import { createServer } from 'node:http';
import type { ConnectorPlatform, PlatformCredentials, PlatformAccount } from '@openagency/types';
import {
  getConnector,
  registerConnector,
  MetaConnector,
  GoogleAdsConnector,
  DV360Connector,
  TikTokAdsConnector,
  TikTokShopConnector,
  AmazonAdsConnector,
} from '@openagency/connectors';
import { NodeCredentialStore } from '@openagency/connectors/credential-store';

const CALLBACK_PORT = 3847;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

const PLATFORM_LABELS: Record<ConnectorPlatform, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads (Facebook + Instagram)',
  dv360: 'Display & Video 360',
  tiktok_ads: 'TikTok Ads',
  tiktok_shop: 'TikTok Shop',
  amazon_ads: 'Amazon Ads',
};

export function connectCommand(): Command {
  const cmd = new Command('connect')
    .description('Connect a platform via OAuth2')
    .argument('[platform]', 'Platform to connect (google_ads, meta_ads, dv360, tiktok_ads, tiktok_shop, amazon_ads)')
    .action(async (platformArg?: string) => {
      console.log(chalk.bold.cyan('\n  Platform Connect\n'));

      // Select platform
      const platform: ConnectorPlatform = platformArg
        ? (platformArg as ConnectorPlatform)
        : await select({
            message: 'Which platform do you want to connect?',
            choices: Object.entries(PLATFORM_LABELS).map(([value, name]) => ({
              value: value as ConnectorPlatform,
              name,
            })),
          });

      // Initialize connector based on platform
      initializeConnector(platform);

      const connector = getConnector(platform);

      // Get passphrase for credential encryption
      const passphrase = await password({
        message: 'Encryption passphrase (for securing credentials):',
        mask: '*',
      });
      if (!passphrase) {
        console.log(chalk.red('  Passphrase required to encrypt credentials.'));
        return;
      }

      const store = new NodeCredentialStore(passphrase);

      // Check if already connected
      if (store.has(platform)) {
        const reconnect = await select({
          message: `${PLATFORM_LABELS[platform]} is already connected. What to do?`,
          choices: [
            { value: 'reconnect', name: 'Reconnect (re-authorize)' },
            { value: 'cancel', name: 'Cancel' },
          ],
        });
        if (reconnect === 'cancel') return;
      }

      // Start OAuth flow
      const authUrl = connector.getAuthUrl(REDIRECT_URI, platform);
      console.log(chalk.dim(`\n  Opening browser for authorization...\n`));
      console.log(chalk.cyan(`  ${authUrl}\n`));

      // Start local callback server
      const code = await waitForOAuthCallback();
      if (!code) {
        console.log(chalk.red('  OAuth flow failed — no authorization code received.'));
        return;
      }

      // Exchange code for tokens
      const spinner = ora('Exchanging authorization code...').start();
      const tokens = await connector.exchangeCode(code, REDIRECT_URI);
      spinner.succeed('Got access tokens');

      // List accounts
      const accountSpinner = ora('Fetching accounts...').start();
      let accounts: PlatformAccount[];
      try {
        accounts = await connector.listAccounts(tokens);
        accountSpinner.succeed(`Found ${accounts.length} account(s)`);
      } catch (err) {
        accountSpinner.fail('Could not list accounts');
        console.log(chalk.yellow(`  ${err instanceof Error ? err.message : String(err)}`));
        accounts = [];
      }

      // Select account
      let accountId: string | undefined;
      if (accounts.length === 1) {
        accountId = accounts[0].id;
        console.log(chalk.green(`  Using account: ${accounts[0].name} (${accountId})`));
      } else if (accounts.length > 1) {
        accountId = await select({
          message: 'Select an account:',
          choices: accounts.map((a) => ({
            value: a.id,
            name: `${a.name} (${a.id})${a.currency ? ` - ${a.currency}` : ''}`,
          })),
        });
      }

      // Save encrypted credentials
      const credentials: PlatformCredentials = {
        platform,
        tokens,
        account_id: accountId,
        connected_at: new Date().toISOString(),
      };

      const saveSpinner = ora('Encrypting and saving credentials...').start();
      store.set(credentials);
      saveSpinner.succeed('Credentials saved to ~/.openagency/credentials.enc');

      console.log(`
${chalk.bold.green('  Connected!')} ${PLATFORM_LABELS[platform]}
${chalk.dim(`  Account: ${accountId ?? 'none'}`)}

  ${chalk.cyan('openagency sync --platform ' + platform)}   Pull campaign data
  ${chalk.cyan('openagency disconnect ' + platform)}        Remove connection
`);
    });

  return cmd;
}

function initializeConnector(platform: ConnectorPlatform): void {
  switch (platform) {
    case 'meta_ads':
      registerConnector(
        new MetaConnector({
          appId: requireEnv('META_APP_ID'),
          appSecret: requireEnv('META_APP_SECRET'),
        }),
      );
      break;
    case 'google_ads':
      registerConnector(
        new GoogleAdsConnector({
          clientId: requireEnv('GOOGLE_CLIENT_ID'),
          clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
          developerToken: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
        }),
      );
      break;
    case 'dv360':
      registerConnector(
        new DV360Connector({
          clientId: requireEnv('GOOGLE_CLIENT_ID'),
          clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        }),
      );
      break;
    case 'tiktok_ads':
      registerConnector(
        new TikTokAdsConnector({
          appId: requireEnv('TIKTOK_ADS_APP_ID'),
          secret: requireEnv('TIKTOK_ADS_SECRET'),
        }),
      );
      break;
    case 'tiktok_shop':
      registerConnector(
        new TikTokShopConnector({
          appKey: requireEnv('TIKTOK_SHOP_APP_KEY'),
          appSecret: requireEnv('TIKTOK_SHOP_APP_SECRET'),
        }),
      );
      break;
    case 'amazon_ads':
      registerConnector(
        new AmazonAdsConnector({
          clientId: requireEnv('AMAZON_ADS_CLIENT_ID'),
          clientSecret: requireEnv('AMAZON_ADS_CLIENT_SECRET'),
        }),
      );
      break;
  }
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `Missing env var: ${key}. Set it before connecting.\n` +
      `  export ${key}="your-value"`,
    );
  }
  return val;
}

function waitForOAuthCallback(): Promise<string | null> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2>${code ? 'Authorization successful!' : 'Authorization failed.'}</h2>
            <p>${code ? 'You can close this window.' : 'No code received.'}</p>
          </body></html>
        `);

        server.close();
        resolve(code);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      // Try to open the browser (best-effort)
      const { exec } = require('node:child_process');
      exec(`open http://localhost:${CALLBACK_PORT}`).unref?.();
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      resolve(null);
    }, 300_000);
  });
}
