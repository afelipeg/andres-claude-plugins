---
name: waste
description: "Focused waste waterfall analysis. Quantify media waste across 6 categories, generate recovery plan and C-Suite summary."
---

# /waste

## Usage

```
/waste [campaign or client name]
/waste --estimate [gross_spend] --industry [vertical]
/waste --compare [period1] [period2]
/waste --recovery
```

## Workflow

### Phase 1: Data Collection
1. **Governance**: Gather supply chain data via `supply-chain-auditor`
2. **Governance**: Gather quality data via `media-quality-scorer`
3. **Value**: Gather revenue reconciliation data via `revenue-connector`

### Phase 2: Waste Calculation
4. **Governance**: Run 6-category waste waterfall via `waste-quantifier`
   - Non-Working Overhead (agency fees, tech fees, data costs)
   - Supply Chain Waste (hidden margins, intermediary fees, arbitrage)
   - Quality Waste (fraud/IVT, non-viewable, brand-unsafe, MFA)
   - Audience Waste (off-target, frequency violations, duplication)
   - Optimization Waste (poor pacing, stale creatives, wrong bids)
   - Measurement Waste (misattributed conversions, overcounted revenue)
5. Validate: all categories + productive spend = gross spend

### Phase 3: Context
6. **Intelligence**: Compare vs industry benchmarks via `performance-oracle`
7. **Activation**: Identify optimization gaps via `optimization-engine`

### Phase 4: Reporting
8. **Value**: Generate C-Suite summaries via `executive-translator`

## Data Sources
- Manual input: User provides spend breakdowns, vendor reports
- MCP platform connectors (optional): Auto-pull spend and performance data
- MCP GCP connector (optional): Query detailed spend data from BigQuery

## Engines Activated
- Governance (waste-quantifier, supply-chain-auditor, media-quality-scorer)
- Value (revenue-connector, executive-translator)
- Intelligence (performance-oracle)
- Activation (optimization-engine)

## Output
1. **Waste Waterfall Visualization**: Gross spend -> 6 waste stages -> productive spend
2. **Working Media Ratio**: Per channel and overall
3. **Recovery Action Plan**: Prioritized by recoverable dollars
4. **C-Suite Summary**: CEO (revenue impact), CFO (waste-to-savings), CMO (media efficiency)
5. **Industry Comparison**: Your waste vs vertical benchmarks
