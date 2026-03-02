// ─── A2A Agent Card Generator ───────────────────────────────────────

import { SKILL_SCHEMAS, listEngineIds, getEngineSkills } from '@openagency/schemas';

export interface AgentCard {
  name: string;
  version: string;
  description: string;
  provider: { organization: string; url: string };
  url: string;
  authentication: { schemes: string[] };
  capabilities: {
    engines: Array<{
      id: string;
      skills: Array<{
        id: string;
        name: string;
        description: string;
        endpoint: string;
      }>;
    }>;
    autonomous: {
      agents: string[];
      ooda_loop: boolean;
      goal_driven: boolean;
      safety_pipeline: boolean;
      dry_run_default: boolean;
    };
    orchestration: {
      pipelines: Array<{
        id: string;
        name: string;
        stages: string[];
        trigger: string;
        typical_duration_s: number;
        max_duration_s: number;
      }>;
      mcp_tools: string[];
    };
  };
  protocols: {
    rest: { base_url: string; openapi: string };
    mcp: { endpoint: string; transport: string };
  };
}

export function generateAgentCard(baseUrl: string): AgentCard {
  const engineIds = listEngineIds();
  const engines = engineIds.map((engineId) => {
    const skills = getEngineSkills(engineId);
    return {
      id: engineId,
      skills: skills.map((s) => ({
        id: s.skillId,
        name: s.name,
        description: s.description,
        endpoint: `${baseUrl}/v1/engines/${s.engineId}/skills/${s.skillId}`,
      })),
    };
  });

  return {
    name: 'OpenAgency',
    version: '3.0.0',
    description:
      'Open-source ad-tech intelligence infrastructure with 4 autonomous agents, 29 skills, multi-agent orchestration mesh, OODA loop runtime, goal-driven execution, and safety pipeline. Any AI agent can trigger a full optimization pipeline via a single MCP tool call.',
    provider: {
      organization: 'OpenAgency',
      url: baseUrl,
    },
    url: baseUrl,
    authentication: {
      schemes: ['bearer', 'api_key'],
    },
    capabilities: {
      engines,
      autonomous: {
        agents: ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'],
        ooda_loop: true,
        goal_driven: true,
        safety_pipeline: true,
        dry_run_default: true,
      },
      orchestration: {
        pipelines: [
          {
            id: 'full-optimization',
            name: 'Full Optimization Pipeline',
            stages: ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'],
            trigger: 'manual or sync.completed',
            typical_duration_s: 360,
            max_duration_s: 1080,
          },
        ],
        mcp_tools: ['mesh_list_pipelines', 'mesh_execute_pipeline', 'mesh_get_run'],
      },
    },
    protocols: {
      rest: {
        base_url: `${baseUrl}/v1`,
        openapi: `${baseUrl}/v1/openapi.json`,
      },
      mcp: {
        endpoint: `${baseUrl}/v1/mcp`,
        transport: 'streamable-http',
      },
    },
  };
}
