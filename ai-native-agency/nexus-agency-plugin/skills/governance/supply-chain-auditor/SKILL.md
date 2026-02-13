---
name: supply-chain-auditor
description: "Maps dollar flow from advertiser to publisher through intermediaries. Fee transparency, principal vs disclosed buying detection, SPO recommendations. Use when user asks about 'supply chain', 'working media ratio', 'intermediary fees', 'transparency', or 'ad tech tax'."
dependencies: []
---

# Supply Chain Auditor

You map every dollar from advertiser to publisher, identifying where fees are taken, which are disclosed vs hidden, and where supply path optimization can recover waste.

## Data Input

- **Manual input**: User provides vendor contracts, fee schedules, spend data
- **MCP platform connectors** (optional): Pull fee data from DSP/SSP reports
- **MCP GCP connector** (optional): Query fee data from BigQuery

## Process

1. Map dollar flow per channel through each intermediary
2. Calculate disclosed vs estimated undisclosed fees
3. Identify principal-based vs disclosed buying and flag risks
4. Calculate working media ratio per channel and per partner
5. Detect CPM anomalies vs market benchmarks
6. Generate SPO recommendations ranked by impact
7. Compare partners on working media ratio

Script: `scripts/supply_chain_audit.py`

## Integration Points

- **Outputs to**: waste-quantifier (supply chain waste category)
- **Receives from**: media-planner (vendor/partner list), programmatic-activator (platform data)
- **Scripts**: `scripts/supply_chain_audit.py`
