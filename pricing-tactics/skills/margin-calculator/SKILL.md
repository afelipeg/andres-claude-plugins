---
name: margin-calculator
description: Margin and Markup Calculator. Converts between margin, markup, cost, and price. Manual invocation only - use /pricing:margin-calculator for margin calculations.
disable-model-invocation: true
allowed-tools: Read, Bash(python *)
argument-hint: "[cost] [price] or [cost] [margin_%] or [price] [margin_%]"
---

# Margin and Markup Calculator

Calculate and convert between different profitability metrics.

## Key Formulas

### Margin (% of selling price)
```
Gross Margin = (Price - Cost) / Price × 100
```

### Markup (% of cost)
```
Markup = (Price - Cost) / Cost × 100
```

### Conversions
```
Price = Cost × (1 + Markup%)
Price = Cost / (1 - Margin%)
Margin% = Markup% / (1 + Markup%)
Markup% = Margin% / (1 - Margin%)
```

## Usage

Run the calculator script:

```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/margin.py $ARGUMENTS
```

**Supported inputs:**
- Cost and Price: Calculate both margin and markup
- Cost and Target Margin: Calculate required price
- Cost and Target Markup: Calculate required price
- Price and Target Margin: Calculate maximum cost

## Common Margin/Markup Conversions

| Markup | Margin | Multiplier |
|--------|--------|------------|
| 10% | 9.1% | 1.10x |
| 20% | 16.7% | 1.20x |
| 25% | 20.0% | 1.25x |
| 33.3% | 25.0% | 1.33x |
| 50% | 33.3% | 1.50x |
| 75% | 42.9% | 1.75x |
| 100% | 50.0% | 2.00x |
| 150% | 60.0% | 2.50x |
| 200% | 66.7% | 3.00x |

## Industry Benchmarks

| Industry | Typical Gross Margin |
|----------|---------------------|
| Grocery retail | 25-30% |
| Apparel retail | 45-55% |
| Software (perpetual) | 75-85% |
| SaaS | 70-80% |
| Professional services | 30-50% |
| Manufacturing | 25-35% |
| Luxury goods | 60-70% |

## Output Format

### Margin Analysis Results

**Given:**
- [What was provided: Cost, Price, Margin, or Markup]

**Calculated:**
| Metric | Value |
|--------|-------|
| Cost | $X |
| Price | $Y |
| Gross Profit | $Z |
| Margin | W% |
| Markup | V% |
| Multiplier | A.Bx |

**Context:**
- Industry typical: X-Y%
- Your position: [Above/Below/Within] typical range

## Multi-Product Analysis

For product portfolios, calculate weighted average:

```
Weighted Margin = Σ(Product Revenue × Product Margin) / Total Revenue
```

| Product | Revenue | Margin | Contribution |
|---------|---------|--------|--------------|
| A | $X | Y% | Z% of total |
| B | $X | Y% | Z% of total |
| **Total** | **$X** | **Y% weighted** | |
