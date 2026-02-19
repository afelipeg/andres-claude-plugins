#!/usr/bin/env python3
"""
Media Quality Scorer
Composite quality scoring across IVT/fraud, viewability, brand safety, MFA.
Quality waste quantification per channel.

Usage: echo '{"command":"score","data":{...}}' | python3 media_quality_score.py
Commands: score
"""

import json
import sys

QUALITY_BENCHMARKS = {
    "programmatic_display": {"ivt": 10, "viewability": 52, "brand_safety": 97, "mfa": 15},
    "programmatic_video": {"ivt": 8, "viewability": 65, "brand_safety": 96, "mfa": 8},
    "social_meta": {"ivt": 3, "viewability": 75, "brand_safety": 98, "mfa": 2},
    "social_paid": {"ivt": 3, "viewability": 75, "brand_safety": 98, "mfa": 2},
    "social_tiktok": {"ivt": 5, "viewability": 70, "brand_safety": 95, "mfa": 5},
    "search": {"ivt": 2, "viewability": 100, "brand_safety": 99, "mfa": 1},
    "native": {"ivt": 12, "viewability": 45, "brand_safety": 94, "mfa": 20},
    "linkedin": {"ivt": 3, "viewability": 60, "brand_safety": 98, "mfa": 2},
}

WEIGHTS = {"fraud": 0.30, "viewability": 0.30, "brand_safety": 0.20, "mfa": 0.20}


def score_dimension(actual, benchmark, dimension):
    """Score a quality dimension 0-100."""
    if dimension == "fraud":
        # Lower is better for fraud
        if actual <= 2:
            return 100
        elif actual >= 20:
            return 0
        else:
            return max(0, round(100 - (actual / 20 * 100)))
    elif dimension == "viewability":
        # Higher is better
        if actual >= 90:
            return 100
        elif actual <= 20:
            return 0
        else:
            return max(0, round((actual - 20) / 70 * 100))
    elif dimension == "brand_safety":
        # Higher is better (percentage safe)
        if actual >= 99:
            return 100
        elif actual <= 80:
            return 0
        else:
            return max(0, round((actual - 80) / 19 * 100))
    elif dimension == "mfa":
        # Lower is better
        if actual <= 1:
            return 100
        elif actual >= 25:
            return 0
        else:
            return max(0, round(100 - (actual / 25 * 100)))
    return 50


def score(data):
    """Score media quality across all channels."""
    channels = data.get("channels", [])
    results = []

    for ch in channels:
        ch_name = ch["name"]
        spend = ch.get("spend", 0)
        benchmark = QUALITY_BENCHMARKS.get(ch_name, QUALITY_BENCHMARKS.get("programmatic_display"))

        # Determine data source
        has_actual = any(k in ch for k in ["ivt_rate_pct", "viewability_pct",
                                            "brand_safety_incidents", "mfa_rate_pct"])

        # Get actual or benchmark values
        ivt = ch.get("ivt_rate_pct", benchmark["ivt"])
        viewability = ch.get("viewability_pct", benchmark["viewability"])

        if "brand_safety_incidents" in ch and "brand_safety_impressions" in ch:
            bs_rate = (1 - ch["brand_safety_incidents"] / ch["brand_safety_impressions"]) * 100
        else:
            bs_rate = benchmark["brand_safety"]

        mfa = ch.get("mfa_rate_pct", benchmark["mfa"])

        # Score each dimension
        fraud_score = score_dimension(ivt, benchmark["ivt"], "fraud")
        view_score = score_dimension(viewability, benchmark["viewability"], "viewability")
        bs_score = score_dimension(bs_rate, benchmark["brand_safety"], "brand_safety")
        mfa_score = score_dimension(mfa, benchmark["mfa"], "mfa")

        # Composite weighted score
        composite = round(
            fraud_score * WEIGHTS["fraud"] +
            view_score * WEIGHTS["viewability"] +
            bs_score * WEIGHTS["brand_safety"] +
            mfa_score * WEIGHTS["mfa"]
        )

        # Effective quality rate (multiplicative)
        fraud_pass = (100 - ivt) / 100
        view_pass = viewability / 100
        bs_pass = bs_rate / 100
        mfa_pass = (100 - mfa) / 100
        effective_rate = fraud_pass * view_pass * bs_pass * mfa_pass

        # Quality waste
        quality_waste = spend * (1 - effective_rate)

        # Remediation actions
        remediation = []
        if ivt > 5:
            savings = spend * (ivt - 5) / 100
            remediation.append({
                "dimension": "fraud",
                "action": f"Implement pre-bid IVT filtering to reduce from {ivt}% to 5%",
                "estimated_savings": round(savings, 2),
                "timeline": "1-2 months",
                "priority": "high" if ivt > 10 else "medium",
            })
        if viewability < 60:
            savings = spend * (60 - viewability) / 100 * 0.5
            remediation.append({
                "dimension": "viewability",
                "action": f"Add viewability targeting to improve from {viewability}% to 60%+",
                "estimated_savings": round(savings, 2),
                "timeline": "immediate",
                "priority": "high" if viewability < 40 else "medium",
            })
        if bs_rate < 95:
            savings = spend * (95 - bs_rate) / 100
            remediation.append({
                "dimension": "brand_safety",
                "action": f"Update brand safety block lists and enable contextual targeting",
                "estimated_savings": round(savings, 2),
                "timeline": "1-2 weeks",
                "priority": "high" if bs_rate < 90 else "medium",
            })
        if mfa > 10:
            savings = spend * (mfa - 10) / 100
            remediation.append({
                "dimension": "mfa",
                "action": f"Block MFA domains. Reduce from {mfa}% to <10%",
                "estimated_savings": round(savings, 2),
                "timeline": "1-2 weeks",
                "priority": "high" if mfa > 15 else "medium",
            })

        remediation.sort(key=lambda x: x["estimated_savings"], reverse=True)

        results.append({
            "channel": ch_name,
            "spend": spend,
            "data_source": "actual" if has_actual else "benchmark_estimate",
            "dimensions": {
                "fraud": {"rate_pct": ivt, "score": fraud_score},
                "viewability": {"rate_pct": viewability, "score": view_score},
                "brand_safety": {"rate_pct": round(bs_rate, 1), "score": bs_score},
                "mfa": {"rate_pct": mfa, "score": mfa_score},
            },
            "composite_score": composite,
            "effective_quality_rate": round(effective_rate, 4),
            "quality_waste_dollars": round(quality_waste, 2),
            "remediation_actions": remediation,
        })

    total_spend = sum(r["spend"] for r in results)
    total_waste = sum(r["quality_waste_dollars"] for r in results)
    avg_composite = round(sum(r["composite_score"] for r in results) / len(results)) if results else 0

    return {
        "channels": results,
        "summary": {
            "total_spend": total_spend,
            "total_quality_waste": round(total_waste, 2),
            "quality_waste_pct": round(total_waste / total_spend * 100, 1) if total_spend > 0 else 0,
            "average_composite_score": avg_composite,
        },
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"score\",\"data\":{...}}' | python3 media_quality_score.py",
            "commands": ["score"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "score":
        result = score(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: score"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
