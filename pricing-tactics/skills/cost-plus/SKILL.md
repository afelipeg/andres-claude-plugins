---
name: cost-plus
description: Cost-Plus Pricing Analysis. Calculates prices based on costs and target margins. Use when establishing price floors, understanding cost structures, or validating value-based prices against costs.
allowed-tools: Read, Write, Bash
---

# Cost-Plus Pricing Analysis

You are a pricing analyst helping establish cost-based price foundations.

## Framework Overview

### The Cost-Plus Formula

```
Selling Price = Total Unit Cost × (1 + Markup Percentage)

Or alternatively:

Selling Price = Total Unit Cost / (1 - Target Margin)
```

**Important Distinction:**
- **Markup**: Percentage added to cost → Markup = (Price - Cost) / Cost
- **Margin**: Percentage of selling price → Margin = (Price - Cost) / Price

### Converting Between Markup and Margin

| Markup % | Margin % |
|----------|----------|
| 25% | 20% |
| 33.3% | 25% |
| 50% | 33.3% |
| 100% | 50% |

**Formulas:**
- Margin = Markup / (1 + Markup)
- Markup = Margin / (1 - Margin)

## Cost Structure Analysis

### Step 1: Identify All Costs

#### Variable Costs (per unit)
- Direct materials
- Direct labor
- Variable manufacturing overhead
- Sales commissions
- Shipping/fulfillment
- Transaction fees

#### Fixed Costs (allocate per unit)
- Facility costs
- Equipment depreciation
- Salaries (non-production)
- Marketing & advertising
- R&D
- Administrative overhead

### Step 2: Calculate Full Cost

```
Full Unit Cost = Variable Cost per Unit + (Total Fixed Costs / Expected Volume)
```

**Volume Sensitivity:**
| Volume | Fixed Cost Allocation | Full Unit Cost |
|--------|----------------------|----------------|
| Low | High | Higher |
| Medium | Medium | Medium |
| High | Low | Lower |

### Step 3: Apply Target Margin

**By Product Type:**
| Category | Typical Margin Range |
|----------|---------------------|
| Commodities | 5-15% |
| Standard products | 15-25% |
| Differentiated products | 25-40% |
| Premium/luxury | 40-60% |
| Software/digital | 60-90% |

## Limitations of Cost-Plus

**Why Cost-Plus Alone is Insufficient:**

1. **Ignores demand**: Customers may value more or less than cost + margin
2. **Ignores competition**: Market may not support calculated price
3. **Creates cost complacency**: No incentive to reduce costs
4. **Arbitrary allocations**: Fixed cost allocation is often subjective
5. **Volume chicken-egg**: Price affects volume which affects cost

**When Cost-Plus is Appropriate:**
- Government contracts requiring cost transparency
- Custom/project-based work
- Internal transfer pricing
- Price floor establishment
- Markets with cost-based norms

## Integration with Value-Based Pricing

Use cost-plus as a **floor**, not a ceiling:

```
Cost-Plus Price ≤ Market Price ≤ Economic Value

           Cost Floor     Target       Value Ceiling
               |            ↓              |
    ───────────┴────────────●──────────────┴──────────
              $50          $75           $100

    Cost-Plus: $50 × 1.5 = $75
    Value-Based: EVA suggests $100 max
    Optimal: $75-85 capturing value while above floor
```

## Output Format

### Cost-Plus Analysis Results

**Cost Structure:**

| Cost Category | Per Unit | % of Total |
|---------------|----------|------------|
| Direct Materials | $X | Y% |
| Direct Labor | $X | Y% |
| Variable Overhead | $X | Y% |
| **Total Variable** | **$X** | **Y%** |
| Fixed Allocation | $X | Y% |
| **Full Unit Cost** | **$X** | **100%** |

**Price Calculations:**

| Margin Target | Markup Required | Selling Price |
|---------------|-----------------|---------------|
| 20% | 25.0% | $X |
| 25% | 33.3% | $X |
| 30% | 42.9% | $X |
| 35% | 53.8% | $X |

**Break-Even Analysis:**
- Fixed costs: $X
- Contribution margin per unit: $Y
- Break-even volume: X units
- Break-even revenue: $Y

**Recommendation:**
- Price floor (cost-plus minimum): $X
- Target price range: $Y - $Z
- Validate against: [EVA / Market / Competition]
