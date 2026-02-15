---
name: mmm-meridian
description: "Marketing Mix Modeling using Google Meridian framework. Covers the full 4-phase MMM workflow: pre-modeling (data prep), modeling (Bayesian inference with Hill curves and Adstock), post-modeling (diagnostics and refresh), and scenario planning (budget optimization). Use when user needs MMM, budget optimization, marketing mix analysis, or scenario planning."
allowed-tools: "Bash(python3 *), Read, Grep, Glob"
---

# MMM Meridian

You implement Marketing Mix Modeling following Google's Meridian framework methodology. MMM is the strategic layer of the measurement trifecta, answering: "What is the optimal budget split across channels?"

This skill drives the **continuous optimization cycle**: Scenario Planning outputs feed channel-architect for reallocation, which triggers activation, value measures results, governance validates waste, and results feed back into the next model refresh.

## Data Input

- **Manual input**: User provides historical spend, KPIs, control variables as CSV/JSON
- **MCP platform connectors** (optional): Pull historical spend and performance data from Google Ads, Meta, DV360, TikTok, Amazon
- **MCP GCP connector** (optional): Query BigQuery for historical data, Google Query Volume (GQV), and YouTube reach/frequency via MMM Data Platform

## Meridian Framework Overview

Meridian is Google's open-source Bayesian MMM framework. It uses hierarchical geo-level modeling with Hill saturation curves and Adstock decay to estimate channel-level ROI and optimize budget allocation.

**Core methodology**: Bayesian causal inference with MCMC sampling (NUTS sampler), TensorFlow Probability backend, GPU-accelerated.

**Four pillars**: Accuracy (Bayesian + experiment calibration), Actionability (channel ROI + budget scenarios), Adaptability (open-source), Privacy-Durability (aggregated data, no cookies).

## Phase 1: Pre-Modeling

Prepare and validate data before modeling. This phase is critical — garbage in, garbage out.

### Data Requirements

| Data Type | Minimum | Recommended | Granularity |
|-----------|---------|-------------|-------------|
| Time series length | 1 year weekly | 2-3 years weekly | Weekly |
| Geographic level | National | 10+ geos | State/DMA |
| Media channels | 3+ | All active | Per channel |
| Control variables | Seasonality | Seasonality + macro + competitive | Weekly |

### Required Data Columns

1. **Media spend** per channel per geo per week
2. **KPI data** (revenue, conversions, leads) per geo per week
3. **Control variables**: seasonality indicators, pricing, promotions, macro-economic, competitive
4. **Optional**: Google Query Volume (GQV) as organic demand proxy, YouTube reach/frequency

### Pre-Modeling Checklist

- [ ] Data spans minimum 52 weeks (104+ recommended)
- [ ] No gaps in time series (interpolate or flag)
- [ ] Media spend aligns with KPI granularity (same geo, same week)
- [ ] Outliers identified and documented (do NOT remove without justification)
- [ ] Multicollinearity check: VIF < 5 for all media variables
- [ ] Seasonality patterns identified (Buen Fin, Hot Sale, Christmas for Mexico/LATAM)
- [ ] Currency normalized (single currency across all channels)
- [ ] Spend at net/working media level (exclude fees already quantified by governance)
- [ ] Control variables stationary or differenced

### Exploratory Data Analysis

1. Time series plots per channel spend and KPI
2. Correlation matrix between media channels (flag r > 0.7)
3. Spend distribution analysis (sufficient variation for estimation)
4. KPI decomposition: trend, seasonality, residual
5. Identify structural breaks (COVID, brand events, competitive launches)

### Output: Data Readiness Report

```
DATA READINESS: [Campaign]
Status: READY / NEEDS WORK / INSUFFICIENT

Time span: [X weeks] (minimum 52)
Geos: [N] (national or geo-level)
Channels: [list]
KPI: [metric]
Data quality score: [0-100]

ISSUES:
- [issue 1]: [severity] — [recommendation]

READY FOR MODELING: [YES/NO]
```

## Phase 2: Modeling

