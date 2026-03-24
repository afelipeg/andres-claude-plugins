Aquí está el contenido completo del `.md` para que lo copies directamente:

```markdown
# Ad Platform Hierarchies & API Connector Reference
> Context document for Claude Code agent — use this to build platform connectors from scratch with correct entity levels, IDs, and auth tokens.

---

## 1. DV360 — Display & Video 360

### Auth / Tokens
| Token / Credential | Description |
|---|---|
| `access_token` | OAuth 2.0 Bearer token (Google Identity) |
| `refresh_token` | Para renovar `access_token` |
| `client_id` / `client_secret` | Google Cloud Console OAuth 2.0 credentials |
| Scopes requeridos | `https://www.googleapis.com/auth/display-video` |

### Hierarchy
```
Partner (partnerId)
└── Advertiser (advertiserId)
    └── Campaign (campaignId)
        └── Insertion Order / IO (insertionOrderId)
            └── Line Item (lineItemId)
                └── Creative (creativeId)
```

### Niveles Detallados

| Nivel | ID Field | Descripción | API Resource |
|---|---|---|---|
| **Partner** | `partnerId` | Entidad raíz. Agrupa anunciantes. Configuración global, billing, audiencias compartidas. | `partners` |
| **Advertiser** | `advertiserId` | Representa una marca/unidad de negocio. Contiene Floodlight, públicos, creatividades. | `advertisers` |
| **Campaign** | `campaignId` | Agrupa Insertion Orders por objetivo de marketing. Wrapper sin budget propio. | `advertisers/{id}/campaigns` |
| **Insertion Order (IO)** | `insertionOrderId` | Control de presupuesto, pacing y fechas. Hub central de ejecución. | `advertisers/{id}/insertionOrders` |
| **Line Item** | `lineItemId` | Targeting, bid strategy, inventory source, frecuencia. Nivel de ejecución táctica. | `advertisers/{id}/lineItems` |
| **Creative** | `creativeId` | Asset del anuncio: display, video, native. Asociado a Line Item vía `assignedCreatives`. | `advertisers/{id}/creatives` |

### API Base URL
```
https://displayvideo.googleapis.com/v3/
```

### IDs adicionales relevantes
- `floodlightGroupId` — Tracking de conversiones
- `inventorySourceId` — Fuente de inventario
- `audienceGroupId` — Segmentos de audiencia
- `channelId` — Canales de inventario personalizado

---

## 2. Google Ads

### Auth / Tokens
| Token / Credential | Description |
|---|---|
| `access_token` | OAuth 2.0 Bearer token |
| `refresh_token` | Para renovar sesión |
| `client_id` / `client_secret` | Google Cloud Console |
| `developer_token` | Token de nivel de app (requerido para Google Ads API) |
| `login_customer_id` | Customer ID del Manager Account (MCC) — header `login-customer-id` |
| Scopes | `https://www.googleapis.com/auth/adwords` |

### Hierarchy
```
Manager Account / MCC (customerId)
└── Sub-Manager Account (customerId)  [opcional]
    └── Client Account / Customer (customerId)
        └── Campaign (campaignId)
            └── Ad Group (adGroupId)
                └── Ad (adId)
                    └── Ad Group Criterion / Keyword / Target (criterionId)
```

### Niveles Detallados

| Nivel | ID Field | Descripción |
|---|---|---|
| **Manager Account (MCC)** | `customerId` | Cuenta paraguas. Gestiona múltiples cuentas cliente. Puede anidar sub-MCCs. |
| **Sub-Manager** | `customerId` | MCC secundario. Útil para agencias con múltiples clientes. |
| **Customer (Client Account)** | `customerId` | Cuenta de anunciante individual. Contiene campañas, billing, conversiones. |
| **Campaign** | `campaignId` | Define objetivo, tipo (Search/Display/Video/Shopping/App), budget y bid strategy. |
| **Ad Group** | `adGroupId` | Agrupa anuncios y keywords bajo un tema. Hereda configuración de Campaign. |
| **Ad** | `adId` | Creative específico: RSA, Display, Video, etc. |
| **Ad Group Criterion** | `criterionId` | Keywords, placements, audiences, topics asignados al Ad Group. |

### Recursos adicionales
- `biddingStrategyId` — Estrategia de puja compartida
- `conversionActionId` — Acción de conversión
- `feedId` / `feedItemId` — Para Shopping/Dynamic Ads
- `assetId` — Assets compartidos (imágenes, textos)
- `labelId` — Etiquetas para organización

### API Base URL
```
https://googleads.googleapis.com/v18/customers/{customerId}/
```

---

## 3. Meta — Facebook Business Manager

### Auth / Tokens
| Token / Credential | Description |
|---|---|
| `access_token` (User Token) | OAuth token del usuario con permisos `ads_management`, `ads_read` |
| `access_token` (System User Token) | Token de larga duración para integración server-to-server (recomendado) |
| `app_id` / `app_secret` | Credenciales de la Meta App (developers.facebook.com) |
| `business_id` | ID del Business Portfolio / Business Manager |
| `pixel_id` | ID del Meta Pixel para Conversions API |
| Scopes | `ads_management`, `ads_read`, `business_management`, `pages_read_engagement` |

