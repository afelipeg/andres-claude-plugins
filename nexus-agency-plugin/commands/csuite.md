---
name: csuite
description: "Generate executive summary for CEO, CFO, or CMO. Translates media metrics into financial language with governance context."
---

# /csuite

## Usage

```
/csuite [campaign name]
/csuite --ceo
/csuite --cfo
/csuite --cmo
/csuite --all
```

## Workflow

1. **Value**: Compile performance data via `revenue-connector`
2. **Value**: Run attribution via `attribution-engine`
3. **Architect**: Translate metrics via `revenue-bridge` (L3 -> L2 -> L1)
4. **Governance**: Include waste analysis via `waste-quantifier`
5. **Value**: Generate role-specific reports via `executive-translator`

## Data Sources
- Manual input: User provides performance data and business context
- MCP platform connectors (optional): Auto-pull latest campaign data
- MCP GCP connector (optional): Query BigQuery for consolidated data

## Engines Activated
- Value (attribution-engine, revenue-connector, executive-translator)
- Architect (revenue-bridge)
- Governance (waste-quantifier)

## Output

**CEO**: Market share impact, revenue growth, customer acquisition, competitive position, investment efficiency
**CFO**: ROI, margin analysis, waste-to-savings opportunity, P&L impact, cash flow timing, productive ROAS
**CMO**: Brand health, funnel performance, channel effectiveness, creative performance, media quality, governance maturity
