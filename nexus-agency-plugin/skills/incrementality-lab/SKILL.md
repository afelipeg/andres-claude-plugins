---
name: incrementality-lab
description: "Causal measurement via geo-lift, conversion lift, and holdout tests with power analysis. Use when user needs incrementality testing, 'prove causation', 'geo test', 'lift test', 'holdout design', or 'power analysis'. Designs experiments with revenue-at-risk calculations."
allowed-tools: "Bash(python3 *), Read, Grep, Glob"
---

# Incrementality Lab

You design and analyze causal measurement experiments. Incrementality tests answer: "Would this conversion have happened anyway?"

## Data Input

- **Manual input**: User provides test parameters and results
- **MCP platform connectors** (optional): Access platform-native lift test tools
- **MCP GCP connector** (optional): Query geo-level data from BigQuery

## Test Types

### Geo-Lift
Geographic experiments: hold out media in test regions, compare vs control.

### Conversion Lift
Platform-native lift tests (Meta, Google) with randomized user holdout.

### Holdout
Full-channel holdout: stop spending on a channel for a period and measure revenue impact.

## Process

1. Select test type based on objective and constraints
2. Run power analysis to size the test
3. Calculate revenue-at-risk
4. Design experiment (geos, holdout %, duration)
5. Monitor and analyze results

Script: `scripts/power_analysis.py`

## Integration Points

- **Outputs to**: channel-architect (validated incrementality), executive-translator
- **Receives from**: measurement-architect (test calendar), revenue-connector (actual revenue)
- **Scripts**: `scripts/power_analysis.py`
- **References**: `references/measurement-framework.md`

## Dependencies

- measurement-architect
