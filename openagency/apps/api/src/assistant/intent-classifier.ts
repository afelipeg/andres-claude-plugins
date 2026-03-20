// ─── Intent Classifier ──────────────────────────────────────────────
// Fast keyword/pattern-based intent detection for the Plinth Assistant.
// No LLM call — pure regex + heuristics for sub-millisecond classification.

export interface OptimizeParams {
  target_metric?: string;    // "ROAS", "CPA", "ROI"
  target_value?: number;     // 4.5
  budget?: number;           // 2000000
  timeframe?: string;        // "Q3", "next month"
  channels?: string[];       // ["google_ads", "meta"]
  constraints?: string[];    // ["maintain brand spend"]
}

export interface AnalyzeParams {
  scope?: string;            // "waste", "spend", "performance"
  platform?: string;         // "google_ads", "meta", etc.
  timeframe?: string;        // "last month", "Q2"
}

export interface ReportParams {
  format?: 'pdf' | 'excel' | 'ppt' | 'docx';
  report_type?: string;      // "executive_summary", "campaign_performance", etc.
  timeframe?: string;
}

export interface CompareParams {
  period_a?: string;         // "Q1", "January"
  period_b?: string;         // "Q2", "February"
  metric?: string;           // "ROAS", "spend"
}

export type AssistantIntent =
  | { type: 'conversation' }
  | { type: 'optimize'; params: OptimizeParams }
  | { type: 'analyze'; params: AnalyzeParams }
  | { type: 'report'; params: ReportParams }
  | { type: 'compare'; params: CompareParams };

// ─── Metric patterns ──────────────────────────────────────────────────

const METRIC_PATTERNS: Array<{ re: RegExp; metric: string }> = [
  { re: /\broas\b/i, metric: 'ROAS' },
  { re: /\bcpa\b/i, metric: 'CPA' },
  { re: /\broi\b/i, metric: 'ROI' },
  { re: /\bctr\b/i, metric: 'CTR' },
  { re: /\bcpc\b/i, metric: 'CPC' },
  { re: /\bcpm\b/i, metric: 'CPM' },
  { re: /\bconversion\s*rate\b/i, metric: 'conversion_rate' },
  { re: /\bwaste\b/i, metric: 'waste' },
];

const CHANNEL_PATTERNS: Array<{ re: RegExp; channel: string }> = [
  { re: /\bgoogle\s*ads?\b/i, channel: 'google_ads' },
  { re: /\bmeta\b|\bfacebook\b|\binstagram\b/i, channel: 'meta' },
  { re: /\bdv360\b|\bdisplay\s*&?\s*video/i, channel: 'dv360' },
  { re: /\btiktok\b/i, channel: 'tiktok' },
  { re: /\bamazon\s*ads?\b/i, channel: 'amazon_ads' },
  { re: /\bsearch\b/i, channel: 'search' },
  { re: /\bdisplay\b/i, channel: 'display' },
  { re: /\bvideo\b/i, channel: 'video' },
  { re: /\bsocial\b/i, channel: 'social' },
];

const TIMEFRAME_PATTERNS: Array<{ re: RegExp; timeframe: string }> = [
  { re: /\bq1\b/i, timeframe: 'Q1' },
  { re: /\bq2\b/i, timeframe: 'Q2' },
  { re: /\bq3\b/i, timeframe: 'Q3' },
  { re: /\bq4\b/i, timeframe: 'Q4' },
  { re: /\bnext\s+month\b/i, timeframe: 'next_month' },
  { re: /\blast\s+month\b/i, timeframe: 'last_month' },
  { re: /\bthis\s+month\b/i, timeframe: 'this_month' },
  { re: /\bnext\s+quarter\b/i, timeframe: 'next_quarter' },
  { re: /\blast\s+quarter\b/i, timeframe: 'last_quarter' },
  { re: /\bjanuary\b/i, timeframe: 'January' },
  { re: /\bfebruary\b/i, timeframe: 'February' },
  { re: /\bmarch\b/i, timeframe: 'March' },
  { re: /\bapril\b/i, timeframe: 'April' },
  { re: /\bmay\b/i, timeframe: 'May' },
  { re: /\bjune\b/i, timeframe: 'June' },
  { re: /\bjuly\b/i, timeframe: 'July' },
  { re: /\baugust\b/i, timeframe: 'August' },
  { re: /\bseptember\b/i, timeframe: 'September' },
  { re: /\boctober\b/i, timeframe: 'October' },
  { re: /\bnovember\b/i, timeframe: 'November' },
  { re: /\bdecember\b/i, timeframe: 'December' },
];

