---
name: intelligence
description: "Generate latest intelligence report: audience insights, competitive landscape, and performance benchmarks."
---

# /intelligence

## Usage

```
/intelligence [client or campaign name]
/intelligence --audience [segment]
/intelligence --competitive [competitor]
/intelligence --benchmarks [channel]
```

## Workflow

1. **Intelligence**: Pull latest audience profiles via `audience-intelligence`
2. **Intelligence**: Run competitive scan via `competitive-radar`
3. **Intelligence**: Compare performance vs benchmarks via `performance-oracle`
4. **Cross-cutting**: Surface relevant historical learnings via `learning-accumulator`

## Data Sources
- Manual input: User provides market data, reports, competitor info
- MCP platform connectors (optional): Pull audience data from Google Ads, Meta, DV360
- MCP GCP connector (optional): Query BigQuery for historical intelligence data

## Engines Activated
- Intelligence (audience-intelligence, competitive-radar, performance-oracle)
- Cross-cutting (learning-accumulator)

## Output
Intelligence briefing with audience profiles, competitive landscape, benchmark comparison, and historical patterns.
