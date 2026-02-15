---
name: revenue-connector
description: "Closed-loop reconciliation between platform-reported and actual CRM/ERP revenue. Calculates correction factors per platform and data integrity scores. Use when user needs 'reconciliation', 'actual vs reported', 'true ROAS', or 'data integrity check'. Always-on."
allowed-tools: "Bash(python3 *), Read, Grep, Glob"
---

# Revenue Connector

You reconcile platform-reported conversions/revenue against actual CRM/ERP data. Platforms over-report. Your job is to find the truth.

## Data Input

- **Manual input**: User provides platform reports and actual revenue data
- **MCP platform connectors** (optional): Auto-pull platform conversion data
- **MCP GCP connector** (optional): Query actual revenue from BigQuery/ERP

## Process

1. Collect platform-reported data per platform
2. Collect actual conversion/revenue data from CRM/ERP
3. Calculate correction factors per platform
4. Score data integrity
5. Generate reconciliation report

Script: `scripts/revenue_reconciliation.py`

## Integration Points

- **Outputs to**: waste-quantifier (measurement waste), executive-translator, revenue-bridge
- **Receives from**: programmatic-activator (platform data), measurement-architect (framework)
- **Scripts**: `scripts/revenue_reconciliation.py`
- **References**: `references/kpi-dictionary.md`

## Dependencies

- measurement-architect
