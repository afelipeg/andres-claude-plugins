# Próxima sesión: Schedule + Delivery Engine + E2E + Deploy

---

## BLOQUE 1: Pipeline Scheduler + Delivery Engine (5to motor)

### 1A. Pipeline Scheduler

Agregar cron scheduling al mesh coordinator. El humano o un agente programa runs recurrentes.

**Nuevo: `packages/agent/src/mesh/scheduler.ts`**

```typescript
interface PipelineSchedule {
  id: string;              // ULID
  client_id: string;
  pipeline_id: string;     // "full-optimization", "full-with-deliverables"
  cron: string;            // "0 6 * * 1" (lunes 6am)
  auto_approve: boolean;   // si HFL risk < threshold, no escalar
  notify_on_complete: boolean;
  enabled: boolean;
  created_at: string;
  last_run_at?: string;
  next_run_at?: string;
}
```

- Persistence: tabla `pipeline_schedules` en PostgreSQL (nueva migration `004_schedules.sql`)
- Runtime: cron parser + `setInterval` check cada minuto → si toca → `mesh.executePipeline()`
- HFL integration: el run schedulado pasa por HFL como cualquier otro run
- MCP tool: `schedule_pipeline`, `list_schedules`, `delete_schedule`
- REST: `POST /v1/mesh/schedules`, `GET /v1/mesh/schedules`, `DELETE /v1/mesh/schedules/:id`
- Event: `'mesh.schedule.triggered'`, `'mesh.schedule.created'`
- Wire into `apps/api/src/app.ts`: inicializar scheduler al startup, cargar schedules de DB

**Esfuerzo: S-M**

---

### 1B. Delivery Engine (5to motor)

Un nuevo engine que consume outputs de los 4 engines existentes y genera entregables de agencia.

**Input**: JSON de los 4 engines (Layer 1) + datos frescos de internet (web search, ad libraries)
**LLM**: Claude genera narrativa, insights, recomendaciones, análisis
**Output**: archivos PPTX, PDF, DOCX, XLSX descargables

#### Tools del Delivery Engine

El Delivery Engine es el ÚNICO engine que tiene acceso a tools externas (los otros 4 son pure computation):

| Tool | Para qué | Implementación |
|------|----------|----------------|
| **Web Search** | Competitive analysis, industry trends, benchmarks frescos | Anthropic web search tool via API, o Brave Search API |
| **Meta Ad Library** | Ads activos de competencia en Meta/Instagram | `https://www.facebook.com/ads/library/api/` (público, no requiere auth) |
| **Google Ads Transparency** | Ads activos de competencia en Google | `https://adstransparency.google.com` (scraping o API) |
| **PPTX Generator** | Crear presentaciones | `pptxgenjs` (npm package) |
| **PDF Generator** | Crear reportes PDF | `@react-pdf/renderer` o `puppeteer` (HTML→PDF) |
| **DOCX Generator** | Crear documentos Word | `docx` (npm package, ya usado en skills) |
| **XLSX Generator** | Crear spreadsheets | `exceljs` (npm package) |

#### Skills del Delivery Engine

```
packages/engines/src/delivery/
├── index.ts
├── tools/
│   ├── web-search.ts              ← wrapper sobre search API
│   ├── ad-library-meta.ts         ← Meta Ad Library API
│   ├── ad-library-google.ts       ← Google Ads Transparency
│   └── file-generators/
│       ├── pptx-generator.ts      ← template Plinth → PPTX
│       ├── pdf-generator.ts       ← template Plinth → PDF
│       ├── docx-generator.ts      ← template Plinth → DOCX
│       └── xlsx-generator.ts      ← template Plinth → XLSX
├── templates/
│   ├── monthly-report.ts          ← layout template Plinth
│   ├── competitive-analysis.ts
│   ├── budget-proposal.ts
│   ├── quarterly-review.ts
│   └── base-template.ts           ← colores, fonts, logo Plinth default
└── skills/
    ├── monthly-report.ts           ← PDF/PPTX reporte mensual de performance
    ├── competitive-analysis.ts     ← Research de competencia (usa web search + ad libraries)
    ├── industry-benchmarks.ts      ← Benchmarks del sector (usa web search)
    ├── budget-proposal.ts          ← Documento de gestión de presupuesto
    ├── campaign-brief.ts           ← Brief creativo basado en insights de engines
    ├── project-status.ts           ← Estado de entregables y milestones
    ├── quarterly-review.ts         ← Presentación ejecutiva QBR
    ├── media-plan-deck.ts          ← PPTX con plan de medios optimizado
    ├── learnings-digest.ts         ← Hallazgos y aprendizajes del período
    └── client-scorecard-export.ts  ← Scorecard exportable (XLSX + PDF)
```

#### Cómo funciona cada skill

