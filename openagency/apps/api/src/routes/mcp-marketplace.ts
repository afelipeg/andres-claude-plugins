// ─── MCP Marketplace Routes ──────────────────────────────────────────
// Catalog + connection CRUD for external MCP servers

import { Hono } from 'hono';
import { ulid } from 'ulid';
import type { McpConnectionRepo } from '@openagency/memory';
import { encrypt } from '@openagency/memory';
import type { McpClientRegistry, McpProcessManager } from '@openagency/agent';

// ─── Catalog Types ───────────────────────────────────────────────────

interface AuthField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  help: string;
  required?: boolean;
  options?: string[];
}

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  repo?: string;
  endpoint?: string;
  hosted: boolean;
  auth_type: string;
  auth_fields: AuthField[];
  logo: string;
  tools_preview: string[];
  tools_count: number;
  source: 'official' | 'open-source';
  badge: string | null;
}

// ─── Catalog Data ────────────────────────────────────────────────────

const MCP_CATALOG: CatalogEntry[] = [
  {
    id: 'google_ads_mcp',
    name: 'Google Ads',
    description: 'Official Google Ads API via MCP. Campaigns, keywords, performance, conversions.',
    repo: 'https://github.com/googleads/google-ads-mcp',
    hosted: false,
    auth_type: 'oauth2',
    auth_fields: [
      { key: 'developer_token', label: 'Developer Token', type: 'password', help: 'Google Ads API Center > Developer Token' },
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', help: 'Google Cloud Console > Credentials' },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', help: 'Google Cloud Console > Credentials' },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', help: 'Generate at https://developers.google.com/oauthplayground' },
      { key: 'login_customer_id', label: 'Manager Account ID', type: 'text', help: 'Your MCC ID without dashes (e.g. 1234567890)', required: false },
    ],
    logo: 'google_ads',
    tools_preview: ['get_campaigns', 'get_keywords', 'get_performance', 'get_conversions', 'run_gaql_query'],
    tools_count: 12,
    source: 'official',
    badge: 'Official',
  },
  {
    id: 'meta_ads_mcp',
    name: 'Meta Ads',
    description: 'Facebook & Instagram campaigns. 40 tools aligned with Meta Marketing API v25.',
    repo: 'https://github.com/gomarble-ai/facebook-ads-mcp-server',
    hosted: false,
    auth_type: 'bearer',
    auth_fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', help: 'Meta Business Suite > Settings > API Access' },
      { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', help: 'Your Ad Account ID (e.g. act_123456789)' },
    ],
    logo: 'meta_ads',
    tools_preview: ['get_campaigns', 'get_insights', 'get_audiences', 'get_creatives', 'get_ad_sets'],
    tools_count: 40,
    source: 'open-source',
    badge: 'Most Tools',
  },
  {
    id: 'tiktok_ads_mcp',
    name: 'TikTok Ads',
    description: 'TikTok Ads Manager. Campaigns, ad groups, analytics, and reports.',
    repo: 'https://adsmcp.com/mcp/tiktok-ads/',
    hosted: false,
    auth_type: 'oauth2',
    auth_fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', help: 'TikTok for Business > My Apps > Access Token' },
      { key: 'advertiser_id', label: 'Advertiser ID', type: 'text', help: 'TikTok Ads Manager > Account ID' },
    ],
    logo: 'tiktok_ads',
    tools_preview: ['get_campaigns', 'get_ad_groups', 'get_analytics', 'get_reports', 'get_creative_assets'],
    tools_count: 15,
    source: 'open-source',
    badge: null,
  },
  {
    id: 'amazon_ads_mcp',
    name: 'Amazon Ads',
    description: 'Sponsored Products, Brands, and Display. Direct Amazon Advertising API access.',
    endpoint: 'https://app.marketplaceadpros.com/mcp',
    repo: 'https://github.com/MarketplaceAdPros/amazon-ads-mcp-server',
    hosted: true,
    auth_type: 'oauth2',
    auth_fields: [
      { key: 'client_id', label: 'LWA Client ID', type: 'text', help: 'Amazon Developer Console > Login with Amazon' },
      { key: 'client_secret', label: 'LWA Client Secret', type: 'password', help: 'Amazon Developer Console > Login with Amazon' },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', help: 'Generate with Amazon OAuth flow' },
      { key: 'profile_id', label: 'Profile ID', type: 'text', help: 'Amazon Ads Console > Settings > Profile ID' },
      { key: 'region', label: 'Region', type: 'select', options: ['na', 'eu', 'fe'], help: 'NA = North America, EU = Europe, FE = Far East' },
    ],
    logo: 'amazon_ads',
    tools_preview: ['get_campaigns', 'get_keywords', 'get_acos', 'get_sponsored_products', 'get_reports'],
    tools_count: 18,
    source: 'official',
    badge: 'Ready Now',
  },
  {
    id: 'dv360_mcp',
    name: 'Display & Video 360',
    description: 'Google DV360 programmatic campaigns. Insertion orders, line items, creatives, reports.',
    repo: 'https://github.com/caspercrause/dv360-ads-mcp-server',
    hosted: false,
    auth_type: 'service_account',
    auth_fields: [
      { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', help: 'Google Cloud Console > IAM > Service Accounts > Create JSON key. Paste the entire file content.' },
      { key: 'partner_id', label: 'Partner ID', type: 'text', help: 'DV360 > Settings > Partner ID' },
    ],
    logo: 'dv360',
    tools_preview: ['get_insertion_orders', 'get_line_items', 'get_creatives', 'run_report'],
    tools_count: 10,
    source: 'open-source',
    badge: null,
  },
];

