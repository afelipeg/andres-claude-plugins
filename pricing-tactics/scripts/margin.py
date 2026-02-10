#!/usr/bin/env python3
"""
Margin and Markup Calculator
Part of the Pricing Tactics Plugin

Usage: python margin.py <cost> <price>
       python margin.py --from-margin <cost> <target_margin_%>
       python margin.py --from-markup <cost> <target_markup_%>
       python margin.py --interactive

Based on "The Strategy and Tactics of Pricing" by Nagle & Müller
"""

import sys
import json

def calculate_from_cost_price(cost: float, price: float) -> dict:
    """Calculate margin and markup given cost and price."""

    if price <= 0:
        return {"error": "Price must be greater than zero"}

    gross_profit = price - cost
    margin_pct = (gross_profit / price) * 100
    markup_pct = (gross_profit / cost) * 100 if cost > 0 else float('inf')
    multiplier = price / cost if cost > 0 else float('inf')

    return {
        "mode": "from_cost_and_price",
        "inputs": {
            "cost": cost,
            "price": price
        },
        "results": {
            "gross_profit": round(gross_profit, 2),
            "margin_percent": round(margin_pct, 2),
            "markup_percent": round(markup_pct, 2),
            "multiplier": round(multiplier, 3)
        },
        "formulas": {
            "margin": "Margin = (Price - Cost) / Price",
            "markup": "Markup = (Price - Cost) / Cost"
        }
    }

def calculate_from_margin(cost: float, target_margin: float) -> dict:
    """Calculate price given cost and target margin."""

    if target_margin >= 100:
        return {"error": "Margin must be less than 100%"}

    price = cost / (1 - target_margin / 100)
    gross_profit = price - cost
    markup_pct = (gross_profit / cost) * 100 if cost > 0 else float('inf')
    multiplier = price / cost if cost > 0 else float('inf')

    return {
        "mode": "from_target_margin",
        "inputs": {
            "cost": cost,
            "target_margin_percent": target_margin
        },
        "results": {
            "required_price": round(price, 2),
            "gross_profit": round(gross_profit, 2),
            "equivalent_markup_percent": round(markup_pct, 2),
            "multiplier": round(multiplier, 3)
        },
        "formula": "Price = Cost / (1 - Margin%)"
    }

def calculate_from_markup(cost: float, target_markup: float) -> dict:
    """Calculate price given cost and target markup."""

    price = cost * (1 + target_markup / 100)
    gross_profit = price - cost
    margin_pct = (gross_profit / price) * 100 if price > 0 else 0
    multiplier = price / cost if cost > 0 else float('inf')

    return {
        "mode": "from_target_markup",
        "inputs": {
            "cost": cost,
            "target_markup_percent": target_markup
        },
        "results": {
            "required_price": round(price, 2),
            "gross_profit": round(gross_profit, 2),
            "equivalent_margin_percent": round(margin_pct, 2),
            "multiplier": round(multiplier, 3)
        },
        "formula": "Price = Cost × (1 + Markup%)"
    }

def generate_conversion_table() -> dict:
    """Generate margin-markup conversion reference table."""

    conversions = [
        (10, 9.09), (15, 13.04), (20, 16.67), (25, 20.00),
        (30, 23.08), (33.33, 25.00), (40, 28.57), (50, 33.33),
        (60, 37.50), (75, 42.86), (100, 50.00), (150, 60.00),
        (200, 66.67), (300, 75.00)
    ]

    return {
        "header": ["Markup %", "Margin %", "Multiplier"],
        "rows": [[m, round(m/(1+m/100), 2), round(1+m/100, 2)] for m, _ in conversions]
    }

def get_industry_benchmarks() -> dict:
    """Return typical margins by industry."""

    return {
        "Grocery Retail": "25-30%",
        "Apparel Retail": "45-55%",
        "Software (Perpetual)": "75-85%",
        "SaaS": "70-80%",
        "Professional Services": "30-50%",
        "Manufacturing": "25-35%",
        "Luxury Goods": "60-70%",
        "Electronics Retail": "15-25%",
        "Restaurants": "60-70%",
        "Pharmaceuticals": "70-80%"
    }

