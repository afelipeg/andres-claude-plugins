// ─── Architecture Page ─────────────────────────────────────────────
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '../components/ui/glass';
const PACKAGES = [
  { name: 'types', desc: 'Shared TypeScript interfaces', deps: [], color: 'bg-white/10 text-white/70' },
  { name: 'schemas', desc: 'Zod validation for 29 skills', deps: ['types'], color: 'bg-white/10 text-white/70' },
  { name: 'core', desc: 'Orchestration, LLM, file parser, billing', deps: ['types'], color: 'bg-white/10 text-white/70' },
  { name: 'auth', desc: 'JWT, API keys, RBAC, Hono middleware', deps: ['types'], color: 'bg-white/10 text-white/70' },
  { name: 'events', desc: 'Event bus (InMemory + Redis), 37 event types', deps: ['types'], color: 'bg-white/10 text-white/70' },
  { name: 'memory', desc: 'PostgreSQL repos, pgvector episodic memory', deps: ['types'], color: 'bg-white/10 text-white/70' },
  { name: 'engines', desc: '4 engines, 29 skills across ad intelligence', deps: ['types', 'schemas', 'core'], color: 'bg-[#00F5FF]/20 text-[#00F5FF]' },
  { name: 'connectors', desc: '6 platform connectors, OAuth2, safety pipeline', deps: ['types', 'events'], color: 'bg-white/10 text-white/70' },
  { name: 'agent', desc: 'OODA runtime, mesh coordinator, goal tracker', deps: ['types', 'core', 'events', 'connectors', 'memory'], color: 'bg-[#00F5FF]/20 text-[#00F5FF]' },
];
const APPS = [
  { name: 'api', desc: 'Hono REST + MCP + A2A + SSE', deps: ['all packages'], color: 'bg-[#00F5FF]/20 text-[#00F5FF]' },
  { name: 'web', desc: 'Vite + React dashboard', deps: ['api (HTTP)'], color: 'bg-white/10 text-white/70' },
  { name: 'cli', desc: 'CLI tool + serve command', deps: ['api'], color: 'bg-white/10 text-white/70' },
];
const TECH_STACK = [
  { category: 'Runtime', items: ['Node.js 20', 'TypeScript 5.7', 'ESM'] },
  { category: 'API', items: ['Hono', 'MCP SDK', 'A2A Protocol', 'SSE'] },
  { category: 'Database', items: ['PostgreSQL 16', 'pgvector', 'porsager/postgres'] },
  { category: 'AI/LLM', items: ['Claude (Anthropic)', 'OpenAI', 'Google Gemini'] },
  { category: 'Auth', items: ['JWT (jose)', 'API Keys', 'OAuth2 M2M', 'RBAC'] },
  { category: 'Events', items: ['InMemory Bus', 'Redis Pub/Sub', '37 Event Types'] },
  { category: 'Connectors', items: ['Meta Ads', 'Google Ads', 'DV360', 'TikTok', 'Amazon Ads'] },
  { category: 'Build', items: ['pnpm', 'Turborepo', 'Vitest', 'Docker'] },
  { category: 'Frontend', items: ['React 18', 'Vite 5', 'Tailwind CSS', 'Recharts'] },
];
const PIPELINE_STAGES = [
  { engine: 'Leak Detector', color: 'border-red-500/30 bg-red-500/10', textColor: 'text-red-300', skills: ['waste-waterfall', 'media-quality-score', 'supply-chain-audit', 'fraud-detector', 'viewability-audit', 'frequency-cap', 'geo-waste'], output: 'Waste eliminated, quality waste, supply chain savings' },
  { engine: 'Media Architect', color: 'border-white/10 bg-white/5', textColor: 'text-white/95', skills: ['mmm-optimize', 'mmm-model', 'channel-mix', 'saturation-curve', 'response-curve', 'marginal-roi', 'budget-optimizer'], output: 'KPI lift, ROAS improvement, channel reallocation' },
  { engine: 'Campaign Ops', color: 'border-emerald-500/30 bg-emerald-500/10', textColor: 'text-emerald-300', skills: ['optimization-analyze', 'optimization-reallocate', 'pacing-monitor', 'audience-overlap', 'creative-fatigue'], output: 'CPA savings, reallocation amounts, pacing corrections' },
  { engine: 'Executive Bridge', color: 'border-[#7000FF]/30 bg-[#7000FF]/10', textColor: 'text-purple-300', skills: ['revenue-translate', 'reconcile', 'incrementality', 'media-plan'], output: 'Media-Driven Sales, measurement waste, validated lift' },
];
const DATA_FLOW = [
  { step: 1, label: 'Ingest', desc: 'CSV/Excel/PDF upload or platform API sync (6 connectors)', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { step: 2, label: 'Parse', desc: 'Smart auto-detect platform format, column mapping', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { step: 3, label: 'Analyze', desc: '4 engines run 29 skills: waste, optimize, ops, executive', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { step: 4, label: 'Decide', desc: 'OODA loop: orient (LLM reasoning) + decide (action plan)', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { step: 5, label: 'Act', desc: 'Safety pipeline validates, then execute connector writes', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { step: 6, label: 'Bill', desc: 'Outcome-based billing: 3 fee streams on value delivered', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];
export function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Architecture</h2>
        <p className="mt-1 text-sm text-white/50">
          OpenAgency infrastructure: A2A advertising intelligence with autonomous OODA agents.
        </p>
      </div>
      {/* Data Flow Pipeline */}
      <GlassCard>
        <GlassCardHeader><GlassCardTitle>Data Flow</GlassCardTitle></GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {DATA_FLOW.map((step) => (
              <div key={step.step} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00F5FF]/20 text-[#00F5FF]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70">{step.step}</span>
                    <h4 className="text-sm font-semibold text-white/95">{step.label}</h4>
                  </div>
                  <p className="mt-1 text-xs text-white/50">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
      {/* Engine Pipeline */}
      <GlassCard>
        <GlassCardHeader><GlassCardTitle>Engine Pipeline (Mesh)</GlassCardTitle></GlassCardHeader>
        <GlassCardContent>
          <p className="mb-4 text-xs text-white/50">The mesh coordinator executes engines sequentially. Each stage passes context to the next via output_summary.</p>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.engine} className={`rounded-xl border p-4 ${stage.color}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70 shadow-sm">{i + 1}</span>
                  <h4 className={`text-sm font-semibold ${stage.textColor}`}>{stage.engine}</h4>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <span className="ml-auto text-xs text-white/30">output_summary --&gt;</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stage.skills.map((s) => (
                    <span key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">{s}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/50">{stage.output}</p>
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
      {/* OODA Loop */}
      <GlassCard>
        <GlassCardHeader><GlassCardTitle>OODA Loop (Autonomous Agent Cycle)</GlassCardTitle></GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { phase: 'Observe', desc: 'Collect observations from events, platform sync data, human feedback. Observer pipeline filters and enriches.', color: 'border-white/10 bg-white/5 text-white/70' },
              { phase: 'Orient', desc: 'LLM analyzes observations: finds anomalies, opportunities, risks. Context-aware with agent memory and goal progress.', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
              { phase: 'Decide', desc: 'LLM produces action plan with confidence and risk level. High-risk decisions require human approval.', color: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' },
              { phase: 'Act', desc: 'Execute actions through safety pipeline. Connector writes to platforms. Outcomes measured for next cycle.', color: 'border-red-500/30 bg-red-500/10 text-red-300' },
            ].map((phase) => (
              <div key={phase.phase} className={`rounded-xl border p-4 ${phase.color}`}>
                <h4 className="font-semibold">{phase.phase}</h4>
                <p className="mt-2 text-xs">{phase.desc}</p>
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
      {/* Monorepo Structure */}
      <GlassCard>
        <GlassCardHeader><GlassCardTitle>Monorepo Structure</GlassCardTitle></GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-white/95 mb-2">Packages (libraries)</h4>
              <div className="grid gap-2 md:grid-cols-3">
                {PACKAGES.map((pkg) => (
                  <div key={pkg.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${pkg.color}`}>{pkg.name}</span>
                    <p className="mt-1 text-xs text-white/50">{pkg.desc}</p>
                    {pkg.deps.length > 0 && (
                      <p className="mt-1 text-[10px] text-white/30">depends: {pkg.deps.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white/95 mb-2">Apps (deployables)</h4>
              <div className="grid gap-2 md:grid-cols-3">
                {APPS.map((app) => (
                  <div key={app.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${app.color}`}>{app.name}</span>
                    <p className="mt-1 text-xs text-white/50">{app.desc}</p>
                    <p className="mt-1 text-[10px] text-white/30">depends: {app.deps.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
      {/* Tech Stack */}
      <GlassCard>
        <GlassCardHeader><GlassCardTitle>Tech Stack</GlassCardTitle></GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {TECH_STACK.map((cat) => (
              <div key={cat.category}>
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide">{cat.category}</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cat.items.map((item) => (
                    <span key={item} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/70">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
      {/* Protocols */}
      <GlassCard>
        <GlassCardHeader><GlassCardTitle>Communication Protocols</GlassCardTitle></GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="font-semibold text-white/95">REST API</h4>
              <p className="mt-1 text-xs text-white/50">12 route modules, 40+ endpoints. Hono framework with JWT/API key auth.</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <h4 className="font-semibold text-emerald-300">MCP (Model Context Protocol)</h4>
              <p className="mt-1 text-xs text-emerald-300/70">44 tools: 29 skills + file parser + agent + connector + mesh tools. Streamable HTTP transport.</p>
            </div>
            <div className="rounded-lg border border-[#7000FF]/30 bg-[#7000FF]/10 p-4">
              <h4 className="font-semibold text-purple-300">A2A (Agent-to-Agent)</h4>
              <p className="mt-1 text-xs text-purple-300/70">Agent Cards at /.well-known/agent.json. Skill discovery, remote invocation, mesh orchestration.</p>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
