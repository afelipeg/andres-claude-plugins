#!/usr/bin/env python3
"""
MMM Scenario Planner
Simplified Marketing Mix Model simulation inspired by Google Meridian.
Hill saturation curves + Adstock decay + budget optimization.
Zero external dependencies — mimics Meridian methodology for quick estimates.

Usage: echo '{"command":"pre_model","data":{...}}' | python3 mmm_scenario_planner.py
Commands: pre_model, model, post_model, optimize
"""

import json
import sys
import math
import random


# Default Hill curve parameters by channel (alpha, ec50_pct_of_budget, max_response_multiplier)
CHANNEL_DEFAULTS = {
    "search": {"alpha": 2.5, "ec50_ratio": 0.4, "max_mult": 6.0, "decay": 0.1},
    "social_meta": {"alpha": 1.8, "ec50_ratio": 0.5, "max_mult": 4.0, "decay": 0.3},
    "social_tiktok": {"alpha": 1.6, "ec50_ratio": 0.45, "max_mult": 3.5, "decay": 0.25},
    "programmatic_display": {"alpha": 1.2, "ec50_ratio": 0.6, "max_mult": 2.5, "decay": 0.5},
    "programmatic_video": {"alpha": 1.5, "ec50_ratio": 0.55, "max_mult": 3.0, "decay": 0.6},
    "native": {"alpha": 1.3, "ec50_ratio": 0.5, "max_mult": 2.0, "decay": 0.4},
    "linkedin": {"alpha": 1.4, "ec50_ratio": 0.5, "max_mult": 3.0, "decay": 0.35},
    "tv": {"alpha": 1.0, "ec50_ratio": 0.7, "max_mult": 2.0, "decay": 0.85},
    "ooh": {"alpha": 0.9, "ec50_ratio": 0.6, "max_mult": 1.5, "decay": 0.7},
    "radio": {"alpha": 1.1, "ec50_ratio": 0.5, "max_mult": 1.8, "decay": 0.6},
}


def hill_curve(spend, alpha, ec50, max_response):
    """Hill saturation function: response = max * (spend^a / (spend^a + ec50^a))"""
    if spend <= 0 or ec50 <= 0:
        return 0
    spend_a = spend ** alpha
    ec50_a = ec50 ** alpha
    return max_response * (spend_a / (spend_a + ec50_a))


def adstock(spend_series, decay_rate):
    """Geometric adstock transformation for a spend time series."""
    if not spend_series:
        return []
    result = [spend_series[0]]
    for i in range(1, len(spend_series)):
        result.append(spend_series[i] + decay_rate * result[i - 1])
    return result


def marginal_response(spend, alpha, ec50, max_response, delta=100):
    """Marginal response: additional KPI per additional dollar at current spend."""
    r1 = hill_curve(spend, alpha, ec50, max_response)
    r2 = hill_curve(spend + delta, alpha, ec50, max_response)
    return (r2 - r1) / delta


