#!/usr/bin/env python3
"""
Benchmark Tracker
Compares campaign actuals vs market benchmarks and detects anomalies.

Usage: echo '{"command":"health_check","data":{...}}' | python3 benchmark_tracker.py
Commands: health_check, anomaly_detect
"""

import json
import sys
import math

MEXICO_BENCHMARKS = {
    "search": {"cpc": 16.5, "ctr": 5.75, "cvr": 3.5},
    "social_display": {"cpm": 165, "cpc": 7.5, "ctr": 1.65, "cvr": 2.25},
    "social_video": {"cpm": 235, "cpc": 11.5, "ctr": 2.0, "cvr": 1.65},
    "social_tiktok": {"cpm": 130, "cpc": 6.0, "ctr": 2.6, "cvr": 1.25},
    "programmatic_display": {"cpm": 95, "cpc": 9.5, "ctr": 0.19, "cvr": 0.9},
    "programmatic_video": {"cpm": 380, "cpc": 19.0, "ctr": 1.25, "cvr": 1.25},
    "email": {"cpm": 12.5, "open_rate": 22.5, "cvr": 3.0},
    "native": {"cpm": 115, "cpc": 7.5, "ctr": 0.75, "cvr": 1.25},
    "linkedin": {"cpm": 400, "cpc": 32.5, "ctr": 0.7, "cvr": 1.5},
    "amazon": {"cpc": 12.5, "ctr": 0.65, "cvr": 10.0},
}

INDUSTRY_MULTIPLIERS = {
    "automotive": {"cpm": 1.3, "cpc": 1.4, "cvr": 0.7},
    "fmcg": {"cpm": 0.8, "cpc": 0.7, "cvr": 1.2},
    "financial": {"cpm": 1.5, "cpc": 1.6, "cvr": 0.6},
    "retail": {"cpm": 0.9, "cpc": 0.8, "cvr": 1.3},
    "telecom": {"cpm": 1.1, "cpc": 1.0, "cvr": 0.9},
}


def get_adjusted_benchmark(channel, metric, industry):
    """Get benchmark adjusted by industry multiplier."""
    base = MEXICO_BENCHMARKS.get(channel, {}).get(metric)
    if base is None:
        return None
    multiplier = INDUSTRY_MULTIPLIERS.get(industry, {}).get(metric, 1.0)
    return base * multiplier


def health_check(data):
    """Compare actuals vs market benchmarks by channel and industry."""
    industry = data.get("industry", "retail")
    channels = data.get("channels", [])
    results = []

    for ch in channels:
        name = ch["name"]
        spend = ch.get("spend", 0)
        impressions = ch.get("impressions", 0)
        clicks = ch.get("clicks", 0)
        conversions = ch.get("conversions", 0)

        actuals = {}
        if impressions > 0:
            actuals["cpm"] = (spend / impressions) * 1000
            if clicks > 0:
                actuals["ctr"] = (clicks / impressions) * 100
                actuals["cpc"] = spend / clicks
            if conversions > 0:
                actuals["cvr"] = (conversions / clicks) * 100 if clicks > 0 else 0

        checks = []
        for metric, actual in actuals.items():
            benchmark = get_adjusted_benchmark(name, metric, industry)
            if benchmark is None:
                continue

            deviation_pct = ((actual - benchmark) / benchmark) * 100

            if metric in ("cpm", "cpc"):
                if deviation_pct > 30:
                    status = "critical"
                elif deviation_pct > 15:
                    status = "warning"
                else:
                    status = "healthy"
            else:
                if deviation_pct < -30:
                    status = "critical"
                elif deviation_pct < -15:
                    status = "warning"
                else:
                    status = "healthy"

            recommendation = ""
            if status == "critical":
                if metric in ("cpm", "cpc"):
                    recommendation = (f"Review targeting and bidding. "
                                      f"{metric.upper()} is {abs(deviation_pct):.0f}% "
                                      f"above benchmark.")
                else:
                    recommendation = (f"Investigate low {metric.upper()}. "
                                      f"Check creative, landing page, and tracking.")
            elif status == "warning":
                recommendation = f"Monitor {metric.upper()} closely."

            checks.append({
                "metric": metric,
                "actual": round(actual, 2),
                "benchmark": round(benchmark, 2),
                "deviation_pct": round(deviation_pct, 1),
                "status": status,
                "recommendation": recommendation,
            })

        overall = "healthy"
        if any(c["status"] == "critical" for c in checks):
            overall = "critical"
        elif any(c["status"] == "warning" for c in checks):
            overall = "warning"

        results.append({
            "channel": name,
            "overall_status": overall,
            "checks": checks,
        })

    return {"industry": industry, "channels": results}


def anomaly_detect(data):
    """Z-score based anomaly detection on time series."""
    metric = data.get("metric", "unknown")
    values = data.get("values", [])
    threshold = data.get("threshold", 2.0)

    if len(values) < 3:
        return {"error": "Need at least 3 data points for anomaly detection"}

    n = len(values)
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / n
    std = math.sqrt(variance) if variance > 0 else 0.0001

    anomalies = []
    for i, val in enumerate(values):
        z = (val - mean) / std
        if abs(z) >= threshold:
            severity = "high" if abs(z) >= 3.0 else "medium"
            anomalies.append({
                "index": i,
                "value": val,
                "z_score": round(z, 2),
                "severity": severity,
                "direction": "above" if z > 0 else "below",
            })

    return {
        "metric": metric,
        "data_points": n,
        "mean": round(mean, 2),
        "std": round(std, 2),
        "threshold": threshold,
        "anomalies_detected": len(anomalies),
        "anomalies": anomalies,
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"health_check\",\"data\":{...}}' | python3 benchmark_tracker.py",
            "commands": {
                "health_check": {
                    "description": "Compare actuals vs benchmarks",
                    "input": {"industry": "automotive", "channels": [
                        {"name": "search", "spend": 100000,
                         "impressions": 500000, "clicks": 25000,
                         "conversions": 500}
                    ]}
                },
                "anomaly_detect": {
                    "description": "Z-score anomaly detection",
                    "input": {"metric": "cpc",
                              "values": [1.2, 1.3, 1.1, 5.0],
                              "threshold": 2.0}
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

    if cmd == "health_check":
        result = health_check(data)
    elif cmd == "anomaly_detect":
        result = anomaly_detect(data)
    else:
        result = {"error": f"Unknown command: {cmd}. "
                  "Valid: health_check, anomaly_detect"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