Build the MMM with Bayesian inference, Hill saturation curves, and Adstock decay.

### Model Specification

**Response variable**: KPI (revenue, conversions, etc.)

**Media variables** (per channel):
- **Adstock transformation**: Geometric decay `adstock(x, decay_rate)` captures carryover effects
  - Decay rate range: 0.1 (fast decay, e.g., search) to 0.9 (slow decay, e.g., TV/brand)
- **Hill saturation curve**: `response = max * (spend^alpha / (spend^alpha + ec50^alpha))`
  - alpha: shape parameter (steepness of diminishing returns)
  - ec50: half-saturation point (spend level at 50% of max response)

**Control variables**: Additive effects for seasonality, pricing, promotions, macro factors

**Priors** (Bayesian):
- ROI priors from experiments (incrementality tests), past MMM results, or industry benchmarks
- Prior strength controls influence on posterior: weak priors let data speak, strong priors enforce known constraints
- ALWAYS use informative priors when experiment data is available (calibration)

### Modeling Guidance

1. Start with default priors, review posterior distributions
2. Calibrate with experiment results when available (incrementality-lab outputs)
3. Check posterior ROI credible intervals — wide intervals = insufficient data
4. If channels are highly correlated, consider aggregating or using stronger priors
5. For new channels with < 6 months data, use informative priors from benchmarks

### Edge Cases

- **New channel**: Use industry benchmark ROI priors (from performance-oracle)
- **Channel paused mid-period**: Adstock will model the decay; ensure spend=0 weeks are included
- **Extreme seasonality**: Add interaction terms or separate seasonal indicators
- **Currency fluctuation**: Normalize all spend to single currency before modeling
- **Offline channels**: Include if data available (TV GRPs, OOH impressions); skip if digital-only config

### Simulation Mode (Plugin Script)

When full Meridian modeling is not available (no GPU/Colab), use `scripts/mmm_scenario_planner.py` for simplified simulation:
- Hill curve fitting from historical data
- Adstock decay estimation
- Budget optimization via marginal ROI
- Scenario comparison

## Phase 3: Post-Modeling

Evaluate model quality, interpret results, plan refresh cadence.

### Model Fit Diagnostics

1. **R-squared**: Minimum 0.70 for acceptable fit (0.85+ preferred)
2. **MAPE**: Mean Absolute Percentage Error < 15% on holdout
3. **In-sample fit**: Predicted vs actual KPI time series plot
4. **Out-of-sample validation**: Last 8-12 weeks as holdout
5. **Posterior predictive check**: Simulated data should resemble actual data distribution
6. **Residual analysis**: No systematic patterns (check for autocorrelation)

### Parameter Interpretation

For each media channel, extract and validate:

| Parameter | What it means | Red flag |
|-----------|---------------|----------|
| ROI | Revenue per dollar spent | Negative or > 20x |
| mROI | Marginal ROI at current spend | Negative (oversaturated) |
| Saturation point | Where diminishing returns kick in | Below current spend = waste |
| Adstock half-life | How long effect persists | > 8 weeks (unrealistic for digital) |
| Contribution % | Share of KPI explained | Dominant single channel > 60% |

### Visualizations

1. **Response curves** per channel (spend vs incremental KPI)
2. **ROI waterfall** across channels
3. **Saturation analysis**: Current spend vs optimal range
4. **Contribution decomposition**: Base + media + controls over time
5. **Prior vs posterior**: How much did data update the priors?

### Model Refresh Cadence

| Trigger | Action |
|---------|--------|
| Quarterly | Full model refresh with latest data |
| New channel added | Re-estimate with new channel included |
| Major market shift | Re-estimate with structural break indicator |
| Post incrementality test | Update priors with experiment results |
| Budget cycle (annual) | Full refresh + scenario planning |

### Debugging Guide

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Poor R-squared | Missing control variables | Add seasonality, macro, competitive |
| Negative ROI for known-good channel | Multicollinearity | Aggregate correlated channels or use priors |
| All channels show flat ROI | Insufficient spend variation | Use geo-level data for more variation |
| Posterior = Prior (no update) | Insufficient data | More time periods or stronger signal |
| Unrealistically high ROI | Confounding with organic | Add GQV as control, use incrementality calibration |

