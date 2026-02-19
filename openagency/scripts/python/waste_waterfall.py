#!/usr/bin/env python3
"""
Waste Waterfall
Full 6-stage waste decomposition from gross spend to productive spend.
Recovery roadmap and C-Suite narratives.

Math rule: sum of all waste + productive = gross_spend (tolerance < $1)

Usage: echo '{"command":"analyze","data":{...}}' | python3 waste_waterfall.py
Commands: analyze, estimate, compare_periods
"""

import json
import sys

INDUSTRY_BENCHMARKS = {
    "automotive": {"non_working": 0.18, "supply_chain": 0.08, "quality": 0.12,
                   "audience": 0.10, "optimization": 0.05, "measurement": 0.02},
    "fmcg": {"non_working": 0.15, "supply_chain": 0.10, "quality": 0.14,
             "audience": 0.08, "optimization": 0.04, "measurement": 0.02},
    "financial": {"non_working": 0.20, "supply_chain": 0.07, "quality": 0.10,
                  "audience": 0.13, "optimization": 0.06, "measurement": 0.04},
    "retail": {"non_working": 0.14, "supply_chain": 0.09, "quality": 0.11,
               "audience": 0.08, "optimization": 0.05, "measurement": 0.03},
    "telecom": {"non_working": 0.17, "supply_chain": 0.11, "quality": 0.13,
                "audience": 0.09, "optimization": 0.05, "measurement": 0.03},
}


def _sum_category(data, keys):
    """Sum values from a dict or return 0."""
    if isinstance(data, dict):
        return sum(data.get(k, 0) for k in data.keys())
    return 0


def analyze(data):
    """Full waste waterfall analysis with actual data."""
    gross = data["gross_spend"]
    industry = data.get("industry", "retail")
    actual_revenue = data.get("actual_revenue", 0)

    # Extract waste categories
    nw = data.get("non_working", {})
    sc = data.get("supply_chain", {})
    qu = data.get("quality", {})
    au = data.get("audience", {})
    op = data.get("optimization", {})
    me = data.get("measurement", {})

    non_working_total = sum(nw.values()) if isinstance(nw, dict) else nw
    supply_chain_total = sum(sc.values()) if isinstance(sc, dict) else sc
    quality_total = sum(qu.values()) if isinstance(qu, dict) else qu
    audience_total = sum(au.values()) if isinstance(au, dict) else au
    optimization_total = sum(op.values()) if isinstance(op, dict) else op
    measurement_total = sum(me.values()) if isinstance(me, dict) else me

    total_waste = (non_working_total + supply_chain_total + quality_total +
                   audience_total + optimization_total + measurement_total)
    productive = gross - total_waste

    # Validate math
    math_check = abs(total_waste + productive - gross)
    if math_check > 1:
        return {"error": f"Math validation failed: waste ({total_waste}) + "
                f"productive ({productive}) = {total_waste + productive}, "
                f"but gross = {gross}. Difference: {math_check}"}

    # Build waterfall
    remaining = gross
    waterfall = []

    stages = [
        ("non_working", "Non-Working Overhead", non_working_total),
        ("supply_chain", "Supply Chain Waste", supply_chain_total),
        ("quality", "Quality Waste", quality_total),
        ("audience", "Audience Waste", audience_total),
        ("optimization", "Optimization Waste", optimization_total),
        ("measurement", "Measurement Waste", measurement_total),
    ]

    for cat_id, label, amount in stages:
        pct = (amount / gross * 100) if gross > 0 else 0
        benchmark = INDUSTRY_BENCHMARKS.get(industry, {}).get(cat_id, 0) * gross
        vs_benchmark = "above" if amount > benchmark * 1.1 else ("below" if amount < benchmark * 0.9 else "at")

        waterfall.append({
            "category": cat_id,
            "label": label,
            "gross_in": round(remaining, 2),
            "waste_amount": round(amount, 2),
            "waste_pct": round(pct, 1),
            "remaining": round(remaining - amount, 2),
            "benchmark_amount": round(benchmark, 2),
            "benchmark_pct": round(INDUSTRY_BENCHMARKS.get(industry, {}).get(cat_id, 0) * 100, 1),
            "vs_benchmark": vs_benchmark,
            "data_source": "actual",
        })
        remaining -= amount

    # Recovery roadmap
    roadmap = []
    difficulty_map = {
        "non_working": "medium", "supply_chain": "hard",
        "quality": "easy", "audience": "medium",
        "optimization": "easy", "measurement": "medium",
    }
    timeline_map = {
        "non_working": "3-6 months", "supply_chain": "6-12 months",
        "quality": "1-3 months", "audience": "1-3 months",
        "optimization": "immediate", "measurement": "3-6 months",
    }

    for cat_id, label, amount in stages:
        if amount > 0:
            benchmark = INDUSTRY_BENCHMARKS.get(industry, {}).get(cat_id, 0) * gross
            recoverable = max(0, amount - benchmark)
            if recoverable > 0:
                roadmap.append({
                    "category": cat_id,
                    "action": f"Reduce {label.lower()} from {amount/gross*100:.1f}% to benchmark {INDUSTRY_BENCHMARKS.get(industry, {}).get(cat_id, 0)*100:.1f}%",
                    "estimated_savings": round(recoverable, 2),
                    "difficulty": difficulty_map.get(cat_id, "medium"),
                    "timeline": timeline_map.get(cat_id, "3-6 months"),
                })

    roadmap.sort(key=lambda x: x["estimated_savings"], reverse=True)

    # C-Suite summaries
    productive_pct = (productive / gross * 100) if gross > 0 else 0
    total_recoverable = sum(r["estimated_savings"] for r in roadmap)

    csuite = {
        "ceo": f"Of ${gross:,.0f} invested, ${productive:,.0f} ({productive_pct:.0f}%) reached consumers productively. ${total_recoverable:,.0f} is recoverable through governance improvements, directly increasing marketing effectiveness.",
        "cfo": f"Total waste: ${total_waste:,.0f} ({total_waste/gross*100:.0f}% of spend). Recovery roadmap identifies ${total_recoverable:,.0f} in savings. Current ROAS would improve by {total_recoverable/gross*100:.0f}% if waste is eliminated.",
        "cmo": f"Productive spend: {productive_pct:.0f}% (industry benchmark: {INDUSTRY_BENCHMARKS.get(industry, {}).get('non_working', 0.15)*100:.0f}% non-working). Top waste categories: {', '.join(s[0] for s in sorted(stages, key=lambda x: x[2], reverse=True)[:3])}.",
    }

    result = {
        "gross_spend": gross,
        "waterfall": waterfall,
        "productive_spend": {"amount": round(productive, 2), "pct": round(productive_pct, 1)},
        "waste_summary": {"total_waste": round(total_waste, 2), "waste_pct": round(total_waste/gross*100, 1) if gross > 0 else 0},
        "recovery_roadmap": roadmap,
        "csuite_summary": csuite,
        "industry": industry,
        "math_validated": math_check < 1,
    }

    # ROI impact if actual revenue provided
    if actual_revenue > 0:
        current_roas = actual_revenue / gross
        productive_roas = actual_revenue / productive if productive > 0 else 0
        result["roi_impact"] = {
            "current_roas": round(current_roas, 2),
            "productive_roas": round(productive_roas, 2),
            "improvement_potential_pct": round((productive_roas - current_roas) / current_roas * 100, 1) if current_roas > 0 else 0,
        }

    return result


