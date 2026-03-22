// ─── Pipeline Visualization (Glassmorphism) ────────────────────────

interface StageInfo {
  agent_id: string;
  status: string;
  duration_ms?: number;
}

interface PipelineVizProps {
  stages: StageInfo[];
}

const STAGE_LABELS: Record<string, string> = {
  'leak-detector': 'LEAK',
  'media-architect': 'MEDIA',
  'campaign-ops': 'CAMP',
  'executive-bridge': 'EXEC',
};

const STAGE_FULL_LABELS: Record<string, string> = {
  'leak-detector': 'Waste Detector',
  'media-architect': 'Media Architect',
  'campaign-ops': 'Campaign Ops',
  'executive-bridge': 'Exec. Bridge',
};

const STATUS_ICON: Record<string, string> = {
  pending: 'text-white/20',
  running: 'text-[#00F5FF] animate-pulse',
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  skipped: 'text-white/30',
  timed_out: 'text-orange-400',
};

export function PipelineViz({ stages }: PipelineVizProps) {
  return (
    <div className="flex items-center gap-2 w-full justify-between">
      {stages.map((stage, i) => (
        <div key={stage.agent_id} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div
              className={`flex h-14 w-full items-center justify-center rounded-lg border-2 text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm px-2 ${
                stage.status === 'completed'
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                  : stage.status === 'running'
                    ? 'border-[#00F5FF]/50 bg-[#00F5FF]/15 text-[#00F5FF] animate-pulse'
                    : stage.status === 'failed' || stage.status === 'timed_out'
                      ? 'border-red-400/50 bg-red-500/15 text-red-300'
                      : 'border-white/[0.10] bg-white/[0.05] text-white/40'
              }`}
              title={STAGE_FULL_LABELS[stage.agent_id] ?? stage.agent_id}
            >
              {STAGE_LABELS[stage.agent_id] ?? stage.agent_id.slice(0, 4).toUpperCase()}
            </div>
            <span className="mt-1 text-[9px] text-white/40 truncate max-w-full text-center">
              {STAGE_FULL_LABELS[stage.agent_id] ?? stage.agent_id}
            </span>
            <span className="text-[9px] text-white/25 font-mono">
              {stage.duration_ms != null ? `${(stage.duration_ms / 1000).toFixed(1)}s` : '0.0s'}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div className="flex items-center px-1 shrink-0">
              <div className={`h-px w-4 ${stage.status === 'completed' ? 'bg-emerald-400/50' : 'bg-white/[0.10]'}`} />
              <svg className={`h-3 w-3 -ml-1 ${STATUS_ICON[stage.status] ?? 'text-white/20'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Minimal inline pipeline for agent rows */
export function MiniPipelineViz({ stages }: PipelineVizProps) {
  return (
    <div className="flex items-center gap-0.5">
      {stages.map((stage, i) => (
        <div key={stage.agent_id} className="flex items-center">
          <div
            className={`h-2 w-8 rounded-sm ${
              stage.status === 'completed'
                ? 'bg-emerald-400'
                : stage.status === 'running'
                  ? 'bg-[#00F5FF] animate-pulse'
                  : stage.status === 'failed'
                    ? 'bg-red-400'
                    : 'bg-white/[0.10]'
            }`}
            title={`${stage.agent_id}: ${stage.status}`}
          />
          {i < stages.length - 1 && <div className="h-px w-0.5 bg-white/[0.10]" />}
        </div>
      ))}
    </div>
  );
}
