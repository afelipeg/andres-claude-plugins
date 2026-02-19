# Campaign Taxonomy Rules

## Naming Convention

Format: `{Client}_{Campaign}_{Channel}_{Format}_{Audience}_{Geo}_{Date}`

### Rules
- Use underscores `_` as primary separator
- Use hyphens `-` within components (e.g., `Brand-Awareness`)
- No spaces, no special characters
- All lowercase except Client and Campaign (Title Case)
- Date format: YYYYMM

### Examples

**Campaign Level:**
`Acme_Q1-Launch_Search_Brand_All_MX_202603`

**Ad Group Level:**
`Acme_Q1-Launch_Search_Brand_Intent-High_CDMX_202603`

**Ad Level:**
`Acme_Q1-Launch_Search_Brand_Intent-High_CDMX_202603_v1`

## Platform-Specific Rules

### Google Ads
- Campaign: `{Client}_{Objective}_{Channel}_{Targeting}_{Geo}_{Date}`
- Ad Group: `{Client}_{Objective}_{Theme}_{Audience}_{Match-Type}`
- Max characters: 255 per field

### Meta (Facebook/Instagram)
- Campaign: `{Client}_{Objective}_{Funnel-Stage}_{Date}`
- Ad Set: `{Client}_{Audience}_{Placement}_{Geo}_{Date}`
- Ad: `{Client}_{Creative-Concept}_{Format}_{Version}`

### DV360
- IO: `{Client}_{Campaign}_{Channel}_{Date}`
- Line Item: `{Client}_{Targeting}_{Format}_{Buying-Model}`
- Creative: `{Client}_{Concept}_{Size}_{Version}`

### TikTok
- Campaign: `{Client}_{Objective}_{Date}`
- Ad Group: `{Client}_{Audience}_{Placement}_{Date}`
- Ad: `{Client}_{Creative}_{Format}_{Version}`

### Amazon
- Campaign: `{Client}_{Product}_{Type}_{Date}`
- Ad Group: `{Client}_{Targeting}_{Match-Type}`

## UTM Taxonomy

| Parameter | Convention |
|-----------|-----------|
| utm_source | Platform name (google, meta, tiktok, dv360, amazon, linkedin) |
| utm_medium | Buying type (cpc, paid_social, display, video, native) |
| utm_campaign | `{client}_{campaign_name}` |
| utm_content | `{ad_name}` or `{creative_concept}` |
| utm_term | `{keyword}` (search only) |
