#!/usr/bin/env python3
"""
Optimization Rules Engine
Rule-based campaign optimization with cross-channel reallocation.

Usage: echo '{"command":"analyze","data":{...}}' | python3 optimization_rules.py
Commands: analyze, reallocate
"""

import json
import sys

# Stage 5 conservative thresholds
THRESHOLDS = {
    "cpa_overshoot_pct": 0.30,
    "cpa_headroom_pct": 0.30,
    "roas_below_pct": 0.20,
    "pacing_over_pct": 0.20,
    "pacing_under_pct": 0.20,
    "ctr_fatigue_pct": 0.30,
}


def analyze(data):
    """Run optimization rules on campaign data."""
    campaigns = data.get("campaigns", [])
    all_alerts = []
    campaign_results = []

    for camp in campaigns:
        name = camp["name"]
        channel = camp.get("channel", "unknown")
        spend = camp.get("spend", 0)
        budget = camp.get("budget", 0)
        days_elapsed = camp.get("days_elapsed", 0)
        days_total = camp.get("days_total", 30)
        impressions = camp.get("impressions", 0)
        clicks = camp.get("clicks", 0)
        conversions = camp.get("conversions", 0)
        revenue = camp.get("revenue", 0)
        cpa_target = camp.get("cpa_target", 0)
        roas_target = camp.get("roas_target", 0)
        historical_ctr = camp.get("historical_ctr", 0)

        alerts = []

        # Actual metrics
        cpa = spend / conversions if conversions > 0 else float('inf')
        roas = revenue / spend if spend > 0 else 0
        ctr = (clicks / impressions) if impressions > 0 else 0
        expected_spend_pct = days_elapsed / days_total if days_total > 0 else 0
        actual_spend_pct = spend / budget if budget > 0 else 0

        # CPA Overshoot
        if cpa_target > 0 and conversions > 0:
            cpa_deviation = (cpa - cpa_target) / cpa_target
            if cpa_deviation > THRESHOLDS["cpa_overshoot_pct"]:
                alerts.append({
                    "type": "cpa_overshoot",
                    "severity": "critical" if cpa_deviation > 0.5 else "warning",
                    "message": f"CPA ${cpa:.0f} is {cpa_deviation*100:.0f}% above target ${cpa_target:.0f}",
                    "recommendation": "Reduce bids, tighten targeting, or pause underperforming ad groups",
                })

        # CPA Headroom
        if cpa_target > 0 and conversions > 0:
            cpa_headroom = (cpa_target - cpa) / cpa_target
            if cpa_headroom > THRESHOLDS["cpa_headroom_pct"]:
                alerts.append({
                    "type": "cpa_headroom",
                    "severity": "info",
                    "message": f"CPA ${cpa:.0f} is {cpa_headroom*100:.0f}% below target. Opportunity to scale.",
                    "recommendation": "Increase budget or expand targeting to capture more volume",
                })

        # ROAS Below Target
        if roas_target > 0 and spend > 0:
            roas_deviation = (roas_target - roas) / roas_target
            if roas_deviation > THRESHOLDS["roas_below_pct"]:
                alerts.append({
                    "type": "roas_below_target",
                    "severity": "critical" if roas_deviation > 0.4 else "warning",
                    "message": f"ROAS {roas:.2f}x is {roas_deviation*100:.0f}% below target {roas_target:.2f}x",
                    "recommendation": "Review channel mix, creative performance, and landing page conversion",
                })

        # Pacing Analysis
        if budget > 0 and days_total > 0:
            pacing_ratio = actual_spend_pct / expected_spend_pct if expected_spend_pct > 0 else 0
            if pacing_ratio > (1 + THRESHOLDS["pacing_over_pct"]):
                alerts.append({
                    "type": "pacing_over",
                    "severity": "warning",
                    "message": f"Overpacing: spent {actual_spend_pct*100:.0f}% of budget but only {expected_spend_pct*100:.0f}% of time elapsed",
                    "recommendation": "Reduce daily budgets or add daypart restrictions",
                })
            elif pacing_ratio < (1 - THRESHOLDS["pacing_under_pct"]):
                alerts.append({
                    "type": "pacing_under",
                    "severity": "warning",
                    "message": f"Underpacing: spent {actual_spend_pct*100:.0f}% of budget but {expected_spend_pct*100:.0f}% of time elapsed",
                    "recommendation": "Broaden targeting, increase bids, or add new ad groups",
                })

        # Creative Fatigue
        if historical_ctr > 0 and impressions > 0:
            ctr_decline = (historical_ctr - ctr) / historical_ctr
            if ctr_decline > THRESHOLDS["ctr_fatigue_pct"]:
                alerts.append({
                    "type": "creative_fatigue",
                    "severity": "warning",
                    "message": f"CTR {ctr*100:.2f}% is {ctr_decline*100:.0f}% below historical {historical_ctr*100:.2f}%",
                    "recommendation": "Rotate creative assets. Test new concepts, copy, or formats.",
                })

        # Zero Conversions
        if spend > 0 and conversions == 0:
            alerts.append({
                "type": "zero_conversions",
                "severity": "critical",
                "message": f"${spend:,.0f} spent with zero conversions. Possible tracking issue.",
                "recommendation": "Verify conversion tracking immediately. Check tag firing, attribution window, and consent settings.",
            })

        campaign_results.append({
            "campaign": name,
            "channel": channel,
            "metrics": {
                "spend": spend, "budget": budget,
                "cpa": round(cpa, 2) if cpa != float('inf') else None,
                "roas": round(roas, 2), "ctr": round(ctr * 100, 2),
                "pacing_pct": round(actual_spend_pct * 100, 1),
            },
            "alerts": alerts,
            "alert_count": {
                "critical": sum(1 for a in alerts if a["severity"] == "critical"),
                "warning": sum(1 for a in alerts if a["severity"] == "warning"),
                "info": sum(1 for a in alerts if a["severity"] == "info"),
            },
        })
        all_alerts.extend(alerts)

    return {
        "campaigns": campaign_results,
        "total_alerts": {
            "critical": sum(1 for a in all_alerts if a["severity"] == "critical"),
            "warning": sum(1 for a in all_alerts if a["severity"] == "warning"),
            "info": sum(1 for a in all_alerts if a["severity"] == "info"),
        },
    }


