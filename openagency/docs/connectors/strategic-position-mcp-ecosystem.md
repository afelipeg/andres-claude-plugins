# OpenAgency Strategic Position — MCP Ecosystem Analysis
## "The Stripe of Advertising Intelligence for Agents"

> Date: 2026-03-03
> Context: Phase 3.1 Track B (Billing Engine) + MCP ecosystem research
> Thesis: OpenAgency is the A2A protocol infrastructure for advertising intelligence

---

## THE ECOSYSTEM HAS VALIDATED OUR BET

### What Happened in the Last 6 Months

1. **Google** open-sourced their Ads MCP server (Oct 2025) — READ-ONLY, analytics only
2. **Amazon** launched official Ads MCP server (Feb 2026) — read+write, with "tools as instruction manuals"
3. **Meta** has Pipeboard (community, 73K+ users) — read+write, remote MCP
4. **TikTok** has AdsMCP (community, 1.5K users) — read+write, OAuth flow
5. **DV360** has one community read-only MCP server (`caspercrause/dv360-ads-mcp-server`) — OpenAgency remains the only DV360 **intelligence** layer (Shapley attribution, waste detection, write capabilities)

### What This Means

The major ad platforms have built MCP servers that give agents access to **raw data and basic operations**. This is the plumbing layer — the "pipes." What NO ONE has built is the **intelligence layer** — the system that takes data from ALL platforms simultaneously and produces:

- Cross-platform Shapley attribution
- Multi-channel Hill saturation optimization
- Waste detection with calibrated industry benchmarks
- Revenue reconciliation across measurement systems
- Autonomous optimization with safety guardrails
- **Outcome-based billing tied to verified recovery**

**This is precisely what OpenAgency does.**

---

## THE STRIPE ANALOGY, EXTENDED

```
PAYMENT INDUSTRY (2010s)          ADVERTISING INDUSTRY (2026+)
─────────────────────────          ──────────────────────────────
Banks have APIs                    Ad platforms have MCP servers
(Visa API, bank APIs)              (Google Ads MCP, Amazon Ads MCP)

Stripe = intelligence layer        OpenAgency = intelligence layer
that sits ABOVE bank APIs          that sits ABOVE platform MCPs

Stripe doesn't replace banks       OpenAgency doesn't replace platforms

Stripe makes payments              OpenAgency makes optimization
"work" for developers              "work" for AI agents

Stripe charges per transaction     OpenAgency charges per recovery
(2.9% + 30¢)                      (3.5-5% of verified waste recovery)

Developers build ON Stripe         Agents build ON OpenAgency
```

### Key Pricing Parallel

Stripe doesn't charge per "seat" or per "month." It charges a percentage of each transaction.
OpenAgency doesn't charge per "user" or per "seat." It charges a percentage of verified recovery.

This is why **Track B (Billing Engine) is existential** — it's not a feature, it's the business model.

---

## HOW THE MCP ECOSYSTEM FEEDS THE BILLING ENGINE

### Data Flow: Platform MCPs → OpenAgency → Billing

```
STEP 1: BASELINE CAPTURE
  Platform MCP servers → raw campaign data
  OpenAgency connectors → NormalizedCampaignRow
  Billing: baseline_measurement established

STEP 2: OPTIMIZATION
  Leak Detector → waste_summary.total_waste ($)
  Media Architect → kpi_lift, reallocation_deltas ($)
  Campaign Ops → waste_prevented, pacing_corrections ($)
  Executive Bridge → measurement_correction, reconciliation ($)

STEP 3: VERIFICATION
  Platform MCP servers → post-optimization data
  Executive Bridge → verified_recovery = Σ(deltas)
  Deduplication → remove cross-engine overlap

STEP 4: BILLING
  Recovery Extractor → per-engine dollar breakdown
  Tier Manager → apply rate (5% starter → 3.5% enterprise)
  Recovery Report → proof document with before/after ROAS
  billing.recovery_calculated event → monthly aggregation
```

### Amazon's Validation of Our Approach

Amazon's MCP server announcement (March 2, 2026) explicitly states:

> "Tools reduce complexity by orchestrating capabilities into complete, multi-step
> operations... They act as an instruction manual, turning complex operations into
> simple actions an agent can execute."

This is EXACTLY what `mesh_execute_pipeline` does — it orchestrates Leak Detector →
Media Architect → Campaign Ops → Executive Bridge into a single tool call that any
agent can invoke. Amazon built this for campaign operations. We built it for
cross-platform intelligence.

