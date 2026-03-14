Bloque 1 completo. Dos tareas antes del Bloque 2:

## TAREA 0: Swap Brave Search → Serper

Reemplazar Brave Search API por Serper (Google Search API) en el Delivery Engine.

### Cambios:

**`packages/engines/src/delivery/tools/web-search.ts`:**
- Eliminar toda referencia a Brave Search API
- Endpoint: `https://google.serper.dev/search`
- Method: POST
- Headers: `{ 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }`
- Body: `{ q: query, num: maxResults || 10 }`
- Response: `{ organic: [{ title, link, snippet, position }], searchParameters, knowledgeGraph? }`
- Env var: `SERPER_API_KEY` (reemplaza `BRAVE_SEARCH_API_KEY`)
- Graceful fallback sin key (igual que antes — retorna vacío con nota)
- Cache: mantener mismo sistema (namespace `web`, TTL 24h)

**`.env.example`:**
- Reemplazar `BRAVE_SEARCH_API_KEY=` por `SERPER_API_KEY=`

**Tests:** actualizar mock de web-search si existe — el response shape de Serper es diferente al de Brave.

## TAREA 1: Crear .env.production template

Crear `openagency/.env.production.example` con todas las variables necesarias para deploy:

```bash
# === INFRA (Railway) ===
DATABASE_URL=postgresql://postgres:xxx@postgres.railway.internal:5432/railway
REDIS_URL=redis://default:xxx@redis.railway.internal:6379

# === LLM (Polanyi provee) ===
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...

# === Delivery Engine Tools ===
SERPER_API_KEY=...
META_ACCESS_TOKEN=              # opcional
SERPAPI_KEY=                    # opcional (Google Ads Transparency)

# === Auth ===
JWT_SECRET=                     # generar: openssl rand -hex 32
NODE_ENV=production
PORT=3100

# === CORS + URLs ===
CORS_ORIGIN=https://plinth.polanyi.tech
API_BASE_URL=https://api.plinth.polanyi.tech

# === File Storage ===
FILE_STORAGE_URL=               # vacío = local filesystem, s3://bucket = S3/R2
FILE_STORAGE_DIR=/data/files    # solo si local

# === HFL Agent ===
HFL_DEFAULT_WEBHOOK_URL=        # Slack/email/custom webhook del cliente
HFL_SCORECARD_BASE_URL=https://plinth.polanyi.tech
```

## Ahora ejecuta BLOQUE 2

### 2.1 Smoke Tests (E2E local)

Levantar backend + frontend localmente y probar:

```bash
# Terminal 1: Backend
cd openagency
docker compose up -d  # postgres + redis local
pnpm build && pnpm start

# Terminal 2: Frontend
cd landing-scorecard_Plinth
VITE_API_URL=http://localhost:3100 pnpm dev
```

Probar y reportar:
```
| Paso | Status |
|------|--------|
| Landing page (/) | ✅/❌ |
| Demo pages (/demo/*) | ✅/❌ |
| Register (/app/register) | ✅/❌ |
| Login (/app/login) | ✅/❌ |
| Command Center (/app/) | ✅/❌ |
| 10 scorecard pages | ✅/❌ |
| SSE events | ✅/❌ |
| Mock fallback | ✅/❌ |
```

### 2.2 HFL Wiring Verification

Verificar que después de `mesh_execute_pipeline`:
1. HFL coordinator se invoca automáticamente
2. Risk scorer evalúa y decide auto-approve vs escalate
3. Channel dispatcher hace POST al webhook configurado
4. Endpoints approve/reject funcionan
5. Eventos HFL aparecen en SSE stream
6. **NUEVO**: Delivery Engine se conecta con HFL — cuando un run con deliverables completa, el HFL puede despachar el archivo generado como attachment en el webhook

Si algo no está wired, conectarlo.

### 2.3 Deploy Prep

**Dockerfile para Railway:**
Verificar/crear `openagency/Dockerfile` optimizado para Railway:
- Multi-stage build (install → build → runtime)
- Node 20 alpine
- pnpm install --frozen-lockfile
- pnpm build
- CMD: node apps/api/dist/index.js
- EXPOSE 3100
- Health check: GET /v1/health

**Vercel ya está deploying.** Solo verificar que `/demo/*` funciona como demo room y `/app/*` como app real.

**Branding check:**
- Frontend dice "Plinth" (no "OpenAgency") en títulos, meta tags, navbar
- `<title>Plinth by Polanyi</title>`
- Favicon correcto

### 2.4 Verificar gap HFL ↔ Delivery

¿Cuando el Delivery Engine genera un archivo (monthly-report, competitive-analysis), el HFL puede incluir el download link en el webhook payload? Verificar que `RenderOutput.attachments` incluye `{ type: 'file', url: '/v1/delivery/files/:id/download' }` cuando hay archivos generados.

## Orden: Tarea 0 → Tarea 1 → 2.1 → 2.2 → 2.3 → 2.4. Reportar después de cada paso.
