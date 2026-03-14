# MCP Ad Platform Ecosystem — Reference for Claude Code

> Last updated: 2026-03-03
> Purpose: Complete reference for integrating external MCP ad servers with OpenAgency's
> own MCP server, connectors, and billing pipeline. Used by Claude Code during development.

---

## 1. ECOSYSTEM OVERVIEW

The ad-tech MCP ecosystem has matured rapidly since Q4 2025. Each major ad platform now
has at least one MCP server implementation — some official, some community-built.

**OpenAgency's position is unique**: we are NOT another MCP-to-platform wrapper.
We are the **intelligence layer** that sits ABOVE these platform MCP servers.
Platform MCP servers provide raw data access. OpenAgency provides:
- Shapley attribution across ALL platforms simultaneously
- Hill saturation optimization with cross-channel budget reallocation
- Waste waterfall detection with industry benchmarks
- Revenue reconciliation with measurement correction
- Autonomous OODA loop agents that observe, decide, and act
- Multi-agent mesh orchestration (4-stage pipeline)
- **Outcome-based billing** (% of verified waste recovery)

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL AI AGENTS                        │
│            (Claude, GPT, Gemini, Custom)                     │
│                                                              │
│   "Optimize my Q3 for ROAS 4.5x with $2M budget"           │
└──────────────────────┬──────────────────────────────────────┘
                       │ A2A Protocol / MCP
┌──────────────────────▼──────────────────────────────────────┐
│              OPENAGENCY (A2A INFRASTRUCTURE)                 │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │   Leak   │ │  Media   │ │ Campaign │ │  Executive   │   │
│  │ Detector │→│ Architect│→│   Ops    │→│   Bridge     │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
│       │             │            │               │           │
│  ┌────▼─────────────▼────────────▼───────────────▼──────┐   │
│  │           OPENAGENCY CONNECTORS (v0.3+)              │   │
│  │  google-ads | meta | dv360 | tiktok | amazon-ads     │   │
│  └────┬─────────────┬────────────┬───────────────┬──────┘   │
└───────┼─────────────┼────────────┼───────────────┼──────────┘
        │ REST API    │ Graph API  │ Business API  │ Ads API
