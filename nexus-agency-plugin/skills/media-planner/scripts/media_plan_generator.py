#!/usr/bin/env python3
"""
Media Plan Generator
Auto-generates flowcharts, insertion orders, spec sheets, and UTM taxonomy.

Usage: echo '{"command":"generate","data":{...}}' | python3 media_plan_generator.py
Commands: generate
"""

import json
import sys
from datetime import datetime

PLATFORM_SPECS = {
    "google_ads": {
        "search": {"headline_chars": 30, "description_chars": 90, "headlines_max": 15},
        "display": {"formats": ["300x250", "728x90", "160x600", "320x50"],
                    "max_file_kb": 150, "file_types": ["jpg", "png", "gif", "html5"]},
        "video": {"formats": ["16:9", "1:1", "9:16"], "max_duration_sec": 180,
                  "max_file_mb": 256, "file_types": ["mp4", "mov"]},
    },
    "meta": {
        "feed": {"image_ratio": "1:1", "image_px": "1080x1080", "headline_chars": 40,
                 "text_chars": 125, "max_file_mb": 30},
        "stories": {"image_ratio": "9:16", "image_px": "1080x1920",
                    "max_duration_sec": 15},
        "reels": {"video_ratio": "9:16", "max_duration_sec": 90},
    },
    "dv360": {
        "display": {"formats": ["300x250", "728x90", "160x600", "970x250", "320x50"],
                    "max_file_kb": 200, "file_types": ["jpg", "png", "html5"]},
        "video": {"formats": ["16:9"], "max_duration_sec": 120,
                  "file_types": ["mp4"]},
    },
    "tiktok": {
        "in_feed": {"video_ratio": "9:16", "min_duration_sec": 5,
                    "max_duration_sec": 60, "max_file_mb": 500},
        "topview": {"video_ratio": "9:16", "max_duration_sec": 60},
    },
    "amazon": {
        "sponsored_products": {"headline_chars": 50, "image_px": "1000x1000"},
        "dsp_display": {"formats": ["300x250", "728x90", "160x600", "970x250"]},
    },
}


def generate(data):
    """Generate complete media plan with all deliverables."""
    campaign_name = data.get("campaign_name", "Campaign")
    client = data.get("client", "Client")
    channels = data.get("channels", [])
    start_date = data.get("start_date", datetime.now().strftime("%Y-%m-%d"))

    # Flowchart
    flowchart = []
    for ch in channels:
        name = ch["name"]
        monthly_budget = ch.get("monthly_budget", 0)
        duration = ch.get("duration_months", 3)
        months = []
        for m in range(duration):
            months.append({
                "month": m + 1,
                "budget": round(monthly_budget, 2),
            })
        flowchart.append({
            "channel": name,
            "platform": ch.get("platform", ""),
            "total_budget": round(monthly_budget * duration, 2),
            "months": months,
        })

    total_budget = sum(f["total_budget"] for f in flowchart)

    # Insertion Orders
    ios = []
    for ch in channels:
        io = {
            "io_number": f"IO-{campaign_name[:3].upper()}-{ch['name'][:3].upper()}-001",
            "advertiser": client,
            "campaign": campaign_name,
            "channel": ch["name"],
            "platform": ch.get("platform", ""),
            "start_date": start_date,
            "total_budget": round(
                ch.get("monthly_budget", 0) * ch.get("duration_months", 3), 2
            ),
            "payment_terms": "Net 30",
            "buying_model": ch.get("buying_model", "auction"),
        }
        ios.append(io)

    # Spec Sheets
    specs = []
    for ch in channels:
        platform = ch.get("platform", "")
        platform_specs = PLATFORM_SPECS.get(platform, {})
        specs.append({
            "channel": ch["name"],
            "platform": platform,
            "ad_specs": platform_specs,
        })

    # UTM Taxonomy
    utms = []
    for ch in channels:
        utm = {
            "channel": ch["name"],
            "utm_source": ch.get("platform", ch["name"]).replace("_", ""),
            "utm_medium": _classify_medium(ch["name"]),
            "utm_campaign": f"{client.lower().replace(' ', '_')}_{campaign_name.lower().replace(' ', '_')}",
            "utm_content": "{ad_name}",
            "utm_term": "{keyword}" if "search" in ch["name"].lower() else "",
            "full_utm": "",
        }
        utm["full_utm"] = (
            f"?utm_source={utm['utm_source']}"
            f"&utm_medium={utm['utm_medium']}"
            f"&utm_campaign={utm['utm_campaign']}"
            f"&utm_content={utm['utm_content']}"
        )
        if utm["utm_term"]:
            utm["full_utm"] += f"&utm_term={utm['utm_term']}"
        utms.append(utm)

    return {
        "campaign": campaign_name,
        "client": client,
        "start_date": start_date,
        "total_budget": round(total_budget, 2),
        "flowchart": flowchart,
        "insertion_orders": ios,
        "spec_sheets": specs,
        "utm_taxonomy": utms,
    }


def _classify_medium(channel_name):
    """Classify channel into UTM medium."""
    name = channel_name.lower()
    if "search" in name:
        return "cpc"
    elif "social" in name or "meta" in name or "tiktok" in name or "facebook" in name:
        return "paid_social"
    elif "display" in name or "programmatic" in name:
        return "display"
    elif "video" in name or "youtube" in name:
        return "video"
    elif "email" in name:
        return "email"
    elif "native" in name:
        return "native"
    else:
        return "paid"


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print(json.dumps({
            "usage": "echo '{\"command\":\"generate\",\"data\":{...}}' | python3 media_plan_generator.py",
            "commands": ["generate"],
        }, indent=2))
        return

    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input. Use --help for usage."}))
        sys.exit(1)

    payload = json.loads(raw)
    cmd = payload.get("command", "")
    data = payload.get("data", {})

    if cmd == "generate":
        result = generate(data)
    else:
        result = {"error": f"Unknown command: {cmd}. Valid: generate"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