### Hierarchy
```
Business Portfolio / Business Manager (business_id)
├── Ad Account (act_{ad_account_id})
│   └── Campaign (campaign_id)
│       └── Ad Set (adset_id)
│           └── Ad (ad_id)
│               └── Ad Creative (creative_id)
├── Meta Pixel (pixel_id)
├── Page (page_id)
├── Instagram Account (instagram_actor_id)
├── Catalog (catalog_id)
│   └── Product Set (product_set_id)
└── Custom Audience (audience_id)
```

### Niveles Detallados

| Nivel | ID Format | Descripción |
|---|---|---|
| **Business Manager** | `business_id` | Contenedor raíz. Gestiona cuentas publicitarias, páginas, pixels, personas. |
| **Ad Account** | `act_{number}` | Cuenta de facturación y ejecución. Prefijo `act_` obligatorio en API. |
| **Campaign** | `campaign_id` | Define el objetivo (Awareness, Traffic, Leads, Sales, etc.) y Campaign Budget Optimization (CBO). |
| **Ad Set** | `adset_id` | Audiencia, placements, presupuesto (si no CBO), schedule, optimization goal y bid. |
| **Ad** | `ad_id` | Combina creative con Ad Set. Estado de entrega individual. |
| **Ad Creative** | `creative_id` | Asset visual/copy: image, video, carousel, collection. Reusable entre ads. |

### Assets Adicionales Relevantes

| Asset | ID Field | Uso en API |
|---|---|---|
| **Meta Pixel** | `pixel_id` | Tracking web. Necesario para Conversions API (CAPI). |
| **Page** | `page_id` | Requerido para crear ads en Facebook/Instagram. |
| **Instagram Account** | `instagram_actor_id` | Para ads en Instagram. Vinculada a Page. |
| **Custom Audience** | `audience_id` | Audiencias de retargeting, lookalike. |
| **Product Catalog** | `catalog_id` | Para Dynamic Ads / Advantage+ Shopping. |
| **Product Set** | `product_set_id` | Subconjunto de catálogo para targeting granular. |

### API Base URL
```
https://graph.facebook.com/v21.0/
```

---

## 4. TikTok Ads Manager + TikTok Shop

### Auth / Tokens
| Token / Credential | Description |
|---|---|
| `access_token` | OAuth 2.0 token obtenido tras autorización del advertiser |
| `app_id` / `secret` | Credenciales de la TikTok App (developers.tiktok.com) |
| `advertiser_id` | ID de la cuenta publicitaria del anunciante |
| `bc_id` | Business Center ID (contenedor corporativo) |
| Scopes | `advertiser:read`, `campaign:read`, `campaign:write`, `report:read` |

### TikTok Ads — Hierarchy
```
Business Center (bc_id)
└── Advertiser Account (advertiser_id)
    └── Campaign (campaign_id)
        └── Ad Group (adgroup_id)
            └── Ad (ad_id)
                └── Creative (image_id / video_id)
```

### Niveles Detallados — TikTok Ads

| Nivel | ID Field | Descripción |
|---|---|---|
| **Business Center** | `bc_id` | Contenedor corporativo. Agrupa múltiples cuentas publicitarias y activos. |
| **Advertiser Account** | `advertiser_id` | Cuenta de ejecución publicitaria. Contiene campañas y billing. |
| **Campaign** | `campaign_id` | Objetivo de marketing (Reach, Traffic, App Install, Conversions, etc.) y budget CBO. |
| **Ad Group** | `adgroup_id` | Placements, audiencia (intereses, comportamientos, lookalike), presupuesto, bid, schedule. |
| **Ad** | `ad_id` | Creative específico. Texto, imagen o video. Estado de entrega individual. |

### TikTok Shop — Hierarchy Adicional
```
TikTok Shop Seller Account (shop_id)
└── Product (product_id)
    └── SKU (sku_id)
└── Order (order_id)
└── Shop Ads — VSA (Video Shopping Ads)
    └── Campaign (campaign_id)  [objective: PRODUCT_SALES]
        └── Ad Group (adgroup_id)  [shopping_ads_type: VIDEO / LIVE / CATALOG]
            └── Ad (ad_id)
```

### Tokens adicionales TikTok Shop
| Token / ID | Description |
|---|---|
| `shop_id` | ID del seller shop en TikTok Shop |
| `shop_cipher` | Token cifrado de autenticación del shop (distinto al ads token) |
| `open_id` | ID del usuario TikTok que autorizó |
| App Scopes Shop | `shop.info.read`, `product.list`, `order.list` |

### API Base URLs
```
# Ads API
https://business-api.tiktok.com/open_api/v1.3/

# TikTok Shop API
https://open-api.tiktok-shops.com/
```

