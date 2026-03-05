// ─── Connector Write Registry ──────────────────────────────────────
// Manages writable connectors and enforces safety checks before
// executing any write operation against a platform API.

import type {
  ConnectorPlatform,
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  WriteOperation,
  SafetyContext,
  SafetyPipelineResult,
} from '@openagency/types';
import { createLogger } from '@openagency/core';
import { SafetyPipeline } from './safety/pipeline.js';

export class ConnectorWriteRegistry {
  private writers = new Map<ConnectorPlatform, WritablePlatformConnector>();
  private safetyPipeline: SafetyPipeline;
  private log = createLogger('writer');

  constructor(safetyPipeline?: SafetyPipeline) {
    this.safetyPipeline = safetyPipeline ?? new SafetyPipeline();
  }

  registerWriter(connector: WritablePlatformConnector): void {
    this.writers.set(connector.platform, connector);
  }

  getWriter(platform: ConnectorPlatform): WritablePlatformConnector | undefined {
    return this.writers.get(platform);
  }

  listWriters(): ConnectorPlatform[] {
    return Array.from(this.writers.keys());
  }

  async executeWrite(
    action: { type: WriteOperation; platform: ConnectorPlatform; parameters: Record<string, unknown> },
    credentials: PlatformCredentials,
    context: SafetyContext,
  ): Promise<{ safety: SafetyPipelineResult; result?: WriteResult }> {
    this.log.info({ platform: action.platform, operation: action.type }, 'Executing write');

    // Run safety pipeline first
    const safety = this.safetyPipeline.evaluate(
      { type: action.type, parameters: action.parameters },
      context,
    );

    if (!safety.approved) {
      this.log.warn({ platform: action.platform, operation: action.type }, 'Write blocked by safety pipeline');
      return { safety };
    }

    const writer = this.writers.get(action.platform);
    if (!writer) {
      throw new Error(`No writable connector for platform: ${action.platform}`);
    }

    let result: WriteResult;

    switch (action.type) {
      case 'budget_update':
        result = await writer.updateCampaignBudget(credentials, {
          campaign_id: action.parameters['campaign_id'] as string,
          new_budget: action.parameters['new_budget'] as number,
          budget_type: action.parameters['budget_type'] as 'daily' | 'lifetime' | undefined,
        });
        break;
      case 'campaign_pause':
        result = await writer.pauseCampaign(
          credentials,
          action.parameters['campaign_id'] as string,
        );
        break;
      case 'campaign_enable':
        result = await writer.enableCampaign(
          credentials,
          action.parameters['campaign_id'] as string,
        );
        break;
      case 'bid_adjustment':
        result = await writer.adjustBid(credentials, {
          ad_set_id: action.parameters['ad_set_id'] as string,
          new_bid: action.parameters['new_bid'] as number,
          bid_strategy: action.parameters['bid_strategy'] as string | undefined,
        });
        break;
    }

    return { safety, result };
  }
}
