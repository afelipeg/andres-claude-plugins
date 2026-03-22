// ─── Command Center Page — Mission Control Redesign ─────────────────
// Three-panel layout: Left Sidebar | Center Engine Grid | Right Stream
// Inspired by real-time mission control / audit stream aesthetic.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgentRow } from '../components/AgentRow';
import { PipelineViz } from '../components/PipelineViz';
import { StatusBadge } from '../components/StatusBadge';
import { useEventStream } from '../hooks/useEventStream';
import {
  GlassBadge,
  GlassButton,
  GlassProgress,
} from '../components/ui/glass';
import {
  Search,
  BarChart3,
  Zap,
  TrendingUp,
  Activity,
  Radio,
  RotateCcw,
  Play,
  ChevronRight,
  Target,
  AlertTriangle,
  Cpu,
  Gauge,
} from 'lucide-react';
import {
  listAgents,
  listPipelines,
  listRuns,
  getRun,
  executePipeline,
  listGoals,
  listPendingDecisions,
  approveDecision,
  rejectDecision,
  type AgentState,
  type MeshPipeline,
  type MeshRunSummary,
  type MeshRunDetail,
  type GoalSummary,
  type PendingDecision,
} from '../api/agents';
import { getConnectorStatus } from '../api/onboarding';

// ─── Engine Config ──────────────────────────────────────────────────

const ENGINE_CONFIG = [
  {
    id: 'leak-detector',
    label: 'Leak Detector',
    number: '01',
    icon: Search,
    borderColor: 'border-red-400/20',
    bgColor: 'bg-red-500/5',
    hoverBorder: 'hover:border-red-400/40',
    accentColor: 'text-red-400',
    glowColor: 'shadow-[0_0_20px_rgba(248,113,113,0.06)]',
    skillCount: 12,
  },
  {
    id: 'media-architect',
    label: 'Media Architect',
    number: '02',
    icon: BarChart3,
    borderColor: 'border-[#00F5FF]/20',
    bgColor: 'bg-[#00F5FF]/5',
    hoverBorder: 'hover:border-[#00F5FF]/40',
    accentColor: 'text-[#00F5FF]',
    glowColor: 'shadow-[0_0_20px_rgba(0,245,255,0.06)]',
    skillCount: 9,
  },
  {
    id: 'campaign-ops',
    label: 'Campaign Ops',
    number: '03',
    icon: Zap,
    borderColor: 'border-emerald-400/20',
    bgColor: 'bg-emerald-500/5',
    hoverBorder: 'hover:border-emerald-400/40',
    accentColor: 'text-emerald-400',
    glowColor: 'shadow-[0_0_20px_rgba(52,211,153,0.06)]',
    skillCount: 14,
  },
  {
    id: 'executive-bridge',
    label: 'Executive Bridge',
    number: '04',
    icon: TrendingUp,
    borderColor: 'border-[#7000FF]/20',
    bgColor: 'bg-[#7000FF]/5',
    hoverBorder: 'hover:border-[#7000FF]/40',
    accentColor: 'text-[#7000FF]',
    glowColor: 'shadow-[0_0_20px_rgba(112,0,255,0.06)]',
    skillCount: 7,
  },
] as const;

// ─── Skill Stream Event Colors ──────────────────────────────────────