## Phase 4: Scenario Planning

Optimize budget allocation using model results. This is the actionable output that drives the continuous cycle.

### Budget Optimization

Using fitted Hill curves and Adstock parameters, optimize allocation:

1. **Fixed budget**: Distribute total budget across channels to maximize KPI
2. **Flexible budget**: Find optimal total budget and split
3. **Constrained**: Apply min/max per channel, flighting patterns, business rules

### Scenario Types

| Scenario | Description | Use Case |
|----------|-------------|----------|
| **Current baseline** | Current allocation at current spend | Benchmark |
| **Optimized same budget** | Reallocate for max KPI at same total | Quick win |
| **Growth scenarios** | +10%, +20%, +50% budget | Business case for investment |
| **Reduction scenarios** | -10%, -20% budget | Efficiency under cuts |
| **Channel what-if** | Add/remove specific channel | Channel justification |
| **Seasonal shift** | Reallocate across time periods | Flighting optimization |

### Modifiable Assumptions (Meridian `new_data`)

- **Cost per media unit**: Adjust if CPMs are expected to change
- **Revenue per KPI unit**: Adjust for price changes or CLV updates
- **Flighting pattern**: Change geographic or temporal distribution

### Scenario Planning Output

```
SCENARIO PLANNING: [Campaign]
Model version: [date] | R-squared: [X] | Channels: [N]

BASELINE (Current Allocation)
  Total budget: $[X]
  Expected KPI: [Y units]
  Overall ROI: [Z]x

OPTIMIZED (Same Budget)
  Channel reallocation: [from → to table]
  Expected KPI lift: +[%]
  Savings from waste reduction: $[X] (via governance)

GROWTH SCENARIO (+20%)
  Incremental budget: $[X]
  Incremental KPI: [Y]
  Marginal ROI: [Z]x (vs [baseline]x)

RECOMMENDATION:
  [Top 1-2 actions with expected impact]
```

## Continuous Cycle

This is the heart of the NEXUS system. MMM Meridian is NOT a one-time analysis — it drives continuous optimization:

```
                    ┌──────────────────────┐
                    │   MMM MERIDIAN       │
                    │   Scenario Planning  │
                    └──────────┬───────────┘
                               │ Budget allocation
                               ▼
                    ┌──────────────────────┐
                    │   CHANNEL ARCHITECT  │
                    │   Reallocation       │
                    └──────────┬───────────┘
                               │ Updated media plan
                               ▼
                    ┌──────────────────────┐
                    │   ACTIVATION ENGINE  │
                    │   Execute changes    │
                    └──────────┬───────────┘
                               │ Campaign data
                               ▼
                    ┌──────────────────────┐
                    │   VALUE ENGINE       │
                    │   Measure results    │
                    └──────────┬───────────┘
                               │ Attribution + incrementality
                               ▼
                    ┌──────────────────────┐
                    │   GOVERNANCE ENGINE  │
                    │   Waste validation   │
                    └──────────┬───────────┘
                               │ Validated results + waste data
                               ▼
                    ┌──────────────────────┐
                    │   MMM MERIDIAN       │
                    │   Model refresh      │◄── New data feeds next cycle
                    └──────────────────────┘
```

**Cycle frequency**: Quarterly full refresh, monthly scenario updates, weekly data ingestion.

## Integration Points

- **Outputs to**: channel-architect (budget reallocation), revenue-bridge (ROI projections), executive-translator (scenario summaries), optimization-engine (spend targets)
- **Receives from**: performance-oracle (benchmarks for priors), attribution-engine (daily signals), incrementality-lab (experiment calibration), governance (waste-adjusted spend), revenue-connector (actual revenue)
- **Scripts**: `scripts/mmm_scenario_planner.py`
- **References**: `references/meridian-framework.md`

## Dependencies

- measurement-architect
- performance-oracle