const FORMAT_PATTERNS: Array<{ re: RegExp; format: 'pdf' | 'excel' | 'ppt' | 'docx' }> = [
  { re: /\bpdf\b/i, format: 'pdf' },
  { re: /\bexcel\b|\bxlsx?\b|\bspreadsheet\b/i, format: 'excel' },
  { re: /\bppt\b|\bpptx\b|\bpowerpoint\b|\bdeck\b|\bslides?\b|\bpresentation\b/i, format: 'ppt' },
  { re: /\bdocx?\b|\bword\b|\bdocument\b/i, format: 'docx' },
];

// ─── Number extraction ──────────────────────────────────────────────

function extractNumber(text: string, context: RegExp): number | undefined {
  const match = text.match(context);
  if (!match) return undefined;
  // Look for a number near the context match
  const idx = text.indexOf(match[0]);
  const surrounding = text.slice(Math.max(0, idx - 30), idx + match[0].length + 30);
  const numMatch = surrounding.match(/(\d[\d,]*\.?\d*)\s*[xX%]?/);
  if (!numMatch) return undefined;
  return parseFloat(numMatch[1].replace(/,/g, ''));
}

function extractBudget(text: string): number | undefined {
  // "$2M", "$2,000,000", "2 million budget", "$500K", "budget of $1.5M"
  const patterns = [
    /\$\s*([\d,.]+)\s*[mM]\b/,                     // $2M, $1.5m
    /\$\s*([\d,.]+)\s*[kK]\b/,                     // $500K
    /\$\s*([\d,]+(?:\.\d+)?)\b/,                   // $2,000,000 or $2000000
    /([\d,.]+)\s*million\s*(?:dollar|budget|spend)/i,
    /([\d,.]+)\s*(?:thousand|k)\s*(?:dollar|budget|spend)/i,
    /budget\s*(?:of|:)?\s*\$?\s*([\d,.]+)\s*([mMkK])?/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;
    let value = parseFloat(m[1].replace(/,/g, ''));
    // Check for M/K suffix
    const suffix = m[2] ?? '';
    if (/[mM]/.test(suffix) || /million/i.test(text.slice(text.indexOf(m[0]), text.indexOf(m[0]) + m[0].length + 20))) {
      value *= 1_000_000;
    } else if (/[kK]/.test(suffix) || /thousand/i.test(text.slice(text.indexOf(m[0]), text.indexOf(m[0]) + m[0].length + 20))) {
      value *= 1_000;
    }
    // If match is $2M pattern, suffix is already handled
    if (pat.source.includes('[mM]') && !suffix) value *= 1_000_000;
    if (pat.source.includes('[kK]') && !suffix) value *= 1_000;
    return value;
  }
  return undefined;
}

function extractMetricValue(text: string): { metric?: string; value?: number } {
  for (const { re, metric } of METRIC_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    // Look for a number near the metric
    const idx = text.indexOf(m[0]);
    const after = text.slice(idx + m[0].length, idx + m[0].length + 30);
    const before = text.slice(Math.max(0, idx - 20), idx);
    // "ROAS 4.5x" or "4.5x ROAS" or "ROAS of 4.5" or "ROAS to 4.5"
    const numAfter = after.match(/\s*(?:of|to|at|=|:)?\s*([\d,.]+)\s*[xX%]?/);
    const numBefore = before.match(/([\d,.]+)\s*[xX%]?\s*$/);
    const numStr = numAfter?.[1] ?? numBefore?.[1];
    if (numStr) {
      return { metric, value: parseFloat(numStr.replace(/,/g, '')) };
    }
    return { metric };
  }
  return {};
}

function extractChannels(text: string): string[] {
  const channels: string[] = [];
  for (const { re, channel } of CHANNEL_PATTERNS) {
    if (re.test(text)) channels.push(channel);
  }
  return channels;
}

