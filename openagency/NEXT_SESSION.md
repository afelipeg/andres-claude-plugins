# Próxima sesión: packages/hfl/ — Human Feedback Loop Agent (modelo Jarvis)

## Estado Actual (v3.1.1 — 5 gaps cerrados)

**Build:** 12/12 paquetes. **Tests:** 333 pasando en 31 archivos. **0 errores de tipo.**
**Gaps cerrados:** Embeddings Voyage AI, Migration ordering, Rollback execution, Writer tests, Billing UI.

---

## Concepto

El HFL Agent es un módulo BACKEND que decide CUÁNDO escalar al humano, POR QUÉ canal, y QUÉ mostrarle. No es un frontend. Genera payloads que cualquier superficie consume (Slack, email, scorecard web, otro agente).

El scorecard web (plinth.polanyi.tech) ya existe como app separada — es el "Nivel 3" del render engine. Claude Code NO construye el scorecard. Claude Code construye el motor que genera los datos que el scorecard y cualquier otro canal consumen.

## Arquitectura

```
OpenAgency Core (engines, mesh, OODA, billing)
                    │
               packages/hfl/
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
Risk Scorer    Channel         Render Engine
(¿necesita     Dispatcher      (adapta formato
 humano?)      (a dónde        al canal)
               enviar)
    │               │               │
    ▼               ▼               ▼
auto-execute   webhook POST    RenderOutput payload
sin humano     al canal        { format, content,
               configurado       actions, attachments }
```

## Componentes a construir

### 1. Risk Scorer (`packages/hfl/src/risk-scorer.ts`)
Evalúa si un mesh run necesita aprobación humana o se auto-ejecuta.
Inputs: MeshRun result, policy config del cliente, monto de acciones propuestas.
Output: `{ needs_human: boolean, urgency: 'low'|'medium'|'high'|'critical', reason: string }`
Reglas: budget changes > threshold → human, first run for client → human, dentro de policy → auto.

### 2. Channel Dispatcher (`packages/hfl/src/channel-dispatcher.ts`)
Despacha el payload al canal configurado por el cliente.
Implementación: HTTP POST a webhook URL configurable.
El webhook puede ser Slack incoming webhook, email API (SendGrid, Resend), custom endpoint.
OpenAgency no sabe ni le importa qué hay detrás del webhook — solo hace POST con el payload.

### 3. Render Engine (`packages/hfl/src/render-engine.ts`)
Genera el payload adaptado al contexto:
- Nivel 1 (minimal): texto plano, resumen de una línea + actions (approve/reject URLs)
- Nivel 2 (rich): markdown con breakdown por engine, métricas, billing summary
- Nivel 3 (full): JSON payload completo que un scorecard web consume para render full
El nivel se determina por: channel type + complexity del resultado + config del cliente.

### 4. Types (`packages/hfl/src/types.ts`)
```typescript
interface HFLConfig {
  client_id: string;
  auto_approve_threshold: number;    // USD — debajo de esto, auto-execute
  channels: ChannelConfig[];
  default_channel: string;
  escalation_rules: EscalationRule[];
}
interface ChannelConfig {
  id: string;
  type: 'webhook' | 'mcp_callback';
  url: string;
  render_level: 'minimal' | 'rich' | 'full';
  active: boolean;
}
interface EscalationRule {
  condition: string;    // e.g. 'budget_change > 10000'
  urgency: 'low' | 'medium' | 'high' | 'critical';
  channel_id: string;   // override default channel
}
interface RenderContext {
  channel: ChannelConfig;
  urgency: string;
  complexity: 'simple' | 'moderate' | 'complex';
}
interface RenderOutput {
  format: 'text' | 'markdown' | 'html' | 'json';
  content: string;
  actions: { label: string; url: string; method: string }[];
  attachments?: { type: string; data: unknown }[];
}
interface HFLDecision {
  run_id: string;
  needs_human: boolean;
  urgency: string;
  reason: string;
  dispatched_to?: string;       // channel ID
  render_output?: RenderOutput;
  auto_approved?: boolean;
  human_response?: 'approved' | 'rejected';
  human_feedback?: string;
}
```

