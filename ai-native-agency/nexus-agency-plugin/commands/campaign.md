---
name: campaign
description: "Full campaign intake, decomposition, and kickoff. Start here for any new campaign."
---

# /campaign

## Usage

```
/campaign [brief text or file path]
/campaign --status [campaign_name]
/campaign --list
```

## Workflow

### New Campaign
1. **Orchestrator**: Parse brief via `campaign-orchestrator`
2. **Orchestrator**: Validate completeness, flag gaps
3. **Intelligence**: Kick off parallel audience + competitive scans
4. **Value**: Design measurement framework (BEFORE strategy)
5. **Governance**: Establish governance baseline and initial waste estimate
6. **Orchestrator**: Generate sprint backlog with dependencies
7. **Orchestrator**: Output campaign blueprint

### Campaign Status
1. **Orchestrator**: Pull state via `state-tracker`
2. Show progress across all 6 engines
3. Highlight blockers and next actions
4. Surface governance alerts

## Engines Activated
- Orchestrator (campaign-orchestrator, state-tracker, dependency-resolver)
- Intelligence (audience-intelligence, competitive-radar, performance-oracle)
- Value (attribution-engine — measurement framework setup)
- Governance (waste-quantifier — baseline estimate)

## Output
Campaign blueprint with sprint backlog, dependency graph, timeline, risk register, and governance checkpoints.
