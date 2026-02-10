#!/usr/bin/env python3
"""
Contribution Margin and CVP Analysis Calculator
Part of the Pricing Tactics Plugin

Usage: python contribution.py <price> <variable_cost> <fixed_costs> <volume>
       python contribution.py --interactive

Based on "The Strategy and Tactics of Pricing" by Nagle & Müller
"""

import sys
import json

def calculate_contribution_analysis(price: float, variable_cost: float,
                                   fixed_costs: float, volume: float) -> dict:
    """Perform full contribution margin and CVP analysis."""

    # Unit economics
    contribution_margin = price - variable_cost
    cm_ratio = (contribution_margin / price) * 100 if price > 0 else 0

    # Break-even analysis
    break_even_units = fixed_costs / contribution_margin if contribution_margin > 0 else float('inf')
    break_even_revenue = fixed_costs / (cm_ratio / 100) if cm_ratio > 0 else float('inf')

    # Current performance
    total_revenue = price * volume
    total_variable_costs = variable_cost * volume
    total_contribution = contribution_margin * volume
    operating_profit = total_contribution - fixed_costs
    profit_margin = (operating_profit / total_revenue) * 100 if total_revenue > 0 else 0

    # Margin of safety
    if break_even_revenue != float('inf'):
        margin_of_safety = ((total_revenue - break_even_revenue) / total_revenue) * 100
        margin_of_safety_units = volume - break_even_units
    else:
        margin_of_safety = -100
        margin_of_safety_units = volume

    # Sensitivity analysis
    scenarios = generate_scenarios(price, variable_cost, fixed_costs, volume, contribution_margin)

    # Target profit analysis
    target_profits = calculate_target_profit_volumes(fixed_costs, contribution_margin,
                                                      [operating_profit * 0.5,
                                                       operating_profit * 1.5,
                                                       operating_profit * 2])

    return {
        "unit_economics": {
            "selling_price": round(price, 2),
            "variable_cost": round(variable_cost, 2),
            "contribution_margin": round(contribution_margin, 2),
            "contribution_margin_ratio": round(cm_ratio, 2)
        },
        "break_even": {
            "break_even_units": round(break_even_units, 0) if break_even_units != float('inf') else "N/A",
            "break_even_revenue": round(break_even_revenue, 2) if break_even_revenue != float('inf') else "N/A",
            "fixed_costs": round(fixed_costs, 2)
        },
        "current_performance": {
            "volume": volume,
            "total_revenue": round(total_revenue, 2),
            "total_variable_costs": round(total_variable_costs, 2),
            "total_contribution": round(total_contribution, 2),
            "fixed_costs": round(fixed_costs, 2),
            "operating_profit": round(operating_profit, 2),
            "profit_margin_percent": round(profit_margin, 2)
        },
        "margin_of_safety": {
            "percent": round(margin_of_safety, 2),
            "units_above_breakeven": round(margin_of_safety_units, 0),
            "interpretation": interpret_margin_of_safety(margin_of_safety)
        },
        "scenarios": scenarios,
        "target_profit_analysis": target_profits,
        "recommendation": get_recommendation(operating_profit, margin_of_safety, cm_ratio)
    }

def generate_scenarios(price, vc, fc, vol, cm):
    """Generate what-if scenarios."""

    base_profit = (cm * vol) - fc

    scenarios = {
        "base_case": {
            "description": "Current state",
            "profit": round(base_profit, 2)
        },
        "price_increase_5pct": {
            "description": "Price +5%",
            "new_price": round(price * 1.05, 2),
            "new_cm": round(price * 1.05 - vc, 2),
            "profit_at_same_volume": round((price * 1.05 - vc) * vol - fc, 2),
            "profit_change": round((price * 1.05 - vc) * vol - fc - base_profit, 2)
        },
        "volume_increase_10pct": {
            "description": "Volume +10%",
            "new_volume": round(vol * 1.1, 0),
            "profit": round(cm * vol * 1.1 - fc, 2),
            "profit_change": round(cm * vol * 0.1, 2)
        },
        "variable_cost_decrease_5pct": {
            "description": "Variable Cost -5%",
            "new_vc": round(vc * 0.95, 2),
            "new_cm": round(price - vc * 0.95, 2),
            "profit": round((price - vc * 0.95) * vol - fc, 2),
            "profit_change": round((price - vc * 0.95) * vol - fc - base_profit, 2)
        }
    }

    return scenarios

def calculate_target_profit_volumes(fixed_costs, cm, target_profits):
    """Calculate volumes needed for target profit levels."""

    results = {}
    for target in target_profits:
        if cm > 0:
            required_volume = (fixed_costs + target) / cm
            results[f"${target:,.0f}"] = round(required_volume, 0)
        else:
            results[f"${target:,.0f}"] = "N/A"

    return results

