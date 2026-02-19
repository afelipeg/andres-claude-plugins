# Measurement Framework Reference

## The Measurement Trifecta

| Layer | Method | Question | Frequency | Use Case |
|-------|--------|----------|-----------|----------|
| Attribution | Shapley Values / Markov | Which channels contributed? | Daily | Optimization |
| Incrementality | Geo-lift / Conversion lift | Would it happen anyway? | Per test | Validation |
| MMM | Marketing Mix Model | Optimal budget split? | Quarterly | Planning |

## When to Use Each Method

### Attribution
- Best for: Real-time optimization, channel-level budget shifts
- Limitations: Correlation not causation, cookie/consent gaps, walled gardens
- Mexico consideration: Cookie consent rates ~70-80%, cross-device tracking limited

### Incrementality
- Best for: Validating platform claims, justifying spend, measuring true lift
- Limitations: Requires budget sacrifice (holdout), statistical power needs scale
- Mexico consideration: Geo tests viable (32 states + CDMX), conversion lift available on Meta/Google

### MMM (Google Meridian Framework)
- Best for: Long-term planning, offline+online integration, strategic allocation
- Framework: Google Meridian — Bayesian causal inference, Hill saturation, Adstock decay
- Phases: Pre-modeling → Modeling → Post-modeling → Scenario Planning (continuous cycle)
- Limitations: Requires 2+ years data, granularity limited, lagging indicator
- Mexico consideration: Seasonality (Buen Fin, Hot Sale) must be modeled, currency fluctuation
- Implementation: See `mmm-meridian` skill for full 4-phase workflow

## Data Requirements

### Attribution
- Touchpoint-level data (impressions, clicks, conversions with timestamps)
- User-level or cohort-level journey data
- Cross-platform identity resolution (where possible)
- Server-side conversion data for accuracy

### Incrementality
- Geographic conversion data (for geo-lift)
- Platform conversion API access (for conversion lift)
- Minimum 14-28 day test windows
- Power analysis before committing to test

### MMM
- 2+ years weekly channel spend data
- Revenue/conversion data at matching granularity
- External variables: seasonality, competitive, macro-economic
- Offline channel data (TV GRPs, OOH impressions)

## KPI Hierarchy

```
L1 (Strategic / C-Suite)
  CAC, CLV, CLV:CAC ratio, ROI, marketing margin, market share

L2 (Tactical / Management)
  CPA, ROAS, avg order value, conversion volume, pipeline value

L3 (Operational / Execution)
  CPM, CPC, CTR, CVR, viewability, impressions, reach, frequency
```
