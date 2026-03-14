// ─── Inline Approval Widget ────────────────────────────────────────

import type { PendingDecision } from '../api/agents';
import { approveDecision, rejectDecision } from '../api/agents';
import { StatusBadge } from './StatusBadge';

interface ApprovalInlineProps {
  decision: PendingDecision;
  onResolved: () => void;
}

export function ApprovalInline({ decision, onResolved }: ApprovalInlineProps) {
  const handleApprove = async () => {
    try {
      await approveDecision(decision.pipeline_id, decision.run_id);
      onResolved();
    } catch {
      // UI will refresh
    }
  };

  const handleReject = async () => {
    try {
      await rejectDecision(decision.pipeline_id, decision.run_id);
      onResolved();
    } catch {
      // UI will refresh
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={decision.urgency} />
            <span className="text-xs text-gray-500">{decision.pipeline_id}</span>
          </div>
          <p className="mt-1 text-sm text-gray-700">{decision.reason}</p>
          <p className="mt-0.5 text-xs text-gray-500 font-mono">
            run {decision.run_id.slice(0, 10)} | {decision.client_id}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleApprove}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