---

## COMPETITIVE MOATS BY LAYER

### Layer 1: Protocol (WEAK moat — open standards)
- MCP server implementation
- A2A Agent Cards
- REST API + OpenAPI
- *Anyone can implement these*

### Layer 2: Computation (STRONG moat — domain expertise)
- Shapley attribution weights calibrated on real campaign data
- Hill saturation parameters per channel per market (Mexico/LATAM)
- Waste waterfall benchmarks with industry-specific thresholds
- Revenue bridge with statistical power analysis
- *Requires deep advertising domain knowledge + mathematical rigor*

### Layer 3: Orchestration (MEDIUM moat — architecture)
- Multi-agent mesh coordinator
- OODA loop runtime with safety pipeline
- Goal-driven execution with conflict detection
- Event-driven architecture with cross-agent communication
- *Complex to build but replicable with enough engineering*

### Layer 4: Billing (STRONGEST moat — network effects)
- Outcome-based pricing creates alignment between platform and client
- Per-engine recovery attribution creates transparency
- Baseline + improvement measurement creates accountability
- The more clients use OpenAgency, the better the benchmarks become
- *Requires all three layers above PLUS trust from the market*

---

## NEXT STEPS: TRACK B IMPLEMENTATION

### This Session's Build Order

1. `packages/billing/src/types.ts` — core billing type system
2. `packages/billing/src/recovery-extractor.ts` — extract $ from mesh results
3. `packages/billing/src/deduplication.ts` — cross-engine dedup
4. `packages/billing/src/billing-period.ts` — monthly aggregation
5. `packages/billing/src/tier-manager.ts` — spend tiers
6. `packages/billing/src/recovery-report.ts` — proof documents
7. Billing events + MCP tools + REST routes
8. Wire into mesh pipeline

### Key Technical Decision: Recovery Verification

How do we VERIFY that recovery is real?

**Option A: Platform Re-Query** (after optimization, query platform MCPs for actual post-performance)
- Pro: Ground truth from source
- Con: Time delay (optimization effects take days/weeks)
- Con: Attribution window complexity

**Option B: Model-Based Estimation** (predict recovery from optimization actions)
- Pro: Immediate billing
- Con: Less trustworthy
- Con: Overpromise risk

**Option C: Hybrid** (bill immediately on model estimate, true-up monthly with platform data)
- Pro: Fast billing + eventual accuracy
- Pro: Aligns with how agencies already bill (monthly reconciliation)
- **This is the recommended approach**

### Implementation of Hybrid Billing:

```typescript
interface RecoveryEvent {
  run_id: string;
  estimated_recovery: number;    // Immediate, from engine outputs
  verified_recovery?: number;    // Set later, from platform re-query
  verification_status: 'pending' | 'verified' | 'adjusted';
  verification_date?: string;
}
```

The `billing-period.ts` aggregator closes monthly periods using:
- `estimated_recovery` for current period (cash flow)
- `verified_recovery` for prior period true-up (adjustment credit/debit)

This mirrors Stripe's approach with pending charges and settled transactions.

---

## THE VISION: 18 MONTHS FROM NOW

An AI agent working for a CMO says:
> "Optimize our Q3 digital spend across Google, Meta, TikTok, and Amazon
> for ROAS 4.5x with a $2M budget."

The agent discovers OpenAgency via A2A Agent Card. It:
1. Evaluates capabilities (29 skills, 4 engines, safety pipeline)
2. Checks reputation score
3. Negotiates pricing (4% of verified recovery for $2M spend = Scale tier)
4. Invokes `mesh_execute_pipeline` with goal parameters
5. OpenAgency's mesh runs full optimization:
   - Leak Detector finds $180K waste across 4 platforms
   - Media Architect reallocates $120K for projected $95K lift
   - Campaign Ops prevents $45K in pacing overruns
   - Executive Bridge reconciles at $275K total verified recovery
6. Billing: 4% × $275K = $11,000 for a single pipeline execution
7. Client's agent evaluates: $11K cost for $275K recovery = 25x ROI → auto-approve

No human touched the system. No meeting. No pitch deck. No SOW.
An agent discovered, evaluated, contracted, and paid for advertising intelligence
as a service. That's the Stripe of advertising intelligence.

**We're building the infrastructure for this economy. Track B is the billing engine
that makes it all work.**
