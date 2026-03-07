// ─── HFL Routes ─────────────────────────────────────────────────────
// Human Feedback Loop endpoints for approve/reject, config, decisions.

import { Hono } from 'hono';
import type { HFLCoordinator, HFLConfig, ChannelDispatcher } from '@openagency/hfl';

export function hflRoutes(hfl: HFLCoordinator) {
  const app = new Hono();

  // ─── Approve a mesh run ────────────────────────────────────────────
  app.post('/v1/mesh/runs/:runId/approve', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json<{ feedback?: string }>().catch(() => ({} as { feedback?: string }));

    const decision = await hfl.approveRun(runId, body.feedback);
    if (!decision) {
      return c.json(
        { error: 'not_found', message: `No pending decision for run: ${runId}`, status: 404 },
        404,
      );
    }

    return c.json(decision);
  });

  // ─── Reject a mesh run ─────────────────────────────────────────────
  app.post('/v1/mesh/runs/:runId/reject', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json<{ feedback?: string }>().catch(() => ({} as { feedback?: string }));

    const decision = await hfl.rejectRun(runId, body.feedback);
    if (!decision) {
      return c.json(
        { error: 'not_found', message: `No pending decision for run: ${runId}`, status: 404 },
        404,
      );
    }

    return c.json(decision);
  });

  // ─── Get HFL config ────────────────────────────────────────────────
  app.get('/v1/hfl/config', (c) => {
    const clientId = c.req.query('client_id') ?? 'default';
    const config = hfl.getConfig(clientId);
    if (!config) {
      return c.json(
        { error: 'not_found', message: `No HFL config for client: ${clientId}`, status: 404 },
        404,
      );
    }
    return c.json(config);
  });

  // ─── Set HFL config ────────────────────────────────────────────────
  app.put('/v1/hfl/config', async (c) => {
    try {
      const config = await c.req.json<HFLConfig>();

      if (!config.client_id) {
        return c.json(
          { error: 'validation_error', message: 'client_id is required', status: 400 },
          400,
        );
      }

      hfl.setConfig(config);
      return c.json({ message: 'Config updated', config });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── Test HFL webhook config ──────────────────────────────────────
  // Sends a test payload to the configured channel to verify connectivity.
  app.post('/v1/hfl/config/test', async (c) => {
    try {
      const body = await c.req.json<{ client_id?: string; channel_id?: string }>();
      const clientId = body.client_id ?? 'default';
      const config = hfl.getConfig(clientId);

      if (!config) {
        return c.json(
          { error: 'not_found', message: `No HFL config for client: ${clientId}`, status: 404 },
          404,
        );
      }

      // Find the channel to test
      const channelId = body.channel_id ?? config.default_channel;
      const channel = config.channels.find((ch) => ch.id === channelId);

      if (!channel) {
        return c.json(
          { error: 'not_found', message: `Channel not found: ${channelId}`, status: 404 },
          404,
        );
      }

      if (!channel.active) {
        return c.json(
          { error: 'inactive', message: `Channel ${channelId} is inactive`, status: 400 },
          400,
        );
      }

      if (channel.type === 'mcp_callback') {
        return c.json({
          success: true,
          channel_id: channelId,
          message: 'MCP callback channels do not require webhook testing',
        });
      }

      // Send a test payload via the dispatcher
      const testPayload = {
        format: 'text' as const,
        content: `[TEST] OpenAgency HFL webhook test for client "${clientId}" — ${new Date().toISOString()}`,
        actions: [],
      };

      const dispatcher = new (await import('@openagency/hfl')).ChannelDispatcher({
        max_retries: 0,
        retry_delay_ms: 0,
        timeout_ms: 10_000,
      });

      const result = await dispatcher.dispatch(channel, testPayload, {
        decision_id: 'test',
        run_id: 'test',
      });

      return c.json({
        success: result.success,
        channel_id: channelId,
        status_code: result.status_code,
        error: result.error,
        dispatched_at: result.dispatched_at,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'test_failed', message, status: 500 }, 500);
    }
  });

  // ─── List decisions ────────────────────────────────────────────────
  app.get('/v1/hfl/decisions', (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const decisions = hfl.listDecisions(limit);
    return c.json({ decisions, count: decisions.length });
  });

  // ─── Get decision by ID ────────────────────────────────────────────
  app.get('/v1/hfl/decisions/:id', (c) => {
    const id = c.req.param('id');
    const decision = hfl.getDecision(id);
    if (!decision) {
      return c.json(
        { error: 'not_found', message: `Decision not found: ${id}`, status: 404 },
        404,
      );
    }
    return c.json(decision);
  });

  // ─── List pending decisions ────────────────────────────────────────
  app.get('/v1/hfl/pending', (c) => {
    const pending = hfl.listPending();
    return c.json({ decisions: pending, count: pending.length });
  });

  return app;
}
