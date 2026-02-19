#!/usr/bin/env python3
"""
Shapley Attribution
Multi-touch attribution using Shapley values from game theory.

Usage: echo '{"command":"attribute","data":{...}}' | python3 shapley_attribution.py
Commands: attribute, compare
"""

import json
import sys
from itertools import combinations


def compute_shapley(channels, coalition_conversions):
    """Calculate Shapley values for each channel."""
    n = len(channels)
    shapley_values = {ch: 0.0 for ch in channels}

    for ch in channels:
        for size in range(0, n):
            others = [c for c in channels if c != ch]
            for subset in combinations(others, size):
                subset_set = set(subset)
                with_key = "+".join(sorted(subset_set | {ch}))
                without_key = "+".join(sorted(subset_set)) if subset_set else ""

                v_with = coalition_conversions.get(with_key, 0)
                v_without = coalition_conversions.get(without_key, 0)

                marginal = v_with - v_without

                # Weight: |S|! * (n - |S| - 1)! / n!
                s = len(subset_set)
                weight = (factorial(s) * factorial(n - s - 1)) / factorial(n)
                shapley_values[ch] += weight * marginal

    return shapley_values


def factorial(n):
    if n <= 1:
        return 1
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


def attribute(data):
    """Calculate Shapley attribution from coalition data."""
    channels = data.get("channels", [])
    coalition_conversions = data.get("coalition_conversions", {})
    total_conversions = data.get("total_conversions", 0)

    if not channels:
        return {"error": "No channels provided"}

    shapley_values = compute_shapley(channels, coalition_conversions)
    shapley_total = sum(shapley_values.values())

    # Last-click shares (from solo conversions)
    solo_total = sum(coalition_conversions.get(ch, 0) for ch in channels)

    results = []
    for ch in channels:
        sv = shapley_values[ch]
        sv_pct = (sv / shapley_total * 100) if shapley_total > 0 else 0
        lc = coalition_conversions.get(ch, 0)
        lc_pct = (lc / solo_total * 100) if solo_total > 0 else 0

        diff = sv_pct - lc_pct
        if diff > 5:
            credit_status = "under-credited by last-click"
        elif diff < -5:
            credit_status = "over-credited by last-click"
        else:
            credit_status = "fairly credited"

        results.append({
            "channel": ch,
            "shapley_value": round(sv, 2),
            "shapley_share_pct": round(sv_pct, 1),
            "last_click_conversions": lc,
            "last_click_share_pct": round(lc_pct, 1),
            "difference_pct": round(diff, 1),
            "credit_status": credit_status,
        })

    results.sort(key=lambda x: x["shapley_value"], reverse=True)

    return {
        "total_conversions": total_conversions,
        "shapley_total": round(shapley_total, 2),
        "channels": results,
    }


def compare(data):
    """Compare Shapley vs last-click with spend efficiency."""
    channels = data.get("channels", [])
    results = []

    for ch in channels:
        shapley_share = ch.get("shapley_share", 0)
        last_click_share = ch.get("last_click_share", 0)
        spend = ch.get("spend", 0)

        shapley_efficiency = (shapley_share / (spend / 100000)) if spend > 0 else 0
        lc_efficiency = (last_click_share / (spend / 100000)) if spend > 0 else 0

        recommendation = ""
        diff = shapley_share - last_click_share
        if diff > 0.05:
            recommendation = "Increase budget: channel is under-credited by last-click"
        elif diff < -0.05:
            recommendation = "Investigate: channel may be over-credited by last-click"
        else:
            recommendation = "Maintain current allocation"

        results.append({
            "channel": ch["name"],
            "spend": spend,
            "shapley_share": shapley_share,
            "last_click_share": last_click_share,
            "shapley_efficiency": round(shapley_efficiency, 4),
            "last_click_efficiency": round(lc_efficiency, 4),
            "recommendation": recommendation,
        })

    return {"comparison": results}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"attribute\",\"data\":{...}}' | python3 shapley_attribution.py",
            "commands": ["attribute", "compare"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "attribute":
        result = attribute(data)
    elif cmd == "compare":
        result = compare(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: attribute, compare"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
