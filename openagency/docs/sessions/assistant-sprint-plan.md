# AI Assistant Sprint Plan — Plinth HFL Chat

## Context

Build a full-page AI Assistant at `/app/assistant` that provides conversational access to pipeline results, HFL decisions, and engine capabilities. Uses Claude Sonnet via Anthropic API directly. Interface inspired by Claude.ai chat with persistent conversation history.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Full page (Claude.ai style) | Maximum screen real estate, conversation history sidebar |
| File generation | Inline downloads + links to engine pages | Both quick generation and detailed analysis |
| Memory | Persistent history (DB) | User can see past interactions |
| Model | Claude Sonnet (default) | Same as engines, ~$0.02/message |
| Backend | Dedicated `/v1/assistant/chat` endpoint | Clean separation, full context injection |

## What the Assistant Can Do:

<description>: Plith Assistant to guide human across platform, its results across engines, skills and deliverables. Is the connection between human and A2A infrastructure. 
</description>

<role>
    <primary>
      Actuar como un experto en Marketing Mix Modeling Bayesiano, especializado en:
      - Inferencia causal de efectos de marketing
      - Modelado jerárquico geo-temporal
      - Optimización de presupuesto publicitario
      - Cuantificación de incertidumbre en estimaciones
      - Conocimiento en adops implementacion, optimizacion de campañas digitales en meta, google-ads, DV360, tiktok ads y amazon ads
    </primary>
    <secondary>
      - Analista de datos de marketing multiplataforma
      - Consultor de estrategia de medios
      - Especialista en transformaciones Adstock y saturación
      - Experto en calibración con experimentos de incrementalidad
    </secondary>
  </role> 

1. **Summarize pipeline runs** — "What happened in the last run?" → natural language interpretation of all 4 engine results
2. **Explain billing** — "How is my fee calculated?" → breaks down recovery, lift, efficiency with actual numbers
3. **Approve/reject runs** — "Approve the latest run" → calls HFL approve endpoint
4. **Generate files** — "Create a monthly report PDF" → calls delivery engine, returns download link
5. **Re-run pipeline** — "Run the analysis again for ACME" → triggers pipeline execution
6. **Answer questions** — "Why was $312K flagged as Display waste?" → interprets engine data

## Files to Create

### Backend
- `apps/api/src/routes/assistant.ts` — chat endpoint + conversation persistence
  - `POST /v1/assistant/chat` — send message, get Claude response
  - `GET /v1/assistant/conversations` — list conversations
  - `GET /v1/assistant/conversations/:id` — get conversation messages
  - `DELETE /v1/assistant/conversations/:id` — delete conversation

### Frontend
- `apps/web/src/pages/AssistantPage.tsx` — full-page chat UI
- `apps/web/src/api/assistant.ts` — API client

### Modifications
- `apps/web/src/App.tsx` — add route
- `apps/web/src/components/Layout.tsx` — add sidebar nav item
- `apps/api/src/app.ts` — mount assistant routes

## Backend Design: `/v1/assistant/chat`

```typescript
POST /v1/assistant/chat
Body: {
  message: string,
  conversation_id?: string,  // omit to start new conversation
  context?: {
    run_id?: string,         // focus on specific run
    client_id?: string,
  }
}

Response: {
  conversation_id: string,
  message: {
    role: "assistant",
    content: string,
    actions?: Array<{        // actions taken (approve, file generated, etc.)
      type: string,
      result: unknown,
    }>,
    files?: Array<{          // generated file download links
      name: string,
      url: string,
      type: string,
    }>,
  },
}
```

### Claude System Prompt (injected with live data)

The system prompt includes:
- Latest pipeline run summary (all stage results)
- Current scorecard/billing data
- HFL decision status
- Connected platforms
- Available actions (approve, reject, re-run, generate files)

### Action Detection

Claude's response is parsed for action intents:
- "approve" / "accept" → calls `hfl.approveRun()`
- "reject" → calls `hfl.rejectRun()`
- "run pipeline" / "re-run" → calls `mesh.executePipeline()`
- "generate report/PDF/Excel" → calls delivery engine skills
- Pure conversation → no action, just response

## Frontend Design

### Layout (Claude.ai style)
```
┌─────────────────────────────────────────────────┐
│  Conversations    │     Chat Area               │
│  ─────────────    │                              │
│  Today            │  [Assistant message]         │
│  • ACME Q1 review │  [User message]              │
│  • Budget check   │  [Assistant message + file]  │
│  Yesterday        │                              │
│  • Pipeline run   │                              │
│                   │                              │
│  [+ New Chat]     │  ┌────────────────────────┐  │
│                   │  │ Message input...    Send│  │
│                   │  └────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Message Components
- Text messages (markdown rendered)
- File download cards (PDF/Excel/PPT with download button)
- Action confirmation cards (approved/rejected with status badge)
- Pipeline run summary card (collapsible engine results)
- Typing indicator during Claude response

## COGS Impact

| Item | Cost |
|---|---|
| Per message (Sonnet, ~2K input + ~500 output tokens) | ~$0.02 |
| System prompt with run context (~3K tokens) | included |
| File generation (if requested, triggers delivery engine) | +$0.02 per file |
| Estimated 10 messages per session | ~$0.20/session |
| 30 sessions/month per client | ~$6/month |

## Implementation Order

1. Backend: conversation store + chat endpoint
2. Frontend: AssistantPage with chat UI
3. Wire routes + sidebar nav
4. Add action detection (approve/reject/re-run)
5. Add file generation inline
6. Build, test, deploy

## What Stays Untouched
- All existing pages (Command Center, Scorecard, Billing, etc.)
- All engines, skills, packages
- HFL coordinator logic
- MCP server
- Existing AgentChat component (separate from this)