```
1. Recibe: outputs de los 4 engines (MeshRun stage_results)
2. Si necesita datos frescos: llama web search / ad libraries
3. Envía todo a Claude con prompt específico del entregable
4. Claude genera: narrativa, insights, recomendaciones, textos
5. File generator toma el contenido + template Plinth → archivo final
6. Retorna: { file_path, file_type, metadata, download_url }
```

#### Mesh Pipeline extendido

```
Pipeline "full-optimization" (existente, no cambia):
  Leak → Media → CampaignOps → Executive (4 stages)

Pipeline "full-with-deliverables" (nuevo):
  Leak → Media → CampaignOps → Executive → Delivery (5 stages)

Pipeline "deliverables-only" (nuevo):
  Delivery (1 stage, usa último MeshRun como input)
```

#### Templates Plinth (MVP)

Template genérico con branding Plinth:
- Colores: negro, blanco, grises (como la landing)
- Font: Raleway (como la landing)
- Logo: Plinth by Polanyi
- Layout: limpio, premium, estilo Stripe

Definir en `packages/engines/src/delivery/templates/base-template.ts`:
```typescript
interface PlinthTemplate {
  colors: { primary: '#000000', secondary: '#666666', accent: '#FFFFFF', highlight: '#3B82F6' };
  fonts: { heading: 'Raleway', body: 'Raleway' };
  logo_path: string;  // assets/plinth-logo.png
  footer: 'Plinth by Polanyi — plinth.polanyi.tech';
}
```

#### MCP Tools nuevos

```
delivery_monthly_report     ← generar reporte mensual
delivery_competitive        ← análisis de competencia
delivery_benchmarks         ← benchmarks de industria
delivery_budget_proposal    ← propuesta de presupuesto
delivery_campaign_brief     ← brief creativo
delivery_project_status     ← status de proyecto
delivery_quarterly_review   ← QBR deck
delivery_media_plan         ← plan de medios PPTX
delivery_learnings          ← digest de aprendizajes
delivery_scorecard_export   ← exportar scorecard XLSX+PDF
```

#### REST endpoints

```
POST /v1/engines/delivery/skills/:skillId           ← ejecutar skill
GET  /v1/delivery/files                              ← listar archivos generados
GET  /v1/delivery/files/:fileId/download             ← descargar archivo
DELETE /v1/delivery/files/:fileId                    ← eliminar archivo
```

#### Events

```
'delivery.file_generated'     ← archivo creado
'delivery.skill_completed'    ← skill de delivery terminó
'delivery.search_completed'   ← web search/ad library consultado
```

#### Wire into sistema existente

1. Registrar engine en `apps/api/src/app.ts`: `agency.engines.register(new DeliveryEngine())`
2. Agregar schemas en `packages/schemas/src/delivery.ts`
3. Agregar types en `packages/types/src/delivery.ts`
4. Registrar pipeline "full-with-deliverables" en `packages/agent/src/mesh/default-pipeline.ts`
5. MCP tools auto-registrados (ya funciona con SKILL_SCHEMAS)
6. Archivos generados se sirven desde `/v1/delivery/files/:id/download`
7. Scorecard puede mostrar lista de entregables disponibles

#### Schedule + Delivery juntos

```
Schedule: "Cada lunes 6am → full-optimization"
Schedule: "Primer día del mes → delivery_monthly_report"
Schedule: "Cada viernes → delivery_project_status"
Schedule: "Día 15 del mes → delivery_competitive_analysis"

→ Runs automáticos
→ HFL decide si escalar
→ Entregables se generan
→ Webhook: "Tu reporte mensual está listo 📊 [Descargar] [Ver en scorecard]"
```

#### Tests

- `scheduler.test.ts`: cron parsing, trigger correcto, persistence, delete
- `delivery-engine.test.ts`: cada skill genera output válido, file generators crean archivos
- `web-search.test.ts`: mock de search API, fallback si no hay resultado
- `ad-library.test.ts`: mock de Meta/Google ad library responses
- `file-generator.test.ts`: PPTX/PDF/DOCX/XLSX válidos y abribles
- Integration: schedule triggers → pipeline → delivery → file generated → webhook dispatched

#### Orden de construcción

```
1. Scheduler (packages/agent/src/mesh/scheduler.ts + migration + routes + MCP tools)
2. Delivery Engine skeleton (packages/engines/src/delivery/ + types + schemas)
3. File generators (PPTX, PDF, DOCX, XLSX con template Plinth)
4. Web search tool
5. Ad library tools (Meta, Google)
6. Skills uno por uno (empezar por monthly-report y competitive-analysis)
7. Wire into mesh pipeline + app.ts
8. Tests
9. Schedule + Delivery integration test
```

**Ejecutar paso a paso. Reportar después de cada paso. No avanzar sin aprobación.**

---

## BLOQUE 2: E2E Validation + Deploy

### Tarea 1: E2E local — verificar que todo funciona junto

Levantar ambos servicios localmente y probar el flujo completo:

