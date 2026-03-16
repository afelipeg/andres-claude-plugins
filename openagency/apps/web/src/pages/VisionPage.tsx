// ─── Vision Page ─────────────────────────────────────────────────────
// Cinematic editorial page inspired by atoms.co/vision
// Dark bg, scroll-triggered animations, section numbers

import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
  transition: { duration: 0.7, ease: 'easeOut' as const },
};

function Section({
  number,
  title,
  children,
}: {
  number?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section {...fadeUp} className="py-16 md:py-20 border-b border-white/[0.06]">
      {number && (
        <span className="block text-[#02c98d] font-mono text-sm tracking-widest mb-4">
          {number}
        </span>
      )}
      {title && (
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-8 leading-tight">
          {title}
        </h2>
      )}
      <div className="text-[#fff7dde6] text-base md:text-lg leading-relaxed space-y-5">
        {children}
      </div>
    </motion.section>
  );
}

function Quote({ children, author }: { children: React.ReactNode; author?: string }) {
  return (
    <motion.blockquote
      {...fadeUp}
      className="border-l-2 border-[#02c98d] pl-6 md:pl-8 my-16 md:my-20"
    >
      <p className="text-xl md:text-2xl italic text-zinc-300 leading-relaxed">{children}</p>
      {author && (
        <cite className="mt-4 block text-sm text-zinc-500 not-italic">{author}</cite>
      )}
    </motion.blockquote>
  );
}

function HorizontalRule() {
  return <div className="border-t border-white/[0.06] my-4" />;
}

