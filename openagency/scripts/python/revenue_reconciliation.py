#!/usr/bin/env python3
"""
Revenue Reconciliation
Compares platform-reported vs actual conversions/revenue.

Usage: echo '{"command":"reconcile","data":{...}}' | python3 revenue_reconciliation.py
Commands: reconcile, integrity
"""

import json
import sys


def reconcile(data):
    """Compare platform-reported vs actual data."""
    platforms = data.get("platforms", [])
    results = []
    total_reported_rev = 0
    total_actual_rev = 0
    total_reported_conv = 0
    total_actual_conv = 0

    for p in platforms:
        name = p["name"]
        reported_conv = p.get("reported_conversions", 0)
        reported_rev = p.get("reported_revenue", 0)
        actual_conv = p.get("actual_conversions", 0)
        actual_rev = p.get("actual_revenue", 0)

        total_reported_rev += reported_rev
        total_actual_rev += actual_rev
        total_reported_conv += reported_conv
        total_actual_conv += actual_conv

        conv_correction = (actual_conv / reported_conv
                           if reported_conv > 0 else 0)
        rev_correction = (actual_rev / reported_rev
                          if reported_rev > 0 else 0)
        over_reporting_conv = ((reported_conv - actual_conv) / reported_conv * 100
                               if reported_conv > 0 else 0)
        over_reporting_rev = ((reported_rev - actual_rev) / reported_rev * 100
                              if reported_rev > 0 else 0)

        spend = p.get("spend", 0)
        adjusted_roas = actual_rev / spend if spend > 0 else 0
        reported_roas = reported_rev / spend if spend > 0 else 0

        # Data integrity per platform
        integrity = 100
        if over_reporting_rev > 30:
            integrity -= 30
        elif over_reporting_rev > 15:
            integrity -= 15
        if over_reporting_conv > 30:
            integrity -= 20
        elif over_reporting_conv > 15:
            integrity -= 10

        results.append({
            "platform": name,
            "reported_conversions": reported_conv,
            "actual_conversions": actual_conv,
            "conversion_correction_factor": round(conv_correction, 3),
            "over_reporting_conversions_pct": round(over_reporting_conv, 1),
            "reported_revenue": reported_rev,
            "actual_revenue": actual_rev,
            "revenue_correction_factor": round(rev_correction, 3),
            "over_reporting_revenue_pct": round(over_reporting_rev, 1),
            "reported_roas": round(reported_roas, 2),
            "adjusted_roas": round(adjusted_roas, 2),
            "data_integrity_score": max(0, integrity),
        })

    overall_correction = (total_actual_rev / total_reported_rev
                          if total_reported_rev > 0 else 0)
    overall_over_reporting = ((total_reported_rev - total_actual_rev) /
                               total_reported_rev * 100
                              if total_reported_rev > 0 else 0)

    return {
        "platforms": results,
        "summary": {
            "total_reported_revenue": total_reported_rev,
            "total_actual_revenue": total_actual_rev,
            "overall_correction_factor": round(overall_correction, 3),
            "overall_over_reporting_pct": round(overall_over_reporting, 1),
            "total_reported_conversions": total_reported_conv,
            "total_actual_conversions": total_actual_conv,
            "measurement_waste_dollars": round(total_reported_rev - total_actual_rev, 2),
        },
    }


def integrity(data):
    """Score data collection quality."""
    tracking = data.get("tracking_coverage_pct", 100)
    consent = data.get("cookie_consent_rate_pct", 100)
    window = data.get("attribution_window_days", 30)
    cross_device = data.get("cross_device_enabled", False)
    offline_import = data.get("offline_conversion_import", False)

    scores = {
        "tracking_coverage": min(100, round(tracking)),
        "consent_rate": min(100, round(consent)),
        "attribution_window": 100 if window >= 28 else round(window / 28 * 100),
        "cross_device": 100 if cross_device else 50,
        "offline_integration": 100 if offline_import else 40,
    }

    overall = round(sum(scores.values()) / len(scores))

    recommendations = []
    if tracking < 90:
        recommendations.append("Improve tracking coverage: audit tag implementation across all pages")
    if consent < 80:
        recommendations.append("Improve consent rates: optimize consent banner UX")
    if window < 28:
        recommendations.append(f"Attribution window is {window} days. Consider extending to 28+ for accuracy")
    if not cross_device:
        recommendations.append("Enable cross-device tracking for more complete attribution")
    if not offline_import:
        recommendations.append("Import offline conversions for closed-loop measurement")

    return {
        "integrity_score": overall,
        "dimension_scores": scores,
        "recommendations": recommendations,
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"reconcile\",\"data\":{...}}' | python3 revenue_reconciliation.py",
            "commands": ["reconcile", "integrity"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "reconcile":
        result = reconcile(data)
    elif cmd == "integrity":
        result = integrity(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: reconcile, integrity"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
