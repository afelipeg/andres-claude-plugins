# Google Meridian MMM Framework Reference

Source: https://github.com/google/meridian | Docs: https://developers.google.com/meridian

## What is Meridian

Meridian is Google's open-source Marketing Mix Modeling framework that enables advertisers to build in-house models. It uses Bayesian causal inference to jointly estimate saturation and lag effects across marketing channels.

## Core Methodology

### Bayesian MCMC Inference
- Uses No U Turn Sampler (NUTS) for MCMC sampling
- TensorFlow Probability backend with GPU acceleration (XLA compiler)
- Posterior distributions provide uncertainty quantification on all parameters

### Media Transformations

**Adstock (Carryover/Lag Effects)**
- Geometric decay: `adstocked_spend[t] = spend[t] + decay * adstocked_spend[t-1]`
- Decay rate parameter estimated per channel
- Captures media effects that persist beyond exposure week

**Hill Saturation (Diminishing Returns)**
- `response = max_response * (spend^alpha / (spend^alpha + ec50^alpha))`
- alpha: steepness of saturation curve
- ec50: half-saturation spend level (50% of max response)
- Captures diminishing marginal returns as spend increases

### Hierarchical Geo-Level Modeling
- Supports 50+ geos with weekly data
- More statistical power than national-level
- Reduces omitted variable bias
- Geo-level variation helps identify causal effects

### Prior Integration
- Informative priors from experiments, past models, or benchmarks
- Controls degree of prior influence on posterior
- Calibration with incrementality test results recommended

## Four Pillars

| Pillar | Description |
|--------|-------------|
| Accuracy | Bayesian statistics + experiment calibration |
| Actionability | Channel-level ROI + budget optimization |
| Adaptability | Open-source, customizable model specification |
| Privacy-Durability | Aggregated data, no cookies or user-level info |

## Data Requirements

### Minimum Requirements
- 52+ weeks of weekly data (104+ recommended)
- Media spend per channel per time period
- KPI (revenue/conversions) at matching granularity
- At least 3 media channels

### Recommended Additional Data
- Geographic disaggregation (10+ geos)
- Google Query Volume (GQV) as organic demand control
- YouTube reach and frequency data
- Control variables: seasonality, pricing, promotions, macro-economic
- Non-media variables: distribution, pricing, competitive activity

### Data Format
- Weekly time series
- Geo x Time x Channel granularity
- All numeric, no nulls (interpolate gaps)
- Single currency denomination

## Technical Requirements
- Python 3.11 or 3.12
- 1+ GPU recommended (CPU fallback available, much slower)
- Google Colab Pro+ recommended for GPU access
- Vertex AI for production workloads
- `pip install google-meridian`

## Budget Optimization

### BudgetOptimizer Class
- Fixed budget optimization across channels
- Channel constraints via `pct_of_spend` argument
- Custom budgets via `budget` parameter
- `create_optimization_tensors` helper for cost-per-media-unit specs

### Scenario Planning with `new_data`
- Override cost per media unit (CPM changes)
- Override revenue per KPI unit (price/CLV changes)
- Override flighting pattern (geographic/temporal redistribution)
- Posterior parameters remain fixed — only metric definitions change

### Key Insight: Incremental Outcome Forecasting
Meridian forecasts only incremental outcome (causal effect), not absolute future values. Control variables cancel in the difference between Expected Outcome and Counterfactual, simplifying scenario analysis.

## Integration with NEXUS Plugin

### Pre-Modeling Phase → Intelligence Engine
- performance-oracle provides channel benchmarks for prior specification
- competitive-radar provides market context for control variables

### Modeling Phase → Value Engine
- incrementality-lab provides experiment results for calibration
- attribution-engine provides daily signals for validation

### Post-Modeling Phase → Governance Engine
- waste-quantifier validates spend efficiency
- supply-chain-auditor provides net working media (input to model)

### Scenario Planning Phase → Architect Engine
- channel-architect receives optimized budget allocation
- revenue-bridge receives ROI projections for C-Suite reporting

## Key Resources

| Resource | URL |
|----------|-----|
| GitHub repo | https://github.com/google/meridian |
| Developer docs | https://developers.google.com/meridian |
| PyPI | https://pypi.org/project/google-meridian/ |
| Scenario Planner | Interactive via Colab/Looker Studio |
| Think with Google | https://www.thinkwithgoogle.com/intl/en-emea/marketing-strategies/data-and-measurement/meridian-marketing-mix-model/ |
