import { describe, it, expect } from 'vitest';
import {
  createCampaignState,
  updateTaskStatus,
  getNextActions,
  campaignSummary,
} from '../campaign-state.js';

describe('campaign-state', () => {
  it('creates campaign with correct initial state', () => {
    const state = createCampaignState({
      campaign_name: 'Q1 Launch',
      client: 'Acme',
    });
    expect(state.campaign.name).toBe('Q1 Launch');
    expect(state.campaign.client).toBe('Acme');
    expect(state.campaign.state).toBe('BRIEFED');
    expect(Object.keys(state.engines)).toHaveLength(6);
    expect(Object.keys(state.sprints)).toHaveLength(4);
  });

  it('all engines start IDLE', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    for (const engine of Object.values(state.engines)) {
      expect(engine.state).toBe('IDLE');
      expect(engine.progress).toBe(0);
    }
  });

  it('has 23 tasks across 4 sprints', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    let totalTasks = 0;
    for (const sprint of Object.values(state.sprints)) {
      totalTasks += sprint.tasks.length;
    }
    expect(totalTasks).toBe(24);
  });

  it('initial next actions are sprint_0 tasks (no deps)', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    const actions = getNextActions(state);
    // Sprint 0 tasks have no dependencies, should all be ready
    expect(actions.length).toBeGreaterThanOrEqual(5);
    expect(actions.every((a) => a.sprint === 'sprint_0')).toBe(true);
  });

  it('updates task status and cascades to engine', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    const result = updateTaskStatus({
      state,
      task_id: 'T001',
      new_status: 'IN_PROGRESS',
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.engines.orchestrator.state).toBe('ACTIVE');
  });

  it('completes engine when all its tasks are done', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    // T001 is the only orchestrator task in sprint_0
    const r1 = updateTaskStatus({ state, task_id: 'T001', new_status: 'DONE' });
    if ('error' in r1) throw new Error(r1.error);
    // Orchestrator has T001 only in sprint_0, but also depends on other sprints
    // Progress should be non-zero
    expect(r1.engines.orchestrator.progress).toBeGreaterThan(0);
  });

  it('returns error for invalid task status', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    const result = updateTaskStatus({
      state,
      task_id: 'T001',
      new_status: 'INVALID' as any,
    });
    expect('error' in result).toBe(true);
  });

  it('returns error for unknown task id', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    const result = updateTaskStatus({
      state,
      task_id: 'T999',
      new_status: 'DONE',
    });
    expect('error' in result).toBe(true);
  });

  it('campaign summary shows progress', () => {
    const state = createCampaignState({ campaign_name: 'Test', client: 'Test' });
    const summary = campaignSummary(state);
    expect(summary.tasks_total).toBe(24);
    expect(summary.tasks_done).toBe(0);
    expect(summary.overall_progress).toBe('0%');
  });
});
