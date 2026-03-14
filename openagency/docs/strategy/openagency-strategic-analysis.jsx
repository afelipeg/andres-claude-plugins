import { useState } from "react";

const COLORS = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surfaceHover: "#1a1a26",
  border: "#1f1f2e",
  accent: "#00e5a0",
  accentDim: "#00e5a033",
  warning: "#ff6b35",
  warningDim: "#ff6b3522",
  danger: "#ff3366",
  dangerDim: "#ff336622",
  blue: "#3b82f6",
  blueDim: "#3b82f622",
  purple: "#a855f7",
  purpleDim: "#a855f722",
  text: "#e2e2ea",
  textDim: "#8888a0",
  textMuted: "#55556a",
};

const diagnosisData = [
  {
    id: "arch",
    title: "Arquitectura",
    score: 7,
    status: "solid",
    findings: [
      "Monorepo bien estructurado (types → core → engines → connectors → apps)",
      "Engines son pure computation sin side effects — diseño correcto",
      "TypeScript end-to-end con interfaces compartidas",
      "6 conectores de plataforma con OAuth2 + rate limiting",
    ],
    gaps: [
      "Sin event bus / message broker — todo es request-response sincrónico",
      "Sin capa de persistencia real (solo IndexedDB browser-side)",
      "No hay API server — el web app consume engines directamente",
      "Zero observabilidad, telemetría o logging estructurado",
    ],
  },
  {
    id: "agent",
    title: "Agent-Readiness",
    score: 2,
    status: "critical",
    findings: [
      "LLM provider es add-on narrativo, no decision-maker",
      "No hay agent loop (observe → orient → decide → act)",
      "Sin memory/state entre ejecuciones",
      "No existe concepto de 'goal' o 'intent' autónomo",
    ],
    gaps: [
      "No implementa MCP (Model Context Protocol)",
      "No implementa A2A (Agent-to-Agent Protocol)",
      "Sin Agent Cards para discovery",
      "Sin task lifecycle management para agentes",
    ],
  },
  {
    id: "data",
    title: "Data Layer",
    score: 5,
    status: "moderate",
    findings: [
      "NormalizedCampaignRow es un schema universal sólido (30+ campos)",
      "Conectores transforman API-specific → universal bien",
      "Benchmarks por industria embebidos",
    ],
    gaps: [
      "Sin base de datos — datos viven solo en runtime memory",
      "Sin data versioning ni audit trail",
      "Sin streaming de datos (batch-only)",
      "Sin schema registry para evolución de contratos",
    ],
  },
  {
    id: "compute",
    title: "Computation Engines",
    score: 8,
    status: "strong",
    findings: [
      "Shapley attribution con game theory real",
      "Hill saturation curves con greedy marginal allocation",
      "Waste waterfall con 6 etapas + benchmarks por industria",
      "Campaign state machine con 24-task DAG",
      "Revenue bridge con power analysis estadístico",
    ],
    gaps: [
      "Engines no exponen contratos machine-readable",
      "Sin self-describing capabilities (Agent Cards)",
      "No pueden ser invocados por otros agentes via protocolo estándar",
    ],
  },
  {
    id: "product",
    title: "Product / GTM",
    score: 4,
    status: "moderate",
    findings: [
      "Buen CLI interactivo con npx openagency",
      "Web dashboard funcional con Vite + React + Recharts",
      "PDF export + historial de reportes",
    ],
    gaps: [
      "Diseñado 100% para humanos — sin interfaz agent-native",
      "Sin API REST/GraphQL para consumo programático",
      "Sin multi-tenancy ni auth de usuarios",
      "Sin pricing engine ni monetización",
    ],
  },
];

