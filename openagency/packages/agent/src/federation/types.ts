// ─── Federation Types ──────────────────────────────────────────────
// Types for inter-agent communication across OpenAgency instances.

export interface AgentCard {
  name: string;
  version: string;
  url: string;
  description?: string;
  capabilities: string[];
  protocols: string[];
  engines?: Array<{ id: string; skills: string[] }>;
}

export interface ExternalMcpServer {
  name: string;
  url: string;
  connected_at: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export interface RemoteSkillInvocation {
  base_url: string;
  engine_id: string;
  skill_id: string;
  input: Record<string, unknown>;
  api_key?: string;
}

export interface RemoteSkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration_ms: number;
  source: string;
}

export interface FederationDiscoveryResult {
  url: string;
  card: AgentCard;
  discovered_at: string;
}
