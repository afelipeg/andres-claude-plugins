---
name: contribution-margin
description: Contribution Margin Analysis. Calculates contribution margin and performs CVP (Cost-Volume-Profit) analysis. Manual invocation only - use /pricing:contribution-margin for profitability analysis.
disable-model-invocation: true
allowed-tools: Read, Bash(python *)
argument-hint: "[price] [variable_cost] [fixed_costs] [volume]"
---

# Contribution Margin Analysis

Analyze product profitability using contribution margin concepts.

## Key Formulas

### Unit Contribution Margin
```
Contribution Margin = Price - Variable Cost per Unit
CM Ratio = Contribution Margin / Price
```

### Break-Even Analysis
```
Break-Even Units = Fixed Costs / Contribution Margin per Unit
Break-Even Revenue = Fixed Costs / CM Ratio
```

### Target Profit Analysis
```
Units for Target Profit = (Fixed Costs + Target Profit) / CM per Unit
Revenue for Target Profit = (Fixed Costs + Target Profit) / CM Ratio
```

## Usage

Run the calculator script:

```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/contribution.py $ARGUMENTS
```

**Input options:**
- Price, Variable Cost, Fixed Costs, Volume
- Or interactive mode to enter each value

## CVP Analysis Framework

### The Profit Equation
```
Profit = (Price × Quantity) - (Variable Cost × Quantity) - Fixed Costs
Profit = (CM per Unit × Quantity) - Fixed Costs
Profit = (Revenue × CM Ratio) - Fixed Costs
```

### Sensitivity Analysis

What happens when each factor changes?

| Change | Impact on Break-Even | Impact on Profit |
|--------|---------------------|------------------|
| Price ↑ | ↓ BE volume | ↑ Profit |
| Variable Cost ↑ | ↑ BE volume | ↓ Profit |
| Fixed Costs ↑ | ↑ BE volume | ↓ Profit |
| Volume ↑ | - | ↑ Profit |

## Output Format

### Contribution Margin Analysis

**Unit Economics:**
| Metric | Value |
|--------|-------|
| Selling Price | $X |
| Variable Cost | $Y |
| **Contribution Margin** | **$Z** |
| CM Ratio | W% |

**Break-Even Analysis:**
| Metric | Value |
|--------|-------|
| Fixed Costs | $X |
| Break-Even Volume | Y units |
| Break-Even Revenue | $Z |

**Current Performance:**
| Metric | Value |
|--------|-------|
| Current Volume | X units |
| Total Contribution | $Y |
| Fixed Costs | $Z |
| **Operating Profit** | **$W** |
| Margin of Safety | V% |

### Margin of Safety
```
Margin of Safety = (Current Sales - Break-Even Sales) / Current Sales × 100
```

A higher margin of safety indicates less risk.

## Scenario Analysis

### What-If Scenarios:

| Scenario | Volume | Price | VC | Fixed | Profit |
|----------|--------|-------|-----|-------|--------|
| Current | X | $Y | $Z | $W | $V |
| Price +5% | X | $Y | $Z | $W | $V |
| Volume +10% | X | $Y | $Z | $W | $V |
| Cost -5% | X | $Y | $Z | $W | $V |

## Strategic Applications

### Use Contribution Margin for:

1. **Product mix decisions**: Focus on highest CM products
2. **Accept/reject orders**: Accept if price > variable cost
3. **Make vs buy**: Compare CM with outsourcing cost
4. **Discontinuation**: Keep if CM positive and covers some fixed costs
5. **Sales commissions**: Base on CM, not revenue

### Warning Signs:
- CM ratio declining over time
- High fixed cost to CM ratio
- Volume below break-even
- Negative contribution margin products
