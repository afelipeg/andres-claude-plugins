# Next Session: 18/03/2026 — Go Live Day

## Pre-requisitos (Andrés, 20 min antes de empezar)

### 1. Registrar OAuth App de Plinth en Google (~10 min)
- Google Cloud Console → console.cloud.google.com
- Crear proyecto (o usar existente)
- Habilitar Google Drive API
- Crear credencial: OAuth 2.0 Client ID → Web Application
- Redirect URI: `https://plinth.polanyi.tech/auth/callback`
- Configurar OAuth Consent Screen (nombre: Plinth, scopes: drive.readonly, drive.metadata.readonly)
- Copiar Client ID + Client Secret

### 2. Registrar OAuth App de Plinth en Microsoft (~10 min)
- Azure Portal → portal.azure.com → Azure AD → App registrations
- New registration: nombre "Plinth", tipo Web
- Redirect URI: `https://plinth.polanyi.tech/auth/callback`
- API Permissions: Files.Read, Files.Read.All, offline_access
- Certificates & secrets → generar Client Secret
- Copiar Client ID + Client Secret

### 3. Railway Env Vars (3 min)
```
GOOGLE_DRIVE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_TENANT_ID=common
```
→ New Deploy from branch main

---

## Flujo Go Live (dedalo@polanyi.tech)

### Corrida 1: Nuevo Usuario
1. Login en https://plinth.polanyi.tech con dedalo@polanyi.tech
2. `/app/integrations` → Conectar Google Drive (click → autorizar con tu Google)
3. `/app/integrations` → Conectar OneDrive (click → autorizar con tu Microsoft)
4. `/app/integrations` → Configurar al menos 1 ad connector con credenciales reales
5. `/app/data` → Subir archivos: brief, campañas pasadas, sell-out, investor results
6. Column mapping wizard → mapear columnas
7. `/app/command-center` → Seleccionar "Plan" → Execute pipeline
8. Esperar ~2 min → 4 engines, 27 skills
9. Ver scorecard con billing (3 fee streams)
10. HFL → revisar decisión → aprobar

### Corrida 2: Plan vs Actual
1. `/app/data` → Subir KPI results reales (resultados post-campaña)
2. `/app/command-center` → Execute pipeline (auto-detecta run_type=actual)
3. Esperar ~2 min
4. Ver scorecard actual vs plan anterior
5. Comparar: lift %, waste reduction %, MDS delta
6. Billing recalculado con baseline real
7. Verificar 3 fee streams con valores reales

---

## Estado Actual (prod, commit 1d1fee3)

| Componente | Status |
|---|---|
| Backend | https://polanyi-plinth-production.up.railway.app |
| Frontend | https://plinth.polanyi.tech |
| Auth | Admin seeded, JWT + API keys |
| 6 Ad Connectors | Campos específicos por plataforma |
| MCP Marketplace | 5 plataformas, auto-restart, health monitor |
| Google Drive + OneDrive | Cards en UI, pendiente OAuth app setup |
| Batch Upload | 5 tipos, parse PDF/Excel/CSV, column mapping |
| Pipeline Mesh | 4 engines, 27 skills, ~130s |
| Billing | 3 fee streams, waste-estimate fallback |
| HFL | Escalation + auto-approve + decision queue |
| Plan vs Actual | Auto-detect, compare endpoint, baseline injection |
| Scheduler | DB persistence, cron, contextBuilder with feedback |
| Context Validation | 422 hard stop on empty sources |
| MCP Health Monitor | 5 min interval, 12s timeout, 2-failure threshold |

## Stress Tests (verified in prod)

| Test | Result |
|---|---|
| Stress Test A (new user onboarding) | 30 PASS, 0 FAIL |
| Stress Test B (active user cycle) | 25 PASS, 0 FAIL |
| Stress Test Data Flow | 11 PASS, 0 FAIL |

## Session 17-18/03/2026 — Commits (10)

| Commit | Description |
|---|---|
| `dc8f84a` | feat: platform-specific connector auth fields |
| `fd9d3df` | feat: MCP auto-restart + context validation + stress test |
| `34e8dfb` | feat: Cloud Storage cards (Google Drive + OneDrive) |
| `9dac553` | fix: explicit context as data source + recovery 500 |
| `ed84532` | fix: stress test timeouts + 422 handling |
| `f032717` | feat: attribution cycle gaps (run_type, schedule DB, compare API) |
| `2c34de9` | feat: stress test A (onboarding E2E) |
| `64e568a` | fix: JWT cleanup + invite handling |
| `d01bcd9` | fix: single-line JSON + direct curl |
| `1d1fee3` | feat: stress test B + billing waste-estimate fallback |

## Gaps conocidos (no bloqueantes para demo)

| Gap | Impacto | Prioridad |
|---|---|---|
| Lift fee ($0) sin datos de canal | Solo con connector real conectado se llena | Se resuelve al conectar plataforma |
| Efficiency fee ($0) sin métricas CPC/CPM | Mismo — necesita sync real | Se resuelve al conectar plataforma |
| Invite flow 500 en stress test | Script issue, funciona via curl directo | Bajo |
| Compare deltas 0% con datos iguales | Normal — con datos reales los deltas son reales | No es bug |
| Email notifications (Resend) | No implementado | Deferred |
| Cross-client benchmarking | No implementado | Deferred |

## Post Go-Live (si todo funciona)

1. Email notifications con Resend (HFL escalations, pipeline completion)
2. Cross-client benchmarking (comparar waste/lift entre clientes)
3. Onboarding wizard mejorado (step-by-step guiado)
4. Dashboard de usage/consumption mejorado
5. Agent self-evolution / meta-agent
