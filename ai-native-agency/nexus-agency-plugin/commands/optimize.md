---
name: optimize
description: "Manual optimization review. Analyze campaign performance, detect issues, and recommend budget reallocation across channels."
---

# /optimize

## Usage

```
/optimize [campaign name]
/optimize --reallocate [budget]
/optimize --creative
/optimize --pacing
/optimize --mmm-check
```

## Workflow

1. **Activation**: Run optimization rules via `optimization-engine`
2. **Activation**: Check MMM model freshness via `optimization-engine` (mmm_check)
3. **Intelligence**: Compare vs benchmarks via `performance-oracle`
4. **Architect**: Run budget reallocation via `channel-architect` (Hill curves)
5. **Architect**: If MMM refresh triggered → run scenario planning via `mmm-meridian`
6. **Governance**: Check quality metrics via `media-quality-scorer`
7. **Value**: Validate with attribution data via `attribution-engine`

## Data Sources
- Manual input: User provides current campaign performance data
- MCP platform connectors (optional): Auto-pull real-time performance from platforms
- MCP GCP connector (optional): Query optimization data from BigQuery

## Engines Activated
- Activation (optimization-engine — tactical + MMM check)
- Architect (channel-architect, mmm-meridian — strategic reallocation)
- Intelligence (performance-oracle)
- Value (attribution-engine)
- Governance (media-quality-scorer)

## MMM On-Going Optimization
The `--mmm-check` flag explicitly checks whether the Google Meridian model needs refreshing. Triggers include: quarterly staleness, cumulative reallocation drift >20%, channel performance diverging >30% from predictions, and saturation imbalances. When triggered, feeds data to mmm-meridian for model refresh and scenario planning.

## Output
Optimization recommendations with severity levels, budget reallocation suggestions, creative fatigue alerts, pacing analysis, quality-adjusted performance, and MMM model health status.