def reallocate(data):
    """Recommend cross-channel budget reallocation."""
    total_budget = data.get("total_budget", 0)
    campaigns = data.get("campaigns", [])

    performances = []
    for camp in campaigns:
        spend = camp.get("spend", 0)
        revenue = camp.get("revenue", 0)
        roas = revenue / spend if spend > 0 else 0
        conversions = camp.get("conversions", 0)
        cpa = spend / conversions if conversions > 0 else float('inf')

        performances.append({
            "campaign": camp["name"],
            "channel": camp.get("channel", "unknown"),
            "current_spend": spend,
            "roas": round(roas, 2),
            "cpa": round(cpa, 2) if cpa != float('inf') else None,
        })

    performances.sort(key=lambda x: x["roas"], reverse=True)

    recommendations = []
    if len(performances) >= 2:
        top = performances[0]
        bottom = performances[-1]
        shift_amount = round(bottom["current_spend"] * 0.2, 2)
        recommendations.append({
            "action": "reallocate",
            "from_campaign": bottom["campaign"],
            "to_campaign": top["campaign"],
            "amount": shift_amount,
            "rationale": f"Shift ${shift_amount:,.0f} from {bottom['campaign']} (ROAS {bottom['roas']}x) to {top['campaign']} (ROAS {top['roas']}x)",
        })

    return {
        "performances": performances,
        "recommendations": recommendations,
    }


def mmm_check(data):
    """Check if MMM model refresh is needed based on optimization signals.

    Connects to Google Meridian framework (mmm-meridian skill) for
    strategic budget reallocation via scenario planning.
    Reference: https://github.com/google/meridian
    """
    campaigns = data.get("campaigns", [])
    total_budget = data.get("total_budget", 0)
    last_mmm_refresh_weeks = data.get("last_mmm_refresh_weeks", 0)
    cumulative_reallocation_pct = data.get("cumulative_reallocation_pct", 0)

    triggers = []

    # Quarterly refresh trigger
    if last_mmm_refresh_weeks >= 13:
        triggers.append({
            "trigger": "quarterly_refresh",
            "severity": "high",
            "message": f"MMM model is {last_mmm_refresh_weeks} weeks old. Quarterly refresh recommended.",
            "action": "Run mmm-meridian pre_model -> model -> post_model -> optimize cycle",
        })

    # Cumulative reallocation trigger
    if cumulative_reallocation_pct > 20:
        triggers.append({
            "trigger": "reallocation_drift",
            "severity": "high",
            "message": f"Cumulative reallocation of {cumulative_reallocation_pct}% since last model. Refresh needed.",
            "action": "Feed updated spend data to mmm-meridian for model re-estimation",
        })

    # Performance divergence from model predictions
    divergent_channels = []
    for camp in campaigns:
        predicted_roi = camp.get("mmm_predicted_roi")
        actual_roi = camp.get("actual_roi")
        if predicted_roi and actual_roi:
            divergence = abs(actual_roi - predicted_roi) / predicted_roi
            if divergence > 0.3:
                divergent_channels.append({
                    "channel": camp.get("channel", camp.get("name", "unknown")),
                    "predicted_roi": predicted_roi,
                    "actual_roi": actual_roi,
                    "divergence_pct": round(divergence * 100, 1),
                })

    if divergent_channels:
        triggers.append({
            "trigger": "model_divergence",
            "severity": "high",
            "message": f"{len(divergent_channels)} channels diverge >30% from MMM predictions.",
            "action": "Update mmm-meridian priors with actual performance data and re-estimate",
            "channels": divergent_channels,
        })

    # Saturation signals (channels may have crossed saturation points)
    saturated = [c for c in campaigns if c.get("saturation_pct", 0) > 85]
    unsaturated = [c for c in campaigns if c.get("saturation_pct", 0) < 30 and c.get("marginal_roi", 0) > 1.5]

    if saturated and unsaturated:
        triggers.append({
            "trigger": "saturation_imbalance",
            "severity": "medium",
            "message": f"{len(saturated)} over-saturated and {len(unsaturated)} under-saturated channels detected.",
            "action": "Run mmm-meridian scenario planning to optimize allocation across saturation curves",
        })

    needs_refresh = len(triggers) > 0

    return {
        "mmm_framework": "Google Meridian",
        "mmm_skill": "mmm-meridian",
        "needs_refresh": needs_refresh,
        "triggers": triggers,
        "last_refresh_weeks_ago": last_mmm_refresh_weeks,
        "recommendation": (
            "Trigger mmm-meridian model refresh cycle: pre_model -> model -> post_model -> optimize"
            if needs_refresh else
            "MMM model is current. Next scheduled refresh in "
            f"{max(0, 13 - last_mmm_refresh_weeks)} weeks."
        ),
        "continuous_cycle": "mmm-meridian -> channel-architect -> activation -> value -> governance -> mmm-meridian",
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"analyze\",\"data\":{...}}' | python3 optimization_rules.py",
            "commands": ["analyze", "reallocate", "mmm_check"],
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
    elif cmd == "reallocate":
        result = reallocate(data)
    elif cmd == "mmm_check":
        result = mmm_check(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: analyze, reallocate, mmm_check"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
