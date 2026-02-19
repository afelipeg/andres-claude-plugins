#!/usr/bin/env python3
"""
Revenue Bridge
Translates media metrics (L3) to business metrics (L2) to financial metrics (L1).
Generates CEO/CFO/CMO summaries and efficiency scores.

Usage: echo '{"command":"translate","data":{...}}' | python3 revenue_bridge.py
Commands: translate, compare
"""

import json
import sys


def translate(data):
    """Translate L3 media metrics through L2 to L1 financial metrics."""
    channels = data.get("channels", [])
    aov = data.get("aov", 100)
    retention_rate = data.get("retention_rate", 0.3)
    avg_customer_months = data.get("avg_customer_months", 12)

    total_spend = 0
    total_revenue = 0
    total_conversions = 0
    total_impressions = 0
    total_clicks = 0
    channel_results = []

    for ch in channels:
        spend = ch.get("spend", 0)
        impressions = ch.get("impressions", 0)
        clicks = ch.get("clicks", 0)
        conversions = ch.get("conversions", 0)
        revenue = ch.get("revenue", conversions * aov)

        total_spend += spend
        total_revenue += revenue
        total_conversions += conversions
        total_impressions += impressions
        total_clicks += clicks

        l3 = {}
        if impressions > 0:
            l3["cpm"] = round((spend / impressions) * 1000, 2)
        if clicks > 0:
            l3["cpc"] = round(spend / clicks, 2)
        if impressions > 0:
            l3["ctr"] = round((clicks / impressions) * 100, 2)
        if clicks > 0:
            l3["cvr"] = round((conversions / clicks) * 100, 2)

        l2 = {}
        if conversions > 0:
            l2["cpa"] = round(spend / conversions, 2)
        if spend > 0:
            l2["roas"] = round(revenue / spend, 2)
        l2["aov"] = round(revenue / conversions, 2) if conversions > 0 else 0
        l2["conversions"] = conversions

        channel_results.append({
            "channel": ch["name"],
            "spend": spend,
            "revenue": revenue,
            "l3_metrics": l3,
            "l2_metrics": l2,
        })

    # L1 Financial Metrics
    cac = round(total_spend / total_conversions, 2) if total_conversions > 0 else 0
    clv = round(aov * retention_rate * avg_customer_months, 2)
    clv_cac_ratio = round(clv / cac, 2) if cac > 0 else 0
    roi = round(((total_revenue - total_spend) / total_spend) * 100, 1) if total_spend > 0 else 0
    marketing_margin = round(((total_revenue - total_spend) / total_revenue) * 100, 1) if total_revenue > 0 else 0

    l1 = {
        "cac": cac,
        "clv": clv,
        "clv_cac_ratio": clv_cac_ratio,
        "roi_pct": roi,
        "marketing_margin_pct": marketing_margin,
        "total_revenue": total_revenue,
        "total_spend": total_spend,
    }

    # Efficiency Score (0-100)
    scores = []
    if clv_cac_ratio >= 3:
        scores.append(100)
    elif clv_cac_ratio >= 1:
        scores.append(round(clv_cac_ratio / 3 * 100))
    else:
        scores.append(0)

    roas = total_revenue / total_spend if total_spend > 0 else 0
    if roas >= 4:
        scores.append(100)
    elif roas >= 1:
        scores.append(round(roas / 4 * 100))
    else:
        scores.append(0)

    if marketing_margin > 0:
        scores.append(min(100, round(marketing_margin * 2)))
    else:
        scores.append(0)

    efficiency_score = round(sum(scores) / len(scores)) if scores else 0

    # C-Suite Summaries
    csuite = {
        "ceo": (
            f"Marketing investment of ${total_spend:,.0f} generated "
            f"${total_revenue:,.0f} in revenue ({total_conversions:,} customers). "
            f"Customer lifetime value is ${clv:,.0f} vs acquisition cost of ${cac:,.0f} "
            f"(CLV:CAC = {clv_cac_ratio}:1). "
            f"ROI: {roi}%."
        ),
        "cfo": (
            f"Total spend: ${total_spend:,.0f}. Revenue: ${total_revenue:,.0f}. "
            f"Marketing margin: {marketing_margin}%. ROI: {roi}%. "
            f"Blended ROAS: {roas:.2f}x. "
            f"Efficiency score: {efficiency_score}/100."
        ),
        "cmo": (
            f"Campaign delivered {total_conversions:,} conversions across "
            f"{len(channels)} channels at ${cac:,.0f} CPA. "
            f"ROAS: {roas:.2f}x. "
            f"Top channel by ROAS: "
            f"{max(channel_results, key=lambda x: x['l2_metrics'].get('roas', 0))['channel'] if channel_results else 'N/A'}."
        ),
    }

    return {
        "l1_metrics": l1,
        "efficiency_score": efficiency_score,
        "channels": channel_results,
        "csuite_summary": csuite,
    }


def compare(data):
    """Compare channels side by side."""
    channels = data.get("channels", [])
    results = []
    for ch in channels:
        spend = ch.get("spend", 0)
        revenue = ch.get("revenue", 0)
        conversions = ch.get("conversions", 0)
        results.append({
            "channel": ch["name"],
            "spend": spend,
            "revenue": revenue,
            "roas": round(revenue / spend, 2) if spend > 0 else 0,
            "cpa": round(spend / conversions, 2) if conversions > 0 else 0,
            "efficiency_rank": 0,
        })
    results.sort(key=lambda x: x["roas"], reverse=True)
    for i, r in enumerate(results):
        r["efficiency_rank"] = i + 1
    return {"comparison": results}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"translate\",\"data\":{...}}' | python3 revenue_bridge.py",
            "commands": ["translate", "compare"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "translate":
        result = translate(data)
    elif cmd == "compare":
        result = compare(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: translate, compare"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