┌───────▼─────┐ ┌─────▼─────┐ ┌───▼──────┐ ┌─────▼────────┐
│ Google Ads  │ │ Meta Ads  │ │ TikTok   │ │ Amazon Ads   │
│ Platform    │ │ Platform  │ │ Platform │ │ Platform     │
│             │ │           │ │          │ │              │
│ (has own    │ │ (has own  │ │ (has own │ │ (has own     │
│  MCP server)│ │  MCP srv) │ │  MCP srv)│ │  MCP server) │
└─────────────┘ └───────────┘ └──────────┘ └──────────────┘
```

**Key distinction**: Platform MCP servers let agents READ/WRITE to one platform.
OpenAgency lets agents OPTIMIZE across ALL platforms simultaneously.

---

## 2. GOOGLE ADS MCP SERVER

### 2.1 Official Server (Google Marketing Solutions)

| Field | Value |
|-------|-------|
| Repo | `github.com/google-marketing-solutions/google_ads_mcp` |
| Maintainer | Google (not officially supported product) |
| License | Apache-2.0 |
| Language | Python 3.12 (uv) |
| Latest release | v0.4.0 (Sep 2025) |
| Capabilities | **Read-only**: GAQL queries, campaign listing, metrics retrieval |
| Transport | stdio (local MCP) |
| Auth | `google-ads.yaml` (OAuth2 client credentials) |

**Required credentials:**
- `client_id` — Google Cloud OAuth2 client ID
- `client_secret` — OAuth2 client secret
- `refresh_token` — Long-lived refresh token
- `developer_token` — Google Ads API developer token (22 chars)
- `login_customer_id` — Manager/MCC account ID (recommended)

**Claude Code / Claude Desktop config:**
```json
{
  "mcpServers": {
    "GoogleAds": {
      "command": "pipx",
      "args": [
        "run", "--spec",
        "git+https://github.com/google-marketing-solutions/google_ads_mcp.git",
        "run-mcp-server"
      ],
      "env": {
        "GOOGLE_ADS_CREDENTIALS": "/path/to/google-ads.yaml"
      },
      "timeout": 30000
    }
  }
}
```

**Available tools:**
- GAQL query execution (any Google Ads Query Language query)
- Campaign listing with metrics
- Ad group retrieval
- Keyword performance

**Limitations:**
- Read-only (no campaign creation/modification)
- No real-time bidding data
- Requires developer token (application for production access)

### 2.2 Community Alternatives

| Repo | Write? | Tools | Notes |
|------|--------|-------|-------|
| `cohnen/mcp-google-ads` | Read-only | list_accounts, execute_gaql, get_campaign_performance, get_ad_performance | FastMCP, auto token refresh |
| `promobase/google-ads-mcp` | Read-only | 89 services via SDK v20 | Most comprehensive coverage |

### 2.3 Integration with OpenAgency

**Current state**: OpenAgency has its own `google-ads-connector.ts` that calls Google Ads REST API directly. The official MCP server is complementary, NOT a replacement.

**Strategy**:
- OpenAgency's `@openagency/connectors` remains the data ingestion layer (batch sync)
- The Google Ads MCP server can be used by Claude Code during DEVELOPMENT to query live accounts
- For production: OpenAgency's connector handles auth, rate limiting, transforms to NormalizedCampaignRow
- The Google Ads MCP server's GAQL capability could be exposed as a passthrough tool in OpenAgency MCP for ad-hoc queries

**Relevant OpenAgency files:**
- `packages/connectors/src/platforms/google-ads/google-ads-connector.ts`
- `packages/connectors/src/platforms/google-ads/google-ads-writer.ts`
- `packages/connectors/src/platforms/google-shared/google-oauth.ts`

---

## 3. META ADS MCP SERVER

### 3.1 Best Server: Pipeboard Meta Ads (Semi-Official)

| Field | Value |
|-------|-------|
| Repo | `github.com/pipeboard-co/meta-ads-mcp` |
| Remote MCP | `https://mcp.pipeboard.co/meta-ads-mcp` |
| Maintainer | Pipeboard (official classification on PulseMCP) |
| Est. users | 73.2K+ |
| License | MIT |
| Language | Python |
| Capabilities | **Read + Write**: campaigns, ad sets, ads, insights, targeting, creative |
| Transport | Remote MCP (Streamable HTTP) + local stdio |
| Auth | OAuth 2.0 via Meta Business |

**Key tools (25+):**
- `mcp_meta_ads_get_ad_accounts` — list accessible accounts
- `mcp_meta_ads_get_campaigns` — list campaigns with filters
- `mcp_meta_ads_get_insights` — performance data with time_range
- `mcp_meta_ads_create_campaign` — full campaign creation
- `mcp_meta_ads_create_ad_set` — ad set with targeting
- `mcp_meta_ads_create_ad_creative` — creative management
- `mcp_meta_ads_search_interests` — interest targeting search
- `mcp_meta_ads_search_demographics` — demographic targeting
- `mcp_meta_ads_search_geo_locations` — geo targeting search
- `mcp_meta_ads_get_account_pages` — list connected pages
- `mcp_meta_ads_duplicate_campaign` — campaign duplication

**Campaign objectives (Outcome-based, 2025+):**
- `OUTCOME_AWARENESS`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`
- `OUTCOME_SALES`, `OUTCOME_TRAFFIC`, `OUTCOME_APP_PROMOTION`
- Legacy objectives (BRAND_AWARENESS, LINK_CLICKS, etc.) return 400 errors

**Bid strategies:**
- `LOWEST_COST_WITHOUT_CAP`, `LOWEST_COST_WITH_BID_CAP`
- `COST_CAP`, `LOWEST_COST_WITH_MIN_ROAS`

**Claude Code config (Remote MCP — recommended):**
```json
{
  "mcpServers": {
    "meta-ads": {
      "url": "https://mcp.pipeboard.co/meta-ads-mcp"
    }
  }
}
```

**Claude Code config (local):**
```bash
claude mcp add-json "meta-ads-remote" \
  '{"command":"npx","args":["mcp-remote","https://mcp.pipeboard.co/meta-ads-mcp"]}'
