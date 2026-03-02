// ─── Mock Write Registry ────────────────────────────────────────────
// ConnectorWriteRegistry stub that records calls and returns configurable results.

import type {
  ConnectorPlatform,
  PlatformCredentials,
  WriteOperation,
  WriteResult,
  SafetyContext,
  SafetyPipelineResult,
} from '@openagency/types';

export interface WriteCall {
  action: { type: WriteOperation; platform: ConnectorPlatform; parameters: Record<string, unknown> };
  credentials: PlatformCredentials;
  context: SafetyContext;
}

export class MockConnectorWriteRegistry {
  calls: WriteCall[] = [];
  private safetyResult: SafetyPipelineResult = { approved: true, checks: [] };
  private writeResult: WriteResult | undefined;

  setSafetyResult(result: SafetyPipelineResult): void {
    this.safetyResult = result;
  }

  setWriteResult(result: WriteResult): void {
    this.writeResult = result;
  }

  registerWriter(): void {
    // no-op
  }

  getWriter(): undefined {
    return undefined;
  }

  listWriters(): ConnectorPlatform[] {
    return [];
  }

  async executeWrite(
    action: { type: WriteOperation; platform: ConnectorPlatform; parameters: Record<string, unknown> },
    credentials: PlatformCredentials,
    context: SafetyContext,
  ): Promise<{ safety: SafetyPipelineResult; result?: WriteResult }> {
    this.calls.push({ action, credentials, context });

    if (!this.safetyResult.approved) {
      return { safety: this.safetyResult };
    }

    return {
      safety: this.safetyResult,
      result: this.writeResult ?? {
        success: true,
        platform: action.platform,
        operation: action.type,
        target_id: (action.parameters['campaign_id'] as string) ?? 'unknown',
        timestamp: new Date().toISOString(),
        dry_run: false,
      },
    };
  }
}