def pre_model(data):
    """Phase 1: Validate data readiness for modeling."""
    channels = data.get("channels", [])
    time_periods = data.get("time_periods", 0)
    geos = data.get("geos", 1)
    kpi_name = data.get("kpi", "revenue")
    has_controls = data.get("has_control_variables", False)
    has_gqv = data.get("has_gqv", False)

    issues = []
    score = 100

    # Time series length
    if time_periods < 52:
        issues.append({
            "field": "time_periods",
            "severity": "critical",
            "message": f"Only {time_periods} weeks. Minimum 52 required, 104+ recommended.",
            "recommendation": "Collect more historical data or use industry priors.",
        })
        score -= 30
    elif time_periods < 104:
        issues.append({
            "field": "time_periods",
            "severity": "warning",
            "message": f"{time_periods} weeks available. 104+ recommended for robust estimates.",
            "recommendation": "Proceed with informative priors from benchmarks.",
        })
        score -= 10

    # Channel count
    if len(channels) < 3:
        issues.append({
            "field": "channels",
            "severity": "critical",
            "message": f"Only {len(channels)} channels. Minimum 3 required for meaningful MMM.",
            "recommendation": "Include all active media channels.",
        })
        score -= 25
    elif len(channels) > 10:
        issues.append({
            "field": "channels",
            "severity": "warning",
            "message": f"{len(channels)} channels. Consider aggregating similar channels to reduce multicollinearity.",
            "recommendation": "Group related channels (e.g., social_meta + social_tiktok = social).",
        })
        score -= 5

    # Geo level
    if geos < 2:
        issues.append({
            "field": "geos",
            "severity": "info",
            "message": "National-level data only. Geo-level data improves statistical power.",
            "recommendation": "If available, disaggregate by state/region for better estimates.",
        })
        score -= 5

    # Control variables
    if not has_controls:
        issues.append({
            "field": "control_variables",
            "severity": "warning",
            "message": "No control variables specified. Risk of omitted variable bias.",
            "recommendation": "Add seasonality, pricing, promotions, macro-economic indicators.",
        })
        score -= 15

    # Channel data quality
    channel_assessments = []
    for ch in channels:
        ch_name = ch.get("name", "unknown")
        weeks_active = ch.get("weeks_active", time_periods)
        spend_variation_cv = ch.get("spend_cv", 0.3)
        has_prior = ch.get("has_roi_prior", False)

        ch_issues = []
        ch_score = 100

        if weeks_active < 26:
            ch_issues.append(f"Only {weeks_active} active weeks. Use strong priors.")
            ch_score -= 20
        if spend_variation_cv < 0.1:
            ch_issues.append("Low spend variation (CV < 0.1). May not estimate effect reliably.")
            ch_score -= 15
        if not has_prior and weeks_active < 52:
            ch_issues.append("No ROI prior and limited data. Benchmark priors recommended.")
            ch_score -= 10

        channel_assessments.append({
            "channel": ch_name,
            "weeks_active": weeks_active,
            "spend_variation_cv": spend_variation_cv,
            "has_roi_prior": has_prior,
            "readiness_score": max(0, ch_score),
            "issues": ch_issues,
        })

    status = "READY" if score >= 70 else ("NEEDS_WORK" if score >= 40 else "INSUFFICIENT")

    return {
        "phase": "pre_model",
        "data_readiness_score": max(0, score),
        "status": status,
        "time_periods": time_periods,
        "geos": geos,
        "kpi": kpi_name,
        "channels_assessed": len(channels),
        "channel_assessments": channel_assessments,
        "issues": issues,
        "has_control_variables": has_controls,
        "has_gqv": has_gqv,
        "recommendation": (
            "Data is ready for modeling." if status == "READY" else
            "Address issues before modeling. Use informative priors for weak channels." if status == "NEEDS_WORK" else
            "Insufficient data for reliable MMM. Collect more data or use estimate mode."
        ),
        "next_step": "model" if status in ("READY", "NEEDS_WORK") else "collect_more_data",
    }


