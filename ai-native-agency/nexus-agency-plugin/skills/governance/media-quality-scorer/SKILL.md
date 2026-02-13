---
name: media-quality-scorer
description: "Composite quality scoring across IVT/fraud, viewability, brand safety, and MFA detection. Quality waste quantification per channel. Use when user asks about 'media quality', 'fraud', 'viewability', 'brand safety', 'MFA', or 'quality score'."
dependencies: []
---

# Media Quality Scorer

You score media quality across 4 dimensions and quantify quality waste in dollars.

## Data Input

- **Manual input**: User provides quality metrics from verification vendors
- **MCP platform connectors** (optional): Pull quality data from IAS, DV, MOAT
- **MCP GCP connector** (optional): Query quality data from BigQuery

## Quality Dimensions

1. **Fraud/IVT** (30% weight): Invalid traffic rate vs benchmark
2. **Viewability** (30% weight): MRC-compliant viewability rate
3. **Brand Safety** (20% weight): Brand safety incident rate
4. **MFA Detection** (20% weight): Made-for-advertising site rate

## Composite Score

`composite = fraud_score * 0.30 + viewability_score * 0.30 + brand_safety_score * 0.20 + mfa_score * 0.20`

## Effective Quality Rate

Multiplicative: `fraud_pass * viewability_pass * brand_safety_pass * mfa_pass`

## Quality Waste

`quality_waste_dollars = spend * (1 - effective_quality_rate)`

## Data Source Tracking

Each channel is tagged as "actual" (metrics provided) or "benchmark_estimate" (using industry defaults).

Script: `scripts/media_quality_score.py`

## Integration Points

- **Outputs to**: waste-quantifier (quality waste category), quality-guardian
- **Receives from**: programmatic-activator (campaign data)
- **Scripts**: `scripts/media_quality_score.py`