// ─── Env var mapping per catalog ─────────────────────────────────────

const ENV_MAPS: Record<string, Record<string, string>> = {
  google_ads_mcp: {
    developer_token: 'GOOGLE_ADS_DEVELOPER_TOKEN',
    client_id: 'GOOGLE_ADS_CLIENT_ID',
    client_secret: 'GOOGLE_ADS_CLIENT_SECRET',
    refresh_token: 'GOOGLE_ADS_REFRESH_TOKEN',
    login_customer_id: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  },
  meta_ads_mcp: {
    access_token: 'META_ACCESS_TOKEN',
    ad_account_id: 'META_AD_ACCOUNT_ID',
  },
  tiktok_ads_mcp: {
    access_token: 'TIKTOK_ACCESS_TOKEN',
    advertiser_id: 'TIKTOK_ADVERTISER_ID',
  },
  dv360_mcp: {
    service_account_json: 'DV360_SERVICE_ACCOUNT',
    partner_id: 'DV360_PARTNER_ID',
  },
};

function buildEnvFromAuthFields(catalogId: string, fields: Record<string, string>): Record<string, string> {
  const map = ENV_MAPS[catalogId] ?? {};
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, v]) => v)
      .map(([k, v]) => [map[k] ?? k.toUpperCase(), v]),
  );
}

// ─── Route Factory ───────────────────────────────────────────────────