def interpret_margin_of_safety(mos):
    """Interpret margin of safety percentage."""

    if mos >= 50:
        return "Excellent - Very low risk"
    elif mos >= 30:
        return "Good - Moderate risk"
    elif mos >= 15:
        return "Acceptable - Some risk"
    elif mos >= 0:
        return "Concerning - High risk"
    else:
        return "Critical - Operating below break-even"

def get_recommendation(profit, mos, cm_ratio):
    """Generate strategic recommendation."""

    issues = []
    positives = []

    if profit < 0:
        issues.append("Currently operating at a loss")
    else:
        positives.append("Operating profitably")

    if mos < 15:
        issues.append("Low margin of safety indicates high risk")
    elif mos > 30:
        positives.append("Strong margin of safety provides buffer")

    if cm_ratio < 25:
        issues.append("Low contribution margin limits pricing flexibility")
    elif cm_ratio > 50:
        positives.append("High contribution margin provides leverage")

    if issues:
        return "Areas of concern: " + "; ".join(issues)
    return "Strong position: " + "; ".join(positives)

def format_output(results: dict) -> str:
    """Format results for display."""

    output = []
    output.append("\n" + "="*65)
    output.append("CONTRIBUTION MARGIN & CVP ANALYSIS")
    output.append("="*65)

    ue = results["unit_economics"]
    output.append("\n📊 UNIT ECONOMICS:")
    output.append(f"   Selling Price:        ${ue['selling_price']:>12,.2f}")
    output.append(f"   Variable Cost:        ${ue['variable_cost']:>12,.2f}")
    output.append(f"   Contribution Margin:  ${ue['contribution_margin']:>12,.2f}")
    output.append(f"   CM Ratio:             {ue['contribution_margin_ratio']:>12.1f}%")

    be = results["break_even"]
    output.append("\n⚖️  BREAK-EVEN ANALYSIS:")
    output.append(f"   Fixed Costs:          ${be['fixed_costs']:>12,.2f}")
    output.append(f"   Break-Even Units:     {be['break_even_units']:>12,}")
    output.append(f"   Break-Even Revenue:   ${be['break_even_revenue']:>12,.2f}")

    cp = results["current_performance"]
    output.append("\n📈 CURRENT PERFORMANCE:")
    output.append(f"   Volume:               {cp['volume']:>12,.0f} units")
    output.append(f"   Total Revenue:        ${cp['total_revenue']:>12,.2f}")
    output.append(f"   Total Variable Costs: ${cp['total_variable_costs']:>12,.2f}")
    output.append(f"   Total Contribution:   ${cp['total_contribution']:>12,.2f}")
    output.append(f"   Fixed Costs:          ${cp['fixed_costs']:>12,.2f}")
    output.append(f"   ─────────────────────────────────────")
    output.append(f"   Operating Profit:     ${cp['operating_profit']:>12,.2f}")
    output.append(f"   Profit Margin:        {cp['profit_margin_percent']:>12.1f}%")

    mos = results["margin_of_safety"]
    output.append("\n🛡️  MARGIN OF SAFETY:")
    output.append(f"   Margin of Safety:     {mos['percent']:>12.1f}%")
    output.append(f"   Units Above BE:       {mos['units_above_breakeven']:>12,.0f}")
    output.append(f"   Assessment:           {mos['interpretation']}")

    output.append("\n📊 SCENARIO ANALYSIS:")
    for key, scenario in results["scenarios"].items():
        if key != "base_case" and "profit_change" in scenario:
            change = scenario["profit_change"]
            sign = "+" if change > 0 else ""
            output.append(f"   {scenario['description']}: {sign}${change:,.2f} impact")

    output.append(f"\n💡 RECOMMENDATION:")
    output.append(f"   {results['recommendation']}")

    output.append("\n" + "="*65)

    return "\n".join(output)

def interactive_mode():
    """Run in interactive mode."""
    print("\n📊 Contribution Margin Calculator - Interactive Mode")
    print("-" * 55)

    try:
        price = float(input("Enter selling price per unit: $"))
        vc = float(input("Enter variable cost per unit: $"))
        fc = float(input("Enter total fixed costs: $"))
        vol = float(input("Enter current/expected volume (units): "))

        results = calculate_contribution_analysis(price, vc, fc, vol)
        print(format_output(results))

    except ValueError as e:
        print(f"Error: Invalid input. ({e})")

def main():
    if len(sys.argv) == 1 or sys.argv[1] == "--interactive":
        interactive_mode()
    elif len(sys.argv) == 5:
        try:
            price = float(sys.argv[1])
            vc = float(sys.argv[2])
            fc = float(sys.argv[3])
            vol = float(sys.argv[4])

            results = calculate_contribution_analysis(price, vc, fc, vol)
            print(format_output(results))
            print("\n📋 JSON Output:")
            print(json.dumps(results, indent=2, default=str))

        except ValueError as e:
            print(f"Error: Invalid input. ({e})")
            sys.exit(1)
    else:
        print("Usage: python contribution.py <price> <variable_cost> <fixed_costs> <volume>")
        print("       python contribution.py --interactive")
        sys.exit(1)

if __name__ == "__main__":
    main()
