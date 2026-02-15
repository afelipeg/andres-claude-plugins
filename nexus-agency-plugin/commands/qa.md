---
name: qa
description: "Run quality validation across all engine outputs. Pre-launch checks, data integrity, governance compliance."
---

# /qa

## Usage

```
/qa [campaign name]
/qa --pre-launch
/qa --post-launch
/qa --governance
/qa --full
```

## Workflow

1. **Cross-cutting**: Run comprehensive QA via `quality-guardian`
2. **Governance**: Validate waste thresholds and quality scores
3. **Value**: Verify tracking and attribution setup
4. **Activation**: Verify platform configurations and creative specs

## Engines Activated
- Cross-cutting (quality-guardian)
- Governance (media-quality-scorer, waste-quantifier)
- Value (revenue-connector — data integrity)
- Activation (campaign-launcher — setup verification)

## Output
QA report with pass/fail status per check, governance health dashboard, required actions, and recommendations.
