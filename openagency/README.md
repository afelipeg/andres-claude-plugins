<p align="center">
  <h1 align="center">OpenAgency</h1>
  <p align="center">
    <strong>Open-source advertising agency toolkit for solo marketers.</strong>
    <br />
    Find where your ad budget leaks money. Optimize channels. Generate executive reports.
    <br />
    Connect live to Google Ads, Meta, DV360, TikTok, and Amazon — all from one command.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#platform-connectors">Connectors</a> &bull;
  <a href="#engines">Engines</a> &bull;
  <a href="#web-dashboard">Dashboard</a> &bull;
  <a href="#commands">Commands</a> &bull;
  <a href="#llm-integration">LLM Integration</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/openagency?style=flat-square" alt="npm" />
  <img src="https://img.shields.io/github/license/openagency/openagency?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/engines-4-blue?style=flat-square" alt="4 Engines" />
  <img src="https://img.shields.io/badge/skills-33-green?style=flat-square" alt="33 Skills" />
  <img src="https://img.shields.io/badge/platforms-6-orange?style=flat-square" alt="6 Platforms" />
</p>

---

## The Problem

The Big 6 monopoly of old-fashion advertising holding companies charge millions for media planning, measurement, and optimization capabilities that remain locked behind paywalls and proprietary processes.

**Solo marketers and small businesses are priced out.**

## The Solution

OpenAgency gives any solo marketer agency-grade tools: waste detection, budget optimization, campaign management, and executive reporting. Connect your ad platforms, pull live data, and get answers instantly. No contracts. MIT licensed.

```bash
npx openagency
```

That's it. Connect your platforms. See where your money leaks.

---

## Quick Start

### Interactive (recommended)

```bash
npx openagency
```

Launches an interactive menu. Pick "See a demo" to get started instantly, or "Connect platform" to link your ad accounts.

### One-liner

```bash
npx openagency scan --demo
```

Output:

```
  WASTE WATERFALL
  =================================================================

  Gross Spend                                $500,000

  +-- Non-Working Overhead             - $70,000    14.0%
  |   #######
  +-- Supply Chain Waste               - $45,000     9.0%
  |   #####
  +-- Quality Waste                    - $55,000    11.0%
  |   ######
  +-- Audience Waste                   - $40,000     8.0%
  |   ####
  +-- Optimization Waste               - $25,000     5.0%
  |   ###
  +-- Measurement Waste                - $15,000     3.0%
  |   ##
  =================================================================
  Productive Spend                           $250,000    50.0%

  Total Waste: $250,000 (50.0%)
```

### Quick estimate from budget

```bash
npx openagency scan --budget 250000 --industry retail
```

### Analyze your real data

```bash
npx openagency scan --file your-data.json
```

### AI-powered executive report

```bash
npx openagency report leak-detector --demo
```

Requires `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in env. Falls back to structured data without.

---

## Platform Connectors

OpenAgency connects directly to **6 advertising platforms** via OAuth2. No more exporting CSVs manually — pull live campaign data at any granularity level.

### Supported Platforms

| Platform | API | Data Levels | Key Metrics |
|----------|-----|-------------|-------------|
| **Google Ads** | Ads API v17 (GAQL) | Campaign, Ad Group, Ad | spend, impressions, clicks, conversions, revenue, CPA, search impression share, video views, view-through conversions |
| **Meta Ads** | Marketing API v21.0 | Campaign, Ad Set, Ad | spend, impressions, clicks, conversions, revenue, reach, frequency, video quartiles (p25/p50/p75/p100), link clicks, unique clicks |
| **DV360** | Reporting API v3 | Insertion Order, Line Item, Creative | spend, impressions, clicks, conversions, revenue, viewable impressions, TrueView views/rate, reach, frequency |
| **TikTok Ads** | Marketing API v1.3 | Campaign, Ad Group, Ad | spend, impressions, clicks, conversions, revenue, reach, frequency, video plays, video quartiles, conversion rate |
| **TikTok Shop** | Shop API v2 | Daily Aggregate, Product-level | orders, revenue, GMV, units sold, refund amount, product details |
| **Amazon Ads** | Advertising API v3 | Campaign, Ad Group | spend, impressions, clicks, conversions, revenue, ACoS, DPV, viewable impressions, new-to-brand conversions (across SP, SB, SD) |

### Connect a Platform

```bash
# Interactive — opens browser for OAuth2
openagency connect

# Direct
openagency connect meta_ads
openagency connect google_ads
openagency connect dv360
openagency connect tiktok_ads
openagency connect tiktok_shop
openagency connect amazon_ads
```

### Sync Data

```bash
# Sync all connected platforms (last 30 days)
openagency sync

