# Plinth MCP Composition Guide

## How It Works

Claude Desktop connects to **multiple MCPs simultaneously**:

1. **Platform MCPs** (Google Ads, Meta, Amazon) -- pull raw campaign data
2. **Plinth MCP** -- run the 4-engine analytical pipeline on that data

Claude orchestrates the flow: pull data from platform MCPs, pass it to Plinth's `analyze_ad_data` tool, get waste analysis + optimization + billing + optional deliverables.

**No Plinth OAuth needed.** Clients authenticate directly with their ad platforms via the platform MCPs.

---

## Setup: Claude Desktop Configuration

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "pipx",
      "args": [
        "run",
        "--spec",
        "git+https://github.com/googleads/google-ads-mcp.git",
        "google-ads-mcp"
      ],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json",
        "GOOGLE_PROJECT_ID": "YOUR_GCP_PROJECT_ID",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEVELOPER_TOKEN",
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID": "XXX-XXX-XXXX"
      }
    },
    "plinth": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/openagency/apps/api/src/mcp/stdio.ts"
      ],
      "env": {
        "NODE_ENV": "production",
        "MCP_STDIO": "1",
        "DATABASE_URL": "postgresql://user:pass@host:port/db",
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

### Prerequisites

**Google Ads MCP:**
- Python 3.10+ and `pipx` installed
- Google Cloud project with Google Ads API enabled
- Google Ads Developer Token (apply at ads.google.com > Tools & Settings > API Center)
- OAuth credentials via `gcloud auth application-default login`

**Plinth MCP:**
- Node.js 20+ and `npx` available
- PostgreSQL database URL (Railway, Supabase, local)
- Optional: `ANTHROPIC_API_KEY` for AI-powered delivery reports

---

## Usage: The Composition Flow

### Step 1: Pull Data from Google Ads

Ask Claude:
> "Use Google Ads to run this GAQL query:
> SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
> FROM campaign WHERE segments.date DURING LAST_30_DAYS"

Claude uses the `search` tool from the Google Ads MCP.

### Step 2: Analyze with Plinth

Then ask:
> "Now use Plinth's analyze_ad_data tool with this data. Total ad_spend is $150,000."

Or provide all metrics directly:

> "Run Plinth analyze_ad_data with:
> - ad_spend: 150000
> - impressions: 2500000
> - clicks: 75000
> - conversions: 3200
> - revenue: 480000
> - roas: 3.2
> - platform: google_ads
> - generate_report: true"

### Step 3: Get Results

Plinth returns:
- **Leak Detector**: Waste waterfall (fraud, viewability, overlap, frequency waste)
- **Media Architect**: MMM optimization (channel reallocation recommendations)
- **Campaign Ops**: Priority scores and optimization actions
- **Executive Bridge**: Revenue impact translation for C-suite
- **Billing**: Recovery fees, lift fees, efficiency fees
- **Report** (optional): Monthly report deliverable (PDF/PPTX)

### Step 4: Download Report (if generated)

> "Use get_file_content to download the report file"

Claude retrieves the base64-encoded file and offers to save it locally.

---

## Available Plinth MCP Tools

### Core Analysis
| Tool | Description |
|------|-------------|
| `analyze_ad_data` | **Main tool** -- runs full 4-engine pipeline on raw metrics |
| `leak_detector_waste_waterfall` | Waste decomposition (fraud, viewability, overlap, frequency) |
| `media_architect_mmm_optimize` | Media Mix Model optimization |
| `campaign_ops_optimization_analyze` | Campaign optimization analysis |
| `executive_bridge_revenue_translate` | Revenue impact translation |

### Delivery (Reports & Artifacts)
| Tool | Description |
|------|-------------|
| `delivery_monthly_report` | Monthly performance report (PDF/PPTX) |
| `delivery_competitive_analysis` | Competitor ad intelligence report |
| `delivery_budget_proposal` | Investment thesis & ROI projections |
| `delivery_campaign_brief` | Creative brief with media strategy |
| `delivery_quarterly_review` | QBR executive presentation |
| `delivery_media_plan_deck` | Media plan with flight strategy |
| `get_file_content` | Download any delivery file as base64 |
| `delivery_list_files` | List all generated files |

### Pipeline Orchestration
| Tool | Description |
|------|-------------|
| `mesh_execute_pipeline` | Run full multi-agent OODA pipeline |
| `mesh_list_pipelines` | List available pipeline configurations |
| `schedule_pipeline` | Set up recurring analysis (cron) |

### 39 Total Skills
Run `marketplace_list_skills` to see all available tools.

---

## Adding More Platforms

### Meta Ads (via Pipeboard -- cloud hosted, no local setup)

```json
{
  "mcpServers": {
    "meta-ads": {
      "url": "https://mcp.pipeboard.co/meta-ads-mcp"
    }
  }
}
```

30+ tools including `get_insights`, `get_campaigns`, `get_ads`.

### Amazon Ads (Official -- Open Beta)

```json
{
  "mcpServers": {
    "amazon-ads": {
      "type": "streamable-http",
      "url": "https://app.marketplaceadpros.com/mcp"
    }
  }
}
```

50+ tools across Sponsored Products, Brands, Display, DSP.

### TikTok Ads (Community)

```json
{
  "mcpServers": {
    "tiktok-ads": {
      "command": "python",
      "args": ["/path/to/tiktok-ads-mcp/run_server.py"],
      "env": {
        "TIKTOK_APP_ID": "your_app_id",
        "TIKTOK_APP_SECRET": "your_app_secret"
      }
    }
  }
}
```

---

## Multi-Platform Analysis Example

```
User: "Pull last 30 days from Google Ads and Meta Ads, then run Plinth analysis"

Claude:
1. Uses google-ads MCP: search() with GAQL query
2. Uses meta-ads MCP: get_insights() for campaigns
3. Combines the data
4. Uses plinth MCP: analyze_ad_data() with combined metrics
5. Returns unified waste analysis + optimization across both platforms
```

---

## Cerebro Media Quick Start

1. Install prerequisites: `pip install pipx` (Google Ads MCP needs Python)
2. Authenticate Google: `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords`
3. Edit Claude Desktop config (see above) with your credentials
4. Restart Claude Desktop
5. Ask Claude: "List my Google Ads accounts" (verifies Google MCP)
6. Ask Claude: "Run Plinth analyze_ad_data with ad_spend: 50000, impressions: 1000000, clicks: 30000, conversions: 1500, revenue: 225000, roas: 4.5, platform: google_ads, generate_report: true"
