<p align="center">
  <h1 align="center">OpenAgency</h1>
  <p align="center">
    <strong>Open-source advertising agency toolkit for solo marketers.</strong>
    <br />
    Find where your ad budget leaks money. Optimize channels. Generate executive reports.
    <br />
    All from one command.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
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
</p>

---

## The Problem

Big advertising holding companies (WPP, Publicis, Omnicom, IPG, Dentsu, Havas) charge millions for media planning, measurement, and optimization capabilities that remain locked behind paywalls and proprietary processes.

**Solo marketers and small businesses are priced out.**

## The Solution

OpenAgency gives any solo marketer agency-grade tools: waste detection, budget optimization, campaign management, and executive reporting. One command. No contracts. MIT licensed.

```bash
npx openagency
```

That's it. Paste your data. See where your money leaks.

---

## Quick Start

### Interactive (recommended)

```bash
npx openagency
```

Launches an interactive menu. Pick "See a demo" to get started instantly.

### One-liner

```bash
npx openagency scan --demo
```

Output:

```
  WASTE WATERFALL
  ═══════════════════════════════════════════════════════════

  Gross Spend                                $500,000

  ├─ Non-Working Overhead             - $70,000    14.0%
  │  ███████
  ├─ Supply Chain Waste               - $45,000     9.0%
  │  █████
  ├─ Quality Waste                    - $55,000    11.0%
  │  ██████
  ├─ Audience Waste                   - $40,000     8.0%
  │  ████
  ├─ Optimization Waste               - $25,000     5.0%
  │  ███
  ├─ Measurement Waste                - $15,000     3.0%
  │  ██
  ═══════════════════════════════════════════════════════════
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

## Engines

OpenAgency ships with **4 computation engines** covering the full advertising lifecycle:

### 1. Leak Detector
> "Where is my money leaking?"

Analyzes your ad spend through a 6-stage waste waterfall (Non-Working → Supply Chain → Quality → Audience → Optimization → Measurement → Productive). Compares against industry benchmarks. Shows exactly where dollars disappear.

**Skills:** `waste-waterfall`, `waste-estimate`, `waste-compare`, `supply-chain-audit`, `media-quality-score`

```bash
openagency run leak-detector waste-waterfall --file spend.json
```

### 2. Media Architect
> "Where should my budget go?"

Optimizes budget allocation across channels using Hill saturation curves and greedy marginal allocation. Includes MMM scenario planning, benchmark tracking, and media plan generation.

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

Shapley value attribution (game theory), L3→L2→L1 metric translation for C-Suite reporting, platform vs. actual revenue reconciliation, and statistical power analysis for incrementality testing.

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

## Input Format

### Waste Waterfall (Leak Detector)

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

### Channel Optimization (Media Architect)

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

### Campaign Data (Campaign Ops)

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
@openagency/types     Zero deps — shared TypeScript interfaces
        │
        v
@openagency/core      Orchestration + LLM + math utilities
        │
        v
@openagency/engines   4 pure computation engines (no I/O, no side effects)
        │
        v
  openagency CLI      Commander.js + interactive prompts + renderers
```

**Key design principle:** Engines are pure computation. They run identically in Node.js, browsers, and tests. LLM is optional and additive — it adds narrative interpretation on top of structured results.

### Monorepo

```
openagency/
├── packages/
│   ├── types/        @openagency/types
│   ├── core/         @openagency/core
│   └── engines/      @openagency/engines
├── apps/
│   ├── cli/          openagency (npm bin)
│   └── web/          @openagency/web (Vite + React + Tailwind + Recharts)
├── references/       Industry benchmarks and frameworks
└── scripts/python/   Original Python reference implementations
```

---

## Development

```bash
# Clone
git clone https://github.com/openagency/openagency.git
cd openagency

# Install
pnpm install

# Build
pnpm run build

# Test (79 tests across 11 test files)
pnpm run test

# Run locally
node apps/cli/dist/index.js scan --demo
```

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
- Smart CSV auto-detect: drop a Google Ads, Meta Ads, or TikTok Ads export and analyze instantly
- One-click PDF report export for every engine
- Saved reports with IndexedDB persistence (auto-saves, reload/export/delete)
- Waste waterfall visualization with interactive charts
- Channel optimization with current vs. optimized allocation comparison
- Campaign DAG timeline with sprint tracking and optimization alerts
- Revenue bridge with L1/L2/L3 financial metrics and efficiency scoring
- Shapley attribution analysis with last-click comparison
- Demo data buttons for all 4 engines
- Paste CSV data directly or drag-and-drop files

---

## Roadmap

- [x] **v0.1.0** — 4 engines, 33 skills, CLI, web dashboard, multi-LLM
- [x] **v0.2.0** — Smart CSV auto-detect (Google/Meta/TikTok), PDF export, IndexedDB persistence
- [ ] **v0.3.0** — Platform API connectors (Google Ads, Meta, TikTok), real-time sync
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
