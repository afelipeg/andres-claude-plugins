// @ts-nocheck
/*
 * Design: "Dark Infrastructure" — Hero with animated particle background
 * Layout: Centered hero with animated dark canvas background
 * Left: large headline + subtitle + CTA buttons
 * Right: code snippet (desktop only)
 * Background: AnimatedGradientBackground with particles + grid + glow
 */
import { motion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import AnimatedGradientBackground from "./AnimatedGradientBackground";

// ─── Code Tokenizer ──────────────────────────────────────────
interface CodeToken {
  text: string;
  type: "keyword" | "string" | "comment" | "number" | "method" | "plain" | "bracket" | "property";
}

function tokenizeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const commentMatch = remaining.match(/^(\/\/.*)$/);
    if (commentMatch) {
      tokens.push({ text: commentMatch[1], type: "comment" });
      remaining = remaining.slice(commentMatch[1].length);
      continue;
    }
    const stringMatch = remaining.match(/^('[^']*'|"[^"]*")/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[1], type: "string" });
      remaining = remaining.slice(stringMatch[1].length);
      continue;
    }
    const keywordMatch = remaining.match(/^(import|from|const|await|new|async)/);
    if (keywordMatch) {
      tokens.push({ text: keywordMatch[1], type: "keyword" });
      remaining = remaining.slice(keywordMatch[1].length);
      continue;
    }
    const numberMatch = remaining.match(/^(\d[\d_,.]*)/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[1], type: "number" });
      remaining = remaining.slice(numberMatch[1].length);
      continue;
    }
    const methodMatch = remaining.match(/^(\.\w+)/);
    if (methodMatch) {
      tokens.push({ text: methodMatch[1], type: "method" });
      remaining = remaining.slice(methodMatch[1].length);
      continue;
    }
    const bracketMatch = remaining.match(/^([{}()\[\]])/);
    if (bracketMatch) {
      tokens.push({ text: bracketMatch[1], type: "bracket" });
      remaining = remaining.slice(bracketMatch[1].length);
      continue;
    }
    tokens.push({ text: remaining[0], type: "plain" });
    remaining = remaining.slice(1);
  }
  return tokens;
}

const tokenColors: Record<CodeToken["type"], string> = {
  keyword: "text-zinc-400 font-medium",
  string: "text-zinc-200",
  comment: "text-zinc-600",
  number: "text-white font-medium",
  method: "text-zinc-300",
  plain: "text-zinc-400",
  bracket: "text-zinc-500",
  property: "text-zinc-300",
};

const codeLines = [
  "// Connect your agent to Plinth",
  "import { Plinth } from '@plinth/sdk';",
  "",
  "const agent = new Plinth({",
  "  apiKey: 'oa_live_...',",
  "  protocol: 'a2a'",
  "});",
  "",
  "// Detect waste across 6 ad platforms",
  "const analysis = await agent.engines.wasteWaterfall({",
  "  budget: 2_000_000,",
  "  platforms: ['meta', 'google', 'tiktok',",
  "              'dv360', 'amazon', 'linkedin'],",
  "  attribution: 'shapley'",
  "});",
  "",
  "// Result: $550K waste detected → ROAS 4.5x",
  "console.log(analysis.savings);  // $550,000",
  "console.log(analysis.newROAS);  // 4.52",
];

const tagline = "The ad agency OS for AI agents. Humans brief, curated agents do the work.";

export default function HeroSection() {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= tagline.length) {
        setDisplayedText(tagline.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Animated dark particle background */}
      <AnimatedGradientBackground
        particleCount={90}
        speed={1.0}
        enabled={true}
        glowIntensity={0.07}
      />

      {/* Bottom fade to page background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 z-[2]"
        style={{ background: "linear-gradient(to top, #09090B, transparent)" }}
      />

      <div className="container relative z-10 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-8">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-zinc-400 tracking-wide">MCP-First · Agent-to-Agent Protocol</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
              Plinth is the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">
                A2A protocol infrastructure
              </span>{" "}
              for advertising intelligence
            </h1>

            <div className="h-16 mb-8">
              <p className="text-lg lg:text-xl text-zinc-400 font-light leading-relaxed">
                {displayedText}
                <span className={`inline-block w-[2px] h-5 bg-white ml-0.5 align-middle transition-opacity ${showCursor ? "opacity-100" : "opacity-0"}`} />
              </p>
            </div>

            <p className="text-base text-zinc-500 mb-10 max-w-lg leading-relaxed">
              In 12-18 months, CMO and marketers won't hire an agency and sit in a room watching a PowerPoint deck. They'll say "optimize my Q3 for ROAS 4.5x with $2M budget" — and an orchestrator agent will handle the rest.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="mailto:hello@polanyi.tech"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-all duration-200 text-sm"
              >
                Contact Us
                <ArrowRight size={16} />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/15 text-white font-medium rounded-lg hover:bg-white/[0.05] transition-all duration-200 text-sm"
              >
                <Terminal size={16} />
                See How It Works
              </a>
            </div>
          </motion.div>

          {/* Right: Code snippet */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="hidden lg:block"
          >
            <div className="relative">
              {/* Subtle glow behind card */}
              <div
                className="absolute -inset-8 rounded-3xl opacity-20"
                style={{ background: "radial-gradient(ellipse at center, rgba(255,255,255,0.08), transparent 70%)" }}
              />
              <div
                className="relative rounded-xl border border-white/[0.08] overflow-hidden"
                style={{ background: "rgba(9,9,11,0.8)", backdropFilter: "blur(20px)" }}
              >
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-zinc-800" />
                    <div className="w-3 h-3 rounded-full bg-zinc-800" />
                    <div className="w-3 h-3 rounded-full bg-zinc-800" />
                  </div>
                  <span className="text-xs text-zinc-600 font-mono ml-2">agent.ts</span>
                </div>
                {/* Code */}
                <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto">
                  <code className="font-mono">
                    {codeLines.map((line, i) => (
                      <div key={i} className="flex">
                        <span className="text-zinc-700 select-none w-8 text-right mr-4 flex-shrink-0 text-[12px]">{i + 1}</span>
                        <span>
                          {tokenizeLine(line).map((token, j) => (
                            <span key={j} className={tokenColors[token.type]}>{token.text}</span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