# Sync specific platform with custom range
openagency sync --platform google_ads --days 90

# Sync and run an engine on the results
openagency sync --platform meta_ads --engine leak-detector
```

### Disconnect

```bash
openagency disconnect meta_ads
```

### Environment Variables

```bash
# Google (Ads + DV360)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=    # Google Ads only

# Meta
META_APP_ID=
META_APP_SECRET=

# TikTok Ads
TIKTOK_ADS_APP_ID=
TIKTOK_ADS_SECRET=

# TikTok Shop
TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=

# Amazon Ads
AMAZON_ADS_CLIENT_ID=
AMAZON_ADS_CLIENT_SECRET=
```

### Security

Credentials are encrypted at rest using AES-256-GCM with PBKDF2 key derivation (100k iterations). You set a passphrase on first connect.

| Environment | Storage | Encryption |
|-------------|---------|------------|
| CLI (Node.js) | `~/.openagency/credentials.enc` (mode 0600) | Node crypto AES-256-GCM |
| Web Dashboard | IndexedDB `credentials` store | Web Crypto API AES-256-GCM |

Same passphrase decrypts on either environment.

---

## Engines

OpenAgency ships with **4 computation engines** covering the full advertising lifecycle:

### 1. Leak Detector
> "Where is my money leaking?"

Analyzes your ad spend through a 6-stage waste waterfall (Non-Working -> Supply Chain -> Quality -> Audience -> Optimization -> Measurement -> Productive). Compares against industry benchmarks. Shows exactly where dollars disappear.

**Skills:** `waste-waterfall`, `waste-estimate`, `waste-compare`, `supply-chain-audit`, `media-quality-score`

```bash
openagency run leak-detector waste-waterfall --file spend.json
```

### 2. Media Architect
> "Where should my budget go?"

Optimizes budget allocation across channels using Hill saturation curves and greedy marginal allocation. Includes MMM scenario planning with 6 interactive charts, benchmark tracking, and media plan generation.

**Skills:** `channel-optimize`, `scenario-analysis`, `mmm-pre-model`, `mmm-model`, `mmm-post-model`, `mmm-optimize`, `health-check`, `anomaly-detect`, `generate-plan`

```bash
openagency run media-architect channel-optimize --file channels.json
```

### 3. Campaign Ops
> "Is the campaign on track?"

24-task DAG state machine for campaign lifecycle management. 6 rule-based optimization checks (CPA overshoot, ROAS alerts, pacing, creative fatigue, zero conversions). Cross-channel reallocation.

**Skills:** `create-campaign`, `update-task`, `next-actions`, `campaign-summary`, `optimization-analyze`, `optimization-reallocate`

```bash
openagency run campaign-ops optimization-analyze --file campaign.json
```

### 4. Executive Bridge
> "What's the real ROI?"

Shapley value attribution (game theory), L3->L2->L1 metric translation for C-Suite reporting, platform vs. actual revenue reconciliation, and statistical power analysis for incrementality testing.

**Skills:** `shapley-attribute`, `shapley-compare`, `revenue-translate`, `revenue-compare-channels`, `reconcile`, `data-integrity`, `geo-lift`, `conversion-lift`, `holdout`

```bash
openagency run executive-bridge shapley-attribute --file touchpoints.json
```

---

## Commands

| Command | Description |
|---------|-------------|
| `openagency` | Interactive menu (zero-arg experience) |
| `openagency init` | Setup wizard — configure LLM, run first scan |
| `openagency scan` | Waste detection — the hook command |
| `openagency run <engine> <skill>` | Run any engine skill directly |
| `openagency report <engine>` | AI-powered executive narrative |
| `openagency dashboard` | Web dashboard info & launch instructions |
| `openagency connect [platform]` | OAuth2 connect to an ad platform |
| `openagency sync [--platform] [--days] [--engine]` | Pull live campaign data from connected platforms |
| `openagency disconnect <platform>` | Remove a platform connection |

---

## LLM Integration

LLM is **optional and additive**. All 4 engines are pure computation — they run identically with or without an API key. LLM adds narrative interpretation on top.

### Supported Providers

| Provider | Env Variable | Default Model |
|----------|-------------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |
| Ollama | (none — local) | llama3 |

### Setup

```bash
# Option 1: Environment variable (recommended)
export ANTHROPIC_API_KEY=sk-ant-...

# Option 2: Interactive setup
openagency init