```bash
# Terminal 1: Backend
cd openagency
docker compose up  # postgres + redis
pnpm build && pnpm start  # API en puerto 3100

# Terminal 2: Frontend  
cd landing-scorecard_Plinth
VITE_API_URL=http://localhost:3100 pnpm dev  # Plinth en puerto 5173
```

Probar este flujo E2E:
1. Abrir Plinth → ver landing page
2. Register → crear cuenta
3. Login → JWT funciona
4. Onboarding → elegir Google Ads → REST → (mock OAuth o skip)
5. Command Center → ver métricas (pueden ser zero/empty, eso está bien)
6. Verificar que cada página carga sin errores de consola
7. Verificar SSE: /v1/events/stream conecta y recibe eventos
8. Verificar fallback: si backend no responde, páginas muestran datos mock

Reportar:
```
## E2E Results
| Paso | Status | Notas |
|------|--------|-------|
| Landing page | ✅/❌ | |
| Register | ✅/❌ | |
| Login | ✅/❌ | |
| Onboarding | ✅/❌ | |
| Command Center | ✅/❌ | |
| ... (10 páginas) | | |
| SSE events | ✅/❌ | |
| Mock fallback | ✅/❌ | |

### Errores encontrados
[lista]

### Fixes aplicados
[lista]
```

### Tarea 2: Verificar HFL Agent wiring

packages/hfl/ se construyó. Verificar:
1. ¿Después de `mesh_execute_pipeline`, el HFL coordinator se invoca automáticamente?
2. ¿El risk scorer evalúa correctamente y decide auto-approve vs escalate?
3. ¿El channel dispatcher hace POST al webhook configurado?
4. ¿Los endpoints approve/reject (`POST /v1/mesh/runs/:id/approve|reject`) funcionan?
5. ¿Los eventos HFL (`hfl.escalated`, `hfl.auto_approved`, etc.) aparecen en el SSE stream?

Si algo no está wired, conectarlo.

### Tarea 3: Preparar para deploy

#### Backend (OpenAgency) → Railway
1. Verificar que `Dockerfile` y `docker-compose.yml` están listos para producción
2. Variables de entorno necesarias:
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   ANTHROPIC_API_KEY=sk-ant-...
   VOYAGE_API_KEY=pa-...
   CORS_ORIGIN=https://plinth.polanyi.tech
   NODE_ENV=production
   PORT=3100
   JWT_SECRET=<generar>
   API_BASE_URL=https://api.plinth.polanyi.tech
   ```
3. Health check: `GET /v1/health` debe responder 200
4. Asegurar que CORS permite `https://plinth.polanyi.tech`

#### Frontend (Plinth) → Vercel
1. Verificar build: `pnpm build` genera dist/ correctamente
2. Variable de entorno:
   ```
   VITE_API_URL=https://api.plinth.polanyi.tech
   ```
3. Vercel config: SPA fallback (rewrite all routes to index.html)
4. El server/ de Express NO se usa en Vercel — solo el client/ build

#### Branding
- El producto se llama **Plinth** en todo lo que el humano ve
- "OpenAgency" es el nombre interno del backend/infraestructura
- Verificar que el frontend dice "Plinth" y no "OpenAgency" en títulos, meta tags, favicon
- `<title>Plinth by Polanyi</title>`

#### DNS (ya configurado en GoDaddy)
```
plinth.polanyi.tech      → CNAME → [vercel URL]
api.plinth.polanyi.tech  → CNAME → [railway URL]
```

### Orden de ejecución del Bloque 2

1. E2E local (Tarea 1) — sin esto no deployear
2. Fix errores encontrados
3. HFL verification (Tarea 2)
4. Preparar deploy configs (Tarea 3)
5. Reportar — NO deployear hasta aprobación

---

## Orden global de sesión

```
BLOQUE 1 (construir):
  1.1  Scheduler         → reportar → esperar aprobación
  1.2  Delivery skeleton → reportar → esperar aprobación
  1.3  File generators   → reportar → esperar aprobación
  1.4  Web search + Ad libraries → reportar
  1.5  Skills (monthly-report, competitive-analysis primero) → reportar
  1.6  Wire + tests      → reportar

BLOQUE 2 (validar + deploy):
  2.1  E2E local         → reportar
  2.2  HFL wiring        → reportar
  2.3  Deploy prep       → reportar → NO deployear sin aprobación
```

## Contexto técnico
- Backend: Hono v4, PostgreSQL + pgvector, Redis, puerto 3100
- Frontend: React 19, Vite 7, Wouter, shadcn/ui, Axios
- Auth: JWT (backend genera, frontend almacena)
- LLM: Anthropic Claude only para razonamiento. Voyage AI para embeddings.
- Build: pnpm (ambos repos). 13/13 packages, 399 tests.
- Docker: `docker compose up` levanta api + postgres + redis.
