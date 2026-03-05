# Instrucciones para la Proxima Sesion — OpenAgency v4.0

## Estado Actual (v3.1.0 completo)

**Build:** 12/12 paquetes. **Tests:** 286 pasando en 27 archivos. **0 errores de tipo.**

### Completado en v3.1:
- P1: Structured logging (pino) en OODA, mesh, safety, connectors, API
- P2: Rate floor (`min_cycle_interval_ms`), credential store en runtime
- P3: GoalTracker/GoalDecomposer en ciclo OODA, bug adjustPlan corregido
- P4: Safety audit trail (recent_writes + evaluaciones persistidas), mesh output_summary
- P5: Federation (A2AClient + McpClientRegistry + 8 REST routes + 6 MCP tools)
- P6: Skill Marketplace (DynamicSkillRegistry + 4 REST routes + 3 MCP tools)
- DeepSeek como LLM provider (prioridad: Anthropic > DeepSeek > OpenAI > Ollama)
- E2E pipeline tests (8 tests) + connector mock tests (58 tests)
- README.md actualizado con "How it Works" completo

---

## Pendiente para v4.0

### Prioridad 1 — Critico (produccion)

| # | Tarea | Esfuerzo | Descripcion |
|---|-------|----------|-------------|
| 4.1 | **Rollback Execution** | L | Implementar `rollbackAction()` en action-executor. Usar los valores previos registrados por RollbackTracker para revertir writes fallidos. Agregar endpoint `POST /v1/agents/:id/actions/:actionId/rollback`. |
| 4.2 | **Billing UI** | L | Pagina de billing en `apps/web`: scorecard visual con waste detected, lift, efficiency, fee breakdown por engine. Graficos de tendencia. Exportar a PDF. |
| 4.3 | **Migration Ordering** | M | Agregar campo `depends_on` en nombre de migration (e.g., `002_goals_depends_001_agents.sql`). Resolver orden con topological sort. |

### Prioridad 2 — Mejora (escalabilidad)

| # | Tarea | Esfuerzo | Descripcion |
|---|-------|----------|-------------|
| 4.4 | **Cross-Client Benchmarking** | L | Agregar endpoint `/v1/benchmarks` que compare metricas del cliente contra promedios de industria. Usar datos de waste-waterfall + optimization-analyze acumulados. |
| 4.5 | **Agent Self-Evolution** | XL | Meta-agent que observa el rendimiento de los 4 agentes y ajusta sus configuraciones automaticamente. Requiere: metricas de ciclo, historial de outcomes, LLM para analisis de tendencias. |
| 4.6 | **Connector Integration Tests** | L | Tests contra sandbox/mock servers reales de cada plataforma. Requiere credenciales de sandbox (Google Ads Test Account, Meta Test App, etc.). |

### Prioridad 3 — Nice to have

| # | Tarea | Esfuerzo | Descripcion |
|---|-------|----------|-------------|
| 4.7 | **Multi-tenant** | XL | Aislar datos por tenant_id. Agregar campo a todas las tablas + middleware de tenant resolution. |
| 4.8 | **Webhook Notifications** | M | Notificar eventos criticos (waste detectado, decisiones pendientes, goals completados) via webhook configurable. |
| 4.9 | **Dashboard Polish** | M | Mejorar Command Center: graficos de tendencia por engine, timeline de decisiones, mapa de flujo de dinero. |

---

## Contexto Tecnico

- **LLM**: Usar Anthropic Claude o DeepSeek. NO usar OpenAI.
- **DB**: PostgreSQL + pgvector. Migrations en `apps/api/src/db/migrations/`
- **API**: Hono v4 en puerto 3100. Dev key: `oa_test_dev_default_key_for_local_testing`
- **Build**: `pnpm build` (Turborepo, 12 paquetes). `pnpm test` para 286 tests.
- **Docker**: `docker compose up` levanta api + postgres + redis.

## Comando para empezar

```bash
cd /Users/andresgutierrezhenao/Documents/claude-plugins/openagency
export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:$PATH"
pnpm build && pnpm test  # Verificar estado limpio
```

## Notas

- El archivo `openagency-strategic-analysis.jsx` tiene el analisis estrategico completo (4 fases, scores, gaps)
- El billing model esta en `packages/core/src/billing.ts` — 3 fee streams, 4 tiers
- Los plan files estan en `~/.claude/plans/` (humming-wobbling-curry.md y unified-knitting-floyd.md)
