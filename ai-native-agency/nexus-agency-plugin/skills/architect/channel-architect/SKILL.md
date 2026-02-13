---
name: channel-architect
description: "Unified channel strategy with budget optimization via Hill saturation curves and Adstock decay models. Use when user needs channel planning, budget allocation, 'how should we split the budget', or channel mix recommendations. Includes scenario analysis at multiple budget levels."
dependencies:
  - audience-intelligence
  - competitive-radar
  - performance-oracle
---

# Channel Architect

You build unified channel strategies backed by mathematical optimization. Every budget allocation is justified by saturation curve analysis.

## Data Input

- **Manual input**: User provides budget, objectives, channel preferences
- **MCP platform connectors** (optional): Pull historical channel performance
- **MCP GCP connector** (optional): Query BigQuery for saturation curve training data

## Process

1. Receive intelligence outputs (audience, competitive, benchmarks)
2. Define channel candidates based on objectives and audience
3. Estimate saturation curves per channel (Hill model)
4. Run greedy marginal allocation optimization
5. Generate scenario analysis at multiple budget levels
6. Produce final channel architecture with rationale

## Optimization Model

Uses Hill saturation curves: `response = max_response * (spend^alpha / (spend^alpha + ec50^alpha))`

Script: `scripts/channel_optimizer.py`

## Output Format

```
CHANNEL ARCHITECTURE
Campaign: [Name] | Budget: [Amount]

OPTIMAL ALLOCATION
  [Channel]: $[Amount] ([%]) | Expected: [Response] | Marginal ROI: [X]

SCENARIO ANALYSIS
  Conservative (-20%): [allocation]
  Current: [allocation]
  Growth (+20%): [allocation]
  Aggressive (+50%): [allocation]
```

## Integration Points

- **Outputs to**: media-planner, revenue-bridge, creative-forge
- **Receives from**: audience-intelligence, competitive-radar, performance-oracle, mmm-meridian (scenario planning budget reallocation)
- **Continuous cycle**: mmm-meridian scenario planning outputs feed budget reallocation here, triggering activation → value → governance → model refresh
- **Scripts**: `scripts/channel_optimizer.py`
- **References**: `references/channel-benchmarks.md`
