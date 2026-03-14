# Discord Launch Posts — OpenAgency v0.3.0

Copy-paste ready. Three versions tailored per audience.

---

## 1. Claude / Anthropic Discord (AI-focused technical audience)

```
# OpenAgency — I built an open-source ad agency with Claude

I just shipped v0.3.0 of OpenAgency — an MIT-licensed toolkit that gives solo marketers the same capabilities that Big 6 holding companies charge millions for.

**What it does:**
- 4 computation engines: waste detection, budget optimization, campaign management, executive reporting
- 33 skills covering the full advertising lifecycle
- Live OAuth2 connectors to 6 ad platforms (Google Ads, Meta, DV360, TikTok Ads, TikTok Shop, Amazon Ads)
- Multi-level data: campaign → ad set → ad with 30+ normalized metrics
- CLI + web dashboard (React + Tailwind + Recharts)

**How Claude helped:**
The entire codebase — 4,500+ lines of platform connectors, 4 engines, transforms, encrypted credential storage — was built with Claude Code (Opus). The architecture, the connectors, the types, the dashboard. All of it. Claude didn't just write code — it debugged type errors, audited data granularity gaps, and rewrote 6 platform connectors when I asked "can it actually pull ad set level data?" and the answer was no.

**Try it:**
```bash
npx openagency
```

**The thesis:**
Advertising is a $700B+ market controlled by 6 holding companies. Their "secret sauce" is commodity math: attribution models, saturation curves, waste waterfalls. None of it justifies the markup. OpenAgency open-sources the entire stack.

GitHub: https://github.com/afelipeg/andres-claude-plugins/tree/main/openagency

Built by Axiom-Nexar | MIT License | 79 tests passing
```

---

## 2. Marketing / AdTech Discord (PPC, media buying, digital marketing)

```
# I open-sourced an ad agency toolkit — waste detection, MMM, attribution, live platform sync

If you've ever wondered where your ad budget actually goes, I built a tool for that.

**OpenAgency** is a free, open-source toolkit that does what media agencies charge you $50k-$500k/yr for:

**Find waste:** Run your spend through a 6-stage waste waterfall. See exactly how much goes to overhead, ad fraud, off-target audiences, poor pacing, and stale creative. Industry says 40-60% of ad spend is wasted. This quantifies it.

**Optimize channels:** Hill saturation curves + greedy marginal allocation. Feed it your Google/Meta/TikTok spend, get back optimized budget allocation with diminishing returns analysis.

**Campaign ops:** 24-task DAG for campaign lifecycle. 6 automated optimization rules: CPA overshoot, ROAS alerts, pacing, creative fatigue, zero conversions.

**Executive reporting:** Shapley value attribution (not last-click garbage), L3→L2→L1 metric translation for C-Suite, revenue reconciliation.

**NEW in v0.3.0 — Live platform connectors:**
Connect your actual ad accounts via OAuth2. No more CSV exports.
- Google Ads (campaign → ad group → ad)
- Meta Ads (campaign → ad set → ad)
- DV360 (insertion order → line item → creative)
- TikTok Ads + TikTok Shop
- Amazon Ads (SP, SB, SD)

All data normalized into one schema. Pull. Analyze. Done.

```bash
npx openagency
```

GitHub: https://github.com/afelipeg/andres-claude-plugins/tree/main/openagency
MIT License — free forever.

— Axiom-Nexar
```

---

## 3. Open-source / Dev Discord (TypeScript, Node.js communities)

```
# OpenAgency — open-source advertising toolkit (TypeScript monorepo, 4 engines, 6 API connectors)

Just shipped v0.3.0. Full pnpm + Turborepo monorepo with some architectural decisions that might interest you:

**Stack:**
- TypeScript strict mode, NodeNext resolution, composite project references
- pnpm workspaces + Turborepo (6 packages, parallel builds)
- Vite 5 + React + Tailwind + Recharts for the web dashboard
- Commander.js + Inquirer for the CLI
- Vitest (79 tests across 11 test files)
- Zero external runtime deps for the engine packages — pure computation, no I/O

**Architecture:**
```
@openagency/types      → shared interfaces (zero deps)
@openagency/core       → orchestration + LLM + CSV parser
@openagency/engines    → 4 pure computation engines
@openagency/connectors → 6 platform API connectors
openagency CLI         → Commander.js + interactive prompts
@openagency/web        → Vite + React dashboard
```

**What v0.3.0 adds (the interesting part):**
- OAuth2 connectors for 6 ad platforms (Google Ads, Meta, DV360, TikTok Ads, TikTok Shop, Amazon Ads)
- Each connector supports multi-level data: campaign → ad set → ad
- Universal `NormalizedCampaignRow` schema (30+ fields) that normalizes wildly different APIs into one interface
- AES-256-GCM encrypted credential storage with PBKDF2 (works in both Node crypto and Web Crypto API — same passphrase decrypts on either)
- Token-bucket rate limiter per platform with per-second, per-minute, and daily limits
- Exponential backoff with jitter for API retries
- Async report workflows for DV360 and Amazon (create → poll → download → decompress → parse)
- Scheduled sync with configurable intervals (setInterval per platform)
- Sub-path exports: `@openagency/connectors/meta`, `./credential-store`, etc.

**Multi-LLM support** (optional): Anthropic, OpenAI, Ollama. Engines are pure math — LLM just adds narrative on top.

```bash
npx openagency
```

GitHub: https://github.com/afelipeg/andres-claude-plugins/tree/main/openagency
MIT Licensed | PRs welcome

— Axiom-Nexar
```

---

## Bonus: Short teaser (works anywhere)

```
What if you could run `npx openagency` and instantly know where your ad budget leaks money?

4 engines. 33 skills. 6 live platform connectors. One command.

Open-source. MIT licensed. Free forever.

https://github.com/afelipeg/andres-claude-plugins/tree/main/openagency
```