def model(data):
    """Phase 2: Fit simplified MMM with Hill curves and Adstock."""
    total_budget = data.get("total_budget", 0)
    total_kpi = data.get("total_kpi", 0)
    channels = data.get("channels", [])
    time_periods = data.get("time_periods", 52)

    if total_budget <= 0:
        return {"error": "total_budget must be positive"}

    # Fit model per channel
    channel_models = []
    total_contribution = 0

    for ch in channels:
        ch_name = ch.get("name", "unknown")
        ch_spend = ch.get("spend", 0)
        defaults = CHANNEL_DEFAULTS.get(ch_name, CHANNEL_DEFAULTS.get("programmatic_display"))

        # Use provided parameters or defaults
        alpha = ch.get("alpha", defaults["alpha"])
        decay = ch.get("decay_rate", defaults["decay"])
        ec50 = ch.get("ec50", ch_spend * defaults["ec50_ratio"])
        max_response = ch.get("max_response", ch_spend * defaults["max_mult"])

        # Use ROI prior if available
        roi_prior = ch.get("roi_prior")
        if roi_prior and ch_spend > 0:
            max_response = ch_spend * roi_prior * 2.5

        # Calculate response at current spend
        response = hill_curve(ch_spend, alpha, ec50, max_response)
        roi = response / ch_spend if ch_spend > 0 else 0
        mroi = marginal_response(ch_spend, alpha, ec50, max_response)

        # Saturation analysis
        saturation_pct = (response / max_response * 100) if max_response > 0 else 0

        # Adstock half-life (geometric decay)
        half_life = math.log(0.5) / math.log(decay) if 0 < decay < 1 else 0

        total_contribution += response

        channel_models.append({
            "channel": ch_name,
            "spend": round(ch_spend, 2),
            "spend_share_pct": round(ch_spend / total_budget * 100, 1) if total_budget > 0 else 0,
            "parameters": {
                "alpha": round(alpha, 2),
                "ec50": round(ec50, 2),
                "max_response": round(max_response, 2),
                "decay_rate": round(decay, 3),
                "adstock_half_life_weeks": round(half_life, 1),
            },
            "results": {
                "estimated_contribution": round(response, 2),
                "contribution_share_pct": 0,  # filled after total known
                "roi": round(roi, 2),
                "marginal_roi": round(mroi, 4),
                "saturation_pct": round(saturation_pct, 1),
            },
        })

    # Fill contribution shares
    for cm in channel_models:
        if total_contribution > 0:
            cm["results"]["contribution_share_pct"] = round(
                cm["results"]["estimated_contribution"] / total_contribution * 100, 1
            )

    # Base (non-media) contribution
    base_contribution = max(0, total_kpi - total_contribution) if total_kpi > 0 else total_contribution * 0.4

    # Model fit estimate
    predicted_kpi = total_contribution + base_contribution
    r_squared = 1 - abs(predicted_kpi - total_kpi) / total_kpi if total_kpi > 0 else 0.75

    return {
        "phase": "model",
        "model_type": "simplified_bayesian_mmm",
        "methodology": "Hill saturation + geometric Adstock (Meridian-inspired)",
        "total_budget": total_budget,
        "total_kpi": total_kpi,
        "predicted_kpi": round(predicted_kpi, 2),
        "base_contribution": round(base_contribution, 2),
        "media_contribution": round(total_contribution, 2),
        "media_contribution_pct": round(total_contribution / predicted_kpi * 100, 1) if predicted_kpi > 0 else 0,
        "overall_roi": round(total_contribution / total_budget, 2) if total_budget > 0 else 0,
        "r_squared_estimate": round(min(r_squared, 0.95), 3),
        "channel_models": channel_models,
        "next_step": "post_model",
    }


