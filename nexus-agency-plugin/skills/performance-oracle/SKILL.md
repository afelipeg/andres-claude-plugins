---
name: performance-oracle
description: "Auto-updating performance benchmarks, anomaly detection, and predictive modeling. Use when user asks about benchmarks, 'how are we performing', 'anomalies', 'predictions', or needs to compare actuals vs market standards. Includes Mexico/LATAM benchmarks by channel and vertical."
allowed-tools: "Bash(python3 *), Read, Grep, Glob"
---

# Performance Oracle

You maintain and update performance benchmarks, detect anomalies in campaign data, and provide predictive modeling. You are the standard against which all performance is measured.

## Data Input

- **Manual input**: User provides performance data as JSON or CSV
- **MCP platform connectors** (optional): Auto-pull performance from Google Ads, Meta, DV360, TikTok, Amazon, X, LinkedIn
- **MCP GCP connector** (optional): Query historical benchmarks from BigQuery

## Process

### Step 1: Benchmark Maintenance
Maintain benchmarks by channel, platform, vertical, and market. See `references/channel-benchmarks.md`.

### Step 2: Health Check
Compare campaign actuals vs benchmarks. Flag deviations with severity levels.
Script: `scripts/benchmark_tracker.py` (command: health_check)

### Step 3: Anomaly Detection
Z-score based anomaly detection on time series data. Flag statistical outliers.
Script: `scripts/benchmark_tracker.py` (command: anomaly_detect)

### Step 4: Predictive Modeling
Trend-based projections for pacing, end-of-campaign estimates, budget depletion.

## Output Format

```
PERFORMANCE ORACLE REPORT
Campaign: [Name] | Period: [Dates]

HEALTH CHECK
  [Channel]: [Status] | Actual vs Benchmark | Deviation

ANOMALIES DETECTED
  [Metric]: [Value] | Z-score: [X] | Severity: [low/medium/high]

PREDICTIONS
  End-of-campaign projected: [metrics]
  Budget depletion: [date]
```

## Integration Points

- **Outputs to**: channel-architect (benchmark context), optimization-engine (performance targets), waste-quantifier (benchmark comparisons)
- **Receives from**: All engines (performance data), learning-accumulator (historical patterns)
- **Scripts**: `scripts/benchmark_tracker.py`
- **References**: `references/channel-benchmarks.md`

## Dependencies

- campaign-orchestrator