export function VisionPage() {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Navbar />

      {/* Hero intro — no number */}
      <div className="max-w-[900px] mx-auto px-6 pt-28 md:pt-36 pb-8">
        <motion.div {...fadeUp}>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-10">
            Vision
          </h1>
          <div className="text-[#fff7dde6] text-base md:text-lg leading-relaxed space-y-5">
            <p>
              I spent a decade inside the machine. Running a top-tier digital agency across
              Latin America — managing hundreds of millions in ad spend for brands you know.
              I had a front-row seat to how the modern advertising industry actually works.
            </p>
            <p>What I saw broke something in me.</p>
            <p>
              Not a dramatic break. A slow one. The kind that happens when you watch an
              industry that was built to grow brands quietly become an industry that operates
              platforms. When the people closest to client budgets can't explain what those
              budgets produced. When the most sophisticated campaign review in the room is a
              screenshot of a dashboard everyone already had access to.
            </p>
            <p>I watched it for years. And then I decided to stop watching.</p>
          </div>
        </motion.div>

        <HorizontalRule />

        {/* 01 — The Decay */}
        <Section number="01" title="The Decay">
          <p>
            There was a time when agencies were the smartest room a brand could walk into.
            Strategists who understood consumer psychology, media planners who could map
            attention to revenue, creative directors who turned insight into growth.
          </p>
          <p>That time is over.</p>
          <p>
            Today, the average agency team spends 70% of its hours on operational tasks.
            Pulling reports. Reconciling spreadsheets. Copy-pasting numbers between platforms
            that were designed to talk to each other but never do. A study across 104 agencies
            found that only 1 in 3 minutes of reporting time goes toward actual insight
            generation — the rest is data extraction, formatting, and rework. At least three
            different people touch each client report before it goes out. Account managers
            spend 20 to 60 hours per client per month on reporting alone, and over half of
            that time goes to commentary and formatting that adds no analytical value.
          </p>
          <p>
            The median time to detect meaningful media waste in a cross-platform campaign is
            103 days. By then, the budget is spent. The quarter is closed. The damage is done.
          </p>
          <p>
            The industry didn't collapse. It decayed. Slowly enough that most people inside
            it don't notice. But the numbers don't lie.
          </p>
        </Section>

        {/* 02 — The Waste No One Talks About */}
        <Section number="02" title="The Waste No One Talks About">
          <p>
            Between 15% and 25% of all digital advertising spend is wasted. Not
            misallocated — <em>wasted</em>. Impressions served to bots. Frequency caps
            ignored across platforms. Attribution models that count the same conversion three
            times. Supply chains so opaque that a brand's ad appears on a site it has never
            heard of, through a reseller it never approved.
          </p>
          <p>
            On $650 billion in global digital ad spend, that's $97 to $162 billion. Every
            year. Gone.
          </p>
          <p>
            And here's the part that keeps me up at night: the people managing those budgets
            often don't know it's happening. Not because they're incompetent. Because the
            tools they use were never designed to show them. Each platform optimizes for its
            own metrics, its own attribution window, its own definition of success. No one is
            looking across the entire landscape and asking the only question that matters:
          </p>
          <p className="text-white italic text-xl">Did this money grow the business?</p>
        </Section>

        <Quote>
          "What gets measured gets managed. What gets measured <em>wrong</em> gets managed
          into the ground."
        </Quote>

        {/* 03 — The Severed Link */}
        <Section number="03" title="The Severed Link">
          <p>
            The most consequential failure in modern advertising is not creative. It's not
            targeting. It's not even waste.
          </p>
          <p>It's the severed link between marketing activity and financial outcome.</p>
          <p>
            CMOs present reach and frequency. CFOs want revenue attribution. The two
            languages never meet. Marketing budgets get cut not because they don't work, but
            because no one can prove they do. And agencies — the entities that should bridge
            this gap — have neither the tools nor the incentive to build that bridge. Their
            fee is a percentage of spend. More spend, more fee. Waste is not their problem.
            It's their margin.
          </p>
          <p>This misalignment is the root cause. Everything else is a symptom.</p>
        </Section>

        {/* 04 — The Shift */}
        <Section number="04" title="The Shift">
          <p>
            Something changed in 2024 and 2025 that made the impossible suddenly inevitable.
          </p>
          <p>
            Google, Anthropic, Amazon, and Meta each released protocols — MCP, A2A — that
            allow AI agents to communicate with advertising platforms the same way humans do.
            Not through dashboards. Through direct, authenticated, machine-speed connections.
          </p>
          <p>
            For the first time in the history of the industry, it became technically possible
            for an autonomous system to ingest data from every major ad platform
            simultaneously, analyze it through a unified mathematical framework, detect waste
            in real-time, attribute outcomes to financial results, and present a human with a
            single question: <em>Do you approve this optimization?</em>
          </p>
          <p>Not in 103 days. In under 4 seconds.</p>
          <p>
            This is not an incremental improvement. This is a phase transition. The
            equivalent of going from horse-drawn carriages to internal combustion. The
            infrastructure layer that advertising never had is now possible to build.
          </p>
          <p>So we built it.</p>
        </Section>

        {/* 05 — Plinth */}
        <Section number="05" title="Plinth">
          <p>Plinth is A2A infrastructure for advertising intelligence.</p>
          <p>
            Not a dashboard. Not an analytics tool. Not another SaaS that generates prettier
            charts from the same data everyone already has.
          </p>
          <p>
            Plinth is the invisible layer between platforms and decisions. Five engines.
            Thirty-nine specialized AI skills. Sixty-three MCP tools. Running continuously,
            across every major advertising platform — Google, Meta, TikTok, Amazon, DV360 —
            detecting waste, optimizing allocation, and attributing results to business
            outcomes using the same mathematical frameworks that were previously locked inside
            academic papers and consulting decks that cost six figures.
          </p>
          <p>
            Shapley attribution. Hill saturation curves. Bayesian media mix modeling. Waste
            waterfall analysis. Cross-platform supply chain audits.
          </p>
          <p>
            All of it running autonomously. All of it producing a single artifact: a
            scorecard that tells you exactly how much money was wasted, how much was
            recovered, and what it means for your P&L.
          </p>
          <p>The human doesn't operate the system. The human approves the results.</p>
        </Section>

        {/* 06 — The Compounding Engine */}
        <Section number="06" title="The Compounding Engine">
          <p>
            Here's what no optimization tool in the market does: get smarter with every cycle.
          </p>
          <p>
            Each time Plinth's five engines run, every skill recalibrates against the results
            of the previous cycle. The waste waterfall narrows. The Hill saturation curves
            sharpen. The Shapley attribution model reweights based on actual conversion data,
            not last-click proxies. Media mix recommendations shift as the system learns which
            channels, audiences, and creatives compound over time — and which ones decay.
          </p>
          <p>
            This is not batch optimization on a monthly cycle. This is continuous
            reconfiguration. Every pipeline execution produces a new state of the world:
            updated recovery targets, refined channel allocation, recalculated contribution to
            sales, brand equity, and share of market. The system doesn't just find waste — it
            progressively maximizes business outcomes across every dimension that matters to a
            CFO: revenue, margin, customer lifetime value, market share.
          </p>
          <p>
            Think of it as compound interest applied to media intelligence. Cycle one recovers
            the obvious waste. Cycle two optimizes allocation. Cycle three begins to predict
            diminishing returns before they happen. By cycle ten, the system knows more about
            a brand's cross-platform dynamics than any team of analysts could learn in a year.
          </p>
          <p>
            Traditional agencies review performance quarterly. The best ones, monthly. Plinth
            reconfigures on every run — and every run makes the next one more valuable.
          </p>
        </Section>

        {/* 07 — The Agent That Delivers */}
        <Section number="07" title="The Agent That Delivers">
          <p>
            There's a moment in every agency relationship that quietly erodes trust. It's not
            the strategy. It's not the media buy. It's the Monday morning after a campaign
            ends, when the client asks: <em>"Where's the report?"</em>
          </p>
          <p>
            The answer, in most agencies, is a version of this: the media team pulled the
            numbers on Thursday. The analytics person formatted them on Friday. The account
            director rewrote the narrative on Monday. The designer made it presentable on
            Tuesday. The senior partner reviewed it on Wednesday. The client received it eight
            to ten business days after the campaign ended — a deck assembled by four different
            people across three different teams, stitched together from templates originally
            built for a different client, with insights that are two weeks stale by the time
            anyone reads them.
          </p>
          <p>
            Seventy-eight percent of agencies require at least three people to touch a single
            client report. The average account manager spends 4 or more hours per client per
            month on reporting alone — and that's the industry standard. Across a portfolio of
            twenty clients, that's eighty hours a month. Two full work weeks. Spent not on
            strategy, not on optimization, not on growth — on assembling documents.
          </p>
          <p>
            Plinth's Human Feedback Loop doesn't just present a scorecard and wait for
            approval. It deploys an agent — an intelligence layer between the engines and the
            human — that interprets every result, translates mathematical outputs into
            executive language, flags what matters, contextualizes what changed since the last
            cycle, and generates the deliverables that agencies take days to produce.
          </p>
          <p>
            PowerPoint decks with branded recommendations. Excel models with scenario
            comparisons. PDF reports with attribution waterfalls. Word documents with
            strategic learnings. Campaign briefs ready for the next flight. Quarterly business
            reviews backed by real financial reconciliation — not estimated reach metrics
            repackaged as business impact.
          </p>
          <p>
            All of it generated in the same pipeline run that detected the waste and optimized
            the allocation. Not eight days later. Not assembled by four people. Not stitched
            from templates. Produced by a system that has the full context of every platform,
            every campaign, every dollar, and every result — synthesized into deliverables
            that a CMO can present to a board, and a CFO can reconcile against the P&L.
          </p>
          <p>
            The agent doesn't just hand over files. It explains them. It highlights what the
            human should pay attention to. It recommends what to approve, what to reject, and
            why. The human's authorization is the final gate — and it's an informed gate, not
            a rubber stamp on a deck they barely had time to read.
          </p>
          <p>
            This is the part of the system that makes the intelligence <em>usable</em>.
            Because intelligence without delivery is just data. And data without context is
            just noise.
          </p>
        </Section>

        {/* 08 — The Three Steps */}
        <Section number="08" title="The Three Steps">
          <p>Every Plinth cycle follows the same logic:</p>
          <div className="space-y-6 my-4">
            <div>
              <p className="text-white font-semibold">
                Step 01 — Understand the current state.
              </p>
              <p>
                Ingest live data from every connected platform. Normalize it. Detect
                anomalies, waste patterns, attribution gaps, supply chain opacity.
              </p>
            </div>
            <div>
              <p className="text-white font-semibold">
                Step 02 — Predict the optimal state.
              </p>
              <p>
                Run scenario planning through media mix models. Calculate the mathematically
                optimal allocation across channels, audiences, and formats. Quantify the delta
                between current and optimal.
              </p>
            </div>
            <div>
              <p className="text-white font-semibold">
                Step 03 — Control the future state.
              </p>
              <p>
                Generate specific, actionable optimizations. Produce the deliverables. Present
                everything through the human feedback loop. On approval, execute. On
                rejection, learn and recalibrate. Either way, the next cycle starts smarter
                than the last.
              </p>
            </div>
          </div>
          <p className="text-white font-semibold text-lg">
            Understand. Predict. Control. Deliver. Compound.
          </p>
          <p>
            This is not new logic. It's the OODA loop that every military strategist, every
            trading floor, every autonomous system has used for decades. It has simply never
            been applied to advertising at infrastructure scale — and it has never been paired
            with a delivery layer that turns intelligence into artifacts a human can act on in
            the same session.
          </p>
        </Section>

        {/* 09 — Why Outcome-Based */}
        <Section number="09" title="Why Outcome-Based">
          <p>
            We don't charge for seats. We don't charge for access. We don't charge retainers.
          </p>
          <p>
            Plinth charges a percentage of verified waste recovery. If we don't find waste, we
            don't earn. If we find it and recover it, we take between 3.5% and 5% of the
            recovered amount.
          </p>
          <p>
            This is the most radical part of the thesis:{' '}
            <strong className="text-white">
              the system's economics are perfectly aligned with the client's economics.
            </strong>{' '}
            There is no incentive to inflate spend. No incentive to obscure performance. No
            incentive to extend timelines.
          </p>
          <p>
            When your revenue model punishes you for failing and rewards you only for
            producing measurable results, you build a very different kind of system than the
            industry has ever seen.
          </p>
        </Section>

        <Quote author="Charlie Munger">
          "Show me the incentive and I will show you the outcome."
        </Quote>

        {/* 10 — The Inevitable Math */}
        <Section number="10" title="The Inevitable Math">
          <p>Here is the math that makes this inevitable:</p>
          <p>
            Latin America's digital ad market surpassed $40 billion in 2025. Mexico alone:
            $5.8 billion. Growing at 12%+ year over year.
          </p>
          <p>
            If 15% of that spend is wasted — a conservative estimate — that's $6 billion
            recoverable annually in LATAM alone. At a 4% recovery fee, that's a $240 million
            revenue opportunity from waste alone. Before optimization. Before attribution.
            Before any of the strategic value the engines produce.
          </p>
          <p>
            Globally, at $650 billion in digital spend and 15-25% waste, the recoverable
            amount exceeds $100 billion per year. The infrastructure layer that captures even a
            fraction of that becomes one of the most valuable companies in advertising
            technology.
          </p>
          <p>
            No one is building this layer. Not the agencies. Not the platforms. Not the
            consultancies. The agencies can't — it would cannibalize their retainer model. The
            platforms won't — they benefit from fragmented measurement. The consultancies
            don't — they sell time, not infrastructure.
          </p>
          <p>
            The gap exists because the incentives of every incumbent prevent them from filling
            it.
          </p>
        </Section>

        {/* 11 — What Exists Today */}
        <Section number="11" title="What Exists Today">
          <p>Plinth is not a pitch deck. It is deployed in production.</p>
          <p>
            Five engines processing 39 skills across every major ad platform. An autonomous
            agent mesh that executes a complete intelligence cycle — from waste detection
            through Shapley attribution to executive-ready deliverables — in a single pipeline
            run. A compounding optimization system that recalibrates on every cycle,
            progressively maximizing recovery and business outcomes. A human feedback loop with
            an intelligence agent that interprets results, generates board-ready documents, and
            ensures every approval is informed. A billing engine that calculates fees only on
            verified recovery.
          </p>
          <p>
            81 infrastructure tests passing. 400+ unit tests. 13 frontend pages live. Three
            stress-tested MAU scenarios demonstrating 34x to 47x ROI on recovery fees.
            Persistent data storage for client uploads — sell-in, sell-out, digital sales —
            that enriches every subsequent pipeline run. Google Drive and OneDrive connectors
            that import client data directly into the intelligence cycle.
          </p>
          <p>
            The architecture is A2A-native. Any AI agent on the internet can discover Plinth
            through its Agent Card, evaluate its capabilities, negotiate terms through
            machine-readable pricing, and execute a pipeline — all without a human in the
            loop.
          </p>
          <p>
            This is not a product waiting to be built. This is infrastructure waiting to be
            connected.
          </p>
        </Section>

        {/* 12 — The World After */}
        <Section number="12" title="The World After">
          <p>
            I think about what happens when the first fifty brands in Latin America connect to
            Plinth. When the data from those fifty brands creates cross-client benchmarks that
            no single agency, no single platform, no consulting firm has ever been able to
            produce. When the compounding engine has run hundreds of cycles across an industry
            vertical and the waste detection model has seen patterns that no human analyst
            would ever spot — because no human analyst has access to cross-client,
            cross-platform, longitudinally compounded data at that scale.
          </p>
          <p>
            I think about what happens when the first AI agent — not a human, an agent —
            discovers Plinth's Agent Card, evaluates its 39 skills, and autonomously contracts
            a waste audit for its principal. No RFP. No pitch. No 90-day procurement cycle.
            Just two machines agreeing on terms and executing. And then receiving a complete
            intelligence package — scorecard, attribution model, optimization recommendations,
            and a board-ready deck — before a human even knows the engagement started.
          </p>
          <p>That moment is not five years away. The protocols exist today. The infrastructure is live. The only variable is adoption.</p>
          <p>
            The advertising industry spent fifty years building a model where humans operate
            platforms on behalf of other humans, taking a fee for the privilege. That model is
            about to be compressed into an infrastructure layer where agents operate on behalf
            of brands, taking a fee only when they produce results — and delivering the
            intelligence, the analysis, and the artifacts that used to require entire teams and
            weeks of calendar time.
          </p>
          <p>
            Every industry that has gone through this compression — travel, finance,
            logistics — produced companies worth tens of billions of dollars. Advertising is
            the last trillion-dollar industry that hasn't.
          </p>
        </Section>

        {/* 13 — Why I'm Building This */}
        <Section number="13" title="Why I'm Building This">
          <p>
            I'm not building Plinth because I'm angry at agencies. I ran one. I know the
            people inside them. Most of them are talented, overworked, and trapped in a model
            that doesn't let them do their best work. I've watched brilliant strategists spend
            their Mondays reformatting pivot tables. I've seen media planners who could
            redesign a brand's entire channel architecture if only they weren't buried in
            cross-platform reconciliation spreadsheets that nobody reads past the second tab.
          </p>
          <p>
            I'm building Plinth because I believe the intelligence exists — in academic
            literature, in mathematical frameworks, in the protocols that just became available
            — to fundamentally change how advertising creates value. And I believe that
            intelligence should live in infrastructure, not in people's heads. Not because
            people don't matter. Because when the intelligence is in infrastructure,{' '}
            <em>
              people can finally focus on what actually matters
            </em>
            : strategy, creativity, and growth.
          </p>
          <p>
            The goal was never to replace agencies. The goal is to make the entire concept of
            "operating a platform" obsolete. So that every dollar a brand spends is
            accountable, every optimization is mathematically grounded, every deliverable is
            generated at the speed of insight rather than the speed of bureaucracy, and every
            human in the chain is free to do work that only humans can do.
          </p>
          <p>Plinth is the foundation. We're just getting started.</p>
        </Section>

        {/* Author signature */}
        <motion.div {...fadeUp} className="text-center py-20 md:py-28">
          <p className="text-sm text-zinc-500 tracking-widest uppercase">axiom nexar</p>
          <p className="text-xs text-zinc-600 mt-1">founder, plinth by polanyi</p>
          <p className="text-xs text-zinc-700 mt-0.5">2026</p>
        </motion.div>
      </div>
    </div>
  );
}
