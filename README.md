# Andres Claude Plugins

A collection of custom plugins for [Claude Code](https://claude.com/claude-code) to extend its capabilities with specialized skills, calculators, and frameworks.

## Available Plugins

### 1. Pricing Tactics

A comprehensive strategic pricing toolkit based on **"The Strategy and Tactics of Pricing"** by Thomas T. Nagle and Georg Muller.

**Location:** `pricing-tactics/`

#### Features

- **5 Strategic Frameworks** (Claude can invoke automatically)
  - EVA (Economic Value Analysis)
  - PSM (Price Sensitivity Meter / Van Westendorp)
  - Value-based Segmentation
  - Competitive Pricing Analysis
  - Cost-Plus Pricing

- **4 Python Calculators** (Manual invocation)
  - Price Elasticity Calculator
  - Break-Even Analysis for Discounts
  - Margin & Markup Calculator
  - Contribution Margin & CVP Analysis

- **Interactive Pricing Consultant**
  - Guided pricing strategy sessions
  - Recommends frameworks based on your situation

#### Commands

| Command | Description |
|---------|-------------|
| `/pricing:eva` | Economic Value Analysis framework |
| `/pricing:psm` | Price Sensitivity Meter (Van Westendorp) |
| `/pricing:segmentation` | Customer segmentation by value |
| `/pricing:competition-analysis` | Competitive pricing analysis |
| `/pricing:cost-plus` | Cost-plus pricing calculations |
| `/pricing:elasticity` | Price elasticity calculator |
| `/pricing:break-even` | Break-even analysis for price changes |
| `/pricing:margin-calculator` | Margin and markup calculations |
| `/pricing:contribution-margin` | Contribution margin & CVP analysis |
| `/pricing:pricing-consultant` | Interactive pricing strategy session |

---

### 2. AI Native Agency (NEXUS)

An AI-native advertising agency operations system that replaces a 103-day linear waterfall with **6 concurrent engines running in 8-10 days**. Built around the Google Meridian MMM framework for on-going budget optimization.

**Location:** `ai-native-agency/nexus-agency-plugin/`

#### Architecture

```
6 ENGINES | 24 SKILLS | 13 SCRIPTS | 12 COMMANDS | 4 AGENTS
```

| Engine | Skills | Purpose |
|--------|--------|---------|
| **Orchestrator** | 3 | Campaign lifecycle management with Objective-to-KPI bridge |
| **Intelligence** | 3 | Always-on market awareness, benchmarks, anomaly detection |
| **Architect** | 5 | Strategy + Measurement + MMM Meridian + Budget Optimization |
| **Activation** | 4 | Creative + Setup + Optimization + MMM on-going triggers |
| **Value** | 4 | Measurement trifecta (Attribution + Incrementality + MMM) |
| **Governance** | 3 | Waste waterfall + Supply chain transparency + Media quality |
| **Cross-Cutting** | 2 | Quality assurance + Cross-campaign learning |

#### Key Features

- **Measurement Trifecta**: Attribution (Shapley values, real-time) + Incrementality (geo-lift, conversion lift) + MMM (Google Meridian)
- **Waste Waterfall**: 6-stage decomposition from gross spend to productive spend, math-validated
- **Revenue Bridge**: L3 (media metrics) to L2 (marketing KPIs) to L1 (C-Suite P&L language)
- **MMM On-Going Optimization**: Google Meridian-based continuous cycle (pre-modeling, modeling, post-modeling, scenario planning)
- **Governance Engine**: Supply chain auditing, media quality scoring (IVT, viewability, brand safety, MFA), waste quantification
- **3 Data Input Modes**: Manual upload, MCP platform connectors (optional), MCP GCP/BigQuery (optional)
- **Objective-to-KPI Bridge**: Mandatory mapping from business objectives to marketing KPIs to media metrics
- **Stage 5 Governance**: Always-on with conservative thresholds (ID Comms 5-Stage Maturity Model)

#### Continuous Optimization Cycle

```
MMM Meridian (Scenario Planning)
       |
       v
Channel Architect (Budget Reallocation)
       |
       v
Activation Engine (Execute Changes)
       |
       v
Value Engine (Measure Results)
       |
       v
Governance Engine (Waste Validation)
       |
       v
MMM Meridian (Model Refresh) --> back to top
```

#### Commands

| Command | Description |
|---------|-------------|
| `/campaign` | Full campaign intake and kickoff |
| `/intelligence` | Latest intel report |
| `/architect` | Strategy + planning + MMM scenario analysis |
| `/activate` | Campaign launch |
| `/pulse` | Real-time health check |
| `/revenue` | Revenue attribution report |
| `/csuite` | Executive summary (CEO/CFO/CMO) |
| `/optimize` | Optimization review + MMM model health check |
| `/learnings` | Cross-campaign insights |
| `/qa` | Quality validation |
| `/governance` | Full governance audit |
| `/waste` | Media waste waterfall analysis |

#### 13 Python Scripts (Zero External Dependencies)

| Script | Engine | Purpose |
|--------|--------|---------|
| `campaign_state.py` | Orchestrator | Campaign state machine (6 engines, 24 tasks) |
| `benchmark_tracker.py` | Intelligence | Health checks + Z-score anomaly detection |
| `channel_optimizer.py` | Architect | Hill saturation curves + greedy allocation |
| `revenue_bridge.py` | Architect | L3-L2-L1 metric translation + C-Suite summaries |
| `media_plan_generator.py` | Architect | Auto-generate flowchart, IOs, specs, UTM taxonomy |
| `mmm_scenario_planner.py` | Architect | Meridian-inspired MMM simulation (4 phases) |
| `optimization_rules.py` | Activation | Rule-based optimization + MMM refresh triggers |
| `shapley_attribution.py` | Value | Multi-touch attribution via Shapley values |
| `power_analysis.py` | Value | Geo-lift, conversion lift, holdout test design |
| `revenue_reconciliation.py` | Value | Platform vs actual reconciliation |
| `waste_waterfall.py` | Governance | 6-stage waste decomposition (math-validated) |
| `supply_chain_audit.py` | Governance | Dollar flow mapping + CPM anomaly detection |
| `media_quality_score.py` | Governance | 4-dimension quality scoring + waste quantification |

#### Market Defaults

Mexico/LATAM benchmarks for 5 verticals: Automotive, FMCG, Financial, Retail, Telecom.

#### Installation

```bash
# Test locally
claude --plugin-dir ./ai-native-agency/nexus-agency-plugin

# Or install permanently
claude plugin install ./ai-native-agency/nexus-agency-plugin --scope user
```

---

## Plugin Structure

Each plugin follows the Claude Code plugin specification:

```
plugin-name/
+-- .claude-plugin/
|   +-- plugin.json          # Plugin manifest
+-- skills/                  # SKILL.md files
+-- scripts/                 # Python/shell scripts
+-- commands/                # Slash commands
+-- agents/                  # Agent definitions
+-- hooks/                   # Event hooks
+-- references/              # Reference documents
```

## Requirements

- Claude Code v1.0.33 or later
- Python 3.x (for calculator/simulation scripts)

## License

MIT

## Author

Andres Gutierrez

---

Built with Claude Code
