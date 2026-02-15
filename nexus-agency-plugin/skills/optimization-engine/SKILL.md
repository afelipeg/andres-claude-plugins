---
name: optimization-engine
description: "Continuous real-time campaign optimization with rule-based alerts and cross-channel reallocation. Use when user asks 'optimize', 'what needs fixing', 'budget reallocation', 'pacing check', or 'creative fatigue'. Detects CPA overshoot, ROAS issues, pacing problems, creative fatigue, and zero conversions."
allowed-tools: "Bash(python3 *), Read, Grep, Glob"
---

# Optimization Engine

You run continuous optimization across all active campaigns. Rule-based detection with cross-channel reallocation recommendations.

## Data Input

- **Manual input**: User provides current campaign performance data
- **MCP platform connectors** (optional): Auto-pull real-time performance from platforms
- **MCP GCP connector** (optional): Query optimization data from BigQuery

## Optimization Rules

Script: `scripts/optimization_rules.py`

### Detection Rules (Conservative — Stage 5 thresholds)
1. **CPA Overshoot**: Flag when CPA > target * 1.30
2. **CPA Headroom**: Flag when CPA < target * 0.70 (scaling opportunity)
3. **ROAS Below Target**: Flag when ROAS < target * 0.80
4. **Pacing Over**: Flag when spend pacing > 120% of expected
5. **Pacing Under**: Flag when spend pacing < 80% of expected
6. **Creative Fatigue**: Flag when CTR drops > 30% below historical average
7. **Zero Conversions**: Flag campaigns with spend but zero conversions
8. **Cross-Channel Reallocation**: Shift budget from underperforming to outperforming

### MMM On-Going Optimization (Google Meridian)
The optimization engine continuously monitors whether the MMM model (via `mmm-meridian` skill, Google Meridian framework) needs refreshing. MMM is NOT a one-time planning exercise — it drives on-going budget optimization.

**MMM Refresh Triggers** (checked via `mmm_check` command):
- Quarterly refresh overdue (>13 weeks since last model)
- Cumulative reallocation drift > 20% from model baseline
- Channel performance diverges > 30% from MMM predictions
- Saturation imbalance: over-saturated channels coexisting with under-saturated high-mROI channels

**Continuous Cycle**: optimization signals feed mmm-meridian model refresh, which updates channel-architect allocations, which flow back through activation and value engines.

Reference: https://github.com/google/meridian

## Process

1. Collect performance data across all campaigns/channels
2. Run optimization rules via `optimization_rules.py`
3. Check MMM model freshness via `mmm_check` command
4. Prioritize alerts by severity (critical > warning > info)
5. Generate reallocation recommendations (tactical) and MMM refresh triggers (strategic)
6. Report optimization waste to Governance engine
7. If MMM refresh triggered → feed data to `mmm-meridian` for model update → scenario planning → channel-architect reallocation

## Output Format

```
OPTIMIZATION REPORT: [Campaign Name]

ALERTS: [X critical, Y warning, Z info]
[Per-campaign: alert type, severity, recommendation]

REALLOCATION:
[From Channel A -> To Channel B: $X (rationale)]

PACING: [Overall and per-channel]
CREATIVE HEALTH: [Fatigue status per creative]
```

## Integration Points

- **Outputs to**: waste-quantifier (optimization waste), quality-guardian, mmm-meridian (MMM refresh triggers and performance data)
- **Receives from**: programmatic-activator (performance data), performance-oracle (benchmarks), attribution-engine (attribution-informed signals), mmm-meridian (saturation data, model predictions)
- **Continuous cycle**: optimization-engine → mmm-meridian (refresh) → channel-architect (reallocation) → activation (execute) → value (measure) → governance (validate) → optimization-engine
- **Scripts**: `scripts/optimization_rules.py` (commands: analyze, reallocate, mmm_check)

## Dependencies

- programmatic-activator
- performance-oracle
