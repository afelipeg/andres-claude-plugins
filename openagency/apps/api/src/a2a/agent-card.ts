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
    version: '2.0.0',
    description:
      'Open-source ad-tech intelligence platform with 4 autonomous engines, 29 skills, OODA loop runtime, goal-driven execution, and safety pipeline for waste detection, budget optimization, campaign operations, and executive metrics translation.',
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
