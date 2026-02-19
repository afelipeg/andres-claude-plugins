# Channel Benchmarks for Channel Architect

See intelligence/performance-oracle/references/channel-benchmarks.md for comprehensive Mexico/LATAM benchmarks.

## Channel Saturation Curve Defaults (Mexico)

These are default Hill curve parameters when historical data is unavailable:

| Channel | max_response | alpha | ec50 | min_spend_pct | max_spend_pct |
|---------|-------------|-------|------|---------------|---------------|
| Search Brand | 0.95 | 0.8 | 0.15 | 5% | 25% |
| Search Non-Brand | 0.85 | 0.6 | 0.25 | 10% | 35% |
| Social (Meta) | 0.80 | 0.5 | 0.30 | 10% | 40% |
| Social (TikTok) | 0.70 | 0.5 | 0.35 | 5% | 25% |
| Programmatic Display | 0.60 | 0.4 | 0.40 | 5% | 25% |
| Programmatic Video | 0.75 | 0.5 | 0.35 | 5% | 30% |
| LinkedIn | 0.55 | 0.6 | 0.20 | 3% | 15% |
| Amazon | 0.80 | 0.7 | 0.20 | 5% | 30% |

Parameters:
- max_response: Maximum achievable response (normalized 0-1)
- alpha: Diminishing returns rate (lower = faster saturation)
- ec50: Half-saturation point (as fraction of total budget)
- min/max_spend_pct: Constraints as percentage of total budget
