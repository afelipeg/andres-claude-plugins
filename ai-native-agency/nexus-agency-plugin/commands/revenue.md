---
name: revenue
description: "Revenue attribution and reconciliation report. Compare platform-reported vs actual revenue, calculate true ROAS."
---

# /revenue

## Usage

```
/revenue [campaign name]
/revenue --reconcile
/revenue --attribution
/revenue --bridge
```

## Workflow

1. **Value**: Run attribution analysis via `attribution-engine` (Shapley values)
2. **Value**: Reconcile platform vs actual revenue via `revenue-connector`
3. **Architect**: Translate to financial metrics via `revenue-bridge`
4. **Governance**: Include waste-adjusted ROAS via `waste-quantifier`

## Data Sources
- Manual input: User provides platform reports, CRM/ERP revenue data
- MCP platform connectors (optional): Auto-pull conversion data from all platforms
- MCP GCP connector (optional): Query revenue data from BigQuery

## Engines Activated
- Value (attribution-engine, revenue-connector)
- Architect (revenue-bridge)
- Governance (waste-quantifier — productive ROAS)

## Output
Revenue attribution report with Shapley values, platform reconciliation, correction factors, true ROAS, and waste-adjusted ROAS.