const phases = [
  {
    id: "phase1",
    title: "PHASE 1: Agent Protocol Layer",
    timeline: "Meses 1–3",
    color: COLORS.accent,
    dimColor: COLORS.accentDim,
    icon: "🔌",
    objective:
      "Hacer que cada engine sea consumible por cualquier agente IA del mundo via MCP + A2A.",
    actions: [
      {
        name: "MCP Server por Engine",
        detail:
          "Cada engine (Leak Detector, Media Architect, Campaign Ops, Executive Bridge) se expone como un MCP Server independiente. Los agentes de Claude, GPT, Gemini, o cualquier framework pueden invocar waste-waterfall, channel-optimize, shapley-attribute como tools estándar.",
        effort: "Alto",
        impact: "Crítico",
      },
      {
        name: "Agent Cards (A2A Discovery)",
        detail:
          "Cada engine publica un Agent Card JSON describiendo capabilities, input schemas, output schemas, y pricing. Otros agentes descubren dinámicamente qué puede hacer OpenAgency sin documentación humana.",
        effort: "Medio",
        impact: "Crítico",
      },
      {
        name: "API Gateway con Auth",
        detail:
          "Fastify/Hono API server con JWT auth, rate limiting por agente, y telemetría. Los agentes se autentican con API keys o OAuth2 machine-to-machine (client credentials flow).",
        effort: "Alto",
        impact: "Crítico",
      },
      {
        name: "Schema Registry",
        detail:
          "JSON Schema + OpenAPI 3.1 para todos los inputs/outputs de engines. Versionado semántico. Los agentes validan contratos antes de invocar.",
        effort: "Medio",
        impact: "Alto",
      },
    ],
  },
  {
    id: "phase2",
    title: "PHASE 2: Autonomous Engine",
    timeline: "Meses 4–7",
    color: COLORS.blue,
    dimColor: COLORS.blueDim,
    icon: "🧠",
    objective:
      "Convertir engines pasivos en agentes autónomos que observan, deciden y actúan sin intervención humana.",
    actions: [
      {
        name: "OODA Loop por Engine",
        detail:
          "Cada engine implementa Observe → Orient → Decide → Act. El Media Architect observa spend diario via conectores, detecta anomalías (CPA spike, ROAS drop), decide reallocation, y ejecuta cambios via platform APIs. Sin humano en el loop.",
        effort: "Muy Alto",
        impact: "Transformacional",
      },
      {
        name: "Event-Driven Architecture",
        detail:
          "Reemplazar request-response con event bus (Redis Streams o NATS). Los engines publican eventos (waste_detected, budget_reallocated, anomaly_found) y otros engines/agentes suscriben. Desacoplamiento total.",
        effort: "Alto",
        impact: "Crítico",
      },
      {
        name: "Persistent State + Memory",
        detail:
          "PostgreSQL + pgvector para estado persistente y memoria vectorial. Cada agente-engine recuerda decisiones pasadas, aprende de outcomes, y mejora su reasoning con RAG sobre su propia historia.",
        effort: "Alto",
        impact: "Alto",
      },
      {
        name: "Goal-Driven Execution",
        detail:
          "Los engines reciben Goals (ej: 'Maximize ROAS to 4.5x en Q3 con budget de $500K') en lugar de commands. El agente descompone el goal en sub-tasks, ejecuta, mide, y ajusta autónomamente.",
        effort: "Muy Alto",
        impact: "Transformacional",
      },
    ],
  },
  {
    id: "phase3",
    title: "PHASE 3: Multi-Agent Orchestration",
    timeline: "Meses 8–12",
    color: COLORS.purple,
    dimColor: COLORS.purpleDim,
    icon: "🕸️",
    objective:
      "Orquestar múltiples agentes que colaboran, negocian y se auto-organizan para ejecutar campañas completas.",
    actions: [
      {
        name: "Agent Mesh Architecture",
        detail:
          "Los 4 engines + conectores operan como una red de agentes especializados. Leak Detector detecta waste → notifica a Media Architect → quien reasigna budget → Campaign Ops ejecuta cambios → Executive Bridge reporta impacto. Todo automático.",
        effort: "Muy Alto",
        impact: "Transformacional",
      },
      {
        name: "Cross-Client Agent Federation",
        detail:
          "Un agente-cliente de Coca-Cola puede invocar el Media Architect de OpenAgency que a su vez invoca agentes de plataforma (Meta's agent, Google's agent) via A2A. Federación verdadera sin intermediario humano.",
        effort: "Alto",
        impact: "Transformacional",
      },
      {
        name: "Marketplace de Agent Skills",
        detail:
          "Terceros publican skills/engines adicionales (Creative AI, Audience Intelligence, Competitor Monitor) que se integran via MCP. OpenAgency se convierte en plataforma, no solo herramienta.",
        effort: "Alto",
        impact: "Alto",
      },
      {
        name: "Agent-Native Billing",
        detail:
          "Pricing por API call, por computation unit, o por outcome (% del waste recuperado). Los agentes-cliente negocian pricing programáticamente. No hay 'pricing page' para humanos — los agentes evalúan ROI y compran solos.",
        effort: "Medio",
        impact: "Crítico",
      },
    ],
  },
  {
    id: "phase4",
    title: "PHASE 4: Self-Evolving System",
    timeline: "Meses 13–18",
    color: COLORS.warning,
    dimColor: COLORS.warningDim,
    icon: "🔄",
    objective:
      "El sistema se mejora a sí mismo: genera nuevos engines, optimiza benchmarks, y escala sin intervención.",
    actions: [
      {
        name: "Meta-Agent (Engine Generator)",
        detail:
          "Un meta-agente que observa patrones de uso, detecta gaps en capabilities, y genera nuevos engines/skills automáticamente. Si 100 agentes piden 'creative fatigue analysis' y no existe el skill, el meta-agente lo crea, lo testea, y lo publica.",
        effort: "Muy Alto",
        impact: "Revolucionario",
      },
      {
        name: "Benchmark Auto-Calibration",
        detail:
          "Los benchmarks de industria se actualizan automáticamente con datos reales agregados (privacy-preserving) de todos los clientes. No más benchmarks estáticos de WARC — los datos fluyen y los números se ajustan en real-time.",
        effort: "Alto",
        impact: "Alto",
      },
      {
        name: "Agent Reputation System",
        detail:
          "Cada agente acumula un score de reliability, accuracy, y uptime. Otros agentes eligen con quién colaborar basándose en reputation. Natural selection: los mejores engines atraen más tráfico.",
        effort: "Medio",
        impact: "Alto",
      },
      {
        name: "Compliance & Governance Autonoma",
        detail:
          "Un Governance Agent que monitorea todas las decisiones de otros agentes, verifica cumplimiento regulatorio (GDPR, CCPA, ad fraud), y puede vetar o revertir acciones. El 'adult in the room' automatizado.",
        effort: "Alto",
        impact: "Crítico",
      },
    ],
  },
];