export function mcpMarketplaceRoutes(
  connectionRepo: McpConnectionRepo,
  mcpRegistry: McpClientRegistry,
  processManager: McpProcessManager,
): Hono {
  const app = new Hono();

  const encryptionKey = process.env['ENCRYPTION_KEY'] ?? '';

  // GET /v1/mcp/catalog — list available MCPs
  app.get('/v1/mcp/catalog', (c) => {
    return c.json({ catalog: MCP_CATALOG });
  });

  // GET /v1/mcp/connections — list user's connections
  app.get('/v1/mcp/connections', async (c) => {
    const clientId = c.get('userId' as never) as string ?? 'default';
    const connections = await connectionRepo.listByClient(clientId);
    // Strip auth_token from response
    const safe = connections.map(({ auth_token: _, ...rest }) => rest);
    return c.json({ connections: safe });
  });

  // GET /v1/mcp/connections/:id — get detail
  app.get('/v1/mcp/connections/:id', async (c) => {
    const conn = await connectionRepo.getById(c.req.param('id'));
    if (!conn) return c.json({ error: 'not_found' }, 404);
    const { auth_token: _, ...safe } = conn;
    return c.json(safe);
  });

  // POST /v1/mcp/connections — create connection
  app.post('/v1/mcp/connections', async (c) => {
    const body = await c.req.json<{
      catalog_id?: string;
      name?: string;
      url?: string;
      auth_type?: string;
      auth_fields?: Record<string, string>;
      auth_token?: string;
    }>();

    const clientId = c.get('userId' as never) as string ?? 'default';

    let mcpUrl: string;
    let mcpName: string;
    let catalogId: string | null = null;
    let authType = body.auth_type ?? 'bearer';
    let pid: number | null = null;

    if (body.catalog_id) {
      // Catalog connection
      const catalog = MCP_CATALOG.find((e) => e.id === body.catalog_id);
      if (!catalog) return c.json({ error: 'catalog_not_found', message: `No catalog entry: ${body.catalog_id}` }, 404);

      catalogId = catalog.id;
      mcpName = catalog.name;
      authType = catalog.auth_type;

      if (catalog.hosted && catalog.endpoint) {
        // Hosted (e.g., Amazon) — connect directly
        mcpUrl = catalog.endpoint;
      } else {
        // Self-hosted — Plinth spawns the process
        const envVars = buildEnvFromAuthFields(catalog.id, body.auth_fields ?? {});
        try {
          const spawned = await processManager.spawnMcpServer(
            `${clientId}-${catalog.id}`,
            catalog.id,
            envVars,
          );
          mcpUrl = spawned.url;
          pid = spawned.pid;
        } catch (err) {
          return c.json({
            error: 'spawn_failed',
            message: err instanceof Error ? err.message : 'Failed to start MCP server',
          }, 500);
        }
      }
    } else if (body.url) {
      // Custom MCP connection
      mcpUrl = body.url;
      mcpName = body.name ?? new URL(body.url).hostname;
    } else {
      return c.json({ error: 'missing_params', message: 'Provide catalog_id or url' }, 400);
    }

    // Discover tools
    let tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [];
    try {
      const server = await mcpRegistry.connect(mcpName, mcpUrl, body.auth_token);
      tools = server.tools;
    } catch (err) {
      // Save connection as failed but still persist
      const id = ulid();
      await connectionRepo.save({
        id,
        client_id: clientId,
        name: mcpName,
        url: mcpUrl,
        auth_type: authType,
        auth_token: encryptionKey && body.auth_fields
          ? encrypt(JSON.stringify(body.auth_fields), encryptionKey)
          : null,
        catalog_id: catalogId,
        tools: [],
        status: 'failed',
        error: err instanceof Error ? err.message : 'Connection failed',
        allowed_engines: [],
        process_pid: pid,
        connected_at: new Date().toISOString(),
        last_health: null,
      });
      return c.json({
        error: 'connection_failed',
        message: err instanceof Error ? err.message : 'Failed to connect to MCP server',
        connection_id: id,
      }, 502);
    }

    // Persist
    const id = ulid();
    await connectionRepo.save({
      id,
      client_id: clientId,
      name: mcpName,
      url: mcpUrl,
      auth_type: authType,
      auth_token: encryptionKey && body.auth_fields
        ? encrypt(JSON.stringify(body.auth_fields), encryptionKey)
        : null,
      catalog_id: catalogId,
      tools,
      status: 'connected',
      error: null,
      allowed_engines: [],
      process_pid: pid,
      connected_at: new Date().toISOString(),
      last_health: new Date().toISOString(),
    });

    return c.json({
      id,
      name: mcpName,
      url: mcpUrl,
      catalog_id: catalogId,
      status: 'connected',
      tools_discovered: tools.length,
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    }, 201);
  });

  // POST /v1/mcp/connections/:id/test — test connection
  app.post('/v1/mcp/connections/:id/test', async (c) => {
    const conn = await connectionRepo.getById(c.req.param('id'));
    if (!conn) return c.json({ error: 'not_found' }, 404);

    try {
      const server = await mcpRegistry.connect(conn.name, conn.url);
      await connectionRepo.updateTools(conn.id, server.tools);
      await connectionRepo.updateStatus(conn.id, 'connected');
      return c.json({ status: 'ok', tools_count: server.tools.length });
    } catch (err) {
      await connectionRepo.updateStatus(conn.id, 'failed', err instanceof Error ? err.message : 'Test failed');
      return c.json({ status: 'failed', error: err instanceof Error ? err.message : 'Test failed' }, 502);
    }
  });

  // DELETE /v1/mcp/connections/:id — disconnect
  app.delete('/v1/mcp/connections/:id', async (c) => {
    const conn = await connectionRepo.getById(c.req.param('id'));
    if (!conn) return c.json({ error: 'not_found' }, 404);

    // Kill process if managed
    if (conn.process_pid) {
      processManager.killProcess(`${conn.client_id}-${conn.catalog_id ?? conn.id}`);
    }

    mcpRegistry.disconnect(conn.name);
    await connectionRepo.delete(conn.id);

    return c.json({ status: 'disconnected', name: conn.name });
  });

  return app;
}
