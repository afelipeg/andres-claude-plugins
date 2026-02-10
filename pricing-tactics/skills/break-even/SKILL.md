---
name: break-even
description: Break-Even Calculator for discounts and price changes. Calculates the volume increase needed to compensate for a price reduction. Manual invocation only - use /pricing:break-even to analyze discount impacts.
disable-model-invocation: true
allowed-tools: Read, Bash(python *)
argument-hint: "[current_price] [contribution_margin_%] [discount_%]"
---

# Break-Even Calculator for Price Changes

Calculate how much volume must increase to maintain profitability after a price change.

## The Break-Even Formula

**For a price decrease (discount):**
```
Break-Even Volume Change % = -Price Change % / (CM% + Price Change %)
```

Where CM% = Contribution Margin Percentage

**Example:**
- Current contribution margin: 40%
- Proposed discount: 10%
- Break-even volume increase = -(-10%) / (40% + (-10%)) = 10% / 30% = 33.3%

You need 33.3% MORE volume just to maintain the same profit!

## Usage

Run the calculator script with the provided arguments:

```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/break_even.py $ARGUMENTS
```

If no arguments provided, ask the user for:
1. Current price or contribution margin %
2. Variable cost per unit (if price given)
3. Proposed price change (increase or decrease)

## The Break-Even Table

Quick reference for volume changes needed:

| Discount | 20% CM | 30% CM | 40% CM | 50% CM |
|----------|--------|--------|--------|--------|
| 5% off | +33% | +20% | +14% | +11% |
| 10% off | +100% | +50% | +33% | +25% |
| 15% off | +300% | +100% | +60% | +43% |
| 20% off | ∞ | +200% | +100% | +67% |

**Key insight:** The lower your margin, the more volume you need to compensate!

## Output Format

### Break-Even Analysis Results

**Current Situation:**
- Price: $X
- Variable Cost: $Y
- Contribution Margin: $Z (W%)

**Proposed Change:**
- New Price: $X (Y% change)
- New Contribution Margin: $Z (W%)

**Break-Even Requirement:**
- Volume must change by: **+X%**
- If current volume is Y units, need **Z units** to break even

**Probability Assessment:**
- Historical volume sensitivity: [If known]
- Market capacity for increase: [If known]
- Recommendation: [Likely achievable / Risky / Not recommended]

## Decision Framework

### When to Accept Lower Margin per Unit:

1. **Strategic reasons:**
   - Market penetration goal
   - Competitive response required
   - Volume unlocks scale economies
   - Customer lifetime value justifies

2. **Market reasons:**
   - Elastic demand (volume increase likely)
   - Capacity underutilized
   - Inventory liquidation needed

### When to Avoid Price Cuts:

1. **Economic reasons:**
   - Break-even volume increase unrealistic
   - Low elasticity (volume won't increase enough)
   - Competitors will match (no volume gain)

2. **Strategic reasons:**
   - Brand positioning concerns
   - Sets bad precedent
   - Starts price war