const techStack = [
  {
    layer: "Protocol Layer",
    current: "Fetch directo a APIs",
    target: "MCP Server + A2A Protocol + ACP",
    tools: "Anthropic MCP SDK, Google A2A, gRPC",
  },
  {
    layer: "API Gateway",
    current: "No existe",
    target: "Hono/Fastify + tRPC",
    tools: "Hono, tRPC, Zod, OpenAPI 3.1",
  },
  {
    layer: "Event Bus",
    current: "No existe",
    target: "Event-driven async",
    tools: "NATS JetStream / Redis Streams",
  },
  {
    layer: "Database",
    current: "IndexedDB (browser only)",
    target: "Relational + Vector + Time-series",
    tools: "PostgreSQL + pgvector + TimescaleDB",
  },
  {
    layer: "Agent Runtime",
    current: "LLM como add-on narrativo",
    target: "OODA loop autónomo por engine",
    tools: "Anthropic Agent SDK, LangGraph",
  },
  {
    layer: "Observability",
    current: "console.log",
    target: "Full telemetry stack",
    tools: "OpenTelemetry, Grafana, Sentry",
  },
  {
    layer: "Auth",
    current: "No auth",
    target: "M2M OAuth2 + API keys + RBAC",
    tools: "Auth0, Clerk, or custom JWT",
  },
  {
    layer: "Deployment",
    current: "Local only",
    target: "Cloud-native multi-tenant",
    tools: "Docker, Kubernetes, Fly.io/Railway",
  },
];

function ScoreBar({ score, max = 10 }) {
  const pct = (score / max) * 100;
  const color =
    score >= 7 ? COLORS.accent : score >= 4 ? COLORS.warning : COLORS.danger;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 6,
          background: COLORS.border,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{ fontWeight: 700, color, fontSize: 14, minWidth: 32, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {score}/{max}
      </span>
    </div>
  );
}

function Badge({ children, color, bgColor }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: color,
        background: bgColor,
        letterSpacing: "0.02em",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {children}
    </span>
  );
}

