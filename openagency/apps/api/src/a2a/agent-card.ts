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
    delivery: {
      skills: Array<{ id: string; name: string; outputs: string[] }>;
      file_types: string[];
      storage: string;
      file_ttl_days: number;
      endpoints: {
        run_skill: string;
        list_files: string;
        download_file: string;
        delete_file: string;
      };
    };
    scheduling: {
      enabled: boolean;
      cron_supported: boolean;
      endpoint: string;
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
    version: '3.1.1',
    description:
      'Open-source ad-tech intelligence infrastructure with 5 engines (4 optimization + 1 delivery), ' +
      '39 skills, multi-agent orchestration mesh, OODA loop runtime, goal-driven execution, safety pipeline, ' +
      'human feedback loop, and scheduled pipelines. Any AI agent can trigger a full optimization + delivery ' +
      'pipeline via a single MCP tool call.',
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
          {
            id: 'full-with-deliverables',
            name: 'Full Optimization + Delivery Pipeline',
            stages: ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge', 'delivery'],
            trigger: 'manual or sync.completed',
            typical_duration_s: 660,
            max_duration_s: 1380,
          },
        ],
        mcp_tools: ['mesh_list_pipelines', 'mesh_execute_pipeline', 'mesh_get_run'],
      },
      delivery: {
        skills: [
          { id: 'monthly-report', name: 'Monthly Report', outputs: ['pdf', 'pptx'] },
          { id: 'competitive-analysis', name: 'Competitive Analysis', outputs: ['pdf', 'pptx', 'docx'] },
          { id: 'industry-benchmarks', name: 'Industry Benchmarks', outputs: ['pdf', 'xlsx'] },
          { id: 'budget-proposal', name: 'Budget Proposal', outputs: ['pdf', 'docx'] },
          { id: 'campaign-brief', name: 'Campaign Brief', outputs: ['docx', 'pdf'] },
          { id: 'project-status', name: 'Project Status', outputs: ['pdf', 'docx'] },
          { id: 'quarterly-review', name: 'Quarterly Review (QBR)', outputs: ['pptx', 'pdf'] },
          { id: 'media-plan-deck', name: 'Media Plan Deck', outputs: ['pptx', 'pdf'] },
          { id: 'learnings-digest', name: 'Learnings Digest', outputs: ['pdf', 'docx'] },
          { id: 'client-scorecard-export', name: 'Client Scorecard Export', outputs: ['xlsx', 'pdf'] },
        ],
        file_types: ['pptx', 'pdf', 'docx', 'xlsx'],
        storage: process.env['FILE_STORAGE_URL']?.startsWith('s3://') ? 's3' : 'local',
        file_ttl_days: 90,
        endpoints: {
          run_skill: `${baseUrl}/v1/engines/delivery/skills/:skillId`,
          list_files: `${baseUrl}/v1/delivery/files`,
          download_file: `${baseUrl}/v1/delivery/files/:fileId/download`,
          delete_file: `${baseUrl}/v1/delivery/files/:fileId`,
        },
      },
      scheduling: {
        enabled: true,
        cron_supported: true,
        endpoint: `${baseUrl}/v1/mesh/schedules`,
        mcp_tools: ['schedule_pipeline', 'list_schedules', 'delete_schedule'],
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
