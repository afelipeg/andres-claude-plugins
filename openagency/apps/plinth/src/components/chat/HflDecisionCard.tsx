'use client';

import React, { useState } from 'react';
import { Check, X, AlertTriangle, Loader2, Shield, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HflDecision {
  id: string;
  title: string;
  description: string;
  impact_amount?: number;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  engine_id: string;
}

interface HflDecisionCardProps {
  decision: HflDecision;
}

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  low: { label: 'Low Risk', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  medium: { label: 'Medium Risk', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  high: { label: 'High Risk', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  critical: { label: 'Critical', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const ENGINE_LABELS: Record<string, string> = {
  'leak-detector': 'Leak Detector',
  'media-architect': 'Media Architect',
  'campaign-ops': 'Campaign Ops',
  'executive-bridge': 'Executive Bridge',
  delivery: 'Delivery',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('plinth_token');
  if (lsToken) return lsToken;
  const match = document.cookie.match(/(?:^|;\s*)plinth_token=([^;]*)/);
  return match ? match[1] : null;
}

export function HflDecisionCard({ decision }: HflDecisionCardProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(false);
  const [showRejectFeedback, setShowRejectFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  const risk = decision.risk_level ? RISK_BADGE[decision.risk_level] : null;

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !showRejectFeedback) {
      setShowRejectFeedback(true);
      return;
    }

    setLoading(true);
    setError(null);

    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/hfl/decisions/${decision.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          feedback: action === 'reject' ? feedback : undefined,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errBody.message || `Failed to ${action} decision`);
      }

      setStatus(action === 'approve' ? 'approved' : 'rejected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isPending = status === 'pending';

  return (
    <div
      className={cn(
        'my-3 rounded-xl border p-4 transition-colors',
        isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/50',
        status === 'approved' && 'border-emerald-500/30 bg-emerald-500/5',
        status === 'rejected' && 'border-red-500/20 bg-red-500/5'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            isPending ? 'bg-amber-500/10' : status === 'approved' ? 'bg-emerald-500/10' : 'bg-red-500/10'
          )}>
            {isPending && <AlertTriangle className="h-4 w-4 text-amber-400" />}
            {status === 'approved' && <Check className="h-4 w-4 text-emerald-400" />}
            {status === 'rejected' && <X className="h-4 w-4 text-red-400" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{decision.title}</h4>
            <p className="text-xs text-zinc-500">
              {ENGINE_LABELS[decision.engine_id] ?? decision.engine_id}
              {' '}&middot;{' '}
              Human-in-the-Loop Decision
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {risk && (
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', risk.className)}>
              <Shield className="h-3 w-3" />
              {risk.label}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-300 mb-3 leading-relaxed">{decision.description}</p>

      {/* Impact */}
      {decision.impact_amount != null && (
        <div className="flex items-center gap-2 mb-4 rounded-lg bg-zinc-950/50 px-3 py-2 border border-zinc-800">
          <DollarSign className="h-4 w-4 text-zinc-400" />
          <span className="text-sm text-zinc-400">Estimated impact:</span>
          <span className="text-sm font-semibold text-foreground">{formatCurrency(decision.impact_amount)}</span>
        </div>
      )}

      {/* Status badges for completed decisions */}
      {status === 'approved' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          <Check className="h-4 w-4" />
          Approved
        </div>
      )}

      {status === 'rejected' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <X className="h-4 w-4" />
          Rejected{feedback ? ` -- "${feedback}"` : ''}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mb-3 text-sm text-red-400">{error}</p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="space-y-3">
          {/* Reject feedback textarea */}
          {showRejectFeedback && (
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
              rows={2}
            />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading && status === 'pending' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
