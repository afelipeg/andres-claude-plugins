#!/usr/bin/env python3
"""
Price Elasticity Calculator
Part of the Pricing Tactics Plugin

Usage: python elasticity.py <current_price> <current_volume> <new_price> <expected_volume>
       python elasticity.py --interactive

Based on "The Strategy and Tactics of Pricing" by Nagle & Müller
"""

import sys
import json

def calculate_elasticity(p1: float, q1: float, p2: float, q2: float) -> dict:
    """Calculate price elasticity of demand and related metrics."""

    # Calculate percentage changes
    price_change_pct = ((p2 - p1) / p1) * 100
    volume_change_pct = ((q2 - q1) / q1) * 100

    # Calculate elasticity (handle division by zero)
    if price_change_pct == 0:
        elasticity = 0
    else:
        elasticity = volume_change_pct / price_change_pct

    # Classify elasticity
    abs_elasticity = abs(elasticity)
    if abs_elasticity > 1:
        classification = "Elastic"
        description = "Demand is sensitive to price changes"
    elif abs_elasticity == 1:
        classification = "Unit Elastic"
        description = "Demand changes proportionally with price"
    else:
        classification = "Inelastic"
        description = "Demand is relatively insensitive to price changes"

    # Calculate revenue impact
    current_revenue = p1 * q1
    projected_revenue = p2 * q2
    revenue_change = projected_revenue - current_revenue
    revenue_change_pct = (revenue_change / current_revenue) * 100 if current_revenue > 0 else 0

    return {
        "inputs": {
            "current_price": p1,
            "current_volume": q1,
            "new_price": p2,
            "expected_volume": q2
        },
        "calculations": {
            "price_change_percent": round(price_change_pct, 2),
            "volume_change_percent": round(volume_change_pct, 2),
            "elasticity": round(elasticity, 3),
            "absolute_elasticity": round(abs_elasticity, 3)
        },
        "classification": classification,
        "description": description,
        "revenue_impact": {
            "current_revenue": round(current_revenue, 2),
            "projected_revenue": round(projected_revenue, 2),
            "revenue_change": round(revenue_change, 2),
            "revenue_change_percent": round(revenue_change_pct, 2)
        },
        "recommendation": get_recommendation(elasticity, price_change_pct, revenue_change_pct)
    }

def get_recommendation(elasticity: float, price_change: float, revenue_change: float) -> str:
    """Generate strategic recommendation based on elasticity analysis."""

    if price_change > 0:  # Price increase
        if revenue_change > 0:
            return "Price increase is favorable - revenue increases despite volume loss."
        else:
            return "Price increase reduces revenue. Consider if strategic goals justify this."
    else:  # Price decrease
        if revenue_change > 0:
            return "Price decrease is favorable - volume gain more than compensates."
        else:
            return "Price decrease reduces revenue. Volume increase insufficient to compensate."

def format_output(results: dict) -> str:
    """Format results for display."""

    output = []
    output.append("\n" + "="*60)
    output.append("PRICE ELASTICITY ANALYSIS")
    output.append("="*60)

    output.append("\n📊 INPUT DATA:")
    output.append(f"   Current Price:    ${results['inputs']['current_price']:,.2f}")
    output.append(f"   Current Volume:   {results['inputs']['current_volume']:,.0f} units")
    output.append(f"   New Price:        ${results['inputs']['new_price']:,.2f}")
    output.append(f"   Expected Volume:  {results['inputs']['expected_volume']:,.0f} units")

    output.append("\n📈 CALCULATIONS:")
    output.append(f"   Price Change:     {results['calculations']['price_change_percent']:+.2f}%")
    output.append(f"   Volume Change:    {results['calculations']['volume_change_percent']:+.2f}%")
    output.append(f"   Elasticity:       {results['calculations']['elasticity']:.3f}")

    output.append(f"\n🏷️  CLASSIFICATION: {results['classification']}")
    output.append(f"   {results['description']}")

    output.append("\n💰 REVENUE IMPACT:")
    output.append(f"   Current Revenue:    ${results['revenue_impact']['current_revenue']:,.2f}")
    output.append(f"   Projected Revenue:  ${results['revenue_impact']['projected_revenue']:,.2f}")
    output.append(f"   Change:             ${results['revenue_impact']['revenue_change']:+,.2f} ({results['revenue_impact']['revenue_change_percent']:+.2f}%)")

    output.append(f"\n💡 RECOMMENDATION:")
    output.append(f"   {results['recommendation']}")

    output.append("\n" + "="*60)

    return "\n".join(output)

def interactive_mode():
    """Run in interactive mode, prompting for inputs."""
    print("\n🔢 Price Elasticity Calculator - Interactive Mode")
    print("-" * 50)

    try:
        p1 = float(input("Enter current price: $"))
        q1 = float(input("Enter current volume (units): "))
        p2 = float(input("Enter new/proposed price: $"))
        q2 = float(input("Enter expected volume at new price: "))

        results = calculate_elasticity(p1, q1, p2, q2)
        print(format_output(results))

    except ValueError as e:
        print(f"Error: Invalid input. Please enter numeric values. ({e})")
        sys.exit(1)

def main():
    if len(sys.argv) == 1 or sys.argv[1] == "--interactive":
        interactive_mode()
    elif len(sys.argv) == 5:
        try:
            p1 = float(sys.argv[1])
            q1 = float(sys.argv[2])
            p2 = float(sys.argv[3])
            q2 = float(sys.argv[4])

            results = calculate_elasticity(p1, q1, p2, q2)
            print(format_output(results))

            # Also output JSON for programmatic use
            print("\n📋 JSON Output:")
            print(json.dumps(results, indent=2))

        except ValueError as e:
            print(f"Error: Invalid input. Please provide numeric values. ({e})")
            sys.exit(1)
    else:
        print("Usage: python elasticity.py <current_price> <current_volume> <new_price> <expected_volume>")
        print("       python elasticity.py --interactive")
        sys.exit(1)

if __name__ == "__main__":
    main()
