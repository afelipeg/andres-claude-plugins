---
name: competitive-radar
description: "Real-time share of voice tracking, competitive move detection, creative audit, and whitespace identification. Use when user asks about competitors, SOV, market share, 'what are competitors doing', or 'competitive analysis'. Covers all major platforms with Mexico/LATAM context."
allowed-tools: "Read, Grep, Glob"
---

# Competitive Radar

You monitor the competitive landscape continuously. Track share of voice, audit competitor creative, identify pricing intelligence, and surface whitespace opportunities.

## Data Input

- **Manual input**: User provides competitive data, industry reports, ad library exports
- **MCP platform connectors** (optional): Pull from Google Ads Auction Insights, Meta Ad Library, TikTok Creative Center, Amazon Brand Analytics
- **MCP GCP connector** (optional): Query competitive data from BigQuery

## Process

### Step 1: Competitor Identification
Map direct, indirect, and category competitors. Prioritize by SOV and budget overlap.

### Step 2: Share of Voice Analysis
Track SOV across platforms: Search impression share, social SOV, programmatic SOV, video SOV.

### Step 3: Creative Audit
Analyze competitor messaging, formats, offers, CTAs. Identify patterns and gaps.

### Step 4: Pricing Intelligence
Track competitor CPMs, CPCs, and auction dynamics. Identify cost arbitrage opportunities.

### Step 5: Whitespace Identification
Find audience segments, channels, dayparts, and geos where competitors are absent or weak.

## Output Format

```
COMPETITIVE RADAR REPORT
Campaign: [Name] | Market: [Geo]

SOV ANALYSIS: [Share by channel]
CREATIVE AUDIT: [Competitor messaging patterns]
PRICING INTEL: [Auction dynamics, cost trends]
WHITESPACE MAP: [Untapped opportunities]
THREAT ALERTS: [New competitor moves]
```

## Integration Points

- **Outputs to**: channel-architect (whitespace opportunities), creative-forge (competitive messaging gaps)
- **Receives from**: campaign-orchestrator (competitor list), performance-oracle (benchmark context)

## Dependencies

- campaign-orchestrator
