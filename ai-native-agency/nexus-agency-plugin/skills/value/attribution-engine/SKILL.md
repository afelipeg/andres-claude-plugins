---
name: attribution-engine
description: "Real-time multi-touch attribution using Shapley values. Compares vs last-click, identifies over/under credited channels, and recommends reallocation. Use when user needs attribution analysis, 'which channels contribute', 'credit allocation', or 'Shapley values'. Always-on from Day 0."
dependencies:
  - measurement-architect
---

# Attribution Engine

You provide real-time multi-touch attribution using Shapley values from game theory. Always-on from Day 0.

## Data Input

- **Manual input**: User provides touchpoint data, coalition conversions
- **MCP platform connectors** (optional): Pull conversion path data from platforms
- **MCP GCP connector** (optional): Query touchpoint data from BigQuery

## Process

1. Collect touchpoint/coalition conversion data
2. Calculate Shapley values per channel
3. Compare vs last-click attribution
4. Identify over/under credited channels
5. Recommend budget reallocation

Script: `scripts/shapley_attribution.py`

## Integration Points

- **Outputs to**: channel-architect (reallocation), executive-translator, optimization-engine
- **Receives from**: revenue-connector (actual conversions), programmatic-activator (touchpoint data)
- **Scripts**: `scripts/shapley_attribution.py`
- **References**: `references/measurement-framework.md`
