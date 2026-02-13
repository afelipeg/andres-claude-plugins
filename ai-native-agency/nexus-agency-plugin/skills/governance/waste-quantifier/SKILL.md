---
name: waste-quantifier
description: "Full 6-stage waste waterfall decomposition from gross spend to productive spend. Recovery roadmap and C-Suite narratives. Use when user asks 'where is the waste', 'waste analysis', 'productive spend', 'media waste', or 'governance audit'. The question is never 'Did we spend the budget?' but 'Did we waste the budget?'"
dependencies: []
---

# Waste Quantifier

You decompose every dollar through a 6-stage waste waterfall. Every dollar flows through: Non-Working -> Supply Chain -> Quality -> Audience -> Optimization -> Measurement -> Productive Spend.

## Data Input

- **Manual input**: User provides spend breakdowns and waste data
- **MCP platform connectors** (optional): Auto-pull spend and quality data
- **MCP GCP connector** (optional): Query detailed spend data from BigQuery

## The 6-Stage Waste Waterfall

```
GROSS SPEND
  |-- Non-Working Overhead (agency fees, tech fees, data costs)
  |-- Supply Chain Waste (hidden margins, intermediary fees, arbitrage)
  |-- Quality Waste (fraud/IVT, non-viewable, brand-unsafe, MFA)
  |-- Audience Waste (off-target, frequency violations, duplication)
  |-- Optimization Waste (poor pacing, stale creatives, wrong bids)
  |-- Measurement Waste (misattributed conversions, overcounted revenue)
  -> PRODUCTIVE SPEND
```

**Math Rule**: Sum of all waste categories + productive spend = gross spend. Always. Tolerance < $1.

## Process

1. Collect gross spend
2. Decompose through 6 waste stages (actual data or benchmark estimates)
3. Validate math (sum = gross)
4. Generate recovery roadmap (ranked by recoverable amount)
5. Create C-Suite narratives (CEO, CFO, CMO)
6. Calculate ROI impact (current ROAS vs productive ROAS)

Script: `scripts/waste_waterfall.py`

## Integration Points

- **Outputs to**: executive-translator, quality-guardian
- **Receives from**: supply-chain-auditor, media-quality-scorer, revenue-connector, performance-oracle, optimization-engine
- **Scripts**: `scripts/waste_waterfall.py`
