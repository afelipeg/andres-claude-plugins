// ─── MCP Server Factory ─────────────────────────────────────────────
// Registers all engine skills + agent management as MCP tools.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { OpenAgency } from '@openagency/core';
import { SKILL_SCHEMAS } from '@openagency/schemas';
import type { OodaRuntime } from '@openagency/agent';

export function createMcpServer(
  agency: OpenAgency,
  agents?: Map<string, OodaRuntime>,
): McpServer {
  const server = new McpServer({
    name: 'openagency',
    version: '2.0.0',
  });

  // Register all skills as MCP tools
  for (const entry of SKILL_SCHEMAS) {
    const toolName = `${entry.engineId}_${entry.skillId}`.replace(/-/g, '_');
    const jsonSchema = zodToJsonSchema(entry.inputSchema, {
      target: 'openApi3',
    }) as Record<string, unknown>;

    server.tool(
      toolName,
      entry.description,
      jsonSchema as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await agency.run(entry.engineId, entry.skillId, args);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  // ─── Agent management MCP tools ───────────────────────────────
  if (agents) {
    server.tool(
      'agent_list',
      'List all autonomous agents with their current status',
      {},
      async () => {
        const states = [];
        for (const [, runtime] of agents) {
          states.push(runtime.getState());
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(states, null, 2) }],
        };
      },
    );

    server.tool(
      'agent_start',
      'Start an autonomous agent OODA loop',
      { agent_id: { type: 'string' } } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        const runtime = agents.get(args['agent_id'] as string);
        if (!runtime) {
          return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };
        }
        try {
          await runtime.start();
          return { content: [{ type: 'text' as const, text: JSON.stringify(runtime.getState(), null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'agent_stop',
      'Stop an autonomous agent',
      { agent_id: { type: 'string' } } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        const runtime = agents.get(args['agent_id'] as string);
        if (!runtime) {
          return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };
        }
        await runtime.stop();
        return { content: [{ type: 'text' as const, text: JSON.stringify(runtime.getState(), null, 2) }] };
      },
    );

    server.tool(
      'agent_cycle',
      'Trigger a single manual OODA cycle for an agent',
      { agent_id: { type: 'string' } } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        const runtime = agents.get(args['agent_id'] as string);
        if (!runtime) {
          return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };
        }
        try {
          const result = await runtime.cycle();
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'agent_approve_decision',
      'Approve a pending agent decision',
      {
        agent_id: { type: 'string' },
        decision_id: { type: 'string' },
      } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        return {
          content: [{
            type: 'text' as const,
            text: `Decision ${args['decision_id']} approval requested. Use the REST API for full approval workflow.`,
          }],
        };
      },
    );
  }

  return server;
}
