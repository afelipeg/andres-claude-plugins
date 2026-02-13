#!/usr/bin/env python3
"""
Power Analysis for Incrementality Tests
Designs geo-lift, conversion lift, and holdout experiments.

Usage: echo '{"command":"geo_lift","data":{...}}' | python3 power_analysis.py
Commands: geo_lift, conversion_lift, holdout
"""

import json
import sys
import math


def normal_cdf(x):
    """Approximation of the cumulative distribution function."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def normal_ppf(p):
    """Approximation of the percent point function (inverse CDF)."""
    if p <= 0:
        return -10
    if p >= 1:
        return 10
    # Rational approximation
    a = [-3.969683028665376e+01, 2.209460984245205e+02,
         -2.759285104469687e+02, 1.383577518672690e+02,
         -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02,
         -1.556989798598866e+02, 6.680131188771972e+01,
         -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01,
         -2.400758277161838e+00, -2.549732539343734e+00,
         4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01,
         2.445134137142996e+00, 3.754408661907416e+00]

    p_low = 0.02425
    p_high = 1 - p_low

    if p < p_low:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    elif p <= p_high:
        q = p - 0.5
        r = q * q
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / \
               (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
    else:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)


def geo_lift(data):
    """Design geographic experiment."""
    daily_conv = data.get("daily_conversions", 1000)
    lift_pct = data.get("expected_lift_pct", 10) / 100
    duration = data.get("test_duration_days", 28)
    geo_pairs = data.get("geo_pairs", 5)
    alpha = data.get("significance_level", 0.05)

    z_alpha = normal_ppf(1 - alpha / 2)
    z_beta = normal_ppf(0.8)  # 80% power

    total_conv = daily_conv * duration
    conv_per_geo = total_conv / (geo_pairs * 2)

    # Required sample size per group
    p1 = daily_conv / (daily_conv / lift_pct + daily_conv)
    p2 = 1 - p1
    n_required = ((z_alpha * math.sqrt(2 * 0.5 * 0.5) +
                    z_beta * math.sqrt(p1 * (1-p1) + p2 * (1-p2))) /
                   (p1 - p2)) ** 2

    power = min(0.99, 0.6 + (conv_per_geo / max(n_required, 1)) * 0.4)
    min_detectable = max(2, round(lift_pct * 100 * (n_required / max(conv_per_geo, 1)), 1))

    revenue_per_conv = data.get("revenue_per_conversion", 100)
    revenue_at_risk = round(conv_per_geo * geo_pairs * lift_pct * revenue_per_conv * duration / 28, 2)

    return {
        "test_type": "geo_lift",
        "daily_conversions": daily_conv,
        "expected_lift_pct": round(lift_pct * 100, 1),
        "test_duration_days": duration,
        "geo_pairs": geo_pairs,
        "conversions_per_geo": round(conv_per_geo),
        "statistical_power": round(power, 2),
        "minimum_detectable_lift_pct": min_detectable,
        "revenue_at_risk": revenue_at_risk,
        "recommended_geo_count": max(geo_pairs, round(n_required / max(conv_per_geo, 1) * 2)),
        "confidence_level": round((1 - alpha) * 100),
    }


def conversion_lift(data):
    """Design platform-native conversion lift test."""
    daily_impr = data.get("daily_impressions", 500000)
    baseline_cvr = data.get("baseline_cvr", 0.02)
    lift_pct = data.get("expected_lift_pct", 15) / 100
    duration = data.get("test_duration_days", 14)
    holdout_pct = data.get("holdout_pct", 10) / 100
    alpha = data.get("significance_level", 0.05)

    total_impr = daily_impr * duration
    test_group = round(total_impr * (1 - holdout_pct))
    control_group = round(total_impr * holdout_pct)

    expected_conv_test = test_group * baseline_cvr * (1 + lift_pct)
    expected_conv_control = control_group * baseline_cvr

    z_alpha = normal_ppf(1 - alpha / 2)
    p1 = baseline_cvr * (1 + lift_pct)
    p2 = baseline_cvr
    n_per_group = ((z_alpha * math.sqrt(2 * baseline_cvr * (1 - baseline_cvr)) +
                     normal_ppf(0.8) * math.sqrt(p1*(1-p1) + p2*(1-p2))) /
                    (p1 - p2)) ** 2

    power = min(0.99, 0.5 + (control_group / max(n_per_group, 1)) * 0.5)

    revenue_per_conv = data.get("revenue_per_conversion", 100)
    revenue_at_risk = round(expected_conv_control * lift_pct * revenue_per_conv, 2)

    return {
        "test_type": "conversion_lift",
        "test_group_size": test_group,
        "control_group_size": control_group,
        "expected_conversions_test": round(expected_conv_test),
        "expected_conversions_control": round(expected_conv_control),
        "minimum_detectable_lift_pct": round(lift_pct * 100 * max(1, n_per_group / max(control_group, 1)), 1),
        "statistical_power": round(power, 2),
        "revenue_at_risk": revenue_at_risk,
        "test_duration_days": duration,
    }


def holdout(data):
    """Design holdout test with revenue-at-risk calculation."""
    monthly_revenue = data.get("monthly_revenue", 500000)
    contribution_pct = data.get("channel_contribution_pct", 30) / 100
    holdout_pct = data.get("holdout_pct", 15) / 100
    duration = data.get("test_duration_days", 30)

    daily_revenue = monthly_revenue / 30
    channel_daily_revenue = daily_revenue * contribution_pct
    revenue_at_risk = round(channel_daily_revenue * holdout_pct * duration, 2)
    expected_loss = round(revenue_at_risk * 0.7, 2)  # Assume 70% is truly incremental

    # Power estimate
    effect_size = contribution_pct * holdout_pct
    power = min(0.99, 0.4 + effect_size * 4)

    break_even = round(revenue_at_risk / 12, 2)  # Value spread over 12 months of better decisions

    return {
        "test_type": "holdout",
        "monthly_revenue": monthly_revenue,
        "channel_contribution_pct": round(contribution_pct * 100),
        "holdout_pct": round(holdout_pct * 100),
        "test_duration_days": duration,
        "revenue_at_risk": revenue_at_risk,
        "expected_revenue_loss": expected_loss,
        "statistical_power": round(power, 2),
        "break_even_learning_value": break_even,
        "recommendation": "Proceed" if power >= 0.7 else "Increase duration or holdout percentage for sufficient power",
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"geo_lift\",\"data\":{...}}' | python3 power_analysis.py",
            "commands": ["geo_lift", "conversion_lift", "holdout"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "geo_lift":
        result = geo_lift(data)
    elif cmd == "conversion_lift":
        result = conversion_lift(data)
    elif cmd == "holdout":
        result = holdout(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: geo_lift, conversion_lift, holdout"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
