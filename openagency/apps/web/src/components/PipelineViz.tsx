// ─── Pipeline Visualization ────────────────────────────────────────

interface StageInfo {
  agent_id: string;
  status: string;
  duration_ms?: number;
}

interface PipelineVizProps {
  stages: StageInfo[];
}

const STAGE_LABELS: Record<string, string> = {
  'leak-detector': 'Leak',
  'media-architect': 'Media',
  'campaign-ops': 'Campaign',
  'executive-bridge': 'Exec',
};

const STATUS_ICON: Record<string, string> = {
  pending: 'text-gray-300',
  running: 'text-blue-500 animate-pulse',
  completed: 'text-green-500',
  failed: 'text-red-500',
  skipped: 'text-gray-400',
  timed_out: 'text-orange-500',
};

export function PipelineViz({ stages }: PipelineVizProps) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => (
        <div key={stage.agent_id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xs font-bold ${
                stage.status === 'completed'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : stage.status === 'running'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : stage.status === 'failed' || stage.status === 'timed_out'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              {STAGE_LABELS[stage.agent_id] ?? stage.agent_id.charAt(0).toUpperCase()}
            </div>
            <span className="mt-0.5 text-[10px] text-gray-500">
              {stage.duration_ms != null ? `${(stage.duration_ms / 1000).toFixed(1)}s` : '-'}
            </span>
          </div>
          {i < stages.length - 1 && (
            <svg className={`mx-0.5 h-4 w-4 ${STATUS_ICON[stage.status] ?? 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
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
                ? 'bg-green-500'
                : stage.status === 'running'
                  ? 'bg-blue-500 animate-pulse'
                  : stage.status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-gray-200'
            }`}
            title={`${stage.agent_id}: ${stage.status}`}
          />
          {i < stages.length - 1 && <div className="h-px w-0.5 bg-gray-300" />}
        </div>
      ))}
    </div>
  );
}
