/*
 * Command Center — The hero screen of the Plinth demo
 * Agent status cards, mesh pipeline, live event feed, key metrics
 */
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import DemoLayout from "@/components/demo/DemoLayout";

// ─── OODA Phases ────────────────────────────────────────
const oodaPhases = ["Observing", "Orienting", "Deciding", "Acting"] as const;
const oodaColors: Record<string, string> = {
  Observing: "#00e5a0",
  Orienting: "#a78bfa",
  Deciding: "#3b82f6",
  Acting: "#ff6b35",
};

const agents = [
  { name: "Leak Detector", cyclesToday: 47, wasteFound: "$127,400", startPhase: 0 },
  { name: "Media Architect", cyclesToday: 52, reallocations: 8, startPhase: 2 },
  { name: "Campaign Ops", cyclesToday: 89, actionsExecuted: 23, startPhase: 3 },
  { name: "Executive Bridge", cyclesToday: 31, reports: 6, startPhase: 1 },
];

// ─── Event Feed Data ────────────────────────────────────
const eventTemplates = [
  { type: "waste", color: "#00e5a0", domain: "domain.waste_detected", msg: "$23,400 in frequency waste (Meta Ads)" },
  { type: "data", color: "#3b82f6", domain: "domain.budget_reallocated", msg: "$15,000 from Brand → Retarget (Google Ads)" },
  { type: "action", color: "#ff6b35", domain: "agent.action.executed", msg: 'Campaign "Summer Sale" budget updated (dry_run: false)' },
  { type: "report", color: "#a78bfa", domain: "domain.executive_report", msg: "Weekly recovery: $41,200 across 3 platforms" },
  { type: "mesh", color: "#00e5a0", domain: "mesh.pipeline.completed", msg: "Run #847 in 4.2s (4/4 stages)" },
  { type: "waste", color: "#00e5a0", domain: "domain.waste_detected", msg: "$18,700 in supply chain leakage (DV360)" },
  { type: "data", color: "#3b82f6", domain: "domain.channel_optimized", msg: "Hill curve saturation reached for TikTok Ads" },
  { type: "action", color: "#ff6b35", domain: "agent.action.executed", msg: 'Creative rotation triggered for "Q1 Retarget"' },
  { type: "report", color: "#a78bfa", domain: "domain.shapley_computed", msg: "Attribution update: Meta 34%, Google 28%, TikTok 22%" },
  { type: "mesh", color: "#00e5a0", domain: "mesh.pipeline.completed", msg: "Run #848 in 3.8s (4/4 stages)" },
  { type: "waste", color: "#00e5a0", domain: "domain.waste_detected", msg: "$9,200 in audience waste (Amazon Ads)" },
  { type: "data", color: "#3b82f6", domain: "domain.budget_reallocated", msg: "$22,000 from Awareness → Conversion (Meta)" },
];

// ─── Pipeline Runs ──────────────────────────────────────
const pipelineRuns = [
  { id: 847, duration: 4.2, status: "completed" },
  { id: 846, duration: 3.9, status: "completed" },
  { id: 845, duration: 5.1, status: "completed" },
  { id: 844, duration: 4.0, status: "completed" },
  { id: 843, duration: 3.7, status: "completed" },
];

