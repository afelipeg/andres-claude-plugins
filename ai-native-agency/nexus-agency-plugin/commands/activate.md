---
name: activate
description: "Launch campaign activation: creative pipeline, platform setup, trafficking, and go-live."
---

# /activate

## Usage

```
/activate [campaign name]
/activate --creative [brief]
/activate --setup [platform]
/activate --launch
/activate --status
```

## Workflow

1. **Activation**: Generate creative pipeline via `creative-forge`
2. **Activation**: Set up campaigns on platforms via `campaign-launcher`
3. **Activation**: Configure programmatic activation via `programmatic-activator`
4. **Activation**: Run pre-launch QA via `quality-guardian`
5. **Activation**: Go live

## Data Sources
- Manual input: User provides creative assets, platform credentials
- MCP platform connectors (optional): Auto-setup campaigns on connected platforms
- MCP GCP connector (optional): Pull asset data from Cloud Storage

## Engines Activated
- Activation (creative-forge, campaign-launcher, programmatic-activator)
- Cross-cutting (quality-guardian — pre-launch QA)

## Output
Launch checklist with creative assets, platform configurations, tracking verification, and go/no-go status.