function extractTimeframes(text: string): string[] {
  const tfs: string[] = [];
  for (const { re, timeframe } of TIMEFRAME_PATTERNS) {
    if (re.test(text)) tfs.push(timeframe);
  }
  return tfs;
}

function extractFormat(text: string): 'pdf' | 'excel' | 'ppt' | 'docx' | undefined {
  for (const { re, format } of FORMAT_PATTERNS) {
    if (re.test(text)) return format;
  }
  return undefined;
}

function extractConstraints(text: string): string[] {
  const constraints: string[] = [];
  // "maintain X", "keep X", "don't change X", "protect X"
  const maintainRe = /(?:maintain|keep|protect|preserve|don'?t\s+(?:change|touch|reduce))\s+(.{5,40}?)(?:\.|,|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = maintainRe.exec(text)) !== null) {
    if (m[1]) constraints.push(m[1].trim());
  }
  return constraints;
}

// ─── Intent detection ──────────────────────────────────────────────

const OPTIMIZE_SIGNALS = /\b(?:optimi[sz]e|improve|boost|increase|maximize|maximise|grow|scale|uplift|enhance|target)\b/i;
const ANALYZE_SIGNALS = /\b(?:analy[sz]e|audit|review|assess|diagnose|examine|inspect|evaluate|check|scan|find waste|detect waste|waste analysis)\b/i;
const REPORT_SIGNALS = /\b(?:generate|create|build|make|produce|export|send)\b.*\b(?:report|deck|scorecard|summary|brief|document|presentation|spreadsheet|pdf|excel|ppt)\b/i;
const REPORT_SIGNALS_ALT = /\b(?:report|deck|scorecard|summary|brief)\b.*\b(?:for|about|of|on)\b/i;
const COMPARE_SIGNALS = /\b(?:compare|comparison|versus|vs\.?|diff(?:erence)?|benchmark|against)\b/i;

export function classifyIntent(message: string): AssistantIntent {
  const text = message.trim();
  if (!text) return { type: 'conversation' };

  // ── Compare (check first — "compare Q1 vs Q2" should not match optimize) ──
  if (COMPARE_SIGNALS.test(text)) {
    const tfs = extractTimeframes(text);
    const { metric } = extractMetricValue(text);
    return {
      type: 'compare',
      params: {
        period_a: tfs[0],
        period_b: tfs[1],
        metric,
      },
    };
  }

  // ── Report ──
  if (REPORT_SIGNALS.test(text) || REPORT_SIGNALS_ALT.test(text)) {
    const tfs = extractTimeframes(text);
    const format = extractFormat(text);

    // Detect report type from keywords
    let report_type = 'full_report';
    if (/executive\s*summary/i.test(text)) report_type = 'executive_summary';
    else if (/campaign\s*performance/i.test(text)) report_type = 'campaign_performance';
    else if (/budget\s*analysis/i.test(text)) report_type = 'budget_analysis';
    else if (/media\s*plan/i.test(text)) report_type = 'media_plan';
    else if (/monthly/i.test(text)) report_type = 'monthly';

    return {
      type: 'report',
      params: {
        format,
        report_type,
        timeframe: tfs[0],
      },
    };
  }

  // ── Optimize ──
  if (OPTIMIZE_SIGNALS.test(text)) {
    const { metric, value } = extractMetricValue(text);
    const budget = extractBudget(text);
    const tfs = extractTimeframes(text);
    const channels = extractChannels(text);
    const constraints = extractConstraints(text);

    return {
      type: 'optimize',
      params: {
        target_metric: metric,
        target_value: value,
        budget,
        timeframe: tfs[0],
        channels: channels.length > 0 ? channels : undefined,
        constraints: constraints.length > 0 ? constraints : undefined,
      },
    };
  }

  // ── Analyze ──
  if (ANALYZE_SIGNALS.test(text)) {
    const tfs = extractTimeframes(text);
    const channels = extractChannels(text);

    let scope = 'performance';
    if (/waste/i.test(text)) scope = 'waste';
    else if (/spend/i.test(text)) scope = 'spend';
    else if (/budget/i.test(text)) scope = 'budget';

    return {
      type: 'analyze',
      params: {
        scope,
        platform: channels[0],
        timeframe: tfs[0],
      },
    };
  }

  // ── Default: conversation ──
  return { type: 'conversation' };
}
