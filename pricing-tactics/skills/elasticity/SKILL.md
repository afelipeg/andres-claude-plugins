---
name: elasticity
description: Price Elasticity Calculator. Calculates how quantity demanded changes with price changes. Manual invocation only - use /pricing:elasticity to calculate elasticity impacts.
disable-model-invocation: true
allowed-tools: Read, Bash(python *)
argument-hint: "[current_price] [current_volume] [new_price] [expected_volume]"
---

# Price Elasticity Calculator

Calculate price elasticity of demand and its implications for pricing decisions.

## Formula

**Price Elasticity of Demand (PED):**
```
PED = (% Change in Quantity) / (% Change in Price)
     = ((Q2 - Q1) / Q1) / ((P2 - P1) / P1)
```

**Interpretation:**
| PED Value | Classification | Meaning |
|-----------|----------------|---------|
| |PED| > 1 | Elastic | Demand is sensitive to price |
| |PED| = 1 | Unit Elastic | Proportional response |
| |PED| < 1 | Inelastic | Demand is insensitive to price |

## Usage

Run the calculator script with the provided arguments:

```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/elasticity.py $ARGUMENTS
```

If no arguments provided, ask the user for:
1. Current price (P1)
2. Current quantity/volume (Q1)
3. New/proposed price (P2)
4. Expected quantity at new price (Q2) - or estimate

## Revenue Impact Analysis

**Key Insight from Nagle & Müller:**

| Elasticity | Price Increase Effect | Price Decrease Effect |
|------------|----------------------|----------------------|
| Elastic (>1) | Revenue ↓ | Revenue ↑ |
| Unit Elastic (=1) | Revenue unchanged | Revenue unchanged |
| Inelastic (<1) | Revenue ↑ | Revenue ↓ |

## Output Format

### Elasticity Analysis Results

**Input Data:**
- Current Price: $P1
- Current Volume: Q1 units
- New Price: $P2
- Expected Volume: Q2 units

**Calculations:**
- Price Change: X%
- Volume Change: Y%
- **Price Elasticity: Z**

**Classification:** [Elastic/Unit Elastic/Inelastic]

**Revenue Impact:**
- Current Revenue: $X
- Projected Revenue: $Y
- Revenue Change: $Z (W%)

**Margin Impact:**
(If cost data provided)
- Current Margin: $X
- Projected Margin: $Y
- Profit Change: $Z (W%)

**Recommendation:**
[Based on elasticity, recommend whether to proceed with price change]

## Strategic Considerations

1. **Factors increasing elasticity:**
   - Many substitutes available
   - Price is large % of budget
   - Easy to compare prices
   - Low switching costs

2. **Factors decreasing elasticity:**
   - Few substitutes
   - Brand loyalty
   - High switching costs
   - Urgency of need
   - Product is small % of budget