// ─── Agent Status Card ──────────────────────────────────
function AgentCard({ agent, phaseIndex }: { agent: typeof agents[0]; phaseIndex: number }) {
  const phase = oodaPhases[phaseIndex];
  const color = oodaColors[phase];
  const stat = "wasteFound" in agent
    ? { label: "Waste found", value: agent.wasteFound }
    : "reallocations" in agent
    ? { label: "Reallocations", value: agent.reallocations }
    : "actionsExecuted" in agent
    ? { label: "Actions executed", value: agent.actionsExecuted }
    : { label: "Reports", value: agent.reports };

  return (
    <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">{agent.name}</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-xs font-medium" style={{ color }}>{phase}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-3">
        {oodaPhases.map((p, i) => (
          <div
            key={p}
            className="h-1 flex-1 rounded-full transition-all duration-500"
            style={{
              backgroundColor: i === phaseIndex ? color : "rgba(255,255,255,0.06)",
              opacity: i === phaseIndex ? 1 : 0.4,
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-zinc-600 mb-0.5">Cycles today</p>
          <p className="text-sm font-mono font-semibold text-zinc-300">{agent.cyclesToday}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600 mb-0.5">{stat.label}</p>
          <p className="text-sm font-mono font-semibold text-zinc-300">{stat.value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Mesh Pipeline Visualization ────────────────────────
function MeshPipeline({ activeStage }: { activeStage: number }) {
  const stages = ["Leak Detector", "Media Architect", "Campaign Ops", "Executive Bridge"];

  return (
    <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-white">Mesh Pipeline</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-500">Run #847</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00e5a0]/10 text-[#00e5a0] font-medium">
            Completed in 4.2s
          </span>
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center gap-2 mb-5">
        {stages.map((stage, i) => (
          <div key={stage} className="flex items-center flex-1">
            <div className={`flex-1 rounded-lg border p-3 text-center transition-all duration-500 ${
              i <= activeStage
                ? "border-[#00e5a0]/30 bg-[#00e5a0]/5"
                : "border-white/[0.06] bg-white/[0.01]"
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {i <= activeStage && (
                  <svg className="w-3 h-3 text-[#00e5a0]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={`text-[10px] font-semibold ${i <= activeStage ? "text-[#00e5a0]" : "text-zinc-600"}`}>
                  {stage}
                </span>
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="w-4 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mini timeline */}
      <div className="flex items-end gap-2 h-10">
        {pipelineRuns.map((run, i) => (
          <div key={run.id} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(run.duration / 6) * 100}%` }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="w-full rounded-sm"
              style={{ backgroundColor: i === 0 ? "#00e5a0" : "rgba(255,255,255,0.08)", minHeight: 4 }}
            />
            <span className="text-[8px] font-mono text-zinc-700">#{run.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Live Event Feed ────────────────────────────────────
function EventFeed({ events }: { events: typeof eventTemplates }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length]);

  const now = new Date();

  return (
    <div className="rounded-xl border border-white/[0.06] flex flex-col h-full" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Live Event Feed</span>
        <div className="w-2 h-2 rounded-full bg-[#00e5a0] animate-pulse" />
      </div>
      <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]" style={{ maxHeight: 360 }}>
        {events.filter(Boolean).map((event, i) => {
          if (!event || !event.color) return null;
          const seconds = events.length - i;
          const ts = new Date(now.getTime() - seconds * 1000);
          const timeStr = ts.toLocaleTimeString("en-US", { hour12: false });
          return (
            <motion.div
              key={`${event.domain}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
              className="flex items-start gap-2 py-1 px-2 rounded hover:bg-white/[0.02]"
            >
              <span className="text-zinc-700 shrink-0">[{timeStr}]</span>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: event.color }} />
              <span className="text-zinc-500">
                <span className="text-zinc-400">{event.domain}</span> — {event.msg}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Key Metrics Strip ──────────────────────────────────
function MetricsStrip() {
  const metrics = [
    { label: "Total Recovery This Month", value: "$247,800", change: "+12%", changeColor: "#00e5a0" },
    { label: "Waste Rate", value: "14.2% → 8.7%", change: "↓ 5.5%", changeColor: "#00e5a0" },
    { label: "Active Platforms", value: "5/6", change: "Google, Meta, TikTok, Amazon, DV360", changeColor: "#3b82f6" },
    { label: "Pipeline Runs Today", value: "127", change: "avg 3.9s", changeColor: "#a78bfa" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.1 }}
          className="rounded-xl border border-white/[0.06] p-4"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <p className="text-[10px] text-zinc-600 mb-1 font-medium">{m.label}</p>
          <p className="text-xl font-mono font-bold text-white mb-1">{m.value}</p>
          <p className="text-[10px] font-medium" style={{ color: m.changeColor }}>{m.change}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function CommandCenter() {
  const [phaseIndices, setPhaseIndices] = useState(agents.map((a) => a.startPhase));
  const [visibleEvents, setVisibleEvents] = useState(eventTemplates.slice(0, 5));
  const [activeStage, setActiveStage] = useState(3);

  // Cycle OODA phases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndices((prev) => prev.map((p) => (p + 1) % 4));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Add events to feed
  useEffect(() => {
    let eventIndex = 5;
    const interval = setInterval(() => {
      const template = eventTemplates[eventIndex % eventTemplates.length];
      if (template) {
        setVisibleEvents((prev) => {
          const next = [...prev, { ...template }];
          // Keep max 20 events to prevent memory growth
          return next.length > 20 ? next.slice(-20) : next;
        });
      }
      eventIndex++;
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Animate pipeline
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage(0);
      let stage = 0;
      const stageInterval = setInterval(() => {
        stage++;
        if (stage > 3) {
          clearInterval(stageInterval);
        } else {
          setActiveStage(stage);
        }
      }, 800);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DemoLayout>
      <div className="space-y-4">
        {/* Top row: Agent Cards + Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Agent Cards */}
          <div className="lg:col-span-4 space-y-3">
            {agents.map((agent, i) => (
              <AgentCard key={agent.name} agent={agent} phaseIndex={phaseIndices[i]} />
            ))}
          </div>

          {/* Center + Right: Pipeline + Event Feed */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <MeshPipeline activeStage={activeStage} />
            <div className="flex-1">
              <EventFeed events={visibleEvents} />
            </div>
          </div>
        </div>

        {/* Bottom: Key Metrics */}
        <MetricsStrip />
      </div>
    </DemoLayout>
  );
}
