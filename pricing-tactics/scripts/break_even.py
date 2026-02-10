#!/usr/bin/env python3
"""
Break-Even Calculator for Price Changes
Part of the Pricing Tactics Plugin

Usage: python break_even.py <current_price> <variable_cost> <discount_percent>
       python break_even.py --interactive

Based on "The Strategy and Tactics of Pricing" by Nagle & Müller
"""

import sys
import json

def calculate_break_even(price: float, variable_cost: float, price_change_pct: float,
                         fixed_costs: float = 0, current_volume: float = 0) -> dict:
    """Calculate break-even volume change needed to maintain profit after price change."""

    # Current contribution margin
    current_cm = price - variable_cost
    current_cm_pct = (current_cm / price) * 100 if price > 0 else 0

    # New price after change
    new_price = price * (1 + price_change_pct / 100)
    new_cm = new_price - variable_cost
    new_cm_pct = (new_cm / new_price) * 100 if new_price > 0 else 0

    # Break-even volume change calculation
    # Formula: BE% = -Price Change% / (CM% + Price Change%)
    denominator = current_cm_pct + price_change_pct

    if denominator <= 0:
        # Mathematically impossible to break even
        be_volume_change = float('inf')
        achievable = False
        warning = "Break-even is impossible - price change exceeds contribution margin"
    else:
        be_volume_change = (-price_change_pct / denominator) * 100
        achievable = True
        warning = None

    # Calculate scenarios if volume provided
    scenarios = None
    if current_volume > 0:
        be_volume = current_volume * (1 + be_volume_change / 100) if achievable else float('inf')
        current_total_cm = current_cm * current_volume

        scenarios = {
            "current_volume": current_volume,
            "break_even_volume": round(be_volume, 0) if achievable else "Impossible",
            "volume_increase_needed": round(be_volume - current_volume, 0) if achievable else "N/A",
            "current_total_contribution": round(current_total_cm, 2)
        }

    # Generate the break-even table for reference
    be_table = generate_break_even_table(current_cm_pct)

    return {
        "inputs": {
            "current_price": price,
            "variable_cost": variable_cost,
            "price_change_percent": price_change_pct,
            "is_discount": price_change_pct < 0
        },
        "current_state": {
            "contribution_margin": round(current_cm, 2),
            "contribution_margin_percent": round(current_cm_pct, 2)
        },
        "new_state": {
            "new_price": round(new_price, 2),
            "new_contribution_margin": round(new_cm, 2),
            "new_contribution_margin_percent": round(new_cm_pct, 2)
        },
        "break_even": {
            "volume_change_percent_required": round(be_volume_change, 2) if achievable else "Impossible",
            "achievable": achievable,
            "warning": warning
        },
        "scenarios": scenarios,
        "reference_table": be_table,
        "recommendation": get_recommendation(price_change_pct, be_volume_change, achievable)
    }

def generate_break_even_table(current_cm_pct: float) -> dict:
    """Generate break-even table for common discount levels."""

    discounts = [5, 10, 15, 20, 25]
    cm_levels = [20, 30, 40, 50, 60]

    table = {}
    for discount in discounts:
        table[f"-{discount}%"] = {}
        for cm in cm_levels:
            denom = cm - discount
            if denom <= 0:
                table[f"-{discount}%"][f"{cm}% CM"] = "∞"
            else:
                be = (discount / denom) * 100
                table[f"-{discount}%"][f"{cm}% CM"] = f"+{be:.0f}%"

    return {
        "your_cm": f"{current_cm_pct:.1f}%",
        "table": table
    }