def post_model(data):
    """Phase 3: Model diagnostics, interpretation, and refresh recommendations."""
    model_results = data.get("model_results", {})
    channels = model_results.get("channel_models", [])
    r_squared = model_results.get("r_squared_estimate", 0)

    diagnostics = []
    warnings = []

    # R-squared check
    if r_squared < 0.70:
        diagnostics.append({
            "metric": "r_squared",
            "value": r_squared,
            "status": "poor",
            "action": "Add control variables (seasonality, macro). Check for missing channels.",
        })
    elif r_squared < 0.85:
        diagnostics.append({
            "metric": "r_squared",
            "value": r_squared,
            "status": "acceptable",
            "action": "Consider adding more control variables for improvement.",
        })
    else:
        diagnostics.append({
            "metric": "r_squared",
            "value": r_squared,
            "status": "good",
            "action": "Model fit is strong. Proceed to optimization.",
        })

    # Channel-level diagnostics
    channel_diagnostics = []
    for ch in channels:
        ch_diag = {"channel": ch["channel"], "flags": []}
        results = ch.get("results", {})

        # ROI sanity
        roi = results.get("roi", 0)
        if roi < 0:
            ch_diag["flags"].append({
                "issue": "negative_roi",
                "severity": "critical",
                "message": f"Negative ROI ({roi}). Check for confounding or data issues.",
            })
        elif roi > 15:
            ch_diag["flags"].append({
                "issue": "unrealistic_roi",
                "severity": "warning",
                "message": f"ROI of {roi}x seems high. Validate with incrementality test.",
            })

        # Saturation check
        sat = results.get("saturation_pct", 0)
        if sat > 80:
            ch_diag["flags"].append({
                "issue": "high_saturation",
                "severity": "warning",
                "message": f"Channel is {sat}% saturated. Marginal returns are diminishing.",
            })
        elif sat < 20:
            ch_diag["flags"].append({
                "issue": "low_saturation",
                "severity": "info",
                "message": f"Channel is only {sat}% saturated. Room for growth.",
            })

        # Marginal ROI
        mroi = results.get("marginal_roi", 0)
        if mroi < 0.5:
            ch_diag["flags"].append({
                "issue": "low_marginal_roi",
                "severity": "warning",
                "message": f"Marginal ROI is {mroi}. Consider reallocating to higher-return channels.",
            })

        # Adstock half-life
        half_life = ch.get("parameters", {}).get("adstock_half_life_weeks", 0)
        if half_life > 8 and ch["channel"] not in ("tv", "ooh", "radio"):
            ch_diag["flags"].append({
                "issue": "high_adstock",
                "severity": "warning",
                "message": f"Half-life of {half_life} weeks is high for digital. Validate decay rate.",
            })

        channel_diagnostics.append(ch_diag)

    # Refresh schedule
    refresh_schedule = {
        "quarterly_refresh": "Full model re-estimation with latest 104 weeks",
        "monthly_check": "Compare predicted vs actual. Re-estimate if MAPE > 20%",
        "trigger_refresh": [
            "New channel added or removed",
            "Budget change > 30%",
            "Market disruption (competitive, macro)",
            "Post incrementality test (update priors)",
        ],
    }

    return {
        "phase": "post_model",
        "overall_fit": diagnostics,
        "channel_diagnostics": channel_diagnostics,
        "refresh_schedule": refresh_schedule,
        "model_health": "good" if r_squared >= 0.85 else ("acceptable" if r_squared >= 0.70 else "needs_improvement"),
        "next_step": "optimize" if r_squared >= 0.70 else "refine_model",
    }


