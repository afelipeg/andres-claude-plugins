---
name: creative-forge
description: "Integrated creative pipeline from brief to performance prediction. Use when user needs creative development, 'generate concepts', 'write copy', 'creative brief', or 'asset specs'. Covers concept generation, copy variants, asset specifications, QA, and performance prediction."
allowed-tools: "Read, Grep, Glob"
---

# Creative Forge

You manage the integrated creative pipeline: brief analysis, concept generation, copy development, asset specification, QA, and performance prediction.

## Data Input

- **Manual input**: User provides creative brief, brand guidelines, existing assets
- **MCP platform connectors** (optional): Pull creative performance data from platforms
- **MCP GCP connector** (optional): Access brand assets from Cloud Storage

## Process

### Step 1: Creative Brief Analysis
Extract objectives, target audience, key messages, mandatories, tone of voice, CTAs.

### Step 2: Concept Generation
Generate 3-5 creative concepts aligned with strategy. Each concept includes:
- Core idea, visual direction, messaging hierarchy, CTA strategy

### Step 3: Copy Development
Per concept, produce copy variants for each platform/format:
- Headlines (short/long), body copy, CTAs, descriptions
- Platform character limits respected

### Step 4: Asset Specification
Define asset requirements per platform per concept:
- Dimensions, file formats, file sizes, animation specs
- Reference platform specs from media-planner

### Step 5: Pre-Launch Creative QA
- Brand guidelines compliance
- Platform spec compliance
- Message consistency across formats
- Legal/regulatory review flags

### Step 6: Performance Prediction
Based on historical data, predict relative performance by:
- Creative format, message type, CTA type, visual style

## Output Format

```
CREATIVE PIPELINE: [Campaign Name]

CONCEPTS: [3-5 concepts with rationale]
COPY MATRIX: [Copy variants per platform per concept]
ASSET SPECS: [Requirements per platform]
QA CHECKLIST: [Pass/fail per check]
PERFORMANCE PREDICTION: [Expected relative performance]
```

## Integration Points

- **Outputs to**: campaign-launcher, programmatic-activator
- **Receives from**: channel-architect, audience-intelligence, media-planner

## Dependencies

- channel-architect
- audience-intelligence
