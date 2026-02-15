---
name: governance
description: "Full governance audit: waste waterfall, supply chain transparency, media quality scoring, and C-Suite reporting. The question is never 'Did we spend the budget?' but 'Did we waste the budget?'"
---

# /governance

## Usage

```
/governance [campaign or client name]
/governance --channel [channel_name]
/governance --client [client_name]
/governance --period [date_range]
/governance --quick
```

## Workflow

### Phase 1: Data Gathering
1. **Value**: Gather revenue and reconciliation data via `revenue-connector`
2. **Governance**: Audit supply chain via `supply-chain-auditor`
3. **Governance**: Score media quality via `media-quality-scorer`

### Phase 2: Waste Analysis
4. **Governance**: Run full waste waterfall via `waste-quantifier` (6 categories)
5. Validate math: all waste categories + productive spend = gross spend

### Phase 3: Context
6. **Intelligence**: Compare vs industry benchmarks via `performance-oracle`
7. **Activation**: Check optimization waste via `optimization-engine`

### Phase 4: Reporting
8. **Value**: Generate C-Suite summaries via `executive-translator`
9. Map client to ID Comms 5-Stage Media Maturity Model
10. Generate recovery roadmap prioritized by recoverable waste

## Data Sources
- Manual input: User provides spend data, vendor reports, quality metrics
- MCP platform connectors (optional): Auto-pull campaign data from platforms
- MCP GCP connector (optional): Query spend and quality data from BigQuery

## Flags
- `--channel`: Filter to specific channel
- `--client`: Filter to specific client
- `--period`: Specify date range for analysis
- `--quick`: Skip supply chain deep-dive, use benchmark estimates

## Engines Activated
- Governance (waste-quantifier, supply-chain-auditor, media-quality-scorer)
- Value (revenue-connector, executive-translator)
- Intelligence (performance-oracle)
- Activation (optimization-engine)

## Output
1. **Waste Waterfall Report**: 6-stage decomposition from gross to productive spend
2. **Supply Chain Fee Transparency**: Dollar flow mapping, working media ratios, risk flags
3. **Media Quality Scorecard**: IVT, viewability, brand safety, MFA scores per channel
4. **CFO One-Pager**: Waste-to-savings narrative, ROI impact, recovery timeline
5. **Recovery Roadmap**: Prioritized actions ranked by recoverable waste amount
6. **Maturity Assessment**: Current stage on ID Comms 5-Stage model with next-stage recommendations
