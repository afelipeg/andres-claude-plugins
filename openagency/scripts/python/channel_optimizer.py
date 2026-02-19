#!/usr/bin/env python3
"""
Channel Optimizer
Budget optimization using Hill saturation curves with greedy marginal allocation.

Usage: echo '{"command":"optimize","data":{...}}' | python3 channel_optimizer.py
Commands: optimize, scenario
"""

import json
import sys


def hill_response(spend, max_response, alpha, ec50):
    """Hill saturation curve: response = max * (spend^a / (spend^a + ec50^a))"""
    if spend <= 0:
        return 0.0
    s_a = spend ** alpha
    e_a = ec50 ** alpha
    return max_response * (s_a / (s_a + e_a))


def marginal_response(spend, max_response, alpha, ec50, delta=1000):
    """Marginal response for an additional delta of spend."""
    r1 = hill_response(spend, max_response, alpha, ec50)
    r2 = hill_response(spend + delta, max_response, alpha, ec50)
    return (r2 - r1) / delta


CHANNEL_DEFAULTS = {
    "search": {"alpha": 2.5, "ec50_ratio": 0.4, "max_mult": 6.0},
    "social_meta": {"alpha": 1.8, "ec50_ratio": 0.5, "max_mult": 4.0},
    "social_tiktok": {"alpha": 1.6, "ec50_ratio": 0.45, "max_mult": 3.5},
    "programmatic_display": {"alpha": 1.2, "ec50_ratio": 0.6, "max_mult": 2.5},
    "programmatic_video": {"alpha": 1.5, "ec50_ratio": 0.55, "max_mult": 3.0},
    "native": {"alpha": 1.3, "ec50_ratio": 0.5, "max_mult": 2.0},
    "linkedin": {"alpha": 1.4, "ec50_ratio": 0.5, "max_mult": 3.0},
}


def optimize(data):
    """Greedy marginal allocation optimization."""
    total_budget = data["total_budget"]
    channels = data["channels"]
    step = data.get("step_size", total_budget / 100)

    allocation = {}
    for ch in channels:
        name = ch["name"]
        spend = ch.get("spend", 0)
        defaults = CHANNEL_DEFAULTS.get(name, {"alpha": 1.5, "ec50_ratio": 0.5, "max_mult": 3.0})
        min_spend = ch.get("min_spend", 0)
        allocation[name] = {
            "spend": min_spend,
            "max_response": ch.get("max_response", max(spend, total_budget / len(channels)) * defaults["max_mult"]),
            "alpha": ch.get("alpha", defaults["alpha"]),
            "ec50": ch.get("ec50", max(spend, total_budget / len(channels)) * defaults["ec50_ratio"]),
            "min_spend": min_spend,
            "max_spend": ch.get("max_spend", total_budget),
        }

    allocated = sum(a["spend"] for a in allocation.values())
    remaining = total_budget - allocated

    while remaining >= step:
        best_channel = None
        best_marginal = -1

        for name, a in allocation.items():
            if a["spend"] >= a["max_spend"]:
                continue
            mr = marginal_response(a["spend"], a["max_response"],
                                   a["alpha"], a["ec50"], step)
            if mr > best_marginal:
                best_marginal = mr
                best_channel = name

        if best_channel is None:
            break

        allocation[best_channel]["spend"] += step
        remaining -= step

    results = []
    total_response = 0
    for name, a in allocation.items():
        response = hill_response(a["spend"], a["max_response"],
                                 a["alpha"], a["ec50"])
        mr = marginal_response(a["spend"], a["max_response"],
                               a["alpha"], a["ec50"], step)
        total_response += response
        results.append({
            "channel": name,
            "spend": round(a["spend"], 2),
            "spend_pct": round(a["spend"] / total_budget * 100, 1),
            "expected_response": round(response, 4),
            "marginal_roi": round(mr, 6),
            "saturation_pct": round(
                response / a["max_response"] * 100, 1
            ) if a["max_response"] > 0 else 0,
        })

    results.sort(key=lambda x: x["spend"], reverse=True)

    return {
        "total_budget": total_budget,
        "total_allocated": round(total_budget - remaining, 2),
        "total_expected_response": round(total_response, 4),
        "channels": results,
    }


def scenario_analysis(data):
    """Run optimization at multiple budget levels."""
    base_budget = data["total_budget"]
    channels = data["channels"]
    multipliers = data.get("multipliers", [0.8, 1.0, 1.2, 1.5])
    labels = data.get("labels", ["-20%", "Current", "+20%", "+50%"])

    scenarios = []
    for i, mult in enumerate(multipliers):
        scenario_data = {
            "total_budget": base_budget * mult,
            "channels": channels,
        }
        result = optimize(scenario_data)
        label = labels[i] if i < len(labels) else f"{mult}x"
        scenarios.append({
            "label": label,
            "budget": round(base_budget * mult, 2),
            "result": result,
        })

    return {"scenarios": scenarios}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"optimize\",\"data\":{...}}' | python3 channel_optimizer.py",
            "commands": {
                "optimize": {
                    "description": "Greedy marginal allocation",
                    "input": {
                        "total_budget": 1000000,
                        "channels": [{"name": "search",
                                      "max_response": 5000,
                                      "alpha": 0.7, "ec50": 200000,
                                      "min_spend": 50000,
                                      "max_spend": 500000}]
                    }
                },
                "scenario": {
                    "description": "Multi-budget scenario analysis",
                    "input": {
                        "total_budget": 1000000,
                        "channels": ["..."],
                        "multipliers": [0.8, 1.0, 1.2, 1.5]
                    }
                }
            }
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "optimize":
        result = optimize(data)
    elif cmd == "scenario":
        result = scenario_analysis(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: optimize, scenario"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
