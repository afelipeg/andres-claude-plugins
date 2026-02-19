#!/usr/bin/env python3
"""
Supply Chain Audit
Maps dollar flow from advertiser to publisher through intermediaries.
Fee transparency, SPO recommendations, CPM anomaly detection.

Usage: echo '{"command":"audit","data":{...}}' | python3 supply_chain_audit.py
Commands: audit
"""

import json
import sys
import math

CPM_BENCHMARKS = {
    "programmatic_display": {"min": 1.50, "median": 3.50, "max": 8.00, "anomaly": 12.00},
    "programmatic_video": {"min": 8.00, "median": 15.00, "max": 30.00, "anomaly": 45.00},
    "social_meta": {"min": 4.00, "median": 8.00, "max": 15.00, "anomaly": 22.00},
    "social_tiktok": {"min": 3.00, "median": 6.00, "max": 12.00, "anomaly": 18.00},
    "native": {"min": 2.50, "median": 5.00, "max": 10.00, "anomaly": 15.00},
    "linkedin": {"min": 10.00, "median": 20.00, "max": 35.00, "anomaly": 50.00},
}

FEE_BENCHMARKS = {
    "dsp": {"typical_pct": 12, "max_acceptable_pct": 18},
    "ssp": {"typical_pct": 10, "max_acceptable_pct": 15},
    "verification": {"typical_pct": 3, "max_acceptable_pct": 5},
    "data": {"typical_pct": 5, "max_acceptable_pct": 10},
    "reseller": {"typical_pct": 15, "max_acceptable_pct": 20},
    "platform": {"typical_pct": 0, "max_acceptable_pct": 0},
}


def audit(data):
    """Full supply chain audit."""
    gross_spend = data.get("gross_spend", 0)
    channels = data.get("channels", [])

    channel_results = []
    total_fees = 0
    total_working = 0
    all_anomalies = []
    spo_recommendations = []

    for ch in channels:
        ch_name = ch["name"]
        ch_spend = ch.get("spend", 0)
        intermediaries = ch.get("intermediaries", [])
        publisher_cpm = ch.get("publisher_cpm")

        # Calculate fee flow
        fees = []
        total_ch_fees = 0
        risk_flags = []

        for inter in intermediaries:
            disclosed_fee_pct = inter.get("disclosed_fee_pct", 0)
            fee_amount = ch_spend * (disclosed_fee_pct / 100)
            buying_model = inter.get("buying_model", "transparent")
            inter_type = inter.get("type", "unknown")

            # Estimate undisclosed fees for non-transparent models
            estimated_undisclosed = 0
            if buying_model == "principal":
                estimated_undisclosed = ch_spend * 0.08  # Estimate 8% hidden margin
                risk_flags.append({
                    "type": "principal_buying",
                    "intermediary": inter["name"],
                    "severity": "high",
                    "message": f"{inter['name']} uses principal-based buying. Fee transparency is limited.",
                })
            elif buying_model == "reseller":
                estimated_undisclosed = ch_spend * 0.05
                risk_flags.append({
                    "type": "reseller_path",
                    "intermediary": inter["name"],
                    "severity": "medium",
                    "message": f"{inter['name']} is a reseller. Consider direct buying for transparency.",
                })

            total_ch_fees += fee_amount + estimated_undisclosed

            fee_benchmark = FEE_BENCHMARKS.get(inter_type, {})
            fee_status = "normal"
            if disclosed_fee_pct > fee_benchmark.get("max_acceptable_pct", 100):
                fee_status = "above_benchmark"

            fees.append({
                "intermediary": inter["name"],
                "type": inter_type,
                "buying_model": buying_model,
                "disclosed_fee_pct": disclosed_fee_pct,
                "disclosed_fee_amount": round(fee_amount, 2),
                "estimated_undisclosed": round(estimated_undisclosed, 2),
                "total_fee": round(fee_amount + estimated_undisclosed, 2),
                "fee_status": fee_status,
            })

        working_media = ch_spend - total_ch_fees
        working_ratio = (working_media / ch_spend * 100) if ch_spend > 0 else 0

        total_fees += total_ch_fees
        total_working += working_media

        # CPM anomaly detection
        cpm_anomaly = None
        if publisher_cpm is not None:
            benchmark = CPM_BENCHMARKS.get(ch_name, {})
            if benchmark and publisher_cpm > benchmark.get("anomaly", float('inf')):
                cpm_anomaly = {
                    "channel": ch_name,
                    "actual_cpm": publisher_cpm,
                    "benchmark_median": benchmark["median"],
                    "anomaly_threshold": benchmark["anomaly"],
                    "severity": "high",
                }
                all_anomalies.append(cpm_anomaly)

        # SPO recommendation
        if working_ratio < 70:
            savings = ch_spend * ((70 - working_ratio) / 100)
            spo_recommendations.append({
                "channel": ch_name,
                "current_working_ratio": round(working_ratio, 1),
                "target_working_ratio": 70,
                "estimated_savings": round(savings, 2),
                "recommendation": f"Optimize supply path for {ch_name}. Remove redundant intermediaries.",
                "impact": "high" if savings > ch_spend * 0.1 else "medium",
            })

        channel_results.append({
            "channel": ch_name,
            "spend": ch_spend,
            "fee_breakdown": fees,
            "total_fees": round(total_ch_fees, 2),
            "working_media": round(working_media, 2),
            "working_media_ratio_pct": round(working_ratio, 1),
            "risk_flags": risk_flags,
            "cpm_anomaly": cpm_anomaly,
        })

    overall_working_ratio = (total_working / gross_spend * 100) if gross_spend > 0 else 0

    spo_recommendations.sort(key=lambda x: x["estimated_savings"], reverse=True)

    return {
        "gross_spend": gross_spend,
        "dollar_flow": {
            "gross_spend": gross_spend,
            "total_fees": round(total_fees, 2),
            "working_media": round(total_working, 2),
            "working_media_ratio_pct": round(overall_working_ratio, 1),
        },
        "channels": channel_results,
        "anomalies": all_anomalies,
        "spo_recommendations": spo_recommendations,
        "partner_comparison": sorted(
            [{"channel": c["channel"],
              "working_media_ratio": c["working_media_ratio_pct"]}
             for c in channel_results],
            key=lambda x: x["working_media_ratio"], reverse=True
        ),
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"audit\",\"data\":{...}}' | python3 supply_chain_audit.py",
            "commands": ["audit"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "audit":
        result = audit(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: audit"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
