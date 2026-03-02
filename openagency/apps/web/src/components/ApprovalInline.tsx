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
      await approveDecision(decision.agent_id, decision.id);
      onResolved();
    } catch {
      // UI will refresh
    }
  };

  const handleReject = async () => {
    try {
      await rejectDecision(decision.agent_id, decision.id);
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
            <StatusBadge status={decision.risk_level} />
            <span className="text-xs text-gray-500">{decision.agent_id}</span>
          </div>
          <p className="mt-1 text-sm text-gray-700">{decision.reasoning}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Confidence: {(decision.confidence * 100).toFixed(0)}% |{' '}
            {decision.actions.length} action{decision.actions.length !== 1 ? 's' : ''}
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