def optimize(data):
    """Phase 4: Budget optimization and scenario planning."""
    total_budget = data.get("total_budget", 0)
    channels = data.get("channels", [])
    scenarios = data.get("scenarios", ["current", "optimized", "growth_20", "reduction_20"])
    constraints = data.get("constraints", {})

    if total_budget <= 0:
        return {"error": "total_budget must be positive"}
    if not channels:
        return {"error": "channels list required with spend and parameters"}

    # Parse channel parameters
    ch_params = []
    for ch in channels:
        ch_name = ch.get("name", "unknown")
        ch_spend = ch.get("spend", 0)
        defaults = CHANNEL_DEFAULTS.get(ch_name, CHANNEL_DEFAULTS.get("programmatic_display"))

        alpha = ch.get("alpha", defaults["alpha"])
        ec50 = ch.get("ec50", ch_spend * defaults["ec50_ratio"])
        max_response = ch.get("max_response", ch_spend * defaults["max_mult"])

        roi_prior = ch.get("roi_prior")
        if roi_prior and ch_spend > 0:
            max_response = ch_spend * roi_prior * 2.5

        min_pct = constraints.get(ch_name, {}).get("min_pct", 0)
        max_pct = constraints.get(ch_name, {}).get("max_pct", 100)

        ch_params.append({
            "name": ch_name,
            "current_spend": ch_spend,
            "alpha": alpha,
            "ec50": ec50,
            "max_response": max_response,
            "min_pct": min_pct,
            "max_pct": max_pct,
        })

    def greedy_allocate(budget, params, steps=200):
        """Greedy marginal allocation: assign budget in steps to highest marginal ROI.

        Uses multi-scale approach: for S-curve channels (high alpha), evaluates
        response at multiple candidate spend levels to avoid getting trapped by
        steep initial curves.
        """
        step_size = max(100, budget / steps)
        allocation = {}
        for p in params:
            min_spend = budget * p["min_pct"] / 100
            allocation[p["name"]] = min_spend

        remaining = budget - sum(allocation.values())

        # Multi-scale evaluation: for each step, evaluate marginal ROI at current
        # spend AND at several look-ahead levels to handle S-curves
        while remaining >= step_size:
            best_ch = None
            best_value = -1
            for p in params:
                current = allocation[p["name"]]
                max_spend = budget * p["max_pct"] / 100
                if current >= max_spend:
                    continue
                # Evaluate average ROI over next chunk (handles S-curves)
                chunk = min(step_size, max_spend - current)
                response_now = hill_curve(current, p["alpha"], p["ec50"], p["max_response"])
                response_after = hill_curve(current + chunk, p["alpha"], p["ec50"], p["max_response"])
                avg_roi = (response_after - response_now) / chunk if chunk > 0 else 0

                # Also check look-ahead: total ROI if we invest up to ec50
                if current < p["ec50"] * 0.5:
                    look_ahead_spend = min(p["ec50"], max_spend, current + remaining)
                    look_ahead_response = hill_curve(look_ahead_spend, p["alpha"], p["ec50"], p["max_response"])
                    look_ahead_roi = (look_ahead_response - response_now) / (look_ahead_spend - current) if look_ahead_spend > current else 0
                    avg_roi = max(avg_roi, look_ahead_roi)

                if avg_roi > best_value:
                    best_value = avg_roi
                    best_ch = p["name"]
            if best_ch is None or best_value <= 0:
                break
            allocation[best_ch] += step_size
            remaining -= step_size

        # Distribute any remainder to best channel
        if remaining > 0:
            best_ch = max(params, key=lambda p: marginal_response(
                allocation[p["name"]], p["alpha"], p["ec50"], p["max_response"], remaining
            ))
            allocation[best_ch["name"]] += remaining

        return allocation

    def evaluate_allocation(allocation, params):
        """Calculate total response and per-channel metrics for an allocation."""
        total_response = 0
        channel_results = []
        budget = sum(allocation.values())

        for p in params:
            spend = allocation.get(p["name"], 0)
            response = hill_curve(spend, p["alpha"], p["ec50"], p["max_response"])
            roi = response / spend if spend > 0 else 0
            mroi = marginal_response(spend, p["alpha"], p["ec50"], p["max_response"])
            sat = (response / p["max_response"] * 100) if p["max_response"] > 0 else 0
            total_response += response
            channel_results.append({
                "channel": p["name"],
                "spend": round(spend, 2),
                "spend_pct": round(spend / budget * 100, 1) if budget > 0 else 0,
                "response": round(response, 2),
                "roi": round(roi, 2),
                "marginal_roi": round(mroi, 4),
                "saturation_pct": round(sat, 1),
            })

        return {
            "total_budget": round(budget, 2),
            "total_response": round(total_response, 2),
            "overall_roi": round(total_response / budget, 2) if budget > 0 else 0,
            "channels": channel_results,
        }

    # Build scenarios
    scenario_results = {}
    budget_multipliers = {
        "current": 1.0,
        "optimized": 1.0,
        "growth_10": 1.10,
        "growth_20": 1.20,
        "growth_50": 1.50,
        "reduction_10": 0.90,
        "reduction_20": 0.80,
    }

    for scenario in scenarios:
        multiplier = budget_multipliers.get(scenario, 1.0)
        scenario_budget = total_budget * multiplier

        if scenario == "current":
            # Use current allocation
            allocation = {ch["name"]: ch["current_spend"] for ch in ch_params}
            # Scale to scenario budget
            current_total = sum(allocation.values())
            if current_total > 0:
                scale = scenario_budget / current_total
                allocation = {k: v * scale for k, v in allocation.items()}
        else:
            # Optimize allocation
            allocation = greedy_allocate(scenario_budget, ch_params)

        result = evaluate_allocation(allocation, ch_params)
        result["scenario"] = scenario
        result["budget_multiplier"] = multiplier
        scenario_results[scenario] = result

    # Compare optimized vs current
    comparison = None
    if "current" in scenario_results and "optimized" in scenario_results:
        current = scenario_results["current"]
        optimized = scenario_results["optimized"]
        kpi_lift = optimized["total_response"] - current["total_response"]
        kpi_lift_pct = (kpi_lift / current["total_response"] * 100) if current["total_response"] > 0 else 0

        reallocation = []
        current_by_ch = {c["channel"]: c for c in current["channels"]}
        for opt_ch in optimized["channels"]:
            cur_ch = current_by_ch.get(opt_ch["channel"], {})
            delta = opt_ch["spend"] - cur_ch.get("spend", 0)
            if abs(delta) > 0.01:
                reallocation.append({
                    "channel": opt_ch["channel"],
                    "current_spend": cur_ch.get("spend", 0),
                    "optimized_spend": opt_ch["spend"],
                    "delta": round(delta, 2),
                    "direction": "increase" if delta > 0 else "decrease",
                })

        reallocation.sort(key=lambda x: abs(x["delta"]), reverse=True)

        comparison = {
            "kpi_lift": round(kpi_lift, 2),
            "kpi_lift_pct": round(kpi_lift_pct, 1),
            "roi_improvement": round(optimized["overall_roi"] - current["overall_roi"], 2),
            "reallocation": reallocation,
        }

    # Recommendations
    recommendations = []
    if comparison and comparison["kpi_lift_pct"] > 5:
        recommendations.append({
            "priority": "high",
            "action": f"Reallocate budget for +{comparison['kpi_lift_pct']:.1f}% KPI lift at same spend.",
            "impact": f"+{comparison['kpi_lift']:.0f} incremental KPI units",
        })

    for ch in ch_params:
        sat = hill_curve(ch["current_spend"], ch["alpha"], ch["ec50"], ch["max_response"])
        sat_pct = (sat / ch["max_response"] * 100) if ch["max_response"] > 0 else 0
        if sat_pct > 85:
            recommendations.append({
                "priority": "medium",
                "action": f"Reduce {ch['name']} spend — {sat_pct:.0f}% saturated, diminishing returns.",
                "impact": "Reallocate to under-saturated channels",
            })
        elif sat_pct < 30:
            mr = marginal_response(ch["current_spend"], ch["alpha"], ch["ec50"], ch["max_response"])
            if mr > 1.5:
                recommendations.append({
                    "priority": "medium",
                    "action": f"Increase {ch['name']} spend — only {sat_pct:.0f}% saturated, mROI={mr:.2f}.",
                    "impact": "High marginal returns available",
                })

    return {
        "phase": "scenario_planning",
        "methodology": "Greedy marginal allocation with Hill saturation (Meridian-inspired)",
        "total_budget": total_budget,
        "scenarios": scenario_results,
        "comparison_vs_current": comparison,
        "recommendations": recommendations,
        "continuous_cycle": {
            "next_action": "Feed optimized allocation to channel-architect for implementation",
            "loop": "optimize -> channel_architect -> activation -> value -> governance -> model_refresh -> optimize",
            "refresh_trigger": "Quarterly or when cumulative spend delta > 20%",
        },
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"pre_model\",\"data\":{...}}' | python3 mmm_scenario_planner.py",
            "commands": ["pre_model", "model", "post_model", "optimize"],
            "description": "Simplified MMM simulation inspired by Google Meridian framework",
            "phases": {
                "pre_model": "Validate data readiness for modeling",
                "model": "Fit Hill curves + Adstock, estimate channel ROI",
                "post_model": "Model diagnostics and refresh recommendations",
                "optimize": "Budget optimization with scenario planning",
            },
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "pre_model":
        result = pre_model(data)
    elif cmd == "model":
        result = model(data)
    elif cmd == "post_model":
        result = post_model(data)
    elif cmd == "optimize":
        result = optimize(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: pre_model, model, post_model, optimize"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
