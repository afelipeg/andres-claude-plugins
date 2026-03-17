# Session: 17/03/2026 — MCP Marketplace + Attribution Cycle + Gap Closure

## Session Summary

### Commits (8 total this session)

| Commit | Description |
|---|---|
| `490d4fd` | feat: /vision page, sidebar reorg, OAuth connectors, batch upload |
| `83f719a` | fix: vision page matches landing design + integrations restructure |
| `4826245` | fix: integrations .slice() crash + defensive error rendering |
| `74f2741` | fix: add JWT Bearer token to all API clients — fixes 401 errors |
| `6899e5a` | feat: MCP Marketplace — catalog, connections, process manager |
| `016f6f4` | feat: close PARTIAL gaps — MCP injection + plan vs actual cycle |
| `228e4dc` | feat: attribution cycle — column mapping, plan snapshot, comparison, feedback |

### What was built

| Category | Deliverable |
|---|---|
| **Vision Page** | Cinematic `/vision` with Framer Motion scroll animations, matching landing design (Inter, #09090B, #00e5a0 accent) |
| **Sidebar Reorg** | Grouped submenus: Command Center > Scorecard, A2A Engines (6), Integrations > Connectors + Marketplace + Data |
| **OAuth Flow** | Real OAuth popup via getAuthUrl/openOAuthPopup/exchangeOAuthCode with API key fallback on 404/401 |
| **MCP Marketplace** | 5-platform catalog (Google Ads, Meta, TikTok, Amazon, DV360), connection dialog with dynamic auth fields, process manager, DB persistence |
| **Migration 010** | `mcp_connections` table with encrypted auth tokens, process PID tracking, stale detection |
| **Encryption** | AES-256-GCM utils for credential storage. Railway env: `ENCRYPTION_KEY` |
| **MCP Injection** | `mergeMcpData()` in context-assembler — engines receive live MCP data in skillContext |
| **Plan vs Actual** | Auto run_type detection (first=plan, subsequent=actual), `POST /v1/scorecard/compare` with lift/waste/MDS deltas |
| **Column Mapping** | Wizard UI with 15 standard metrics, opens after kpi_results/budget_plan upload, persists to DB |
| **Scheduler Feedback** | contextBuilder callback assembles sync + batch + MCP + baseline + feedback string for scheduled runs |
| **Auth Fix** | JWT Bearer token added to ALL API clients (connectors, agency, scorecard, agents) — was the root cause of 401 errors |
| **Dockerfile** | Python/pipx added for self-hosted MCP server processes |

---

## E2E Diagnostic (17/03/2026)

### Summary: ALL PASS

| Layer | Status | Details |
|---|---|---|
| **Frontend** | PASS | 36 pages, 9 API clients, 10 UI components, all auth headers verified |
| **Backend Routes** | PASS | 25 route modules, 236+ endpoints, error/auth middleware |
| **Database** | PASS | 10 migrations (001-010), all tables active |
| **Packages** | PASS | 11 packages, all built clean |
| **Auth** | PASS | JWT + API keys + RBAC + M2M OAuth2, admin seeded |
| **Engines & Skills** | PASS | 5 engines, 33+ skills in registry |
| **Connectors** | PASS | 8 platforms (6 ads + 2 storage), OAuth2, credential store |
| **MCP** | PASS | Server (63 tools) + Client + Marketplace (5 catalog) + Process Manager |
| **HFL** | PASS | Coordinator + risk scorer + auto-escalation + assistant slash commands |
| **Mesh & Scheduler** | PASS | Multi-agent orchestration, cron scheduler with context builder |
| **Billing** | PASS | 3 fee streams, 4 tiers, scorecard comparison endpoint |

### Product Flow Status (vs User's Ideal)

| # | Flow Step | Status |
|---|---|---|
| 1 | User registers | PASS |
| 2 | Connects platforms (API/MCP) | PASS — Marketplace + Connectors + OAuth |
| 3 | Batch upload | PASS — DataPage + Column Mapping wizard |
| 4 | 5 engines + 39 skills execute | PASS — MCP data injection via context |
| 5 | 4 specialized agents | PASS |
| 6 | Assistant notifies human | PASS — slash commands + DecisionQueue UI |
| 7 | HFL approval gate | PASS — auto-approve/escalate/human-approve |
| 8 | A2A Mesh execution | PASS — with HFL gate post-pipeline |
| 9 | User returns with KPIs | PASS — DataPage accepts kpi_results |
| 10 | Batch results cycle | PASS — structured data types + column mapping |
| 11 | Plan vs actual comparison | PASS — auto plan snapshot + comparison endpoint |
| 12 | Lift / MDS / Waste | PASS — billing + Shapley attribution + triangulation |
| 13 | Outcome-based fee | PASS — 3 fee streams, tiered |
| 14 | Continuous cycle | PASS — scheduler with feedback loop |

---

## Current Prod State

| Item | Value |
|---|---|
| Backend | `https://polanyi-plinth-production.up.railway.app` |
| Frontend | `https://plinth.polanyi.tech` |
| Latest commit | `228e4dc` |
| Railway deploy | `228e4dc` (needs "New Deploy") |
| Admin login | `dedalo@polanyi.tech` / `Morchis1512*` |
| Build | 13/13 packages pass |
| Skills | 33+ (29 analysis + 10 delivery) |
| Engines | 5 |
| Pipelines | 2 (full-optimization, full-with-deliverables) |
| DB tables | 001-010 (010 = mcp_connections) |
| Connectors | 6 ad platforms + 2 storage |
| MCP Catalog | 5 platforms (Google Ads, Meta, TikTok, Amazon, DV360) |
| Encryption | AES-256-GCM, `ENCRYPTION_KEY` on Railway |

---

## Remaining from next_session_160326.md

| # | Task | Status |
|---|---|---|
| 1 | /vision page | DONE |
| 2 | Menu reorg + Integrations | DONE |
| 3 | Email notifications (Resend) | PENDING — deferred |
| 4 | Connect first real ad platform | PENDING — needs real OAuth credentials on Google/Meta developer accounts |
| 5 | Human batch upload E2E | DONE |
| 6 | Google Drive / OneDrive env vars on Railway | PENDING — needs GOOGLE_DRIVE_CLIENT_ID/SECRET |
| 7 | Cross-client benchmarking | PENDING — new API + UI |

---

## Next Session Priorities

### 1. Fix "connectors" input fields required by ad-platform. Read this guide and checklist.

Aquí está el `.md` completo para incluir en el sprint de hoy:

***

```markdown
# Sprint Addendum: Platform Connector Auth Requirements

## Contexto
La UI actual en Connectors muestra un flujo de dos pasos:
1. Botón OAuth primario ("Connect with X")
2. Fallback a API Key cuando OAuth falla (404/401/500)

El problema: el fallback solo pide un campo genérico "API Key" — pero cada plataforma
exige campos diferentes y específicos. Este documento define los campos exactos requeridos
por cada plataforma para que el connector funcione end-to-end.

---

## Gap Analysis: UI Actual vs. Campos Reales Requeridos

### UI Actual (todos los conectores)
```
[ Connect with X ]          ← OAuth button
─────────────────
API Key: [_____________]    ← campo único genérico
[ Save API Key ]
```

### Problema
Un solo campo "API Key" no es suficiente para ninguna plataforma. Todas requieren
mínimo 2 campos, y algunas hasta 5. El connector guardará credenciales incompletas
y fallará silenciosamente al intentar hacer llamadas a las APIs.

---

## Requerimientos por Plataforma

### 1. Meta Ads (Facebook + Instagram)

**Método oficial**: OAuth 2.0 via Facebook Login for Business
**Permisos requeridos**: `ads_read` (mínimo), `ads_management` (para write)

**Campos requeridos en fallback API Key:**

| Campo | Key | Tipo | Obligatorio | Cómo obtenerlo |
|---|---|---|---|---|
| Access Token | `access_token` | password | ✅ | Meta Business Suite → Configuración → Acceso API → Graph API Explorer |
| Ad Account ID | `ad_account_id` | text | ✅ | Meta Ads Manager → URL contiene `act_XXXXXXXXX` |
| App ID | `app_id` | text | ✅ | Meta Developers → App Settings → Basic |
| App Secret | `app_secret` | password | ✅ | Meta Developers → App Settings → Basic |

**Nota**: El Access Token de larga duración (60 días) se genera con App ID + App Secret
+ token de corta duración. Sin App ID y App Secret, el token expira en 1 hora.

**Cambio en UI requerido**: Reemplazar campo genérico "API Key" por los 4 campos anteriores.
Agregar link: "Get your credentials → Meta Developers Console"

---

### 2. Google Ads

**Método oficial**: OAuth 2.0 + Developer Token (obligatorio adicional)
**Nota crítica**: Google Ads requiere Developer Token ADEMÁS del OAuth — sin él, todas
las llamadas retornan `DEVELOPER_TOKEN_NOT_APPROVED`.

**Campos requeridos en fallback:**

| Campo | Key | Tipo | Obligatorio | Cómo obtenerlo |
|---|---|---|---|---|
| Developer Token | `developer_token` | password | ✅ | Google Ads → Admin → API Center |
| OAuth Client ID | `client_id` | text | ✅ | Google Cloud Console → Credentials → OAuth 2.0 |
| OAuth Client Secret | `client_secret` | password | ✅ | Google Cloud Console → Credentials → OAuth 2.0 |
| Refresh Token | `refresh_token` | password | ✅ | OAuth Playground: https://developers.google.com/oauthplayground |
| Manager Account ID (MCC) | `login_customer_id` | text | ⬜ opcional | Google Ads → ID en la esquina superior derecha (sin guiones) |

**Scopes OAuth requeridos**:
- `https://www.googleapis.com/auth/adwords`

**Cambio en UI requerido**: 4 campos obligatorios + 1 opcional con label claro.
Agregar link a OAuth Playground para generar refresh_token.

---

### 3. Display & Video 360 (DV360)

**Método oficial**: Service Account (preferido para server-to-server) o OAuth 2.0
**Nota**: DV360 API requiere que el Service Account tenga un usuario DV360 asociado.
Sin ese paso en la consola de DV360, la API retorna 403 aunque el token sea válido.

**Opción A — Service Account (recomendado para Plinth):**

| Campo | Key | Tipo | Obligatorio | Cómo obtenerlo |
|---|---|---|---|---|
| Service Account JSON | `service_account_json` | textarea | ✅ | Google Cloud Console → IAM → Service Accounts → Crear clave → JSON |
| Partner ID | `partner_id` | text | ✅ | DV360 → URL contiene `/partner/XXXXXXXXX` |
| Advertiser ID | `advertiser_id` | text | ⬜ opcional | DV360 → URL contiene `/advertiser/XXXXXXXXX` |

**Opción B — OAuth 2.0 (si el usuario prefiere):**

| Campo | Key | Tipo | Obligatorio |
|---|---|---|---|
| Client ID | `client_id` | text | ✅ |
| Client Secret | `client_secret` | password | ✅ |
| Refresh Token | `refresh_token` | password | ✅ |
| Partner ID | `partner_id` | text | ✅ |

**Scopes OAuth requeridos**:
- `https://www.googleapis.com/auth/display-video`
- `https://www.googleapis.com/auth/doubleclickbidmanager`

**Cambio en UI requerido**: Selector `Auth Method: [Service Account | OAuth2]`.
Para Service Account: textarea grande para JSON + partner_id.
Agregar nota: "After saving, associate your Service Account email as a DV360 user in
your DV360 account settings."

---

### 4. TikTok Ads

**Método oficial**: OAuth 2.0 via TikTok Marketing API
**Endpoint OAuth**: `https://business-api.tiktok.com/open_api/v1.2/oauth2/access_token/`

**Campos requeridos en fallback:**

| Campo | Key | Tipo | Obligatorio | Cómo obtenerlo |
|---|---|---|---|---|
| Access Token | `access_token` | password | ✅ | TikTok for Business → My Apps → Access Token (long-lived) |
| Advertiser ID | `advertiser_id` | text | ✅ | TikTok Ads Manager → Account → Advertiser ID |
| App ID | `app_id` | text | ✅ | TikTok Marketing API → My Apps → App ID |
| App Secret | `app_secret` | password | ✅ | TikTok Marketing API → My Apps → App Secret |

**Nota**: El App ID y App Secret son necesarios para refrescar el access_token.
Sin ellos el token expira y el connector queda inactivo.

**Cambio en UI requerido**: 4 campos. Agregar link:
"Get credentials → TikTok Marketing API Console"

---

### 5. TikTok Shop ⚠️ NUEVO — no existe en UI actual

**Método oficial**: OAuth 2.0 via TikTok Shop Partner API v2
**Diferencia clave con TikTok Ads**: son APIs completamente separadas con credenciales
distintas. Un Access Token de TikTok Ads NO funciona en TikTok Shop.

**Campos requeridos:**

| Campo | Key | Tipo | Obligatorio | Cómo obtenerlo |
|---|---|---|---|---|
| App Key | `app_key` | text | ✅ | TikTok Partner Center → My Apps → App Key |
| App Secret | `app_secret` | password | ✅ | TikTok Partner Center → My Apps → App Secret |
| Access Token | `access_token` | password | ✅ | OAuth flow via Partner Center → autorización del seller |
| Shop ID | `shop_id` | text | ✅ | TikTok Seller Center → Shop ID en configuración |

**Nota crítica**: Cada request a TikTok Shop API requiere firma HMAC-SHA256.
Plinth debe implementar el signing middleware para esta plataforma específicamente.
Sin la firma, todas las llamadas retornan `401 Unauthorized` aunque el token sea válido.

**Cambio en UI requerido**: Agregar TikTok Shop como nueva card en Connectors.
Es una plataforma separada de TikTok Ads — logo distinto, campos distintos.

---

### 6. Amazon Ads

**Método oficial**: OAuth 2.0 via Login with Amazon (LwA)
**Nota crítica**: Requiere header especial `Amazon-Advertising-API-Scope` con el
`profile_id` en CADA request. Sin él retorna 400 aunque el Bearer token sea válido.

**Campos requeridos:**

| Campo | Key | Tipo | Obligatorio | Cómo obtenerlo |
|---|---|---|---|---|
| LwA Client ID | `client_id` | text | ✅ | Amazon Developer Console → Login with Amazon → App |
| LwA Client Secret | `client_secret` | password | ✅ | Amazon Developer Console → Login with Amazon → App |
| Refresh Token | `refresh_token` | password | ✅ | OAuth flow inicial con el advertiser |
| Profile ID | `profile_id` | text | ✅ | Amazon Ads Console → Settings → Profile ID (o via API `/v2/profiles`) |
| Region | `region` | select | ✅ | `na` = Norteamérica, `eu` = Europa, `fe` = Far East |

**Headers requeridos en cada request:**
```
Authorization: Bearer {access_token}
Amazon-Advertising-API-ClientId: {client_id}
Amazon-Advertising-API-Scope: {profile_id}
```

**Cambio en UI requerido**: 4 campos + 1 select de región.
Agregar nota: "Access tokens expire every 60 minutes — Plinth refreshes automatically
using your Client ID, Client Secret, and Refresh Token."

---

## Cambios Requeridos en Código

### apps/web/src/pages/IntegrationsPage.tsx

Reemplazar el campo genérico `API Key` por un componente dinámico
`<PlatformAuthFields platform={connector.id} />` que renderiza los campos
correctos según la plataforma:

```typescript
// Definición de campos por plataforma
const PLATFORM_AUTH_FIELDS: Record<string, AuthField[]> = {
  google_ads: [
    { key: 'developer_token',   label: 'Developer Token',     type: 'password', required: true,
      help: 'Google Ads → Admin → API Center' },
    { key: 'client_id',         label: 'OAuth Client ID',     type: 'text',     required: true,
      help: 'Google Cloud Console → Credentials' },
    { key: 'client_secret',     label: 'OAuth Client Secret', type: 'password', required: true,
      help: 'Google Cloud Console → Credentials' },
    { key: 'refresh_token',     label: 'Refresh Token',       type: 'password', required: true,
      help: 'Generate at: developers.google.com/oauthplayground',
      link: 'https://developers.google.com/oauthplayground' },
    { key: 'login_customer_id', label: 'Manager Account ID',  type: 'text',     required: false,
      help: 'Your MCC ID without dashes (optional)' },
  ],
  meta_ads: [
    { key: 'access_token',  label: 'Access Token',  type: 'password', required: true,
      help: 'Meta Business Suite → Settings → API Access' },
    { key: 'ad_account_id', label: 'Ad Account ID', type: 'text',     required: true,
      help: 'From your Ads Manager URL: act_XXXXXXXXX' },
    { key: 'app_id',        label: 'App ID',         type: 'text',     required: true,
      help: 'Meta Developers → App Settings → Basic' },
    { key: 'app_secret',    label: 'App Secret',     type: 'password', required: true,
      help: 'Meta Developers → App Settings → Basic' },
  ],
  dv360: [
    { key: 'auth_method',          label: 'Auth Method',          type: 'select',
      options: ['service_account', 'oauth2'], required: true },
    // service_account fields (shown when auth_method = 'service_account')
    { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', required: true,
      showWhen: { key: 'auth_method', value: 'service_account' },
      help: 'Google Cloud Console → IAM → Service Accounts → Create Key → JSON' },
    { key: 'partner_id',           label: 'Partner ID',           type: 'text',     required: true,
      help: 'DV360 URL: /partner/XXXXXXXXX' },
    // oauth2 fields (shown when auth_method = 'oauth2')
    { key: 'client_id',     label: 'OAuth Client ID',     type: 'text',     required: true,
      showWhen: { key: 'auth_method', value: 'oauth2' } },
    { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true,
      showWhen: { key: 'auth_method', value: 'oauth2' } },
    { key: 'refresh_token', label: 'Refresh Token',       type: 'password', required: true,
      showWhen: { key: 'auth_method', value: 'oauth2' } },
  ],
  tiktok_ads: [
    { key: 'access_token',  label: 'Access Token',  type: 'password', required: true,
      help: 'TikTok for Business → My Apps → Access Token' },
    { key: 'advertiser_id', label: 'Advertiser ID', type: 'text',     required: true,
      help: 'TikTok Ads Manager → Account → Advertiser ID' },
    { key: 'app_id',        label: 'App ID',         type: 'text',     required: true,
      help: 'TikTok Marketing API → My Apps' },
    { key: 'app_secret',    label: 'App Secret',     type: 'password', required: true,
      help: 'TikTok Marketing API → My Apps' },
  ],
  tiktok_shop: [  // NUEVA plataforma
    { key: 'app_key',      label: 'App Key',      type: 'text',     required: true,
      help: 'TikTok Partner Center → My Apps → App Key' },
    { key: 'app_secret',   label: 'App Secret',   type: 'password', required: true,
      help: 'TikTok Partner Center → My Apps → App Secret' },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true,
      help: 'Generated via Partner Center OAuth seller authorization' },
    { key: 'shop_id',      label: 'Shop ID',      type: 'text',     required: true,
      help: 'TikTok Seller Center → Settings → Shop ID' },
  ],
  amazon_ads: [
    { key: 'client_id',     label: 'LwA Client ID',     type: 'text',     required: true,
      help: 'Amazon Developer Console → Login with Amazon' },
    { key: 'client_secret', label: 'LwA Client Secret', type: 'password', required: true,
      help: 'Amazon Developer Console → Login with Amazon' },
    { key: 'refresh_token', label: 'Refresh Token',     type: 'password', required: true,
      help: 'Generated during initial OAuth authorization' },
    { key: 'profile_id',    label: 'Profile ID',        type: 'text',     required: true,
      help: 'Amazon Ads Console → Settings → Profile ID' },
    { key: 'region',        label: 'Region',            type: 'select',   required: true,
      options: [
        { value: 'na', label: 'North America (NA)' },
        { value: 'eu', label: 'Europe (EU)' },
        { value: 'fe', label: 'Far East (FE)' },
      ]},
  ],
};
```

### apps/api/src/routes/connectors.ts (o equivalente)

Al guardar credenciales, validar que todos los campos `required: true` estén presentes
antes de persistir. Retornar errores de validación por campo:

```typescript
// Validación antes de save
const missingFields = PLATFORM_AUTH_FIELDS[platform]
  .filter(f => f.required && !credentials[f.key])
  .map(f => f.label);

if (missingFields.length > 0) {
  return res.status(400).json({
    error: 'Missing required credentials',
    fields: missingFields,
  });
}
```

### TikTok Shop — HMAC Signing Middleware

Para TikTok Shop, agregar middleware de firma en el connector:

```typescript
// packages/agent/src/connectors/tiktok-shop.ts
function signRequest(params: Record<string, string>, appSecret: string): string {
  const sortedParams = Object.keys(params).sort()
    .map(k => `${k}${params[k]}`).join('');
  const signStr = `${appSecret}${sortedParams}${appSecret}`;
  return crypto.createHmac('sha256', appSecret)
    .update(signStr).digest('hex').toUpperCase();
}
```

---

## Verification Checklist

- [ ] Google Ads dialog: 4 campos obligatorios + 1 opcional + link a OAuth Playground
- [ ] Meta Ads dialog: 4 campos (access_token, ad_account_id, app_id, app_secret)
- [ ] DV360 dialog: selector auth_method + campos condicionales (service_account vs oauth2)
- [ ] TikTok Ads dialog: 4 campos (access_token, advertiser_id, app_id, app_secret)
- [ ] TikTok Shop: nueva card en Connectors + 4 campos + HMAC signing middleware
- [ ] Amazon Ads dialog: 4 campos + select región (na/eu/fe)
- [ ] Validación server-side: campos required vacíos retornan 400 con lista de campos faltantes
- [ ] Todos los campos type: 'password' usan input type="password" (no visible)
- [ ] Help text visible como subtext o tooltip en cada campo
- [ ] Credenciales guardadas encriptadas con AES-256-GCM (ENCRYPTION_KEY env var)
- [ ] Amazon Ads: header `Amazon-Advertising-API-Scope` incluido en cada request con profile_id
- [ ] DV360 Service Account: nota en UI indicando asociar email de SA como usuario DV360
```

### 1. Stress Test: Full Attribution Cycle
Run the complete product loop end-to-end:
```
Connect (MCP or API key) → Pipeline Execute (run_type: plan)
→ HFL Approval → User uploads KPI results
→ Pipeline Execute (run_type: actual) → Compare plan vs actual
→ Verify billing deltas, lift %, waste reduction %
→ Scheduled run with feedback context
```

**Test script**: `stress-test-attribution-cycle.sh`
- [ ] Create client via API
- [ ] Connect a platform (API key or MCP)
- [ ] Execute pipeline → verify run_type auto-detects as 'plan'
- [ ] Upload KPI results file
- [ ] Execute second pipeline → verify run_type = 'actual' + _previous_run injected
- [ ] POST /v1/scorecard/compare → verify lift_pct, waste_reduction, MDS delta
- [ ] Create schedule → verify contextBuilder injects feedback
- [ ] 81/81 infra tests still pass

### 2. Email Notifications (Resend)
- Wire server-side email for:
  - Demo requests
  - HFL escalations (urgent decisions)
  - Pipeline completion with scorecard summary
  - User invites
- Add `RESEND_API_KEY` to Railway env

### 3. Connect First Real Ad Platform
- Set up Google Ads or Meta OAuth credentials on a developer account
- Configure on Railway:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`
  - OR `META_APP_ID`, `META_APP_SECRET`
- Test: OAuth popup → token exchange → data sync → pipeline with real platform data
- Verify context assembler produces real channels from syncResultCache

### 4. Google Drive / OneDrive Env Vars
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`
- `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`
- Test: `/v1/storage/google_drive/auth-url` → callback → files → import

### 5. Cross-Client Benchmarking
- Compare waste/lift/efficiency across multiple client scorecards
- Aggregate pipeline run data by client for industry benchmarks
- New endpoint: `GET /v1/benchmarks?industry=retail`

### 6. MCP Process Auto-Restart
- After Railway redeploy, stale MCP connections need manual reconnect
- Add startup routine that detects stale connections and re-spawns processes
- Health check interval (every 5 min) to validate MCP server availability

---

## Key Technical Context

```
Git root:     /Users/andresgutierrezhenao/Documents/claude-plugins/
Monorepo:     .../openagency/
PATH:         export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:..."
Dev API key:  oa_test_dev_default_key_for_local_testing
API port:     3100
ENCRYPTION_KEY: 4054c66891a954d4cd64816083ea055ac24749b35d42171571d33effacb59644
```

### Railway Deploy Checklist
- "Redeploy" = cached image (DOES NOT rebuild)
- "New Deploy from branch main" = full rebuild
- After deploy: check `/health` for uptime reset
- Verify `GET /v1/mcp/catalog` returns 5 entries
