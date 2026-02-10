# Andres Claude Plugins

A collection of custom plugins for [Claude Code](https://claude.com/claude-code) to extend its capabilities with specialized skills, calculators, and frameworks.

## Available Plugins

### Pricing Tactics

A comprehensive strategic pricing toolkit based on **"The Strategy and Tactics of Pricing"** by Thomas T. Nagle and Georg Müller.

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

#### Installation

```bash
# Test locally
claude --plugin-dir ./pricing-tactics

# Or install permanently
claude plugin install ./pricing-tactics --scope user
```

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

#### Example Usage

```bash
# Calculate elasticity impact
/pricing:elasticity 100 1000 90 1200

# Analyze a 10% discount with 40% margin
/pricing:break-even 100 60 -10

# Calculate margin from cost and price
/pricing:margin-calculator 50 75

# Full CVP analysis
/pricing:contribution-margin 100 60 50000 2000

# Start interactive consultation
/pricing:pricing-consultant
```

## Plugin Structure

Each plugin follows the Claude Code plugin specification:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/                  # SKILL.md files
├── scripts/                 # Python/shell scripts
├── hooks/                   # Event hooks
└── references/              # Reference documents
```

## Requirements

- Claude Code v1.0.33 or later
- Python 3.x (for calculator scripts)

## License

MIT

## Author

Andres Gutierrez

---

Built with Claude Code