```

### 3.2 Alternative: GoMarble Facebook Ads

| Repo | `github.com/gomarble-ai/facebook-ads-mcp-server` |
|------|--------------------------------------------------|
| Focus | Read-heavy, simpler setup |
| Auth | `--fb-token` CLI arg |
| Tools | list_ad_accounts, get_campaigns, get_insights, get_ad_creatives |

### 3.3 Integration with OpenAgency

**Current state**: `meta-connector.ts` + `meta-writer.ts` handle all Meta API interactions.

**Strategy**:
- OpenAgency's connector is the primary data path (batch sync → NormalizedCampaignRow)
- Pipeboard remote MCP can be used for development/debugging
- Meta's outcome-based objectives align with OpenAgency's billing model
  (OUTCOME_SALES → measurable revenue → waste recovery calculation)
- Creative analysis tools from Meta MCP complement Leak Detector's media quality scoring

**Relevant OpenAgency files:**
- `packages/connectors/src/platforms/meta/meta-connector.ts`
- `packages/connectors/src/platforms/meta/meta-writer.ts`

---

## 4. TIKTOK ADS MCP SERVER

### 4.1 Best Server: AdsMCP TikTok Ads

| Field | Value |
|-------|-------|
| Repo | `github.com/AdsMCP/tiktok-ads-mcp-server` |
| Maintainer | AdsMCP team (community) |
| Est. users | 1.5K+ |
| License | MIT |
| Language | Python |
| Capabilities | **Read + Write**: campaigns, ad groups, performance, OAuth flow |
| Transport | stdio (local) |
| Auth | TikTok OAuth2 (app_id + app_secret) |

**Key tools:**
- `tiktok_ads_login` — start OAuth authentication flow
- `tiktok_ads_complete_auth` — complete auth with authorization code
- `tiktok_ads_auth_status` — check current auth status
- `tiktok_ads_switch_ad_account` — switch advertiser account
- `tiktok_ads_get_campaigns` — retrieve all campaigns
- `tiktok_ads_get_campaign_details` — detailed campaign info
- `tiktok_ads_get_adgroups` — ad groups for a campaign
- `tiktok_ads_get_campaign_performance` — performance metrics with breakdowns
- `tiktok_ads_get_adgroup_performance` — ad group metrics with breakdowns

**Install (required before first use):**
```bash
git clone https://github.com/AdsMCP/tiktok-ads-mcp-server
cd tiktok-ads-mcp-server
pip install -e .   # or: uv sync
```

**Setup:**
```json
{
  "mcpServers": {
    "tiktok-ads": {
      "command": "python",
      "args": ["-m", "tiktok_ads_mcp"],
      "env": {
        "TIKTOK_APP_ID": "your_app_id",
        "TIKTOK_APP_SECRET": "your_app_secret",
        "TIKTOK_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

### 4.2 Alternative: ysntony TikTok Ads MCP

| Repo | `github.com/ysntony/tiktok-ads-mcp` |
|------|--------------------------------------|
| Focus | Pure MCP, AI-first design, read-only |
| Tools | get_advertisers, get_campaigns, get_insights, health_check, validate_token |
| Philosophy | "Single Interface: MCP protocol only — no CLI, web UI, or human interfaces" |

### 4.3 Integration with OpenAgency

**Current state**: `tiktok-ads-connector.ts` + `tiktok-ads-writer.ts` + `tiktok-shop-connector.ts`

**Strategy**:
- TikTok has the weakest MCP ecosystem (no official server from TikTok)
- OpenAgency's own connectors are more reliable for production data ingestion
- AdsMCP server useful for development OAuth flow testing
- TikTok's rapid growth in LATAM makes this a high-priority connector for Digitas México clients
- TikTok Shop connector gives unique commerce + ads cross-analysis capability

**Relevant OpenAgency files:**
- `packages/connectors/src/platforms/tiktok-ads/tiktok-ads-connector.ts`
- `packages/connectors/src/platforms/tiktok-ads/tiktok-ads-writer.ts`
- `packages/connectors/src/platforms/tiktok-shop/tiktok-shop-connector.ts`
- `packages/connectors/src/platforms/tiktok-shop/tiktok-shop-writer.ts`

---

## 5. AMAZON ADS MCP SERVER

### 5.1 Official Server (Amazon Ads — Open Beta)

| Field | Value |
|-------|-------|
| Announcement | Feb 2, 2026 (open beta) |
| Docs | `advertising.amazon.com/API/docs/en-us/mcp/mcp-overview` |
| Maintainer | **Amazon Ads** (first-party, official) |
| Capabilities | **Read + Write**: campaigns, reports, budgets, account settings, billing |
| Supported platforms | Claude, ChatGPT, Gemini, Amazon Q, Amazon Bedrock |
| Auth | Amazon Ads API credentials (active partner account) |

**This is the most strategic MCP server in the ecosystem** because:
1. First-party official (not community)
2. Includes pre-built multi-step workflow tools ("create end-to-end SP campaign in single prompt")
3. Has domain model enforcement (prevents use of deprecated APIs)
4. Global availability
5. Tool prefixes organize operations (cp_ = Campaign Performance, amc_ = Amazon Marketing Cloud)

**Key capabilities:**
- Create, update, delete campaigns (Sponsored Products, Brands, Display)
- Performance reporting queries
- Budget management and allocation
- Account-level settings management
- Billing and financial data access
- Geographic expansion (expand campaign to new country in single prompt)
- End-to-end Sponsored Products creation (campaign + ad group + ads in one tool call)
- Amazon Marketing Cloud (AMC) workflows

**Architecture:**
```
AI Agent (Claude/GPT/Gemini)
    ↓ natural language prompt
Amazon Ads MCP Server (translation layer)
    ↓ structured API calls
Amazon Ads API
    ↓ orchestrated multi-step workflows
Amazon Ads Console (campaigns, reports, budgets)
```

### 5.2 Community: KuudoAI / NetzSicht (rebranded to Openbridge)

| Repo | `github.com/KuudoAI/amazon_ads_mcp` / `github.com/NetzSicht/amazon_ads_mcp` |
|------|-----------------------------------------------------------------------------|
| Focus | Full SDK implementation, Docker support, multi-region (NA/EU/FE) |
| Auth | Openbridge gateway or direct API credentials |
| Packages | Modular — activate only needed services (profiles, amc-workflow, etc.) |
| Prefixes | cp_ (Campaign Perf), amc_ (Marketing Cloud), etc. |
| Note | KuudoAI has rebranded to Openbridge. Docker image `ghcr.io/netzsicht/amazon_ads_mcp:latest` remains available under the NetzSicht org. |

**Setup (NetzSicht/KuudoAI):**
```json
{
  "mcpServers": {
    "amazon-ads": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--env-file", "/path/to/.env",
        "ghcr.io/netzsicht/amazon_ads_mcp:latest"
      ]
    }
  }
}
```

### 5.3 Community: MarketplaceAdPros

| Repo | `github.com/MarketplaceAdPros/amazon-ads-mcp-server` |
|------|------------------------------------------------------|
| Transport | stdio + **Streamable HTTP** (`https://app.marketplaceadpros.com/mcp`) |
| Language | TypeScript (Node.js) |
| Tools | SP/SB/SD campaigns, ad groups, keywords, product ads, reports |

**Remote MCP config:**
```json
{
  "mcpServers": {
    "marketplaceadpros": {
      "type": "streamable-http",
      "url": "https://app.marketplaceadpros.com/mcp"
    }
  }
}
```

### 5.4 Integration with OpenAgency

**Current state**: `amazon-ads-connector.ts` + `amazon-ads-writer.ts`

**Strategy**:
- Amazon's official MCP server is the gold standard — study its "tools as instruction manuals" pattern
- Key architectural insight from Amazon: tools should orchestrate multi-step workflows, not expose raw API
- This validates OpenAgency's `mesh_execute_pipeline` approach
- Amazon's tool prefixes (cp_, amc_) validate OpenAgency's `engineId_skillId` naming convention
- Amazon's domain model enforcement (only current APIs) aligns with OpenAgency's Schema Registry approach
- For billing: Amazon Ads MCP includes financial data access — this feeds into Track B recovery calculation

**Relevant OpenAgency files:**
- `packages/connectors/src/platforms/amazon-ads/amazon-ads-connector.ts`
- `packages/connectors/src/platforms/amazon-ads/amazon-ads-writer.ts`

---

## 6. DV360 MCP SERVER

### 6.1 Community Server: caspercrause/dv360-ads-mcp-server

| Field | Value |
|-------|-------|
| Repo | `github.com/caspercrause/dv360-ads-mcp-server` |
| Maintainer | Casper Crause (community) |
| License | MIT |
| Language | Python |
| Capabilities | **Read-only**: list advertisers, campaigns, insertion orders, line items |
| Transport | stdio (local) |
| Auth | GCP service account with DV360 API access |

**Install:**
```bash
git clone https://github.com/caspercrause/dv360-ads-mcp-server
cd dv360-ads-mcp-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**Claude Code config:**
```json
{
  "mcpServers": {
    "dv360": {
      "command": "python",
      "args": ["server.py"],
      "cwd": "~/dv360-ads-mcp-server",
      "env": {
        "DV360_SERVICE_ACCOUNT": "${DV360_SERVICE_ACCOUNT}",
        "DV360_PARTNER_ID": "${DV360_PARTNER_ID}"
      }
    }
  }
}
```

**Limitations:**
- Read-only (no campaign creation/modification/budget changes)
- No reporting or performance metrics
- Community-maintained, single contributor

### 6.2 OpenAgency's DV360 Advantage

The community MCP server provides basic entity listing. OpenAgency's DV360 intelligence layer remains unique in the market:
- **Write capabilities**: budget adjustments, pacing, status changes via `dv360-writer.ts`
- **Shapley attribution**: cross-channel contribution analysis including DV360
- **Waste detection**: CPM waste, viewability analysis, supply chain fee auditing
- **Cross-platform optimization**: DV360 budgets optimized alongside Google/Meta/TikTok/Amazon

Any agent that wants intelligence-grade DV360 optimization must go through OpenAgency.

**Relevant OpenAgency files:**
- `packages/connectors/src/platforms/dv360/dv360-connector.ts`
- `packages/connectors/src/platforms/dv360/dv360-writer.ts`

---

## 7. CLAUDE CODE CONFIGURATION FOR DEVELOPMENT

### 7.1 Combined MCP Config (all platforms + OpenAgency)

The live config is at `openagency/.mcp.json` (6 servers). Reference copy at `files/.mcp.json.reference`.

```json
{
  "mcpServers": {
    "openagency-dev": {
      "command": "npx",
      "args": ["tsx", "apps/api/src/mcp/stdio.ts"],
      "cwd": ".",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug",
        "PORT": "0"
      }
    },
    "google-ads": {
      "command": "pipx",
      "args": [
        "run", "--spec",
        "git+https://github.com/google-marketing-solutions/google_ads_mcp.git",
        "run-mcp-server"
      ],
      "env": {
        "GOOGLE_ADS_CREDENTIALS": "${GOOGLE_ADS_YAML_PATH:-~/.google-ads.yaml}"
      },
      "timeout": 30000
    },
    "meta-ads": {
      "url": "https://mcp.pipeboard.co/meta-ads-mcp"
    },
    "tiktok-ads": {
      "command": "python",
      "args": ["-m", "tiktok_ads_mcp"],
      "env": {
        "TIKTOK_APP_ID": "${TIKTOK_APP_ID}",
        "TIKTOK_SECRET": "${TIKTOK_APP_SECRET}",
        "TIKTOK_ACCESS_TOKEN": "${TIKTOK_ACCESS_TOKEN}"
      }
    },
    "amazon-ads": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--env-file", ".env.amazon-ads",
        "ghcr.io/netzsicht/amazon_ads_mcp:latest"
      ]
    },
    "dv360": {
      "command": "python",
      "args": ["server.py"],
      "cwd": "${DV360_MCP_PATH:-~/dv360-ads-mcp-server}",
      "env": {
        "DV360_SERVICE_ACCOUNT": "${DV360_SERVICE_ACCOUNT}",
        "DV360_PARTNER_ID": "${DV360_PARTNER_ID}"
      }
    }
  }
}
```

### 7.2 Why This Configuration Matters

With this setup, Claude Code can:
1. **Develop OpenAgency** using its own MCP server for testing engine skills
2. **Query live Google Ads data** via official MCP server to validate connector transforms
3. **Analyze Meta campaigns** via Pipeboard remote MCP for testing waste detection
4. **Test TikTok integration** via AdsMCP local server
5. **Access Amazon Ads** via Docker-based MCP server
6. **List DV360 entities** via community MCP server for development/debugging

This creates a **development loop** where Claude Code can:
- Pull real data from platforms
- Run it through OpenAgency engines
- Compare results
- Iterate on skill logic
- All without leaving the IDE

---

## 8. STRATEGIC IMPLICATIONS FOR TRACK B (BILLING ENGINE)

### 8.1 How Platform MCP Servers Feed Billing

The billing model depends on VERIFIED recovery — real dollar improvements.
Platform MCP servers provide the GROUND TRUTH for before/after comparison:

```
BILLING FLOW:
1. Platform MCP servers → baseline data (pre-optimization)
2. OpenAgency mesh pipeline → optimization actions
3. Platform MCP servers → post-optimization data
4. Recovery Extractor → delta = improvement
5. Deduplication → remove overlap across engines
6. Tier Manager → apply billable rate
7. Recovery Report → proof document for client
```

### 8.2 Per-Platform Recovery Sources

| Platform | Recovery Source | Measurement |
|----------|---------------|-------------|
| Google Ads | GAQL query pre/post ROAS, waste detection | Spend saved + ROAS lift × budget |
| Meta Ads | Insights pre/post, creative performance delta | CPA reduction × conversions |
| TikTok Ads | Campaign performance breakdown pre/post | Wasted spend redirected × lift |
| Amazon Ads | SP/SB/SD performance + AMC attribution | ACoS improvement × ad spend |
| DV360 | Custom reporting pre/post | CPM waste + viewability lift |

### 8.3 Amazon's "Tools as Instruction Manuals" Pattern

Amazon's MCP server design principle is directly applicable to OpenAgency's billing:

> "Tools reduce complexity by orchestrating capabilities into complete, multi-step
> operations... They act as an instruction manual, turning complex operations into
> simple actions an agent can execute."

Apply this to billing:
- `billing_summary` tool = complete current period recovery + fee in one call
- `billing_report` tool = full proof document with per-engine breakdown
- `billing_recover` tool = trigger recovery calculation on a completed mesh run

### 8.4 Cross-Platform Dedup Challenge

When Leak Detector finds $50K waste on Google Ads and Media Architect reallocates
$30K of that to Meta where it generates $20K additional revenue:

- Leak Detector recovery: $50K waste found
- Media Architect recovery: $20K incremental revenue
- BUT: $30K of the reallocation came FROM the waste finding
- Dedup rule: Media Architect's INPUT that came from Leak Detector's OUTPUT
  should not be double-counted. Use Executive Bridge reconciliation as truth anchor.

This is why `packages/billing/src/deduplication.ts` needs access to the full
MeshRun stage_results with their inter-engine data flow.

---

## 9. COMPETITIVE LANDSCAPE

### 9.1 Who Else Is In This Space?

| Player | What They Do | OpenAgency Advantage |
|--------|-------------|---------------------|
| AdCP (Ad Context Protocol) | Open standard for ad automation over MCP+A2A, v3.0 beta | OpenAgency has working computation engines, not just protocol spec |
| Zapier MCP | Universal connector (2 tasks per MCP tool call) | OpenAgency has domain-specific intelligence, not generic connections |
| Pipeboard | Meta Ads MCP + Google Ads integration | Single-platform, no cross-platform optimization |
| AdsMCP | Multi-platform MCP servers (Google, Meta, TikTok) | Data access only, no intelligence layer |
| CData MCP | Enterprise data connectivity for ads | Generic connector, no advertising domain knowledge |
| Adzviser | Data connector + AI analysis for ads | SaaS model, no outcome-based billing |

### 9.2 OpenAgency's Moat

**ZERO competitors offer all of these simultaneously:**
1. Shapley attribution on real multi-platform campaign data
2. Hill saturation optimization with cross-channel reallocation
3. 6-stage waste waterfall with industry benchmarks
4. Autonomous OODA-loop agents with safety pipeline
5. Multi-agent mesh orchestration
6. Outcome-based billing (% of verified recovery)
7. A2A protocol support with Agent Cards
8. MCP tool exposure for any AI agent to invoke

The window to be "Stripe of advertising intelligence for agents" is open NOW.
Platform MCP servers handle the plumbing. OpenAgency handles the intelligence.

---

## 10. DEVELOPMENT PRIORITIES (ALIGNED WITH PLAN-MODE)

### Current Sprint: Track B — Waste-Recovery Billing Engine

**Build `packages/billing/`** with these modules:
1. `types.ts` — RecoveryEvent, RecoveryBreakdown, BillingPeriod, TierSchedule
2. `recovery-extractor.ts` — extract dollar values from MeshRun stage results
3. `deduplication.ts` — cross-engine dedup with reconciliation anchor
4. `billing-period.ts` — monthly aggregation
5. `tier-manager.ts` — spend-based tier management
6. `recovery-report.ts` — proof document generation
7. `index.ts` — exports

**Then wire into:**
- Events: `billing.recovery_calculated`, `billing.period_closed`, `billing.tier_upgraded`
- MCP tools: `billing_summary`, `billing_report`
- REST routes: `/v1/billing/current`, `/v1/billing/reports/:period`, `/v1/billing/tier`
- Mesh hook: after `mesh_execute_pipeline` completes

### After Track B:
- Track A: Safety hardening (rollback executor, anomaly gate, audit log)
- Track C: Goal intelligence (goal→agent routing, conflict detection)
- Track D: Integration tests (end-to-end pipeline test)

---

## 11. APPENDIX: USEFUL LINKS

### Official Repos
- Google Ads MCP: https://github.com/google-marketing-solutions/google_ads_mcp
- Google Ads MCP docs: https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server
- Meta Ads MCP (Pipeboard): https://github.com/pipeboard-co/meta-ads-mcp
- Meta Ads MCP (GoMarble): https://github.com/gomarble-ai/facebook-ads-mcp-server
- TikTok Ads MCP (AdsMCP): https://github.com/AdsMCP/tiktok-ads-mcp-server
- TikTok Ads MCP (ysntony): https://github.com/ysntony/tiktok-ads-mcp
- Amazon Ads MCP (official): https://advertising.amazon.com/API/docs/en-us/mcp/mcp-overview
- Amazon Ads MCP (KuudoAI): https://github.com/KuudoAI/amazon_ads_mcp
- Amazon Ads MCP (MarketplaceAdPros): https://github.com/MarketplaceAdPros/amazon-ads-mcp-server
- DV360 MCP (caspercrause): https://github.com/caspercrause/dv360-ads-mcp-server

### Curated Lists
- Awesome Agentic Advertising: https://github.com/jshorwitz/awesome-agentic-advertising
- PulseMCP Ad Servers: https://www.pulsemcp.com (search "ads")

### Protocol Specs
- MCP Specification: https://modelcontextprotocol.io/
- A2A Protocol: https://google.github.io/A2A/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
