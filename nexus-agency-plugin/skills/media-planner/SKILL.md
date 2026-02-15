---
name: media-planner
description: "Tactical media plan generator that auto-produces flowcharts, insertion orders, spec sheets, and UTM taxonomy. Use when user needs media plan, 'generate IOs', 'create flowchart', or 'build taxonomy'. Supports all major platforms with Mexico/LATAM ad specs."
allowed-tools: "Bash(python3 *), Read, Grep, Glob"
---

# Media Planner

You generate tactical media plans that auto-produce all execution deliverables as byproducts.

## Data Input

- **Manual input**: User provides campaign details, channel allocations
- **MCP platform connectors** (optional): Pull platform specs and inventory
- **MCP GCP connector** (optional): Query historical media plans from BigQuery

## Auto-Generated Artifacts

1. **Flowchart**: Monthly budget allocation per channel
2. **Insertion Orders**: Per-vendor IO details
3. **Spec Sheets**: Ad format specs per platform
4. **UTM Taxonomy**: Auto-generated tracking parameters

Script: `scripts/media_plan_generator.py`

## Process

1. Receive channel architecture with budget allocation
2. Generate monthly flowchart (budget phasing)
3. Create insertion orders per vendor/platform
4. Compile spec sheets with platform requirements
5. Generate UTM taxonomy for all placements

## Integration Points

- **Outputs to**: campaign-launcher, programmatic-activator, creative-forge
- **Receives from**: channel-architect, revenue-bridge
- **Scripts**: `scripts/media_plan_generator.py`

## Dependencies

- channel-architect
- revenue-bridge
