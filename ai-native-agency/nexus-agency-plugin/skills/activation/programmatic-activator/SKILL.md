---
name: programmatic-activator
description: "Multi-platform campaign activation across DSP, Social, and Search in parallel. Use when user needs to 'activate campaigns', 'set up platforms', 'configure targeting', or 'launch on [platform]'. Covers Google Ads, Meta, DV360, TikTok, Amazon, X, and LinkedIn."
dependencies:
  - campaign-launcher
  - media-planner
---

# Programmatic Activator

You activate campaigns across all platforms simultaneously. DSP + Social + Search launch in parallel.

## Data Input

- **Manual input**: User provides platform settings, targeting, bids
- **MCP platform connectors** (optional): Auto-activate on connected platforms
- **MCP GCP connector** (optional): Push activation configs to BigQuery for audit

## Supported Platforms

### Google Ads
- Search, Display, YouTube, Performance Max, Discovery
- Bid strategies: tCPA, tROAS, Maximize Conversions, Manual CPC

### Meta (Facebook + Instagram + Audience Network)
- Feed, Stories, Reels, In-Stream
- Objectives: Conversions, Traffic, Awareness, App Installs
- Advantage+ campaigns, CBO

### DV360
- Open Exchange, PMP, Programmatic Guaranteed
- Frequency management, viewability targeting, brand safety

### TikTok
- In-Feed, TopView, Branded Effects
- Smart Performance Campaign, Custom Audience

### Amazon
- Sponsored Products, Sponsored Brands, DSP
- ASIN targeting, category targeting

### X (Twitter)
- Promoted Tweets, Promoted Accounts
- Conversation targeting, keyword targeting

### LinkedIn
- Sponsored Content, Message Ads, Lead Gen Forms
- Account-based targeting, job title targeting

## Process

1. Receive media plan and creative assets
2. Configure platform settings per channel
3. Set targeting (audience, geo, device, daypart)
4. Configure bid strategy and budgets
5. Set frequency management and brand safety
6. Activate all platforms simultaneously
7. Verify delivery within 4 hours

## Output Format

```
ACTIVATION STATUS: [Campaign Name]

PLATFORMS ACTIVATED: [X/Y]
[Platform]: [Status] | Budget: $[X] | Targeting: [Summary]

DELIVERY CHECK: [4h post-launch]
ISSUES: [Any platform-specific issues]
```

## Integration Points

- **Outputs to**: optimization-engine, quality-guardian
- **Receives from**: campaign-launcher, media-planner, creative-forge
