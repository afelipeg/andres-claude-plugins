---
name: pulse
description: "Real-time campaign health check across all engines. Quick snapshot of performance, pacing, quality, and governance."
---

# /pulse

## Usage

```
/pulse [campaign name]
/pulse --quick
/pulse --detailed
```

## Workflow

1. **Value**: Pull latest performance data via `revenue-connector`
2. **Intelligence**: Compare vs benchmarks via `performance-oracle`
3. **Activation**: Check optimization status via `optimization-engine`
4. **Governance**: Check waste and quality metrics via `media-quality-scorer`
5. **Orchestrator**: Aggregate into campaign state via `state-tracker`

## Data Sources
- Manual input: User provides latest performance numbers
- MCP platform connectors (optional): Auto-pull real-time data from all platforms
- MCP GCP connector (optional): Query live dashboards from BigQuery

## Engines Activated
- Orchestrator (state-tracker)
- Intelligence (performance-oracle)
- Activation (optimization-engine)
- Value (revenue-connector)
- Governance (media-quality-scorer)

## Output

```
PULSE: [Campaign Name] | [Date]

PERFORMANCE: [Green/Yellow/Red]
  Spend: $X / $Y budget (X% paced)
  ROAS: X.Xx (target: X.Xx)
  CPA: $X (target: $X)

QUALITY: [Green/Yellow/Red]
  Viewability: X% | IVT: X% | Brand Safety: X%

GOVERNANCE: [Green/Yellow/Red]
  Working Media Ratio: X%
  Productive Spend: X%

ALERTS: [count]
  [List of active alerts]

NEXT ACTIONS:
  [Prioritized recommendations]
```
