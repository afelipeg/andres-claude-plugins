# Próxima sesión: 10/03/2026 — First Real Pipeline Run

## Estado al cierre de sesión 09/03/2026

### UI completada ✅
- `/app` rediseño completo: paleta zinc + verde oficial `#02c98d`
- Sidebar nav: pure CSS en `index.css` (bypass Tailwind JIT purge) → zinc-300 default, verde en hover/active
- Todos los botones, badges, iconos auditados y alineados a paleta
- Deployed en Vercel: https://plinth.polanyi.tech

### E2E validado ✅ (vs Railway live)
| Endpoint | Status |
|---|---|
| Login + JWT | ✅ |
| Dashboard, Scorecard, Mesh, Connectors | ✅ |
| Agents, Goals, Campaigns | ✅ |
| Consumption (`/v1/consumption/tokens`) | ✅ |
| SSE (`/v1/agents/events/stream`) | ✅ |
| Onboarding, A2A discovery | ✅ |
| VITE_API_URL en Vercel → Railway | ✅ |

### Fixes pushed, pendientes de Railway redeploy ⚠️
- `auth.ts` → `seedAdminUser` ahora force-updates role a `admin` si DB tiene otro rol
- `scorecard.ts` → `tier-preview` movido antes de `/:id` wildcard (route order bug)
- Commit: `7a1b9ac` (scorecard) + `9a703a3` (auth) + `28a783a` (railway.toml)

### Railway auto-deploy roto ⚠️
- Uptime: 28+ horas sin redeploy a pesar de pushes a main
- watchPatterns en `railway.toml` actualizado, pero Railway no ha reaccionado
- **Acción requerida**: ir al Railway dashboard → servicio openagency → "Deploy" manual

---

## Tarea 0: Railway redeploy manual (5 min)

Antes de empezar cualquier cosa nueva:
1. Abrir https://railway.app → proyecto openagency → servicio API
2. Click en "Deploy" o "Redeploy" con el último commit
3. Esperar que healthcheck `/health` responda y uptime se resetee
4. Verificar login: `role: "admin"` (no `engine_user`)

```bash
curl -X POST https://polanyi-plinth-production.up.railway.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dedalo@polanyi.tech","password":"Morchis1512*"}'
# Expect: role: "admin"
```

---

## Tarea 1: Primer pipeline run real desde la UI (el momento de verdad)

El objetivo es ejecutar el ciclo completo: subir datos → correr motores → ver resultado en `/app`.

### Opción A: Upload CSV (más rápido)
1. Ir a `/app` → Command Center
2. Usar el botón "Upload" o ir a la sección de upload
3. Subir cualquier CSV de muestra con campañas publicitarias
4. Ejecutar el mesh pipeline completo
5. Ir a `/app/scorecard` → ver resultados de billing + engine outputs
6. Ir a `/app/command-center` → ver el run en la tabla de mesh runs

### Opción B: API directo (si la UI no está lista)
```bash
curl -X POST https://polanyi-plinth-production.up.railway.app/v1/mesh/pipelines/full-optimization/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"ad_spend":1000000,"impressions":10000000,"clicks":50000}'
```

**Criterio de éxito**: scorecard con valores de recovery/lift/efficiency distintos de cero.

---

## Tarea 2: HFL wiring verification

Después de un mesh run, verificar que el HFL coordinator se invoca:

1. ¿Aparece evento `hfl.auto_approved` o `hfl.escalated` en SSE stream?
   ```bash
   curl --max-time 30 https://polanyi-plinth-production.up.railway.app/v1/agents/events/stream \
     -H "Authorization: Bearer <token>" -H "Accept: text/event-stream"
   ```
2. ¿`GET /v1/hfl/pending` retorna la decisión pendiente (si riesgo alto)?
3. ¿`POST /v1/mesh/runs/:id/approve` funciona?
4. Si no está wired: conectar en `apps/api/src/routes/mesh.ts`

---

## Tarea 3: Primer conector real (opcional, si hay credenciales)

Si tienes credenciales de Google Ads o Meta:
1. `/app/integrations` → conectar plataforma
2. Sync datos reales
3. Correr pipeline con datos reales
4. Ver waste detectado

---

## Bugs conocidos (prioridad baja, no bloquean)

| Bug | Archivo | Descripción |
|---|---|---|
| `listPendingDecisions` | `apps/web/src/api/agents.ts:63` | Llama a `/v1/agents/decisions/pending` que no existe. Exportado pero nunca usado en ningún página. Safe to ignore or add global endpoint. |
| `railway.toml watchPatterns` | `railway.toml` | Auto-deploy puede seguir fallando. Investigate desde Railway dashboard → Settings → "Deploy Triggers" |

---

## Contexto técnico rápido

- Admin login: `dedalo@polanyi.tech` / `Morchis1512*`
- Backend: `https://polanyi-plinth-production.up.railway.app`
- Frontend: `https://plinth.polanyi.tech`
- Git root: `/Users/andresgutierrezhenao/Documents/claude-plugins/` (openagency es subdirectorio)
- PATH: `export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH"`
- curl: usar `/opt/anaconda3/bin/curl` en scripts multi-línea de zsh
- Última versión: `28a783a` en main

---

## Orden de ejecución

1. Railway manual redeploy → verificar `role: admin`
2. Primer mesh pipeline run desde `/app/command-center`
3. Verificar scorecard tiene valores reales
4. HFL verification
5. Si todo OK: pensar en primer cliente piloto / demo en vivo