### 5. HFL Coordinator (`packages/hfl/src/coordinator.ts`)
Orquesta el flujo completo:
1. Recibe MeshRun completado
2. Risk Scorer evalúa → needs_human?
3. Si no → auto-approve, emit event, ejecutar acciones
4. Si sí → Render Engine genera payload → Channel Dispatcher envía → espera respuesta
5. Respuesta llega vía REST → ejecutar o abort → emit event

### 6. REST Endpoints (`apps/api/src/routes/hfl.ts`)
```
POST /v1/mesh/runs/:runId/approve              ← humano aprueba
POST /v1/mesh/runs/:runId/reject               ← humano rechaza (body: { feedback })
GET  /v1/hfl/config                            ← ver config de canales
PUT  /v1/hfl/config                            ← configurar canales y thresholds
GET  /v1/hfl/decisions                         ← historial de decisiones HFL
GET  /v1/hfl/decisions/:id                     ← detalle de una decisión
```

### 7. Events
```
'hfl.escalated'           ← run escalado al humano
'hfl.auto_approved'       ← run auto-aprobado (dentro de policy)
'hfl.human_approved'      ← humano aprobó
'hfl.human_rejected'      ← humano rechazó
'hfl.dispatched'          ← payload enviado a canal
'hfl.timeout'             ← humano no respondió en tiempo
```

### 8. MCP Tools
```
hfl_config          ← ver/modificar config (para agentes que administran)
hfl_approve_run     ← aprobar un run (para agentes que actúan como proxy del humano)
hfl_reject_run      ← rechazar un run con feedback
hfl_decisions       ← consultar historial de decisiones
```

### 9. Wire into mesh pipeline
En `mesh-coordinator.ts`, después de `executePipeline()`:
→ `hflCoordinator.evaluate(meshRun)` → decide automáticamente el siguiente paso.

### 10. Wire into app.ts
Seguir patrón ConnectorInfra / BillingInfra → HFLInfra.

## Tests
- `risk-scorer.test.ts`: auto-approve bajo threshold, escalate sobre threshold, first run siempre escala
- `channel-dispatcher.test.ts`: POST a webhook, retry on failure, timeout handling
- `render-engine.test.ts`: nivel 1/2/3 genera formato correcto, actions incluyen URLs válidas
- `coordinator.test.ts`: flujo completo auto-approve, flujo completo con escalation
- integration: mesh pipeline → HFL → auto-approve → acciones ejecutadas

## Importante
- `packages/hfl/` es backend puro — no React, no CSS, no HTML
- El scorecard web (plinth) consume los payloads de Nivel 3 vía REST API — es un cliente externo
- Los webhooks son fire-and-forget con retry — OpenAgency no depende de que Slack esté up
- El humano responde vía REST endpoints, no vía el webhook (el webhook es one-way push)

## Contexto Técnico

- **LLM**: Anthropic Claude (primary), DeepSeek (fallback). **NO OpenAI para razonamiento.**
- **Embeddings**: Voyage AI (`voyage-3`, 1024 dims). Keyword fallback sin `VOYAGE_API_KEY`.
- **DB**: PostgreSQL + pgvector. Migrations en `apps/api/src/db/migrations/` (001→003).
- **API**: Hono v4 en puerto 3100. Dev key: `oa_test_dev_default_key_for_local_testing`
- **Build**: `pnpm build` (Turborepo, 12 paquetes). `pnpm test` para 333 tests.
- **Docker**: `docker compose up` levanta api + postgres + redis.
- **Dependency chain**: `types → schemas → memory → events → agent → api`
- **New package**: `packages/hfl/` goes between `agent` and `api` in the chain.

## Comando para empezar

```bash
cd /Users/andresgutierrezhenao/Documents/claude-plugins/openagency
export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:$PATH"
pnpm build && pnpm test  # Verificar estado limpio (12/12 build, 333 tests)
```
