---
name: architect
description: "Run strategy and planning workflow: measurement framework, channel architecture, revenue bridge, and media plan generation."
---

# /architect

## Usage

```
/architect [campaign name]
/architect --channels [budget]
/architect --measurement
/architect --mmm [scenario]
/architect --revenue-bridge
/architect --media-plan
```

## Workflow

1. **Architect**: Design measurement framework via `measurement-architect`
2. **Architect**: Validate MMM data readiness via `mmm-meridian` (pre-modeling)
3. **Architect**: Build channel architecture via `channel-architect` (uses intelligence outputs)
4. **Architect**: Optimize budget allocation via `channel_optimizer.py`
5. **Architect**: Run MMM scenario planning via `mmm-meridian` (on-going optimization cycle)
6. **Architect**: Set up revenue bridge via `revenue-bridge`
7. **Architect**: Generate tactical media plan via `media-planner` (auto-produces flowchart, IOs, specs, taxonomy)

## Data Sources
- Manual input: User provides budget, objectives, channel preferences
- MCP platform connectors (optional): Pull historical channel performance
- MCP GCP connector (optional): Query BigQuery for historical data, GQV, YouTube R&F

## Engines Activated
- Architect (measurement-architect, mmm-meridian, channel-architect, revenue-bridge, media-planner)
- Intelligence (performance-oracle — for benchmark context and MMM priors)

## MMM On-Going Optimization
The `--mmm` flag triggers the Google Meridian-based scenario planning cycle. This is NOT a one-time planning exercise — it runs continuously:
- Quarterly full model refresh
- Monthly scenario updates
- MMM refresh triggers from optimization-engine (drift, divergence, saturation)
- Cycle: mmm-meridian → channel-architect → activation → value → governance → mmm-meridian

## Output
Complete strategy package: measurement framework, MMM scenario analysis, channel architecture with budget optimization, revenue bridge, and tactical media plan with auto-generated deliverables.