---

## 5. Amazon Ads

### Auth / Tokens
| Token / Credential | Description |
|---|---|
| `access_token` | OAuth 2.0 (Login with Amazon — LWA) |
| `refresh_token` | Para renovar sesión. Long-lived. |
| `client_id` / `client_secret` | Amazon Developer Console (LWA App) |
| `Amazon-Advertising-API-ClientId` | Header requerido en todas las llamadas |
| `Amazon-Advertising-API-Scope` | Header con el `profileId` activo |
| Endpoint auth | `https://api.amazon.com/auth/o2/token` |

### Hierarchy
```
Amazon Ads Account
└── Profile (profileId)  ← unidad por marketplace + tipo de cuenta
    └── Portfolio (portfolioId)  [opcional, agrupador]
        └── Campaign (campaignId)
            └── Ad Group (adGroupId)
                ├── Ad / Product Ad (adId)
                └── Targeting / Keyword (targetId / keywordId)
```

### Niveles Detallados

| Nivel | ID Field | Descripción |
|---|---|---|
| **Profile** | `profileId` | Representa un anunciante en un marketplace específico. Requerido en header `Amazon-Advertising-API-Scope`. |
| **Portfolio** | `portfolioId` | Agrupador opcional de campañas. Permite budget caps y organización por línea de producto. |
| **Campaign** | `campaignId` | Define el tipo (Sponsored Products, Sponsored Brands, Sponsored Display, DSP) y budget. |
| **Ad Group** | `adGroupId` | Agrupa ads bajo un bid base. Disponible en Sponsored Products y Sponsored Display. |
| **Ad / Product Ad** | `adId` | ASIN o producto específico promovido. |
| **Keyword / Target** | `keywordId` / `targetId` | Keywords (exact/phrase/broad) o targets (PAT, audience, category). |

### Tipos de Campañas

| Tipo | Descripción |
|---|---|
| `sponsoredProducts` | Ads en resultados de búsqueda y páginas de producto |
| `sponsoredBrands` | Banner de marca con logo + múltiples productos |
| `sponsoredDisplay` | Display on/off Amazon, retargeting por audiencia |
| `video` | Video ads dentro de Sponsored Brands |

### Amazon DSP
```
DSP Account (accountId)
└── Order (orderId)
    └── Line Item (lineItemId)
        └── Creative (creativeId)
```

### API Base URLs
```
# Amazon Ads API (Sponsored)
https://advertising.amazon.com/API/  (v2/v3)

# Amazon DSP API
https://advertising.amazon.com/dsp/  (v1)

# Profiles (primer call siempre)
GET https://advertising.amazon.com/v2/profiles
```

---

## Resumen Auth — Quick Reference

| Plataforma | Token Principal | ID Clave de Scope |
|---|---|---|
| **DV360** | `access_token` (Google OAuth) | `partnerId` / `advertiserId` |
| **Google Ads** | `access_token` + `developer_token` | `customerId` (MCC + Client) |
| **Meta** | `access_token` (System User preferido) | `business_id` / `act_{ad_account_id}` |
| **TikTok Ads** | `access_token` | `advertiser_id` / `bc_id` |
| **TikTok Shop** | `access_token` + `shop_cipher` | `shop_id` |
| **Amazon Ads** | `access_token` (LWA) | `profileId` (header scope) |

---

## Notas para Claude Code — Connector Implementation

### IDs mínimos requeridos por plataforma

```json
{
  "dv360": {
    "required": ["access_token", "refresh_token", "partner_id", "advertiser_id"],
    "optional": ["campaign_id", "insertion_order_id"]
  },
  "google_ads": {
    "required": ["access_token", "refresh_token", "developer_token", "customer_id"],
    "optional": ["manager_customer_id", "campaign_id"]
  },
  "meta": {
    "required": ["access_token", "business_id", "ad_account_id"],
    "optional": ["pixel_id", "page_id", "catalog_id"]
  },
  "tiktok_ads": {
    "required": ["access_token", "advertiser_id"],
    "optional": ["bc_id", "campaign_id"]
  },
  "tiktok_shop": {
    "required": ["access_token", "shop_id", "shop_cipher"],
    "optional": ["open_id"]
  },
  "amazon_ads": {
    "required": ["access_token", "refresh_token", "client_id", "profile_id"],
    "optional": ["portfolio_id", "campaign_id"]
  }
}
```

### Webhooks / Real-time disponibles
| Plataforma | Webhook / Push |
|---|---|
| Meta | Conversions API (CAPI) — server-side events |
| TikTok | Events API — server-side pixel |
| Amazon | Amazon EventBridge |
| Google Ads | Pub/Sub (offline conversions upload) |
| DV360 | Reporting API scheduled queries (sin webhook nativo) |
```

Cópialo completo y pégalo en tu proyecto como `ad_platforms_hierarchy.md`. Si quieres que agregue algo más (como endpoints específicos de reporting, ejemplos de payloads, o estructura de permisos por rol), dímelo.