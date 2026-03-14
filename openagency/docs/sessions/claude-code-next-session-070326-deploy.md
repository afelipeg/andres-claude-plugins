# Próxima sesión: E2E Validation + Deploy

## Estado actual
- Backend (OpenAgency): 13/13 packages, 399 tests, main branch limpio
- Frontend (Plinth): 10 páginas conectadas a API, auth, onboarding, hooks, main branch limpio
- Los dos repos están conectados pero nunca se han probado juntos corriendo simultáneamente

## Tarea 1: E2E local — verificar que todo funciona junto

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
| Waste Analysis | ✅/❌ | |
| ... (10 páginas) | | |
| SSE events | ✅/❌ | |
| Mock fallback | ✅/❌ | |

### Errores encontrados
[lista]

### Fixes aplicados
[lista]
```

## Tarea 2: Verificar HFL Agent wiring

packages/hfl/ se construyó. Verificar:
1. ¿Después de `mesh_execute_pipeline`, el HFL coordinator se invoca automáticamente?
2. ¿El risk scorer evalúa correctamente y decide auto-approve vs escalate?
3. ¿El channel dispatcher hace POST al webhook configurado?
4. ¿Los endpoints approve/reject (`POST /v1/mesh/runs/:id/approve|reject`) funcionan?
5. ¿Los eventos HFL (`hfl.escalated`, `hfl.auto_approved`, etc.) aparecen en el SSE stream?

Si algo no está wired, conectarlo.

## Tarea 3: Preparar para deploy

### Backend (OpenAgency) → Railway
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

### Frontend (Plinth) → Vercel
1. Verificar build: `pnpm build` genera dist/ correctamente
2. Variable de entorno:
   ```
   VITE_API_URL=https://api.plinth.polanyi.tech
   ```
3. Vercel config: SPA fallback (rewrite all routes to index.html)
4. El server/ de Express NO se usa en Vercel — solo el client/ build

### Branding
- El producto se llama **Plinth** en todo lo que el humano ve
- "OpenAgency" es el nombre interno del backend/infraestructura
- Verificar que el frontend dice "Plinth" y no "OpenAgency" en títulos, meta tags, favicon
- `<title>Plinth by Polanyi</title>`

### DNS (ya configurado en GoDaddy)
```
plinth.polanyi.tech      → CNAME → [vercel URL]
api.plinth.polanyi.tech  → CNAME → [railway URL]
```

## Orden de ejecución

1. E2E local (Tarea 1) — sin esto no deployear
2. Fix errores encontrados
3. HFL verification (Tarea 2)
4. Preparar deploy configs (Tarea 3)
5. Reportar — NO deployear hasta aprobación

## Contexto técnico
- Backend: Hono v4, PostgreSQL + pgvector, Redis, puerto 3100
- Frontend: React 19, Vite 7, Wouter, shadcn/ui, Axios
- Auth: JWT (backend genera, frontend almacena)
- LLM: Anthropic Claude only para razonamiento. Voyage AI para embeddings.
- Build: pnpm (ambos repos)