def get_recommendation(price_change: float, be_volume_change: float, achievable: bool) -> str:
    """Generate strategic recommendation."""

    if not achievable:
        return "DO NOT proceed with this price change - break-even is mathematically impossible."

    if price_change < 0:  # Discount
        if be_volume_change < 20:
            return f"Discount requires modest {be_volume_change:.0f}% volume increase. Evaluate if market can absorb."
        elif be_volume_change < 50:
            return f"Discount requires significant {be_volume_change:.0f}% volume increase. Proceed with caution."
        else:
            return f"Discount requires {be_volume_change:.0f}% volume increase - very difficult to achieve. Consider alternatives."
    else:  # Price increase
        return f"Price increase allows for {abs(be_volume_change):.0f}% volume loss before profits decline. Generally favorable."

def format_output(results: dict) -> str:
    """Format results for display."""

    output = []
    output.append("\n" + "="*60)
    output.append("BREAK-EVEN ANALYSIS FOR PRICE CHANGE")
    output.append("="*60)

    action = "Discount" if results['inputs']['is_discount'] else "Price Increase"
    output.append(f"\n📊 ANALYZING: {abs(results['inputs']['price_change_percent'])}% {action}")

    output.append("\n📈 CURRENT STATE:")
    output.append(f"   Price:               ${results['inputs']['current_price']:,.2f}")
    output.append(f"   Variable Cost:       ${results['inputs']['variable_cost']:,.2f}")
    output.append(f"   Contribution Margin: ${results['current_state']['contribution_margin']:,.2f} ({results['current_state']['contribution_margin_percent']:.1f}%)")

    output.append("\n📉 AFTER PRICE CHANGE:")
    output.append(f"   New Price:           ${results['new_state']['new_price']:,.2f}")
    output.append(f"   New CM:              ${results['new_state']['new_contribution_margin']:,.2f} ({results['new_state']['new_contribution_margin_percent']:.1f}%)")

    output.append("\n⚖️  BREAK-EVEN REQUIREMENT:")
    be = results['break_even']
    if be['achievable']:
        output.append(f"   Volume must change by: {be['volume_change_percent_required']:+.1f}%")
    else:
        output.append(f"   ⚠️  {be['warning']}")

    if results['scenarios']:
        output.append("\n📦 VOLUME SCENARIOS:")
        s = results['scenarios']
        output.append(f"   Current Volume:      {s['current_volume']:,.0f} units")
        output.append(f"   Break-Even Volume:   {s['break_even_volume']} units")
        output.append(f"   Additional Needed:   {s['volume_increase_needed']} units")

    output.append(f"\n💡 RECOMMENDATION:")
    output.append(f"   {results['recommendation']}")

    output.append("\n" + "="*60)

    return "\n".join(output)

def interactive_mode():
    """Run in interactive mode."""
    print("\n⚖️  Break-Even Calculator - Interactive Mode")
    print("-" * 50)

    try:
        price = float(input("Enter current price: $"))
        vc = float(input("Enter variable cost per unit: $"))
        change = float(input("Enter price change % (negative for discount): "))

        vol_input = input("Enter current volume (or press Enter to skip): ")
        volume = float(vol_input) if vol_input else 0

        results = calculate_break_even(price, vc, change, current_volume=volume)
        print(format_output(results))

    except ValueError as e:
        print(f"Error: Invalid input. ({e})")
        sys.exit(1)

def main():
    if len(sys.argv) == 1 or sys.argv[1] == "--interactive":
        interactive_mode()
    elif len(sys.argv) >= 4:
        try:
            price = float(sys.argv[1])
            vc = float(sys.argv[2])
            change = float(sys.argv[3])
            volume = float(sys.argv[4]) if len(sys.argv) > 4 else 0

            results = calculate_break_even(price, vc, change, current_volume=volume)
            print(format_output(results))
            print("\n📋 JSON Output:")
            print(json.dumps(results, indent=2, default=str))

        except ValueError as e:
            print(f"Error: Invalid input. ({e})")
            sys.exit(1)
    else:
        print("Usage: python break_even.py <price> <variable_cost> <price_change_%> [current_volume]")
        print("       python break_even.py --interactive")
        sys.exit(1)

if __name__ == "__main__":
    main()