# Option 3: Per-command
openagency report leak-detector --demo --provider anthropic --model claude-sonnet-4-20250514
```

### Without LLM

```bash
openagency scan --demo              # Works perfectly — pure computation
openagency report leak-detector --demo --no-llm  # Structured data, no narrative
```

---

## Input Formats

### CSV Auto-Detect (v0.2.0+)

Drop a CSV export from any supported platform and OpenAgency auto-detects the source and maps columns:

- **Google Ads** — Campaign, Ad group, Impressions, Clicks, Cost, Conversions, Conv. value
- **Meta Ads** — Campaign name, Impressions, Link clicks, Amount spent, Results, Purchase ROAS
- **TikTok Ads** — Campaign name, Impression, Click, Cost, Conversion, Total purchase value

```bash
# CLI
openagency scan --file google_ads_export.csv

# Web Dashboard — drag and drop into the upload zone
```

### Live API Data (v0.3.0+)

Connect platforms via OAuth2 and pull data directly — no CSV export needed:

```bash
openagency connect google_ads
openagency sync --platform google_ads --days 30 --engine leak-detector
```

### JSON (Manual)

#### Waste Waterfall (Leak Detector)

```json
{
  "gross_spend": 500000,
  "industry": "retail",
  "non_working": { "agency_fees": 40000, "tech_fees": 20000 },
  "supply_chain": { "dsp_fees": 25000, "ssp_fees": 15000 },
  "quality": { "fraud": 20000, "non_viewable": 15000 },
  "audience": { "off_target": 25000, "frequency_waste": 10000 },
  "optimization": { "poor_pacing": 10000, "stale_creative": 7500 },
  "measurement": { "misattributed": 7500 }
}
```

#### Channel Optimization (Media Architect)

```json
{
  "total_budget": 500000,
  "channels": [
    { "name": "search", "spend": 200000 },
    { "name": "social_meta", "spend": 150000 },
    { "name": "programmatic_display", "spend": 100000 }
  ]
}
```

#### Campaign Data (Campaign Ops)

```json
{
  "campaigns": [
    {
      "name": "Summer Sale",
      "channel": "search",
      "spend": 50000,
      "budget": 60000,
      "impressions": 1000000,
      "clicks": 25000,
      "conversions": 500,
      "revenue": 75000,
      "days_elapsed": 15,
      "days_total": 30,
      "ctr": 2.5,
      "cpa_target": 100
    }
  ]
}
```

---

## Architecture

```
@openagency/types        Zero deps — shared TypeScript interfaces
        |
        v
@openagency/core         Orchestration + LLM + CSV parser + platform-detect
        |
    +---+---+
    |       |
    v       v
@openagency/engines    @openagency/connectors
4 computation engines   6 platform API connectors
(no I/O, no side        OAuth2 + rate limiting +
 effects)               encrypted credentials
    |       |
    +---+---+
        |
        v
  openagency CLI         Commander.js + interactive prompts + renderers
  @openagency/web        Vite + React + Tailwind + Recharts dashboard
```

**Key design principles:**
- Engines are pure computation. They run identically in Node.js, browsers, and tests.
- Connectors handle I/O, auth, and API specifics. Data is normalized into a universal `NormalizedCampaignRow` schema before reaching engines.
- LLM is optional and additive — it adds narrative interpretation on top of structured results.

### Monorepo

```
openagency/
+-- packages/
|   +-- types/          @openagency/types — shared interfaces
|   +-- core/           @openagency/core — orchestration, LLM, CSV parser
|   +-- engines/        @openagency/engines — 4 computation engines
|   +-- connectors/     @openagency/connectors — 6 platform API connectors
+-- apps/
|   +-- cli/            openagency (npm bin)
|   +-- web/            @openagency/web (Vite + React + Tailwind + Recharts)
+-- references/         Industry benchmarks and frameworks
+-- scripts/python/     Original Python reference implementations
```

### Normalized Data Schema

All platform data flows through a universal `NormalizedCampaignRow` before reaching engines:

| Field | Type | Description |
|-------|------|-------------|
| `campaign_name` / `campaign_id` | string | Always present |
| `ad_set_name` / `ad_set_id` | string? | Ad group (Google), Ad set (Meta), Line item (DV360), Ad group (TikTok) |
| `ad_name` / `ad_id` | string? | Individual ad/creative |
| `platform` | string | `google_ads`, `meta_ads`, `dv360`, `tiktok_ads`, `tiktok_shop`, `amazon_ads` |
| `date` | string | YYYY-MM-DD |
| `spend`, `impressions`, `clicks` | number | Core metrics |
| `conversions`, `revenue` | number | Performance metrics |
| `ctr`, `cpc`, `cpa`, `roas` | number | Computed ratios (CTR as fraction: 0.05 = 5%) |
| `reach`, `frequency` | number? | Meta, TikTok, DV360 |
| `video_views`, `video_p25`-`p100` | number? | Video metrics (Meta, TikTok, DV360, Google) |
| `acos`, `dpv`, `new_to_brand_conversions` | number? | Amazon-specific |
| `gmv`, `units_sold`, `refund_amount` | number? | TikTok Shop-specific |

---

## Web Dashboard

OpenAgency includes an interactive web dashboard built with Vite, React, Tailwind CSS, and Recharts.

```bash
# Development
cd apps/web && pnpm dev