const STREAM_COLORS: Record<string, string> = {
  EXECUTING: 'text-[#FF00FF]',
  TRIGGER: 'text-[#00F5FF]',
  CALC: 'text-white/60',
  FETCH: 'text-[#00F5FF]',
  SHIFT: 'text-[#7000FF]',
  RESOLVED: 'text-emerald-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  STARTED: 'text-[#00F5FF]',
  COMPLETED: 'text-emerald-400',
  FAILED: 'text-red-400',
  DECISION: 'text-[#FF00FF]',
  PIPELINE: 'text-[#7000FF]',
  STAGE: 'text-[#00F5FF]',
  WASTE: 'text-amber-400',
  BUDGET: 'text-[#FF00FF]',
  IDLE: 'text-white/30',
};

function getStreamColor(type: string): string {
  const upper = type.toUpperCase();
  for (const [key, color] of Object.entries(STREAM_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return 'text-white/40';
}

function getStreamAction(type: string): string {
  const parts = type.split('.');
  return (parts[parts.length - 1] ?? type).toUpperCase();
}

// ─── Idle Stream Entries ────────────────────────────────────────────

function generateIdleEntries(): Array<{
  id: string;
  time: string;
  action: string;
  description: string;
  color: string;
}> {
  const now = new Date();
  return [
    { id: 'idle-1', time: formatTime(new Date(now.getTime() - 2000)), action: 'IDLE', description: 'Awaiting pipeline directive...', color: 'text-white/30' },
    { id: 'idle-2', time: formatTime(new Date(now.getTime() - 5000)), action: 'HEARTBEAT', description: 'All engines nominal', color: 'text-white/20' },
    { id: 'idle-3', time: formatTime(new Date(now.getTime() - 8000)), action: 'SYNC', description: 'Event bus connected', color: 'text-[#00F5FF]/40' },
    { id: 'idle-4', time: formatTime(new Date(now.getTime() - 12000)), action: 'READY', description: 'Skill registry loaded (39 protocols)', color: 'text-white/25' },
    { id: 'idle-5', time: formatTime(new Date(now.getTime() - 15000)), action: 'INIT', description: 'Command node initialized', color: 'text-[#7000FF]/50' },
  ];
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0');
}

// ─── Decision Queue Component ───────────────────────────────────────

function DecisionQueue({
  decisions,
  onApprove,
  onReject,
}: {
  decisions: PendingDecision[];
  onApprove: (d: PendingDecision) => void;
  onReject: (d: PendingDecision) => void;
}) {
  if (decisions.length === 0) {
    return <p className="py-3 text-center text-[10px] font-mono text-white/25 uppercase tracking-wider">No pending decisions</p>;
  }

  const urgencyVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
    low: 'success',
    medium: 'warning',
    high: 'destructive',
  };

  return (
    <div className="space-y-1.5">
      {decisions.map((d) => (
        <div key={d.id} className="rounded-lg border border-amber-400/20 bg-amber-500/8 backdrop-blur-sm p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-amber-300 font-mono">{d.pipeline_id}</span>
            <GlassBadge variant={urgencyVariant[d.urgency] ?? 'default'}>
              {d.urgency}
            </GlassBadge>
            {d.client_id && (
              <span className="text-[9px] text-white/25 font-mono">{d.client_id}</span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/45 line-clamp-2">{d.reason}</p>
          <p className="mt-0.5 text-[9px] text-white/20 font-mono">run {d.run_id.slice(0, 10)}</p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              onClick={() => onApprove(d)}
              className="rounded-md bg-emerald-500/70 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(d)}
              className="rounded-md bg-red-500/70 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Goal Panel Component ───────────────────────────────────────────

function GoalPanel({ goals }: { goals: GoalSummary[] }) {
  if (goals.length === 0) {
    return <p className="py-3 text-center text-[10px] font-mono text-white/25 uppercase tracking-wider">No active goals</p>;
  }

  const statusVariant: Record<string, 'primary' | 'success' | 'destructive'> = {
    active: 'primary',
    completed: 'success',
    failed: 'destructive',
  };

  return (
    <div className="space-y-1.5">
      {goals.map((g) => (
        <div key={g.id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/90">{g.name}</span>
            <GlassBadge variant={statusVariant[g.status] ?? 'default'}>
              {g.status}
            </GlassBadge>
          </div>
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-[9px] text-white/35">
              <span>{g.target_metric}: {g.current_value ?? '?'} / {g.target_value}</span>
              <span>{g.progress_pct.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[#00F5FF] transition-all shadow-[0_0_6px_rgba(0,245,255,0.25)]"
                style={{ width: `${Math.min(100, g.progress_pct)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HFL Badge ──────────────────────────────────────────────────────

function HFLBadge({ status, urgency }: { status: string; urgency?: string }) {
  const variants: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
    auto_approved: 'success',
    escalated: 'warning',
    human_approved: 'success',
    human_rejected: 'destructive',
    timed_out: 'default',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <GlassBadge variant={variants[status] ?? 'default'}>
      {urgency && status === 'escalated' ? `${urgency}` : label}
    </GlassBadge>
  );
}

// ─── Stage Output Panel ─────────────────────────────────────────────

function StageOutputPanel({ run }: { run: MeshRunDetail }) {
  const stages = Object.entries(run.stage_results ?? {});

  if (stages.length === 0) {
    return <p className="py-3 text-center text-[10px] font-mono text-white/25">No stage results</p>;
  }

  const stageColors: Record<string, string> = {
    'leak-detector': 'border-red-400/20 bg-red-500/8',
    'media-architect': 'border-[#00F5FF]/20 bg-[#00F5FF]/8',
    'campaign-ops': 'border-emerald-400/20 bg-emerald-500/8',
    'executive-bridge': 'border-[#7000FF]/20 bg-[#7000FF]/8',
  };

  return (
    <div className="space-y-1.5">
      {stages.map(([agentId, stage]) => (
        <div key={agentId} className={`rounded-lg border backdrop-blur-sm p-2.5 ${stageColors[agentId] ?? 'border-white/[0.10] bg-white/[0.03]'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/90 font-mono">{agentId}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-white/35 font-mono">{stage.duration_ms}ms</span>
              <StatusBadge status={stage.status} />
            </div>
          </div>
          {stage.skills_invoked.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-0.5">
              {stage.skills_invoked.map((s) => (
                <span key={s} className="rounded-full bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-white/50 font-mono">{s}</span>
              ))}
            </div>
          )}
          {stage.error && (
            <p className="mt-1 text-[9px] text-red-300 font-mono">{stage.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

type RunType = 'standard' | 'planned' | 'actual';

const RUN_TYPE_LABELS: Record<RunType, string> = {
  standard: 'Standard Run',
  planned: 'Planned Run',
  actual: 'Actual Run',
};

const RUN_TYPE_COLORS: Record<RunType, string> = {
  standard: 'bg-white/15 border-white/25 text-white/80',
  planned: 'bg-[#00F5FF]/15 border-[#00F5FF]/25 text-[#00F5FF]',
  actual: 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300',
};

export function CommandCenterPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [pipelines, setPipelines] = useState<MeshPipeline[]>([]);
  const [runs, setRuns] = useState<MeshRunSummary[]>([]);
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [selectedRunDetail, setSelectedRunDetail] = useState<MeshRunDetail | null>(null);
  const [executing, setExecuting] = useState(false);
  const [syntheticData, setSyntheticData] = useState(false);
  const [runType, setRunType] = useState<RunType>('standard');
  const [runTypeMap, setRunTypeMap] = useState<Record<string, RunType>>({});
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const { events, connected } = useEventStream();
  const streamRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, p, r, g, d, cs] = await Promise.allSettled([
        listAgents(),
        listPipelines(),
        listRuns(),
        listGoals(),
        listPendingDecisions(),
        getConnectorStatus(),
      ]);
      if (a.status === 'fulfilled') setAgents(a.value);
      if (p.status === 'fulfilled') setPipelines(p.value);
      if (r.status === 'fulfilled') setRuns(r.value);
      if (g.status === 'fulfilled') setGoals(g.value);
      if (d.status === 'fulfilled') setDecisions(d.value);
      if (cs.status === 'fulfilled') {
        const anyConnected = cs.value.some((s) => s.connected);
        setSyntheticData(!anyConnected);
      }
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleExecute = async () => {
    if (executing) return;
    setExecuting(true);
    try {
      const result = await executePipeline('full-optimization', undefined, undefined, runType);
      setSelectedRunDetail(result);
      setRunTypeMap((prev) => ({ ...prev, [result.id]: runType }));
      await refresh();
    } catch {
      // Error handled
    } finally {
      setExecuting(false);
    }
  };

  const handleApprove = async (d: PendingDecision) => {
    try {
      await approveDecision(d.pipeline_id, d.run_id);
      setDecisions((prev) => prev.filter((x) => x.id !== d.id));
      await refresh();
    } catch { /* keep visible */ }
  };

  const handleReject = async (d: PendingDecision) => {
    try {
      await rejectDecision(d.pipeline_id, d.run_id);
      setDecisions((prev) => prev.filter((x) => x.id !== d.id));
      await refresh();
    } catch { /* keep visible */ }
  };

  const handleSelectRun = async (runId: string) => {
    try {
      const detail = await getRun(runId);
      setSelectedRunDetail(detail);
    } catch { /* ignore */ }
  };

  // Computed metrics
  const activeAgents = agents.filter((a) => a.status !== 'idle' && a.status !== 'error').length;
  const totalSkills = ENGINE_CONFIG.reduce((sum, e) => sum + e.skillCount, 0);
  const todayRuns = runs.filter((r) => {
    const d = new Date(r.started_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const confidencePct = useMemo(() => {
    if (decisions.length === 0 && runs.length === 0) return 98.4;
    const autoApproved = runs.filter((r) => r.hfl?.status === 'auto_approved').length;
    const total = runs.filter((r) => r.hfl != null).length;
    if (total === 0) return 98.4;
    return Math.round((autoApproved / total) * 1000) / 10;
  }, [runs, decisions]);

  const defaultStages = ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'].map(
    (id) => ({ agent_id: id, status: 'pending', duration_ms: 0 }),
  );

  // Build stream entries from real events or idle entries
  const streamEntries = useMemo(() => {
    if (events.length > 0) {
      return events.slice(0, 50).map((e) => ({
        id: e.id,
        time: formatTime(new Date(e.timestamp)),
        action: getStreamAction(e.type),
        description: e.type,
        color: getStreamColor(e.type),
      }));
    }
    return generateIdleEntries();
  }, [events]);

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden">

      {/* ═══ STATUS HEADER BAR ═══ */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shrink-0">
        {/* Left: Protocol status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-[#00F5FF] shadow-[0_0_8px_rgba(0,245,255,0.6)] animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
              {connected ? 'STATUS: LIVE TRANSMISSION' : 'STATUS: DISCONNECTED'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-white/25">ACTIVE PROTOCOL:</span>
            <span className="text-[10px] font-mono font-bold text-[#00F5FF]">KINETIC</span>
          </div>
          {syntheticData && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-0.5">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-300">SYNTHETIC DATA</span>
            </div>
          )}
        </div>

        {/* Right: Stat cards */}
        <div className="flex items-center gap-3">
          <MiniStat icon={<Cpu className="h-3.5 w-3.5" />} label="Agents" value={agents.length} accent={activeAgents > 0} />
          <MiniStat icon={<Activity className="h-3.5 w-3.5" />} label="Pipelines" value={pipelines.length} />
          <MiniStat icon={<Radio className="h-3.5 w-3.5" />} label="Today" value={todayRuns} accent={todayRuns > 0} />
        </div>
      </div>

      {/* ═══ MAIN 3-PANEL LAYOUT ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT SIDEBAR ─── */}
        <div className="w-64 shrink-0 border-r border-white/[0.06] bg-white/[0.01] flex flex-col overflow-hidden">

          {/* Sidebar Header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-[#00F5FF]/60">Active Protocol: Kinetic</p>
            <h2 className="text-sm font-bold text-white/90 mt-1 tracking-wide uppercase">Core Engines</h2>
          </div>

          {/* Engine Nav List */}
          <div className="px-3 py-2 space-y-1">
            {ENGINE_CONFIG.map((eng) => {
              const Icon = eng.icon;
              const isSelected = selectedEngine === eng.id;
              const agent = agents.find((a) => a.engine_id === eng.id);
              const isActive = agent && agent.status !== 'idle' && agent.status !== 'error';
              return (
                <button
                  key={eng.id}
                  onClick={() => setSelectedEngine(isSelected ? null : eng.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 group ${
                    isSelected
                      ? `${eng.bgColor} ${eng.borderColor} border`
                      : 'border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]'
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isSelected ? eng.bgColor : 'bg-white/[0.06]'} transition-colors`}>
                    <Icon className={`h-3.5 w-3.5 ${isSelected ? eng.accentColor : 'text-white/50'} transition-colors`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold truncate ${isSelected ? 'text-white/95' : 'text-white/70'} transition-colors`}>
                      {eng.label}
                    </p>
                    <p className="text-[9px] font-mono text-white/30">
                      {eng.skillCount} skills {isActive && <span className="text-emerald-400">active</span>}
                    </p>
                  </div>
                  <ChevronRight className={`h-3 w-3 text-white/20 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-white/[0.06] my-1" />

          {/* Scrollable sidebar sections */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10">

            {/* Decision Queue */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/45">Decision Queue</h3>
                {decisions.length > 0 && (
                  <GlassBadge variant="warning">{decisions.length}</GlassBadge>
                )}
              </div>
              <DecisionQueue decisions={decisions} onApprove={(d) => void handleApprove(d)} onReject={(d) => void handleReject(d)} />
            </div>

            {/* Active Goals */}
            <div>
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/45 px-1 mb-1.5">Active Goals</h3>
              <GoalPanel goals={goals} />
            </div>

            {/* Agent List (collapsed) */}
            {agents.length > 0 && (
              <div>
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/45 px-1 mb-1.5">Agent Status</h3>
                <div className="space-y-1">
                  {agents.map((agent) => (
                    <AgentRow key={agent.agent_id} agent={agent} onRefresh={refresh} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── CENTER PANEL ─── */}
        <div className="flex-1 flex flex-col overflow-y-auto">

          {/* Center Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-white/60">Engine Activation Stream</h2>
            </div>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => void handleExecute()}
              disabled={executing}
              className="text-[10px] font-mono uppercase tracking-wider"
            >
              <RotateCcw className={`h-3 w-3 mr-1 ${executing ? 'animate-spin' : ''}`} />
              Restart Global Cluster
            </GlassButton>
          </div>

          {/* Synthetic Data Warning */}
          {syntheticData && (
            <div className="mx-6 mt-3 flex items-center gap-2.5 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-200/80 font-mono">
                Running on synthetic data — <a href="/app/integrations" className="underline text-amber-300 hover:text-amber-200">connect a platform</a> for real campaigns.
              </p>
            </div>
          )}

          {/* Engine Grid (2x2) */}
          <div className="grid grid-cols-2 gap-3 px-6 py-4">
            {ENGINE_CONFIG.map((eng) => {
              const Icon = eng.icon;
              const agent = agents.find((a) => a.engine_id === eng.id);
              const isActive = agent && agent.status !== 'idle' && agent.status !== 'error';
              const isSelected = selectedEngine === eng.id;
              return (
                <div
                  key={eng.id}
                  onClick={() => setSelectedEngine(isSelected ? null : eng.id)}
                  className={`
                    relative rounded-xl border backdrop-blur-xl p-4 cursor-pointer
                    transition-all duration-300 group
                    ${eng.borderColor} ${eng.bgColor}
                    ${isSelected ? `${eng.glowColor} ring-1 ring-white/10` : ''}
                    ${eng.hoverBorder}
                    hover:bg-white/[0.04]
                  `}
                >
                  {/* Top shine */}
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-t-xl" />

                  {/* Engine number */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.3em] text-white/25">
                      Engine {eng.number}
                    </span>
                    {isActive && (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse" />
                        <span className="text-[8px] font-mono text-emerald-400/80 uppercase">Live</span>
                      </div>
                    )}
                  </div>

                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${eng.bgColor} border ${eng.borderColor} transition-colors`}>
                      <Icon className={`h-5 w-5 ${eng.accentColor}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white/90">{eng.label}</h3>
                      <p className="text-[10px] font-mono text-white/35">
                        {eng.skillCount} <span className="uppercase tracking-wider">Active Skills</span>
                      </p>
                    </div>
                  </div>

                  {/* Agent cycles */}
                  {agent && (
                    <div className="flex items-center justify-between text-[9px] font-mono text-white/30 mb-2">
                      <span>{agent.cycles_completed} cycles</span>
                      <StatusBadge status={agent.status} />
                    </div>
                  )}

                  {/* Restart button */}
                  <button
                    className={`
                      w-full mt-1 rounded-md border px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.15em]
                      transition-all duration-200
                      ${eng.borderColor} text-white/40
                      hover:text-white/70 hover:bg-white/[0.05]
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Restart triggers the pipeline for this engine
                    }}
                  >
                    <RotateCcw className="h-2.5 w-2.5 inline mr-1" />
                    Restart
                  </button>
                </div>
              );
            })}
          </div>

          {/* Global Stats Bar */}
          <div className="mx-6 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5 text-[#00F5FF]/60" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/45">Global Skill Velocity</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#00F5FF]" />
                  <span className="text-[10px] font-mono text-white/60">
                    <span className="font-bold text-white/80">{totalSkills}</span> Active Protocols
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#7000FF]" />
                  <span className="text-[10px] font-mono text-white/60">
                    <span className="font-bold text-white/80">0.02s</span> Latency
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-mono text-white/60">
                    <span className="font-bold text-white/80">{activeAgents}/{agents.length}</span> Nodes
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Control */}
          <div className="mx-6 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/45">Pipeline Control</h3>
                <p className="text-[9px] font-mono text-white/25 mt-0.5">Full 4-stage optimization pipeline</p>
              </div>
              {/* Pipeline Viz */}
              <PipelineViz stages={defaultStages} />
            </div>

            {/* Run type selector + Execute */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 flex-1">
                {(['standard', 'planned', 'actual'] as RunType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRunType(t)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
                      runType === t
                        ? `${RUN_TYPE_COLORS[t]}`
                        : 'border-white/[0.08] text-white/30 hover:bg-white/[0.04] hover:text-white/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void handleExecute()}
                disabled={executing}
                className="
                  flex items-center gap-2 rounded-lg
                  bg-gradient-to-r from-[#00F5FF]/80 via-[#7000FF]/60 to-[#FF00FF]/80
                  border border-white/20
                  px-5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-white
                  shadow-[0_0_25px_rgba(0,245,255,0.15)]
                  hover:shadow-[0_0_35px_rgba(0,245,255,0.3)]
                  disabled:opacity-40 transition-all duration-300
                "
              >
                <Play className={`h-3.5 w-3.5 ${executing ? 'animate-pulse' : ''}`} />
                {executing ? 'Executing...' : 'Execute'}
              </button>
            </div>
          </div>

          {/* Stage Output (shown when a run is selected) */}
          {selectedRunDetail && (
            <div className="mx-6 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/45">Stage Output</h3>
                  {(runTypeMap[selectedRunDetail.id] != null) && (() => {
                    const rt = runTypeMap[selectedRunDetail.id] as RunType;
                    return (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-mono font-medium ${RUN_TYPE_COLORS[rt]}`}>
                        {RUN_TYPE_LABELS[rt]}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedRunDetail.hfl_decision && (
                    <HFLBadge status={selectedRunDetail.hfl_decision.status} urgency={selectedRunDetail.hfl_decision.urgency} />
                  )}
                  <StatusBadge status={selectedRunDetail.status} />
                </div>
              </div>
              <p className="text-[9px] text-white/20 font-mono mb-2">{selectedRunDetail.id.slice(0, 12)}</p>
              {selectedRunDetail.hfl_decision && (
                <div className="rounded-lg border border-amber-400/15 bg-amber-500/8 p-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold text-amber-300 font-mono">HFL Decision</span>
                    <HFLBadge status={selectedRunDetail.hfl_decision.status} urgency={selectedRunDetail.hfl_decision.urgency} />
                  </div>
                  <p className="mt-0.5 text-[9px] text-white/45 font-mono">{selectedRunDetail.hfl_decision.reason}</p>
                  {selectedRunDetail.hfl_decision.human_feedback && (
                    <p className="mt-0.5 text-[9px] text-white/35 italic">Feedback: {selectedRunDetail.hfl_decision.human_feedback}</p>
                  )}
                </div>
              )}
              <StageOutputPanel run={selectedRunDetail} />
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="w-72 shrink-0 border-l border-white/[0.06] bg-white/[0.01] flex flex-col overflow-hidden">

          {/* Skill Stream Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-[#FF00FF]/60" />
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">Skill Stream</h3>
            </div>
            <div className="flex items-center gap-1">
              <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[#00F5FF] shadow-[0_0_4px_rgba(0,245,255,0.5)]' : 'bg-white/15'}`} />
              <span className="text-[9px] font-mono text-white/30">{connected ? 'LIVE' : 'OFF'}</span>
            </div>
          </div>

          {/* Stream Entries */}
          <div ref={streamRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0 font-mono scrollbar-thin scrollbar-thumb-white/10">
            {streamEntries.map((entry) => (
              <div key={entry.id} className="py-1 border-b border-white/[0.03] group hover:bg-white/[0.02] px-1 rounded transition-colors">
                <div className="flex items-start gap-1.5">
                  <span className="text-[9px] text-white/20 shrink-0 tabular-nums">[{entry.time}]</span>
                  <span className={`text-[9px] font-bold shrink-0 ${entry.color}`}>{entry.action}:</span>
                  <span className="text-[9px] text-white/35 truncate">{entry.description}</span>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="pt-4 text-center">
                <p className="text-[9px] font-mono text-white/15 uppercase tracking-wider">Awaiting directive...</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Recent Runs / Verified Transactions */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Recent Runs</h3>
            {runs.length > 0 ? (
              <div className="space-y-1">
                {runs.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    onClick={() => void handleSelectRun(r.id)}
                    className={`flex items-center justify-between cursor-pointer rounded-md px-2 py-1.5 transition-all hover:bg-white/[0.04] ${
                      selectedRunDetail?.id === r.id ? 'bg-white/[0.06] border border-white/[0.10]' : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-white/30">{r.id.slice(0, 8)}</span>
                      <span className="text-[9px] font-mono text-white/20">
                        {(r.total_duration_ms / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {r.hfl && <HFLBadge status={r.hfl.status} urgency={r.hfl.urgency} />}
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] font-mono text-white/20 text-center py-2">No runs recorded</p>
            )}
          </div>

          {/* Available Pipelines */}
          <div className="px-4 py-3 overflow-y-auto">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Pipelines</h3>
            {pipelines.length > 0 ? (
              <div className="space-y-1">
                {pipelines.map((p) => (
                  <div key={p.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                    <p className="text-[10px] font-mono font-medium text-white/70">{p.name}</p>
                    <p className="text-[9px] font-mono text-white/30">{p.stage_count} stages</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] font-mono text-white/20 text-center py-2">No pipelines registered</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CONFIDENCE INDEX BAR (BOTTOM) ═══ */}
      <div className="shrink-0 border-t border-white/[0.08] bg-white/[0.02] backdrop-blur-xl px-6 py-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Target className="h-3.5 w-3.5 text-[#FF00FF]/60" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/45">
              AI-Human Sync
            </span>
          </div>
          <div className="flex-1">
            <GlassProgress value={confidencePct} color="protocol" />
          </div>
          <span className="text-sm font-mono font-bold text-white/80 tabular-nums shrink-0">
            {confidencePct.toFixed(1)}%
          </span>
          <div className="hidden sm:flex items-center gap-3 ml-2 pl-3 border-l border-white/[0.08]">
            <MiniMetric label="Decisions" value={decisions.length} color="text-amber-400" />
            <MiniMetric label="Goals" value={goals.length} color="text-[#00F5FF]" />
            <MiniMetric label="Skills" value={totalSkills} color="text-[#7000FF]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Components ────────────────────────────────────────────────

function MiniStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-3 py-1.5">
      <div className={accent ? 'text-[#00F5FF]' : 'text-white/40'}>{icon}</div>
      <div>
        <p className="text-[9px] font-mono uppercase tracking-wider text-white/35">{label}</p>
        <p className={`text-sm font-bold font-mono tabular-nums ${accent ? 'text-white/90' : 'text-white/60'}`}>{value}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-mono font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[9px] font-mono text-white/30 uppercase">{label}</span>
    </div>
  );
}
