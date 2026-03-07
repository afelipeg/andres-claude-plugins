import { describe, it, expect } from 'vitest';
import { RenderEngine } from '../render-engine.js';
import type { RenderContext, RiskScore } from '../types.js';
import type { StageResultSummary, BillingSummary } from '../render-engine.js';

function makeRiskScore(overrides?: Partial<RiskScore>): RiskScore {
  return {
    needs_human: true,
    urgency: 'high',
    reason: 'Impact above threshold',
    risk_factors: ['impact_above_threshold: $5000 > $1000'],
    total_impact_usd: 5000,
    ...overrides,
  };
}

function makeStageResults(): Record<string, StageResultSummary> {
  return {
    'leak-detector': {
      agent_id: 'leak-detector',
      status: 'completed',
      duration_ms: 1200,
      skills_invoked: ['waste-waterfall', 'media-quality-score'],
    },
    'media-architect': {
      agent_id: 'media-architect',
      status: 'completed',
      duration_ms: 800,
      skills_invoked: ['mmm-optimize'],
    },
    'campaign-ops': {
      agent_id: 'campaign-ops',
      status: 'failed',
      duration_ms: 500,
      skills_invoked: [],
      error: 'Timeout',
    },
  };
}

function makeBilling(): BillingSummary {
  return {
    ad_spend: 100000,
    total_fee: 1500,
    value_delivered: 15000,
    roi_on_fee: 10,
    tier: 'starter',
    recovery_fee: 500,
    lift_fee: 800,
    efficiency_fee: 200,
  };
}

describe('RenderEngine', () => {
  const engine = new RenderEngine();
  const baseInput = {
    run_id: 'run-1',
    pipeline_id: 'full-optimization',
    risk_score: makeRiskScore(),
    stage_results: makeStageResults(),
    billing: makeBilling(),
    base_url: 'http://localhost:3100',
  };

  it('renders minimal (nivel 1) as text', () => {
    const context: RenderContext = {
      channel: { id: 'slack', type: 'webhook', url: 'https://hooks.slack.com/x', render_level: 'minimal', active: true },
      urgency: 'high',
      complexity: 'moderate',
    };

    const output = engine.render(context, baseInput);
    expect(output.format).toBe('text');
    expect(output.content).toContain('HIGH');
    expect(output.content).toContain('$5000.00');
    expect(output.actions).toHaveLength(2);
    expect(output.actions[0].label).toBe('Approve');
    expect(output.actions[1].label).toBe('Reject');
  });

  it('renders rich (nivel 2) as markdown', () => {
    const context: RenderContext = {
      channel: { id: 'email', type: 'webhook', url: 'https://api.sendgrid.com', render_level: 'rich', active: true },
      urgency: 'high',
      complexity: 'complex',
    };

    const output = engine.render(context, baseInput);
    expect(output.format).toBe('markdown');
    expect(output.content).toContain('# ');
    expect(output.content).toContain('Pipeline Review Required');
    expect(output.content).toContain('leak-detector');
    expect(output.content).toContain('media-architect');
    expect(output.content).toContain('$100,000');
    expect(output.actions).toHaveLength(2);
  });

  it('renders full (nivel 3) as JSON payload', () => {
    const context: RenderContext = {
      channel: { id: 'scorecard', type: 'webhook', url: 'https://plinth.polanyi.tech/api', render_level: 'full', active: true },
      urgency: 'critical',
      complexity: 'complex',
    };

    const output = engine.render(context, baseInput);
    expect(output.format).toBe('json');

    const payload = JSON.parse(output.content);
    expect(payload.run_id).toBe('run-1');
    expect(payload.urgency).toBe('critical');
    expect(payload.risk).toBeDefined();
    expect(payload.risk.total_impact_usd).toBe(5000);
    expect(payload.stages['leak-detector'].status).toBe('completed');
    expect(payload.billing.ad_spend).toBe(100000);
    expect(payload.actions).toHaveLength(2);
    expect(output.metadata).toBeDefined();
  });

  it('includes approve/reject action URLs', () => {
    const context: RenderContext = {
      channel: { id: 'test', type: 'webhook', url: '', render_level: 'minimal', active: true },
      urgency: 'medium',
      complexity: 'simple',
    };

    const output = engine.render(context, baseInput);
    expect(output.actions[0].url).toBe('http://localhost:3100/v1/mesh/runs/run-1/approve');
    expect(output.actions[0].method).toBe('POST');
    expect(output.actions[1].url).toBe('http://localhost:3100/v1/mesh/runs/run-1/reject');
  });

  it('determines complexity correctly', () => {
    expect(engine.determineComplexity({ a: { agent_id: 'a', status: 'completed', duration_ms: 100, skills_invoked: [] } })).toBe('simple');
    expect(engine.determineComplexity(makeStageResults())).toBe('complex'); // has a failure
    expect(engine.determineComplexity({
      a: { agent_id: 'a', status: 'completed', duration_ms: 100, skills_invoked: [] },
      b: { agent_id: 'b', status: 'completed', duration_ms: 100, skills_invoked: [] },
    })).toBe('moderate');
  });

  it('resolves render level with upgrades', () => {
    expect(engine.resolveRenderLevel('minimal', 'critical', 'simple')).toBe('rich');
    expect(engine.resolveRenderLevel('minimal', 'low', 'complex')).toBe('rich');
    expect(engine.resolveRenderLevel('full', 'low', 'simple')).toBe('full');
    expect(engine.resolveRenderLevel('rich', 'medium', 'moderate')).toBe('rich');
  });

  it('includes "Ver detalle" action when scorecard_base_url is set', () => {
    const context: RenderContext = {
      channel: { id: 'slack', type: 'webhook', url: '', render_level: 'minimal', active: true },
      urgency: 'medium',
      complexity: 'simple',
    };

    const inputWithScorecard = {
      ...baseInput,
      scorecard_base_url: 'https://plinth.polanyi.tech',
    };

    const output = engine.render(context, inputWithScorecard);
    expect(output.actions).toHaveLength(3);
    expect(output.actions[2].label).toBe('Ver detalle');
    expect(output.actions[2].url).toBe('https://plinth.polanyi.tech/runs/run-1');
    expect(output.actions[2].method).toBe('GET');
    expect(output.actions[2].style).toBe('secondary');
  });

  it('omits "Ver detalle" when scorecard_base_url is not set', () => {
    const context: RenderContext = {
      channel: { id: 'test', type: 'webhook', url: '', render_level: 'minimal', active: true },
      urgency: 'medium',
      complexity: 'simple',
    };

    const output = engine.render(context, baseInput);
    expect(output.actions).toHaveLength(2);
    expect(output.actions.find((a) => a.label === 'Ver detalle')).toBeUndefined();
  });

  it('includes "Ver detalle" in full JSON payload', () => {
    const context: RenderContext = {
      channel: { id: 'scorecard', type: 'webhook', url: '', render_level: 'full', active: true },
      urgency: 'high',
      complexity: 'complex',
    };

    const inputWithScorecard = {
      ...baseInput,
      scorecard_base_url: 'https://plinth.polanyi.tech',
    };

    const output = engine.render(context, inputWithScorecard);
    expect(output.format).toBe('json');

    const payload = JSON.parse(output.content);
    expect(payload.actions).toHaveLength(3);
    expect(payload.actions[2].label).toBe('Ver detalle');
    expect(payload.actions[2].url).toBe('https://plinth.polanyi.tech/runs/run-1');
  });
});
