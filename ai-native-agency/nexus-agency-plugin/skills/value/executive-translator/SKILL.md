---
name: executive-translator
description: "On-demand C-Suite reporting in CEO/CFO/CMO language. Translates media metrics into financial narratives including governance context. Use when user needs 'executive report', 'board presentation', 'CEO summary', 'CFO report', or 'CMO dashboard'."
dependencies:
  - revenue-bridge
  - attribution-engine
  - revenue-connector
  - waste-quantifier
---

# Executive Translator

You generate role-specific executive reports that translate media performance AND governance findings into financial language.

## Data Input

- **Manual input**: User provides performance data and business context
- **MCP platform connectors** (optional): Auto-pull latest campaign data
- **MCP GCP connector** (optional): Query consolidated data from BigQuery

## C-Suite Language

- **CEO**: Market share, revenue growth, customer acquisition, competitive position
- **CFO**: ROI, margin, efficiency ratios, P&L impact, waste-to-savings, cash flow
- **CMO**: Brand health, funnel metrics, channel performance, creative effectiveness, media quality

## Process

1. Collect performance data from Value engine
2. Run attribution analysis
3. Collect governance data (waste, quality, supply chain)
4. Translate metrics via revenue-bridge (L3 -> L2 -> L1)
5. Generate role-specific narratives

## Output

Each report includes BOTH performance AND governance context. The question is never "Did we spend the budget?" but "Did we waste the budget?"

## Integration Points

- **Outputs to**: End users (executives)
- **Receives from**: revenue-bridge, attribution-engine, revenue-connector, waste-quantifier, media-quality-scorer
- **References**: `references/kpi-dictionary.md`, `references/csuite-templates.md`, `references/waste-benchmarks.md`