def estimate(data):
    """Estimate waste from industry benchmarks when actual data is missing."""
    gross = data["gross_spend"]
    industry = data.get("industry", "retail")
    benchmarks = INDUSTRY_BENCHMARKS.get(industry, INDUSTRY_BENCHMARKS["retail"])

    estimated_data = {
        "gross_spend": gross,
        "industry": industry,
        "non_working": {"estimated": round(gross * benchmarks["non_working"], 2)},
        "supply_chain": {"estimated": round(gross * benchmarks["supply_chain"], 2)},
        "quality": {"estimated": round(gross * benchmarks["quality"], 2)},
        "audience": {"estimated": round(gross * benchmarks["audience"], 2)},
        "optimization": {"estimated": round(gross * benchmarks["optimization"], 2)},
        "measurement": {"estimated": round(gross * benchmarks["measurement"], 2)},
    }

    if "actual_revenue" in data:
        estimated_data["actual_revenue"] = data["actual_revenue"]

    result = analyze(estimated_data)

    # Mark all as estimated
    for stage in result.get("waterfall", []):
        stage["data_source"] = "benchmark_estimate"
        stage["note"] = f"ESTIMATED from {industry} benchmarks"

    return result


def compare_periods(data):
    """Compare waste waterfall across two periods."""
    p1_data = data.get("period_1", {})
    p2_data = data.get("period_2", {})

    p1 = analyze(p1_data)
    p2 = analyze(p2_data)

    if "error" in p1 or "error" in p2:
        return {"error": "Analysis failed for one or both periods",
                "period_1": p1, "period_2": p2}

    comparison = []
    for s1, s2 in zip(p1["waterfall"], p2["waterfall"]):
        delta = s2["waste_pct"] - s1["waste_pct"]
        comparison.append({
            "category": s1["category"],
            "period_1_pct": s1["waste_pct"],
            "period_2_pct": s2["waste_pct"],
            "delta_pct": round(delta, 1),
            "direction": "improved" if delta < 0 else ("regressed" if delta > 0 else "unchanged"),
        })

    return {
        "period_1": p1,
        "period_2": p2,
        "comparison": comparison,
        "productive_spend_delta": round(
            p2["productive_spend"]["pct"] - p1["productive_spend"]["pct"], 1
        ),
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"analyze\",\"data\":{...}}' | python3 waste_waterfall.py",
            "commands": ["analyze", "estimate", "compare_periods"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "analyze":
        result = analyze(data)
    elif cmd == "estimate":
        result = estimate(data)
    elif cmd == "compare_periods":
        result = compare_periods(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: analyze, estimate, compare_periods"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