def format_output(results: dict) -> str:
    """Format results for display."""

    if "error" in results:
        return f"\n❌ Error: {results['error']}"

    output = []
    output.append("\n" + "="*60)
    output.append("MARGIN & MARKUP ANALYSIS")
    output.append("="*60)

    mode = results.get("mode", "")

    if mode == "from_cost_and_price":
        output.append("\n📊 INPUT:")
        output.append(f"   Cost:  ${results['inputs']['cost']:,.2f}")
        output.append(f"   Price: ${results['inputs']['price']:,.2f}")

        output.append("\n📈 RESULTS:")
        output.append(f"   Gross Profit: ${results['results']['gross_profit']:,.2f}")
        output.append(f"   Margin:       {results['results']['margin_percent']:.2f}%")
        output.append(f"   Markup:       {results['results']['markup_percent']:.2f}%")
        output.append(f"   Multiplier:   {results['results']['multiplier']:.3f}x")

    elif mode == "from_target_margin":
        output.append("\n📊 INPUT:")
        output.append(f"   Cost:          ${results['inputs']['cost']:,.2f}")
        output.append(f"   Target Margin: {results['inputs']['target_margin_percent']}%")

        output.append("\n📈 RESULTS:")
        output.append(f"   Required Price:    ${results['results']['required_price']:,.2f}")
        output.append(f"   Gross Profit:      ${results['results']['gross_profit']:,.2f}")
        output.append(f"   Equivalent Markup: {results['results']['equivalent_markup_percent']:.2f}%")

    elif mode == "from_target_markup":
        output.append("\n📊 INPUT:")
        output.append(f"   Cost:          ${results['inputs']['cost']:,.2f}")
        output.append(f"   Target Markup: {results['inputs']['target_markup_percent']}%")

        output.append("\n📈 RESULTS:")
        output.append(f"   Required Price:    ${results['results']['required_price']:,.2f}")
        output.append(f"   Gross Profit:      ${results['results']['gross_profit']:,.2f}")
        output.append(f"   Equivalent Margin: {results['results']['equivalent_margin_percent']:.2f}%")

    output.append("\n📋 CONVERSION REFERENCE:")
    output.append("   Markup% → Margin%")
    for markup, margin in [(25, 20), (50, 33.3), (100, 50), (200, 66.7)]:
        output.append(f"   {markup}% markup = {margin}% margin")

    output.append("\n" + "="*60)

    return "\n".join(output)

def interactive_mode():
    """Run in interactive mode."""
    print("\n💰 Margin Calculator - Interactive Mode")
    print("-" * 50)
    print("Options:")
    print("1. Calculate from Cost and Price")
    print("2. Calculate Price from Target Margin")
    print("3. Calculate Price from Target Markup")

    choice = input("\nSelect option (1-3): ")

    try:
        if choice == "1":
            cost = float(input("Enter cost: $"))
            price = float(input("Enter price: $"))
            results = calculate_from_cost_price(cost, price)
        elif choice == "2":
            cost = float(input("Enter cost: $"))
            margin = float(input("Enter target margin %: "))
            results = calculate_from_margin(cost, margin)
        elif choice == "3":
            cost = float(input("Enter cost: $"))
            markup = float(input("Enter target markup %: "))
            results = calculate_from_markup(cost, markup)
        else:
            print("Invalid option")
            return

        print(format_output(results))

    except ValueError as e:
        print(f"Error: Invalid input. ({e})")

def main():
    if len(sys.argv) == 1 or sys.argv[1] == "--interactive":
        interactive_mode()
    elif sys.argv[1] == "--from-margin" and len(sys.argv) == 4:
        cost = float(sys.argv[2])
        margin = float(sys.argv[3])
        results = calculate_from_margin(cost, margin)
        print(format_output(results))
        print("\n📋 JSON Output:")
        print(json.dumps(results, indent=2))
    elif sys.argv[1] == "--from-markup" and len(sys.argv) == 4:
        cost = float(sys.argv[2])
        markup = float(sys.argv[3])
        results = calculate_from_markup(cost, markup)
        print(format_output(results))
        print("\n📋 JSON Output:")
        print(json.dumps(results, indent=2))
    elif len(sys.argv) == 3:
        cost = float(sys.argv[1])
        price = float(sys.argv[2])
        results = calculate_from_cost_price(cost, price)
        print(format_output(results))
        print("\n📋 JSON Output:")
        print(json.dumps(results, indent=2))
    else:
        print("Usage:")
        print("  python margin.py <cost> <price>")
        print("  python margin.py --from-margin <cost> <target_margin_%>")
        print("  python margin.py --from-markup <cost> <target_markup_%>")
        print("  python margin.py --interactive")
        sys.exit(1)

if __name__ == "__main__":
    main()