# Production build
cd apps/web && pnpm build && pnpm preview
```

**Features:**
- **Platform Integrations page** — connect/disconnect 6 ad platforms, view sync status, set sync intervals
- **Live data sync** — pull campaign data directly from connected platforms with auto-refresh
- **Smart CSV auto-detect** — drop a Google Ads, Meta Ads, or TikTok Ads export and analyze instantly
- **One-click PDF report export** for every engine
- **Saved reports** with IndexedDB persistence (auto-saves, reload/export/delete)
- Waste waterfall visualization with interactive charts
- Channel optimization with current vs. optimized allocation comparison
- MMM scenario planning with 6 interactive charts (saturation curves, marginal returns, budget allocation, ROI comparison, spend vs. response, channel efficiency)
- Campaign DAG timeline with sprint tracking and optimization alerts
- Revenue bridge with L1/L2/L3 financial metrics and efficiency scoring
- Shapley attribution analysis with last-click comparison
- Demo data buttons for all 4 engines
- Sync status indicator in header (colored dots per platform)
- Paste CSV data directly or drag-and-drop files

---

## Development

```bash
# Clone
git clone https://github.com/openagency/openagency.git
cd openagency

# Install
pnpm install

# Build all packages
pnpm run build

# Test (79 tests across 11 test files)
pnpm run test

# Run locally
node apps/cli/dist/index.js scan --demo

# Web dashboard
cd apps/web && pnpm dev
```

---

## Changelog

### v0.3.0 — Platform API Connectors
- Live OAuth2 connectors for Google Ads, Meta Ads, DV360, TikTok Ads, TikTok Shop, Amazon Ads
- Multi-level data fetching: campaign -> ad set/ad group -> ad/creative
- Extended platform-specific metrics (reach, frequency, video quartiles, ACoS, DPV, GMV, etc.)
- Multi-ad-product support for Amazon (Sponsored Products, Sponsored Brands, Sponsored Display)
- Encrypted credential storage (AES-256-GCM) for CLI and browser
- Token-bucket rate limiting per platform with exponential backoff + jitter
- Scheduled sync with configurable intervals (15m / 1h / 6h / 24h / manual)
- New CLI commands: `connect`, `sync`, `disconnect`
- Web dashboard: Integrations page, OAuth popup flow, sync status indicator
- Normalized data schema (`NormalizedCampaignRow`) with 30+ fields across all platforms
- New `@openagency/connectors` package with sub-path exports per platform

### v0.2.0 — Smart CSV & Visualization
- Smart CSV auto-detect for Google Ads, Meta Ads, and TikTok Ads exports
- One-click PDF report export for every engine
- IndexedDB persistence for saved reports
- MMM visualization suite with 6 interactive charts
- Demo button tab switching fixes

### v0.1.0 — Foundation
- 4 computation engines (Leak Detector, Media Architect, Campaign Ops, Executive Bridge)
- 33 skills across all engines
- CLI with interactive menu and one-liner commands
- Web dashboard with Vite + React + Tailwind + Recharts
- Multi-LLM support (Anthropic, OpenAI, Ollama)
- 79 tests across 11 test files

---

## Roadmap

- [x] **v0.1.0** — 4 engines, 33 skills, CLI, web dashboard, multi-LLM
- [x] **v0.2.0** — Smart CSV auto-detect (Google/Meta/TikTok), PDF export, IndexedDB persistence
- [x] **v0.3.0** — Platform API connectors (6 platforms), multi-level data, encrypted credentials, scheduled sync
- [ ] **v0.4.0** — Docker image, hosted cloud version

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Run tests
pnpm run test

# Type check
pnpm run typecheck

# Build all
pnpm run build
```

---

## License

MIT. Use it, fork it, ship it.

---

<p align="center">
  <strong>Built to democratize advertising.</strong>
  <br />
  Stop paying holding company markups. Start using OpenAgency.
</p>
