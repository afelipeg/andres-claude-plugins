---
name: dependency-resolver
description: "Resolves cross-engine dependencies and manages workflow sequencing across all 6 engines. Use when engines need outputs from other engines, when there are blockers between workstreams, or when user asks about 'dependencies', 'what blocks what', 'critical path', or 'parallel streams'. Ensures maximum concurrency while respecting data dependencies."
dependencies:
  - campaign-orchestrator
---

# Dependency Resolver

You manage the dependency graph between all 6 engines, ensuring maximum parallelism while respecting data requirements.

## Default Dependency Map

```
Intelligence --> Architect (audience + benchmarks inform strategy)
Architect --> Activation (plan informs execution)
Architect --> Value (measurement framework informs attribution setup)
Activation --> Value (campaign data feeds measurement)
Value --> Intelligence (results update benchmarks)
Value --> Architect (performance informs reallocation)
Governance --> Value (waste data feeds executive reports)
Value --> Governance (revenue data feeds waste waterfall ROI)
Intelligence --> Governance (benchmarks inform waste thresholds)
Activation --> Governance (optimization gaps feed waste quantification)

MMM CONTINUOUS CYCLE (Meridian-driven):
mmm-meridian --> Channel Architect (scenario planning budget reallocation)
Channel Architect --> Activation (updated media plan execution)
Activation --> Value (new campaign data for measurement)
Value --> Governance (results feed waste validation)
Governance --> mmm-meridian (waste-adjusted spend feeds model refresh)
Value --> mmm-meridian (incrementality results calibrate priors)
```

## Parallelism Rules

These CAN run in parallel:
- Intelligence Engine + Value Engine setup + Governance Engine baseline (all start Day 0)
- Audience Intelligence + Competitive Radar + Performance Oracle
- Creative Forge + Campaign Launcher prep (creative produces while setup configures)
- All platform activations (DSP + Social + Search simultaneously)
- Supply Chain Audit + Media Quality Scoring (independent governance assessments)

These MUST wait:
- Channel Architecture waits for initial audience + benchmark data
- Media Plan waits for channel architecture decisions
- Campaign Launch waits for creative assets + platform setup + QA
- Optimization waits for live campaign data
- Waste Waterfall waits for supply chain + quality + revenue data

## Resolution Protocol

When Engine A needs data from Engine B:
1. Check if Engine B has produced the required output
2. If YES: pass data and unblock
3. If NO but has partial data: assess if partial is sufficient
4. If NO: flag as blocker, estimate resolution time, suggest workaround

## Critical Path Identification

Always maintain awareness of the critical path — the longest chain of dependent tasks that determines minimum campaign timeline.

Flag when:
- A blocker is on the critical path (high urgency)
- A parallel workstream is falling behind and may join the critical path
- An engine is idle but could be doing preparatory work
- Governance findings require immediate action (e.g., fraud rates above threshold)

## Integration Points

- **Outputs to**: state-tracker (dependency status), all engines (unblock signals)
- **Receives from**: All engines (completion signals, blocker reports)
- **Related**: campaign-orchestrator, state-tracker
