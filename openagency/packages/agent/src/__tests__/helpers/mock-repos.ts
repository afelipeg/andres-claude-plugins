// ─── In-Memory Mock Repositories ────────────────────────────────────
// Fakes for all 6 repos used in OODA runtime tests.

import type {
  AgentState,
  AgentStatus,
  Decision,
  DecisionStatus,
  Goal,
  GoalStatus,
} from '@openagency/types';
import type { ActionLogEntry } from '@openagency/memory';

// ─── AgentStateRepo mock ───────────────────────────────────────────

export class MockAgentStateRepo {
  _store = new Map<string, AgentState>();

  async get(agentId: string): Promise<AgentState | null> {
    return this._store.get(agentId) ?? null;
  }

  async upsert(state: AgentState): Promise<void> {
    this._store.set(state.agent_id, { ...state });
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<void> {
    const s = this._store.get(agentId);
    if (s) s.status = status;
  }

  async incrementCycles(agentId: string): Promise<void> {
    const s = this._store.get(agentId);
    if (s) {
      s.cycles_completed += 1;
      s.last_cycle = new Date().toISOString();
    }
  }

  async listAll(): Promise<AgentState[]> {
    return Array.from(this._store.values());
  }
}

// ─── DecisionRepo mock ─────────────────────────────────────────────

export class MockDecisionRepo {
  _store = new Map<string, Decision>();

  async create(decision: Decision): Promise<void> {
    this._store.set(decision.id, { ...decision });
  }

  async get(id: string): Promise<Decision | null> {
    return this._store.get(id) ?? null;
  }

  async listByAgent(agentId: string, limit = 50): Promise<Decision[]> {
    return Array.from(this._store.values())
      .filter((d) => d.agent_id === agentId)
      .slice(0, limit);
  }

  async listPendingApproval(agentId?: string): Promise<Decision[]> {
    return Array.from(this._store.values()).filter(
      (d) =>
        d.status === 'pending_approval' &&
        (!agentId || d.agent_id === agentId),
    );
  }

  async approve(id: string, approvedBy: string): Promise<void> {
    const d = this._store.get(id);
    if (d) {
      d.status = 'approved';
      d.approved_by = approvedBy;
      d.approved_at = new Date().toISOString();
    }
  }

  async reject(id: string): Promise<void> {
    const d = this._store.get(id);
    if (d) d.status = 'rejected';
  }

  async updateStatus(id: string, status: DecisionStatus): Promise<void> {
    const d = this._store.get(id);
    if (d) d.status = status;
  }
}

// ─── ActionLogRepo mock ────────────────────────────────────────────

export class MockActionLogRepo {
  _store: ActionLogEntry[] = [];

  async create(entry: ActionLogEntry): Promise<void> {
    this._store.push({ ...entry });
  }

  async listByDecision(decisionId: string): Promise<ActionLogEntry[]> {
    return this._store.filter((e) => e.decision_id === decisionId);
  }

  async listByAgent(agentId: string, limit = 50): Promise<ActionLogEntry[]> {
    return this._store
      .filter((e) => e.agent_id === agentId)
      .slice(0, limit);
  }

  async countTodayByPlatform(platform: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    return this._store.filter(
      (e) => e.target_platform === platform && e.id.startsWith(today),
    ).length;
  }
}

// ─── OutcomeRepo mock ──────────────────────────────────────────────

interface OutcomeEntry {
  id: string;
  decision_id: string;
  agent_id: string;
  metric_before: Record<string, number>;
  metric_after?: Record<string, number>;
}

export class MockOutcomeRepo {
  _store = new Map<string, OutcomeEntry>();

  async recordBefore(entry: {
    id: string;
    decision_id: string;
    agent_id: string;
    metric_before: Record<string, number>;
  }): Promise<void> {
    this._store.set(entry.id, { ...entry });
  }

  async measureAfter(id: string, metricAfter: Record<string, number>): Promise<void> {
    const o = this._store.get(id);
    if (o) o.metric_after = metricAfter;
  }

  async listByAgent(agentId: string, limit = 50): Promise<OutcomeEntry[]> {
    return Array.from(this._store.values())
      .filter((o) => o.agent_id === agentId)
      .slice(0, limit);
  }
}

// ─── MemoryRepo mock ───────────────────────────────────────────────

interface MemoryEntry {
  id: string;
  agent_id: string;
  content: string;
  content_type: string;
  metadata: Record<string, unknown>;
}

export class MockMemoryRepo {
  _store: MemoryEntry[] = [];

  async store(entry: MemoryEntry): Promise<void> {
    this._store.push({ ...entry });
  }

  async search(agentId: string, _query: string, limit = 10): Promise<unknown[]> {
    return this._store
      .filter((m) => m.agent_id === agentId)
      .slice(0, limit);
  }

  async getRecent(agentId: string, limit = 20): Promise<unknown[]> {
    return this._store
      .filter((m) => m.agent_id === agentId)
      .slice(-limit);
  }
}

// ─── GoalRepo mock ─────────────────────────────────────────────────

export class MockGoalRepo {
  _store = new Map<string, Goal>();

  async create(goal: Goal): Promise<void> {
    this._store.set(goal.id, { ...goal });
  }

  async get(id: string): Promise<Goal | null> {
    return this._store.get(id) ?? null;
  }

  async listActive(agentId?: string): Promise<Goal[]> {
    return Array.from(this._store.values()).filter(
      (g) =>
        g.status === 'active' && (!agentId || g.agent_id === agentId),
    );
  }

  async updateProgress(id: string, currentValue: number, progressPct: number): Promise<void> {
    const g = this._store.get(id);
    if (g) {
      g.current_value = currentValue;
      g.progress_pct = progressPct;
    }
  }

  async complete(id: string): Promise<void> {
    const g = this._store.get(id);
    if (g) {
      g.status = 'completed';
      g.progress_pct = 100;
    }
  }

  async fail(id: string): Promise<void> {
    const g = this._store.get(id);
    if (g) g.status = 'failed';
  }

  async getSubGoals(parentId: string): Promise<Goal[]> {
    return Array.from(this._store.values()).filter(
      (g) => g.parent_goal_id === parentId,
    );
  }

  async updateStatus(id: string, status: GoalStatus): Promise<void> {
    const g = this._store.get(id);
    if (g) g.status = status;
  }
}