function EffortBadge({ effort }) {
  const map = {
    Medio: { color: COLORS.accent, bg: COLORS.accentDim },
    Alto: { color: COLORS.blue, bg: COLORS.blueDim },
    "Muy Alto": { color: COLORS.warning, bg: COLORS.warningDim },
  };
  const c = map[effort] || { color: COLORS.textDim, bg: COLORS.border };
  return (
    <Badge color={c.color} bgColor={c.bg}>
      ⚡ {effort}
    </Badge>
  );
}

function ImpactBadge({ impact }) {
  const map = {
    Alto: { color: COLORS.blue, bg: COLORS.blueDim },
    Crítico: { color: COLORS.warning, bg: COLORS.warningDim },
    Transformacional: { color: COLORS.purple, bg: COLORS.purpleDim },
    Revolucionario: { color: COLORS.danger, bg: COLORS.dangerDim },
  };
  const c = map[impact] || { color: COLORS.textDim, bg: COLORS.border };
  return (
    <Badge color={c.color} bgColor={c.bg}>
      🎯 {impact}
    </Badge>
  );
}

export default function OpenAgencyAnalysis() {
  const [activeTab, setActiveTab] = useState("diagnosis");
  const [expandedPhase, setExpandedPhase] = useState("phase1");
  const [expandedAction, setExpandedAction] = useState(null);

  const tabs = [
    { id: "diagnosis", label: "Diagnóstico", icon: "🔬" },
    { id: "roadmap", label: "Roadmap 18M", icon: "🗺️" },
    { id: "stack", label: "Tech Stack", icon: "⚙️" },
    { id: "thesis", label: "Tesis Central", icon: "💎" },
  ];

  const overallScore = Math.round(
    diagnosisData.reduce((s, d) => s + d.score, 0) / diagnosisData.length
  );

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.blue})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ◈
            </div>
            <div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                OpenAgency → AI-Native SaaS
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: COLORS.textDim,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Strategic Analysis · Axiom Nexar · {new Date().toLocaleDateString("es-MX")}
              </p>
            </div>
          </div>
          <p
            style={{
              fontSize: 14,
              color: COLORS.textDim,
              lineHeight: 1.6,
              maxWidth: 720,
              marginTop: 8,
            }}
          >
            De toolkit para marketeros humanos a plataforma donde agentes IA contratan,
            ejecutan y optimizan campañas publicitarias — sin humanos en el loop operativo.
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 0,
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? COLORS.accent : COLORS.textDim,
                background: "none",
                border: "none",
                borderBottom: `2px solid ${
                  activeTab === t.id ? COLORS.accent : "transparent"
                }`,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                fontFamily: "inherit",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* DIAGNOSIS TAB */}
        {activeTab === "diagnosis" && (
          <div>
            {/* Overall Score */}
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 24,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ textAlign: "center", minWidth: 100 }}>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    color:
                      overallScore >= 7
                        ? COLORS.accent
                        : overallScore >= 4
                        ? COLORS.warning
                        : COLORS.danger,
                    fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: 1,
                  }}
                >
                  {overallScore}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textDim,
                    marginTop: 4,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  /10 OVERALL
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.text }}>
                  <strong>Veredicto:</strong> Los computation engines son el activo más valioso
                  — Shapley attribution, Hill curves, waste waterfall son IP diferenciada.
                  Pero la arquitectura está diseñada para{" "}
                  <span style={{ color: COLORS.danger, fontWeight: 600 }}>
                    humanos que clickean botones
                  </span>
                  , no para agentes que invocan APIs programáticamente. La transición requiere
                  re-arquitectar la capa de acceso sin tocar el core math.
                </p>
              </div>
            </div>

            {/* Dimension Cards */}
            {diagnosisData.map((dim) => (
              <div
                key={dim.id}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>{dim.title}</h3>
                  <div style={{ width: 160 }}>
                    <ScoreBar score={dim.score} />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: COLORS.accent,
                        marginBottom: 6,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.05em",
                      }}
                    >
                      ✓ FORTALEZAS
                    </div>
                    {dim.findings.map((f, i) => (
                      <p
                        key={i}
                        style={{
                          fontSize: 12,
                          color: COLORS.textDim,
                          lineHeight: 1.6,
                          paddingLeft: 12,
                          borderLeft: `2px solid ${COLORS.accentDim}`,
                          marginBottom: 6,
                        }}
                      >
                        {f}
                      </p>
                    ))}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: COLORS.danger,
                        marginBottom: 6,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.05em",
                      }}
                    >
                      ✗ GAPS PARA AGENT-NATIVE
                    </div>
                    {dim.gaps.map((g, i) => (
                      <p
                        key={i}
                        style={{
                          fontSize: 12,
                          color: COLORS.textDim,
                          lineHeight: 1.6,
                          paddingLeft: 12,
                          borderLeft: `2px solid ${COLORS.dangerDim}`,
                          marginBottom: 6,
                        }}
                      >
                        {g}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ROADMAP TAB */}
        {activeTab === "roadmap" && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              {phases.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setExpandedPhase(p.id);
                    setExpandedAction(null);
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: expandedPhase === p.id ? 700 : 500,
                    color: expandedPhase === p.id ? p.color : COLORS.textDim,
                    background:
                      expandedPhase === p.id ? p.dimColor : "transparent",
                    border: `1px solid ${
                      expandedPhase === p.id ? p.color + "44" : COLORS.border
                    }`,
                    borderRadius: 8,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    fontFamily: "inherit",
                  }}
                >
                  {p.icon} {p.timeline}
                </button>
              ))}
            </div>

            {phases
              .filter((p) => p.id === expandedPhase)
              .map((phase) => (
                <div key={phase.id}>
                  <div
                    style={{
                      background: COLORS.surface,
                      border: `1px solid ${phase.color}33`,
                      borderRadius: 12,
                      padding: 24,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{phase.icon}</span>
                      <div>
                        <h2
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: phase.color,
                          }}
                        >
                          {phase.title}
                        </h2>
                        <p
                          style={{
                            fontSize: 12,
                            color: COLORS.textDim,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {phase.timeline}
                        </p>
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        color: COLORS.text,
                        lineHeight: 1.6,
                        marginTop: 8,
                      }}
                    >
                      {phase.objective}
                    </p>
                  </div>

                  {phase.actions.map((action, idx) => {
                    const isOpen = expandedAction === `${phase.id}-${idx}`;
                    return (
                      <div
                        key={idx}
                        style={{
                          background: isOpen
                            ? COLORS.surfaceHover
                            : COLORS.surface,
                          border: `1px solid ${
                            isOpen ? phase.color + "44" : COLORS.border
                          }`,
                          borderRadius: 10,
                          marginBottom: 8,
                          overflow: "hidden",
                          transition: "all 0.2s",
                        }}
                      >
                        <button
                          onClick={() =>
                            setExpandedAction(
                              isOpen ? null : `${phase.id}-${idx}`
                            )
                          }
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                            padding: "14px 18px",
                            background: "none",
                            border: "none",
                            color: COLORS.text,
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 600,
                            textAlign: "left",
                            fontFamily: "inherit",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                background: phase.dimColor,
                                color: phase.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {idx + 1}
                            </span>
                            {action.name}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <EffortBadge effort={action.effort} />
                            <ImpactBadge impact={action.impact} />
                            <span
                              style={{
                                color: COLORS.textMuted,
                                fontSize: 16,
                                marginLeft: 4,
                                transform: isOpen
                                  ? "rotate(180deg)"
                                  : "rotate(0)",
                                transition: "transform 0.2s",
                              }}
                            >
                              ▾
                            </span>
                          </span>
                        </button>
                        {isOpen && (
                          <div
                            style={{
                              padding: "0 18px 16px 52px",
                              fontSize: 13,
                              color: COLORS.textDim,
                              lineHeight: 1.7,
                            }}
                          >
                            {action.detail}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        )}

        {/* TECH STACK TAB */}
        {activeTab === "stack" && (
          <div>
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 1fr 1fr",
                  gap: 0,
                }}
              >
                {/* Header */}
                {["Layer", "Current (v0.3)", "Target (v1.0)", "Stack"].map(
                  (h) => (
                    <div
                      key={h}
                      style={{
                        padding: "12px 16px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: COLORS.textDim,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.05em",
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: COLORS.surfaceHover,
                      }}
                    >
                      {h}
                    </div>
                  )
                )}

                {/* Rows */}
                {techStack.map((row, i) => (
                  <>
                    <div
                      key={`l-${i}`}
                      style={{
                        padding: "12px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: COLORS.text,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {row.layer}
                    </div>
                    <div
                      key={`c-${i}`}
                      style={{
                        padding: "12px 16px",
                        fontSize: 12,
                        color: COLORS.danger,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {row.current}
                    </div>
                    <div
                      key={`t-${i}`}
                      style={{
                        padding: "12px 16px",
                        fontSize: 12,
                        color: COLORS.accent,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {row.target}
                    </div>
                    <div
                      key={`s-${i}`}
                      style={{
                        padding: "12px 16px",
                        fontSize: 11,
                        color: COLORS.textDim,
                        borderBottom: `1px solid ${COLORS.border}`,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {row.tools}
                    </div>
                  </>
                ))}
              </div>
            </div>

            {/* Architecture Diagram */}
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 24,
                marginTop: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                TARGET ARCHITECTURE
              </h3>
              <pre
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: COLORS.textDim,
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: "auto",
                }}
              >
{`┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL AGENT CLIENTS                       │
│  Claude Agents │ GPT Agents │ Gemini Agents │ Custom Agents    │
└────────┬───────────────┬──────────────┬────────────────────────┘
         │ A2A Protocol  │ MCP Protocol │ REST API
         ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY + AUTH                          │
│  Agent Auth (M2M OAuth2) │ Rate Limits │ Schema Validation     │
│  Agent Cards Registry    │ Telemetry   │ Usage Metering        │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT BUS (NATS/Redis)                       │
│  waste.detected │ budget.reallocated │ anomaly.found           │
│  campaign.launched │ report.generated │ goal.completed          │
└────────┬──────────┬──────────┬──────────┬──────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   LEAK   │ │  MEDIA   │ │ CAMPAIGN │ │EXECUTIVE │
│ DETECTOR │ │ARCHITECT │ │   OPS    │ │  BRIDGE  │
│  AGENT   │ │  AGENT   │ │  AGENT   │ │  AGENT   │
│          │ │          │ │          │ │          │
│ OODA Loop│ │ OODA Loop│ │ OODA Loop│ │ OODA Loop│
│ Goals    │ │ Goals    │ │ Goals    │ │ Goals    │
│ Memory   │ │ Memory   │ │ Memory   │ │ Memory   │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │
     └────────────┴─────┬──────┴────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              PLATFORM CONNECTORS (Live APIs)                    │
│  Google Ads │ Meta │ DV360 │ TikTok │ Amazon │ + extensible    │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                            │
│  PostgreSQL │ pgvector (agent memory) │ TimescaleDB (metrics)  │
└─────────────────────────────────────────────────────────────────┘`}
              </pre>
            </div>
          </div>
        )}

        {/* THESIS TAB */}
        {activeTab === "thesis" && (
          <div>
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.accent}33`,
                borderRadius: 12,
                padding: 28,
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.accent,
                  marginBottom: 16,
                  lineHeight: 1.3,
                }}
              >
                La tesis: OpenAgency no compite con Publicis ni con WPP.
                Compite con su infraestructura invisible.
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: COLORS.text,
                  lineHeight: 1.8,
                  marginBottom: 16,
                }}
              >
                En 12-18 meses, los CMOs no van a contratar una agencia y sentarse en una sala
                a ver un deck de PowerPoint. Van a decir "optimiza mi Q3 para ROAS 4.5x con
                $2M de budget" y un agente orquestador va a contratar los servicios que necesita:
                waste detection de OpenAgency, creative generation de otro proveedor, media buying
                de otro — todo via A2A protocol. El agente del CMO negocia precio, evalúa
                reputation scores, y ejecuta. El humano aprueba el goal y revisa los resultados.
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: COLORS.text,
                  lineHeight: 1.8,
                  marginBottom: 16,
                }}
              >
                <strong>Lo que tienes hoy:</strong> Los engines son el equivalente a tener un
                motor Ferrari en un carrito de golf. La math es sólida (Shapley, Hill curves,
                24-task DAG). Pero el carrito de golf tiene pedales para pies humanos — un CLI
                que espera que un humano escriba{" "}
                <code style={{ color: COLORS.accent, fontSize: 13 }}>
                  npx openagency scan
                </code>
                . Un dashboard que espera que un humano suba un CSV. Eso muere en 18 meses.
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: COLORS.text,
                  lineHeight: 1.8,
                  marginBottom: 16,
                }}
              >
                <strong>Lo que necesitas:</strong> Que ese motor Ferrari esté en un chasis
                que otros agentes puedan conducir. Un MCP server que Claude Code pueda llamar.
                Un A2A endpoint que el agente de un CMO pueda descubrir, negociar precio, y
                contratar. Un event bus donde Leak Detector publique "waste detected: $45K
                in supply chain" y Media Architect automáticamente reaccione sin que nadie
                toque nada.
              </p>
            </div>

            {/* Key Strategic Decisions */}
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                5 DECISIONES ESTRATÉGICAS IRREVERSIBLES
              </h3>
              {[
                {
                  num: "01",
                  title: "API-First, UI-Second",
                  desc: "El dashboard web se convierte en UN cliente más, no EL producto. El producto es el API. Si solo construyes para browsers humanos, el 90% del tráfico futuro (agentes) te ignora.",
                },
                {
                  num: "02",
                  title: "MCP antes que features",
                  desc: "Cada minuto invertido en UI bonita debería invertirse en MCP servers robustos. Un Claude Code developer que pueda llamar 'waste-waterfall' desde su terminal vale 100x más que un botón bonito.",
                },
                {
                  num: "03",
                  title: "Pricing por outcome, no por seat",
                  desc: "Los agentes no tienen 'seats'. Pricing por API call, por computation unit, o el modelo killer: % del waste recuperado. Si tu engine encuentra $200K de waste y cobra 5%, son $10K por ejecución. Los agentes que evalúen ROI positivo compran solos.",
                },
                {
                  num: "04",
                  title: "Open protocol, closed IP",
                  desc: "Los protocolos (MCP, A2A) son abiertos. La math (Shapley weights, Hill parameters, benchmarks calibrados) es tu IP. No open-sources los benchmarks reales ni los modelos tuneados. Es como Android: protocolo abierto, Google Services cerrado.",
                },
                {
                  num: "05",
                  title: "De herramienta a plataforma",
                  desc: "OpenAgency v0.3 es una herramienta (4 engines). v1.0 debe ser una plataforma donde terceros publican engines via MCP. Tú cobras por transacción. App Store de advertising intelligence para agentes.",
                },
              ].map((d) => (
                <div
                  key={d.num}
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div
                    style={{
                      minWidth: 36,
                      height: 36,
                      borderRadius: 8,
                      background: COLORS.accentDim,
                      color: COLORS.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {d.num}
                  </div>
                  <div>
                    <h4
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 4,
                        color: COLORS.text,
                      }}
                    >
                      {d.title}
                    </h4>
                    <p
                      style={{
                        fontSize: 13,
                        color: COLORS.textDim,
                        lineHeight: 1.6,
                      }}
                    >
                      {d.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* The Killer Insight */}
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.accent}11, ${COLORS.purple}11)`,
                border: `1px solid ${COLORS.accent}44`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.accent,
                  marginBottom: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                💎 EL INSIGHT KILLER
              </h3>
              <p
                style={{
                  fontSize: 15,
                  color: COLORS.text,
                  lineHeight: 1.8,
                  fontWeight: 500,
                }}
              >
                Hoy hay ~12,000 plugins de Claude Code y ~63,000 agent skills publicados.
                Hay cero que hagan Shapley attribution sobre datos reales de campañas.
                Cero que conecten live a 6 plataformas de ads y calculen waste waterfall.
                Cero que optimicen budget con Hill curves sobre data real.
              </p>
              <p
                style={{
                  fontSize: 15,
                  color: COLORS.text,
                  lineHeight: 1.8,
                  fontWeight: 500,
                  marginTop: 12,
                }}
              >
                La window of opportunity para ser el{" "}
                <span
                  style={{
                    color: COLORS.accent,
                    fontWeight: 700,
                  }}
                >
                  "Stripe de advertising intelligence para agentes"
                </span>{" "}
                está abierta ahora. Stripe no construyó un checkout bonito — construyó un
                API que otros podían llamar programáticamente. Tú tienes la math.
                Solo falta el API.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: COLORS.textMuted,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span>OpenAgency Strategic Analysis v1.0</span>
          <span>Confidential · Not for distribution</span>
        </div>
      </div>
    </div>
  );
}
