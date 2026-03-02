#!/usr/bin/env node
// ─── MCP stdio Entry Point (for Claude Desktop) ────────────────────

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenAgency } from '@openagency/core';
import { LeakDetectorEngine } from '@openagency/engines';
import { MediaArchitectEngine } from '@openagency/engines';
import { CampaignOpsEngine } from '@openagency/engines';
import { ExecutiveBridgeEngine } from '@openagency/engines';
import { createMcpServer } from './server.js';

async function main() {
  const agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());

  const server = createMcpServer(agency);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP stdio server failed:', err);
  process.exit(1);
});
