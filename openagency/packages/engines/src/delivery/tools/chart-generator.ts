// ─── Chart Generator ─────────────────────────────────────────────────
// Pure SVG chart generation — no native dependencies, works on Railway.
// Produces SVG strings for bar, pie, line, stacked-bar, and waterfall charts.
// Also exports structured data helpers for pptxgenjs native charts.

// ─── Types ───────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  series?: string;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  showLegend?: boolean;
  showValues?: boolean;
  colors?: string[];
  /** Horizontal bars instead of vertical (bar chart only) */
  horizontal?: boolean;
}

export interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'stacked_bar' | 'waterfall';
  title: string;
  data: ChartDataPoint[];
  options?: ChartOptions;
}

/** Pre-structured data for pptxgenjs native chart API */
export interface PptxChartSeries {
  name: string;
  labels: string[];
  values: number[];
}

// ─── Brand palette ──────────────────────────────────────────────────

export const CHART_PALETTE = [
  '#1e40af', // blue
  '#059669', // green
  '#dc2626', // red
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#0891b2', // cyan
  '#84cc16', // lime
];

const CHART_BG = '#FFFFFF';
const CHART_TEXT = '#333333';
const CHART_GRID = '#E5E7EB';
const CHART_LABEL = '#6b7280';

// ─── SVG helpers ────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

// ─── Bar Chart ──────────────────────────────────────────────────────

function generateBarChart(chart: ChartData): string {
  const opts = chart.options ?? {};
  const W = opts.width ?? 600;
  const H = opts.height ?? 400;
  const colors = opts.colors ?? CHART_PALETTE;
  const showValues = opts.showValues !== false;
  const data = chart.data;
  if (data.length === 0) return emptySvg(W, H, chart.title);

  const padTop = 50;
  const padBottom = 80;
  const padLeft = 70;
  const padRight = 30;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const barW = Math.min(50, (chartW / data.length) * 0.6);
  const gap = (chartW - barW * data.length) / (data.length + 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="${CHART_BG}"/>`;

  // Title
  svg += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="${CHART_TEXT}">${esc(chart.title)}</text>`;

  // Y-axis gridlines
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = padTop + (chartH / ySteps) * i;
    const val = maxVal - (maxVal / ySteps) * i;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${W - padRight}" y2="${y}" stroke="${CHART_GRID}" stroke-width="1"/>`;
    svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${fmt(val)}</text>`;
  }

  // Bars
  data.forEach((d, i) => {
    const x = padLeft + gap + i * (barW + gap);
    const barH = (Math.abs(d.value) / maxVal) * chartH;
    const y = padTop + chartH - barH;
    const color = d.color ?? colors[i % colors.length]!;

    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="2"/>`;

    // Value label
    if (showValues) {
      svg += `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="${CHART_TEXT}">${fmt(d.value)}</text>`;
    }

    // X-axis label (rotated if long)
    const labelX = x + barW / 2;
    const labelY = padTop + chartH + 14;
    if (d.label.length > 8) {
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}" transform="rotate(-35,${labelX},${labelY})">${esc(d.label)}</text>`;
    } else {
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${esc(d.label)}</text>`;
    }
  });

  // Baseline
  svg += `<line x1="${padLeft}" y1="${padTop + chartH}" x2="${W - padRight}" y2="${padTop + chartH}" stroke="${CHART_TEXT}" stroke-width="1"/>`;
  svg += `</svg>`;
  return svg;
}

// ─── Pie / Donut Chart ──────────────────────────────────────────────

function generatePieChart(chart: ChartData): string {
  const opts = chart.options ?? {};
  const W = opts.width ?? 500;
  const H = opts.height ?? 400;
  const colors = opts.colors ?? CHART_PALETTE;
  const showLegend = opts.showLegend !== false;
  const data = chart.data.filter(d => d.value > 0);
  if (data.length === 0) return emptySvg(W, H, chart.title);

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = showLegend ? W * 0.35 : W / 2;
  const cy = H / 2 + 10;
  const r = Math.min(cx - 30, cy - 50);
  const innerR = r * 0.55; // donut

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="${CHART_BG}"/>`;
  svg += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="${CHART_TEXT}">${esc(chart.title)}</text>`;

  let startAngle = -Math.PI / 2;
  data.forEach((d, i) => {
    const pct = d.value / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = d.color ?? colors[i % colors.length]!;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    svg += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2} Z" fill="${color}"/>`;

    // Percentage label on the arc midpoint
    const midAngle = startAngle + angle / 2;
    const labelR = (r + innerR) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    if (pct >= 0.05) {
      svg += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="white">${(pct * 100).toFixed(0)}%</text>`;
    }

    startAngle = endAngle;
  });

  // Legend
  if (showLegend) {
    const legendX = W * 0.68;
    data.forEach((d, i) => {
      const ly = 60 + i * 22;
      const color = d.color ?? colors[i % colors.length]!;
      svg += `<rect x="${legendX}" y="${ly}" width="12" height="12" rx="2" fill="${color}"/>`;
      svg += `<text x="${legendX + 18}" y="${ly + 10}" font-family="Arial,sans-serif" font-size="11" fill="${CHART_TEXT}">${esc(d.label)} (${fmt(d.value)})</text>`;
    });
  }

  svg += `</svg>`;
  return svg;
}

// ─── Line Chart ─────────────────────────────────────────────────────

function generateLineChart(chart: ChartData): string {
  const opts = chart.options ?? {};
  const W = opts.width ?? 600;
  const H = opts.height ?? 400;
  const colors = opts.colors ?? CHART_PALETTE;
  const showValues = opts.showValues ?? false;
  const data = chart.data;
  if (data.length === 0) return emptySvg(W, H, chart.title);

  const padTop = 50;
  const padBottom = 70;
  const padLeft = 70;
  const padRight = 30;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  // Group by series
  const seriesMap = new Map<string, ChartDataPoint[]>();
  for (const d of data) {
    const key = d.series ?? 'default';
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    seriesMap.get(key)!.push(d);
  }

  const allValues = data.map(d => d.value);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  // Use labels from the first series for the x-axis
  const xLabels = [...new Set(data.map(d => d.label))];
  const xStep = chartW / Math.max(xLabels.length - 1, 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="${CHART_BG}"/>`;
  svg += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="${CHART_TEXT}">${esc(chart.title)}</text>`;

  // Grid
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = padTop + (chartH / ySteps) * i;
    const val = maxVal - (range / ySteps) * i;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${W - padRight}" y2="${y}" stroke="${CHART_GRID}" stroke-width="1"/>`;
    svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${fmt(val)}</text>`;
  }

  // X-axis labels
  xLabels.forEach((label, i) => {
    const x = padLeft + i * xStep;
    svg += `<text x="${x}" y="${padTop + chartH + 18}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${esc(label)}</text>`;
  });

  // Lines + dots per series
  let si = 0;
  for (const [seriesName, points] of seriesMap) {
    const color = colors[si % colors.length]!;
    const coords: { x: number; y: number; val: number }[] = [];

    for (const p of points) {
      const xi = xLabels.indexOf(p.label);
      if (xi < 0) continue;
      const x = padLeft + xi * xStep;
      const y = padTop + chartH - ((p.value - minVal) / range) * chartH;
      coords.push({ x, y, val: p.value });
    }

    if (coords.length > 1) {
      const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
      svg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }

    for (const c of coords) {
      svg += `<circle cx="${c.x}" cy="${c.y}" r="4" fill="${color}" stroke="${CHART_BG}" stroke-width="1.5"/>`;
      if (showValues) {
        svg += `<text x="${c.x}" y="${c.y - 10}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="${CHART_TEXT}">${fmt(c.val)}</text>`;
      }
    }

    // Legend entry when multiple series
    if (seriesMap.size > 1) {
      const lx = padLeft + 10 + si * 120;
      const ly = H - 20;
      svg += `<rect x="${lx}" y="${ly - 8}" width="12" height="3" rx="1" fill="${color}"/>`;
      svg += `<text x="${lx + 16}" y="${ly - 3}" font-family="Arial,sans-serif" font-size="10" fill="${CHART_TEXT}">${esc(seriesName)}</text>`;
    }
    si++;
  }

  // Axes
  svg += `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartH}" stroke="${CHART_TEXT}" stroke-width="1"/>`;
  svg += `<line x1="${padLeft}" y1="${padTop + chartH}" x2="${W - padRight}" y2="${padTop + chartH}" stroke="${CHART_TEXT}" stroke-width="1"/>`;
  svg += `</svg>`;
  return svg;
}

// ─── Stacked Bar Chart ──────────────────────────────────────────────

function generateStackedBarChart(chart: ChartData): string {
  const opts = chart.options ?? {};
  const W = opts.width ?? 600;
  const H = opts.height ?? 400;
  const colors = opts.colors ?? CHART_PALETTE;
  const data = chart.data;
  if (data.length === 0) return emptySvg(W, H, chart.title);

  const padTop = 50;
  const padBottom = 80;
  const padLeft = 70;
  const padRight = 30;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  // Group: label -> [series values]
  const labels: string[] = [];
  const seriesNames: string[] = [];
  const stacks = new Map<string, Map<string, number>>();

  for (const d of data) {
    const series = d.series ?? 'default';
    if (!seriesNames.includes(series)) seriesNames.push(series);
    if (!stacks.has(d.label)) {
      stacks.set(d.label, new Map());
      labels.push(d.label);
    }
    stacks.get(d.label)!.set(series, d.value);
  }

  // Max stack height
  let maxStack = 0;
  for (const seriesVals of stacks.values()) {
    let sum = 0;
    for (const v of seriesVals.values()) sum += Math.abs(v);
    if (sum > maxStack) maxStack = sum;
  }
  if (maxStack === 0) maxStack = 1;

  const barW = Math.min(50, (chartW / labels.length) * 0.6);
  const gap = (chartW - barW * labels.length) / (labels.length + 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="${CHART_BG}"/>`;
  svg += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="${CHART_TEXT}">${esc(chart.title)}</text>`;

  // Grid
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = padTop + (chartH / ySteps) * i;
    const val = maxStack - (maxStack / ySteps) * i;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${W - padRight}" y2="${y}" stroke="${CHART_GRID}" stroke-width="1"/>`;
    svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${fmt(val)}</text>`;
  }

  // Stacked bars
  labels.forEach((label, li) => {
    const x = padLeft + gap + li * (barW + gap);
    let yOffset = 0;
    const seriesVals = stacks.get(label)!;

    for (let si = 0; si < seriesNames.length; si++) {
      const val = seriesVals.get(seriesNames[si]!) ?? 0;
      if (val === 0) continue;
      const segH = (Math.abs(val) / maxStack) * chartH;
      const y = padTop + chartH - yOffset - segH;
      const color = colors[si % colors.length]!;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${segH}" fill="${color}" rx="1"/>`;
      yOffset += segH;
    }

    // X label
    const labelX = x + barW / 2;
    const labelY = padTop + chartH + 14;
    if (label.length > 8) {
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}" transform="rotate(-35,${labelX},${labelY})">${esc(label)}</text>`;
    } else {
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${esc(label)}</text>`;
    }
  });

  // Legend
  seriesNames.forEach((name, i) => {
    const lx = padLeft + 10 + i * 120;
    const ly = H - 15;
    svg += `<rect x="${lx}" y="${ly - 8}" width="12" height="12" rx="2" fill="${colors[i % colors.length]!}"/>`;
    svg += `<text x="${lx + 16}" y="${ly + 2}" font-family="Arial,sans-serif" font-size="10" fill="${CHART_TEXT}">${esc(name)}</text>`;
  });

  svg += `<line x1="${padLeft}" y1="${padTop + chartH}" x2="${W - padRight}" y2="${padTop + chartH}" stroke="${CHART_TEXT}" stroke-width="1"/>`;
  svg += `</svg>`;
  return svg;
}

// ─── Waterfall Chart ────────────────────────────────────────────────

function generateWaterfallChart(chart: ChartData): string {
  const opts = chart.options ?? {};
  const W = opts.width ?? 600;
  const H = opts.height ?? 400;
  const colors = opts.colors ?? CHART_PALETTE;
  const showValues = opts.showValues !== false;
  const data = chart.data;
  if (data.length === 0) return emptySvg(W, H, chart.title);

  const padTop = 50;
  const padBottom = 80;
  const padLeft = 70;
  const padRight = 30;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  // Compute running totals
  const bars: { label: string; start: number; end: number; value: number }[] = [];
  let running = 0;
  for (const d of data) {
    const start = running;
    running += d.value;
    bars.push({ label: d.label, start, end: running, value: d.value });
  }

  const allVals = bars.flatMap(b => [b.start, b.end]);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(1, ...allVals);
  const range = maxVal - minVal || 1;

  const barW = Math.min(50, (chartW / bars.length) * 0.6);
  const gap = (chartW - barW * bars.length) / (bars.length + 1);

  const toY = (v: number) => padTop + chartH - ((v - minVal) / range) * chartH;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="${CHART_BG}"/>`;
  svg += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="${CHART_TEXT}">${esc(chart.title)}</text>`;

  // Grid
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = padTop + (chartH / ySteps) * i;
    const val = maxVal - (range / ySteps) * i;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${W - padRight}" y2="${y}" stroke="${CHART_GRID}" stroke-width="1"/>`;
    svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${fmt(val)}</text>`;
  }

  // Baseline at 0
  const zeroY = toY(0);
  svg += `<line x1="${padLeft}" y1="${zeroY}" x2="${W - padRight}" y2="${zeroY}" stroke="${CHART_TEXT}" stroke-width="1" stroke-dasharray="4,2"/>`;

  bars.forEach((b, i) => {
    const x = padLeft + gap + i * (barW + gap);
    const y1 = toY(b.start);
    const y2 = toY(b.end);
    const top = Math.min(y1, y2);
    const barH = Math.abs(y1 - y2);
    const isPositive = b.value >= 0;
    const color = isPositive ? (colors[1] ?? '#059669') : (colors[2] ?? '#dc2626');

    svg += `<rect x="${x}" y="${top}" width="${barW}" height="${Math.max(barH, 1)}" fill="${color}" rx="2"/>`;

    // Connector line to next bar
    if (i < bars.length - 1) {
      const nextX = padLeft + gap + (i + 1) * (barW + gap);
      svg += `<line x1="${x + barW}" y1="${toY(b.end)}" x2="${nextX}" y2="${toY(b.end)}" stroke="${CHART_GRID}" stroke-width="1" stroke-dasharray="3,2"/>`;
    }

    // Value label
    if (showValues) {
      const valY = isPositive ? top - 6 : top + barH + 14;
      const prefix = isPositive ? '+' : '';
      svg += `<text x="${x + barW / 2}" y="${valY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="${color}">${prefix}${fmt(b.value)}</text>`;
    }

    // X label
    const labelX = x + barW / 2;
    const labelY = padTop + chartH + 14;
    if (b.label.length > 8) {
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}" transform="rotate(-35,${labelX},${labelY})">${esc(b.label)}</text>`;
    } else {
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${CHART_LABEL}">${esc(b.label)}</text>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

// ─── Empty placeholder ─────────────────────────────────────────────

function emptySvg(w: number, h: number, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${CHART_BG}"/>
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="${CHART_LABEL}">${esc(title)} — No data</text>
  </svg>`;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Generate an SVG string for the given chart specification.
 * Pure function — no I/O, no native deps.
 */
export function generateChartSvg(chart: ChartData): string {
  switch (chart.type) {
    case 'bar':
      return generateBarChart(chart);
    case 'pie':
      return generatePieChart(chart);
    case 'line':
      return generateLineChart(chart);
    case 'stacked_bar':
      return generateStackedBarChart(chart);
    case 'waterfall':
      return generateWaterfallChart(chart);
    default:
      return emptySvg(chart.options?.width ?? 600, chart.options?.height ?? 400, chart.title);
  }
}

/**
 * Convert ChartData into pptxgenjs-compatible chart series.
 * pptxgenjs uses { name, labels, values }[] format.
 */
export function toPptxChartData(chart: ChartData): PptxChartSeries[] {
  const seriesMap = new Map<string, { labels: string[]; values: number[] }>();

  for (const d of chart.data) {
    const key = d.series ?? chart.title;
    if (!seriesMap.has(key)) seriesMap.set(key, { labels: [], values: [] });
    const entry = seriesMap.get(key)!;
    entry.labels.push(d.label);
    entry.values.push(d.value);
  }

  return [...seriesMap.entries()].map(([name, { labels, values }]) => ({
    name,
    labels,
    values,
  }));
}

/**
 * Extract chart data from Layer-1 engine results.
 * Produces comprehensive visualizations from all 4 analytical engines:
 *   - Leak Detector: waterfall, benchmark comparison, recovery impact, productive vs waste
 *   - Media Architect: response curves, model fit, contribution waterfall, ROI intervals, spend vs contribution
 *   - Campaign Ops: priority ranking, alert distribution, pacing, CPA performance
 *   - Executive Bridge: channel performance matrix, L1 metrics, Shapley attribution
 *
 * Returns an array of ChartData ready for SVG rendering.
 * Gracefully returns empty array if data is missing or malformed.
 */
export function extractChartsFromLayerOne(layerOne: unknown): ChartData[] {
  const charts: ChartData[] = [];
  if (!layerOne || typeof layerOne !== 'object') return charts;

  const obj = layerOne as Record<string, unknown>;

  try {
    // ── Leak Detector ─────────────────────────────────────────────
    const leak = resolveEngineData(obj, 'leak_detector');
    if (leak) {
      extractLeakDetectorCharts(leak, charts);
    }

    // ── Media Architect ───────────────────────────────────────────
    const media = resolveEngineData(obj, 'media_architect');
    if (media) {
      extractMediaArchitectCharts(media, charts);
    }

    // ── Campaign Ops ──────────────────────────────────────────────
    const campaigns = resolveEngineData(obj, 'campaign_ops');
    if (campaigns) {
      extractCampaignOpsCharts(campaigns, charts);
    }

    // ── Executive Bridge ──────────────────────────────────────────
    const exec = resolveEngineData(obj, 'executive_bridge');
    if (exec) {
      extractExecutiveBridgeCharts(exec, charts);
    }
  } catch {
    // Graceful — return whatever charts we managed to extract
  }

  return charts;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Resolve engine data which may be nested under .data or a skill key */
function resolveEngineData(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const raw = obj[key] ?? obj[key.replace(/_/g, '-')];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  // Engine output may be wrapped: { data: { ... } } or { waste-waterfall: { data: { ... } } }
  if (r.data && typeof r.data === 'object') return r.data as Record<string, unknown>;
  // May be nested under skill key (e.g., { 'waste-waterfall': { data: ... } })
  for (const v of Object.values(r)) {
    if (v && typeof v === 'object' && 'data' in (v as Record<string, unknown>)) {
      return (v as Record<string, unknown>).data as Record<string, unknown>;
    }
  }
  return r;
}

function arrFrom(obj: Record<string, unknown>, ...keys: string[]): Array<Record<string, unknown>> {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v.filter(x => x && typeof x === 'object') as Array<Record<string, unknown>>;
  }
  return [];
}

// ─── LEAK DETECTOR charts ───────────────────────────────────────────

function extractLeakDetectorCharts(data: Record<string, unknown>, charts: ChartData[]): void {
  // 1. Waste Waterfall (primary)
  const waterfall = arrFrom(data, 'waterfall');
  if (waterfall.length > 0) {
    const grossSpend = typeof data.gross_spend === 'number' ? data.gross_spend : null;
    const wfData: ChartDataPoint[] = [];
    if (grossSpend) wfData.push({ label: 'Gross Spend', value: grossSpend, color: '#1e40af' });
    for (const stage of waterfall) {
      const label = (stage.label ?? stage.category ?? '') as string;
      const waste = (stage.waste_amount ?? stage.value ?? 0) as number;
      if (label && waste) wfData.push({ label, value: -Math.abs(waste), color: '#dc2626' });
    }
    const productive = data.productive_spend as Record<string, unknown> | undefined;
    if (productive?.amount && typeof productive.amount === 'number') {
      wfData.push({ label: 'Productive Spend', value: productive.amount as number, color: '#059669' });
    }
    if (wfData.length > 1) charts.push({ type: 'waterfall', title: 'Waste Waterfall', data: wfData });
  }

  // 2. Waste vs Benchmark comparison (grouped bars)
  if (waterfall.length > 0) {
    const benchData: ChartDataPoint[] = [];
    for (const stage of waterfall) {
      const label = (stage.label ?? stage.category ?? '') as string;
      const wastePct = stage.waste_pct as number | undefined;
      const benchPct = stage.benchmark_pct as number | undefined;
      if (label && typeof wastePct === 'number') {
        benchData.push({ label, value: wastePct, series: 'Actual', color: '#dc2626' });
        if (typeof benchPct === 'number') {
          benchData.push({ label, value: benchPct, series: 'Benchmark', color: '#6b7280' });
        }
      }
    }
    if (benchData.length > 2) charts.push({ type: 'bar', title: 'Waste % vs Industry Benchmark', data: benchData });
  }

  // 3. Productive vs Waste pie
  const wasteSummary = data.waste_summary as Record<string, unknown> | undefined;
  const productiveSpend = data.productive_spend as Record<string, unknown> | undefined;
  if (wasteSummary && productiveSpend) {
    const wasteAmt = wasteSummary.total_waste as number | undefined;
    const prodAmt = productiveSpend.amount as number | undefined;
    if (typeof wasteAmt === 'number' && typeof prodAmt === 'number') {
      charts.push({
        type: 'pie',
        title: 'Spend Effectiveness',
        data: [
          { label: 'Productive Spend', value: prodAmt, color: '#059669' },
          { label: 'Total Waste', value: wasteAmt, color: '#dc2626' },
        ],
      });
    }
  }

  // 4. Recovery Roadmap (ranked bars)
  const roadmap = arrFrom(data, 'recovery_roadmap');
  if (roadmap.length > 0) {
    const recoveryData: ChartDataPoint[] = [];
    for (const item of roadmap) {
      const label = (item.category ?? item.action ?? '') as string;
      const savings = item.estimated_savings as number | undefined;
      if (label && typeof savings === 'number' && savings > 0) {
        const diff = item.difficulty as string | undefined;
        const color = diff === 'easy' ? '#059669' : diff === 'medium' ? '#f59e0b' : '#dc2626';
        recoveryData.push({ label: label.slice(0, 20), value: savings, color });
      }
    }
    if (recoveryData.length > 0) {
      recoveryData.sort((a, b) => b.value - a.value);
      charts.push({ type: 'bar', title: 'Recovery Opportunities ($)', data: recoveryData });
    }
  }

  // 5. Quality Score by channel (media-quality-score output)
  const qualityChannels = arrFrom(data, 'channels');
  if (qualityChannels.length > 0 && qualityChannels[0]?.composite_score !== undefined) {
    const scoreData: ChartDataPoint[] = [];
    for (const ch of qualityChannels) {
      const label = (ch.channel ?? ch.name ?? '') as string;
      const score = ch.composite_score as number | undefined;
      if (label && typeof score === 'number') {
        const color = score >= 80 ? '#059669' : score >= 60 ? '#f59e0b' : '#dc2626';
        scoreData.push({ label, value: score, color });
      }
    }
    if (scoreData.length > 0) charts.push({ type: 'bar', title: 'Media Quality Score by Channel', data: scoreData });

    // Quality waste by channel
    const wasteData: ChartDataPoint[] = [];
    for (const ch of qualityChannels) {
      const label = (ch.channel ?? ch.name ?? '') as string;
      const waste = ch.quality_waste_dollars as number | undefined;
      if (label && typeof waste === 'number' && waste > 0) {
        wasteData.push({ label, value: waste, color: '#dc2626' });
      }
    }
    if (wasteData.length > 0) charts.push({ type: 'bar', title: 'Quality Waste by Channel ($)', data: wasteData });
  }

  // 6. Supply Chain — working media ratio
  const dollarFlow = data.dollar_flow as Record<string, unknown> | undefined;
  if (dollarFlow) {
    const totalFees = dollarFlow.total_fees as number | undefined;
    const workingMedia = dollarFlow.working_media as number | undefined;
    if (typeof totalFees === 'number' && typeof workingMedia === 'number') {
      charts.push({
        type: 'pie',
        title: 'Dollar Flow: Fees vs Working Media',
        data: [
          { label: 'Working Media', value: workingMedia, color: '#059669' },
          { label: 'Intermediary Fees', value: totalFees, color: '#dc2626' },
        ],
      });
    }
  }

  const partnerComparison = arrFrom(data, 'partner_comparison');
  if (partnerComparison.length > 0) {
    const compData: ChartDataPoint[] = [];
    for (const p of partnerComparison) {
      const label = (p.channel ?? '') as string;
      const ratio = p.working_media_ratio as number | undefined;
      if (label && typeof ratio === 'number') {
        const color = ratio >= 70 ? '#059669' : ratio >= 50 ? '#f59e0b' : '#dc2626';
        compData.push({ label, value: ratio, color });
      }
    }
    if (compData.length > 0) charts.push({ type: 'bar', title: 'Working Media Ratio by Channel (%)', data: compData });
  }
}

// ─── MEDIA ARCHITECT charts ─────────────────────────────────────────

function extractMediaArchitectCharts(data: Record<string, unknown>, charts: ChartData[]): void {
  // 1. Response Curves (line charts per channel)
  const responseCurves = arrFrom(data, 'response_curves');
  if (responseCurves.length > 0) {
    const curveData: ChartDataPoint[] = [];
    for (const curve of responseCurves) {
      const channel = (curve.channel ?? '') as string;
      const points = curve.points as Array<{ spend: number; response: number }> | undefined;
      if (channel && Array.isArray(points)) {
        // Sample ~10 points for readability
        const step = Math.max(1, Math.floor(points.length / 10));
        for (let i = 0; i < points.length; i += step) {
          const p = points[i]!;
          curveData.push({ label: fmt(p.spend), value: p.response, series: channel });
        }
        // Always include last point
        const last = points[points.length - 1];
        if (last) curveData.push({ label: fmt(last.spend), value: last.response, series: channel });
      }
    }
    if (curveData.length > 0) charts.push({ type: 'line', title: 'Response Curves (Spend → KPI)', data: curveData });
  }

  // 2. Model Fit (actual vs predicted)
  const modelFit = data.model_fit as Record<string, unknown> | undefined;
  if (modelFit) {
    const periods = modelFit.periods as string[] | undefined;
    const actual = modelFit.actual as number[] | undefined;
    const predicted = modelFit.predicted as number[] | undefined;
    if (periods && actual && predicted && periods.length === actual.length) {
      const fitData: ChartDataPoint[] = [];
      // Sample for readability (max 15 points)
      const step = Math.max(1, Math.floor(periods.length / 15));
      for (let i = 0; i < periods.length; i += step) {
        fitData.push({ label: periods[i]!, value: actual[i]!, series: 'Actual' });
        fitData.push({ label: periods[i]!, value: predicted[i]!, series: 'Predicted' });
      }
      if (fitData.length > 2) charts.push({ type: 'line', title: 'Model Fit: Actual vs Predicted', data: fitData });
    }
  }

  // 3. Contribution Waterfall
  const contribWaterfall = arrFrom(data, 'contribution_waterfall');
  if (contribWaterfall.length > 0) {
    const wfData: ChartDataPoint[] = [];
    for (const item of contribWaterfall) {
      const label = (item.channel ?? '') as string;
      const contrib = item.contribution as number | undefined;
      if (label && typeof contrib === 'number') {
        const isBase = label.toLowerCase().includes('base');
        wfData.push({ label, value: contrib, color: isBase ? '#6b7280' : undefined });
      }
    }
    if (wfData.length > 0) charts.push({ type: 'bar', title: 'KPI Contribution by Channel', data: wfData });
  }

  // 4. Spend Share vs Contribution Share (paired bars)
  const channelModels = arrFrom(data, 'channel_models');
  if (channelModels.length > 0) {
    const shareData: ChartDataPoint[] = [];
    for (const ch of channelModels) {
      const label = (ch.channel ?? '') as string;
      const spendShare = ch.spend_share_pct as number | undefined;
      const results = ch.results as Record<string, unknown> | undefined;
      const contribShare = results?.contribution_share_pct as number | undefined;
      if (label && typeof spendShare === 'number' && typeof contribShare === 'number') {
        shareData.push({ label, value: spendShare, series: 'Spend Share %' });
        shareData.push({ label, value: contribShare, series: 'Contribution Share %' });
      }
    }
    if (shareData.length > 2) charts.push({ type: 'bar', title: 'Spend Share vs Contribution Share', data: shareData });
  }

  // 5. ROI with Confidence Intervals (bar chart — CI rendered as value labels)
  const roiIntervals = arrFrom(data, 'roi_intervals');
  if (roiIntervals.length > 0) {
    const roiData: ChartDataPoint[] = [];
    for (const ch of roiIntervals) {
      const label = (ch.channel ?? '') as string;
      const roi = ch.roi as number | undefined;
      if (label && typeof roi === 'number') {
        const color = roi >= 2 ? '#059669' : roi >= 1 ? '#f59e0b' : '#dc2626';
        roiData.push({ label, value: roi, color });
      }
    }
    if (roiData.length > 0) charts.push({ type: 'bar', title: 'ROI by Channel', data: roiData });

    // Marginal ROI ranking
    const mroiData: ChartDataPoint[] = [];
    for (const ch of roiIntervals) {
      const label = (ch.channel ?? '') as string;
      const mroi = ch.mroi as number | undefined;
      if (label && typeof mroi === 'number') {
        mroiData.push({ label, value: mroi });
      }
    }
    if (mroiData.length > 0) {
      mroiData.sort((a, b) => b.value - a.value);
      charts.push({ type: 'bar', title: 'Marginal ROI Ranking', data: mroiData, options: { colors: ['#8b5cf6'] } });
    }
  }

  // 6. Saturation by channel
  if (channelModels.length > 0) {
    const satData: ChartDataPoint[] = [];
    for (const ch of channelModels) {
      const label = (ch.channel ?? '') as string;
      const results = ch.results as Record<string, unknown> | undefined;
      const satPct = results?.saturation_pct as number | undefined;
      if (label && typeof satPct === 'number') {
        const color = satPct >= 80 ? '#dc2626' : satPct >= 50 ? '#f59e0b' : '#059669';
        satData.push({ label, value: satPct, color });
      }
    }
    if (satData.length > 0) charts.push({ type: 'bar', title: 'Channel Saturation (%)', data: satData });
  }

  // 7. Fallback: generic channel spend + ROAS (from any structure)
  const channels = arrFrom(data, 'channels', 'channel_breakdown', 'channel_performance', 'channel_spend');
  if (channels.length > 0 && channelModels.length === 0) {
    const spendData: ChartDataPoint[] = [];
    const roasData: ChartDataPoint[] = [];
    for (const ch of channels) {
      const label = (ch.channel ?? ch.platform ?? ch.name ?? ch.label ?? '') as string;
      const spend = (ch.spend ?? ch.budget ?? ch.cost) as number | undefined;
      const roas = (ch.roas ?? ch.roi) as number | undefined;
      if (label && typeof spend === 'number') spendData.push({ label, value: spend });
      if (label && typeof roas === 'number') roasData.push({ label, value: roas });
    }
    if (spendData.length > 0) charts.push({ type: 'bar', title: 'Spend by Channel', data: spendData });
    if (roasData.length > 0) charts.push({ type: 'bar', title: 'ROAS by Channel', data: roasData, options: { colors: ['#059669'] } });
  }
}

// ─── CAMPAIGN OPS charts ────────────────────────────────────────────

function extractCampaignOpsCharts(data: Record<string, unknown>, charts: ChartData[]): void {
  const campaigns = arrFrom(data, 'campaigns');
  if (campaigns.length === 0) return;

  // 1. Priority Score Ranking
  const priorityData: ChartDataPoint[] = [];
  for (const c of campaigns) {
    const label = (c.campaign ?? c.name ?? '') as string;
    const score = c.priority_score as number | undefined;
    if (label && typeof score === 'number') {
      const color = score >= 0.7 ? '#dc2626' : score >= 0.4 ? '#f59e0b' : '#059669';
      priorityData.push({ label: label.slice(0, 20), value: +(score * 100).toFixed(0), color });
    }
  }
  if (priorityData.length > 0) {
    priorityData.sort((a, b) => b.value - a.value);
    charts.push({ type: 'bar', title: 'Campaign Priority Score', data: priorityData });
  }

  // 2. Alert Distribution (stacked bar by severity)
  const alertData: ChartDataPoint[] = [];
  for (const c of campaigns) {
    const label = (c.campaign ?? c.name ?? '') as string;
    const alertCount = c.alert_count as Record<string, number> | undefined;
    if (label && alertCount) {
      if (alertCount.critical) alertData.push({ label: label.slice(0, 15), value: alertCount.critical, series: 'Critical', color: '#dc2626' });
      if (alertCount.warning) alertData.push({ label: label.slice(0, 15), value: alertCount.warning, series: 'Warning', color: '#f59e0b' });
      if (alertCount.info) alertData.push({ label: label.slice(0, 15), value: alertCount.info, series: 'Info', color: '#3b82f6' });
    }
  }
  if (alertData.length > 0) charts.push({ type: 'stacked_bar', title: 'Alerts by Campaign', data: alertData });

  // 3. CPA Performance (bar chart)
  const cpaData: ChartDataPoint[] = [];
  for (const c of campaigns) {
    const label = (c.campaign ?? c.name ?? '') as string;
    const metrics = c.metrics as Record<string, unknown> | undefined;
    const cpa = metrics?.cpa as number | undefined;
    if (label && typeof cpa === 'number' && cpa > 0) {
      cpaData.push({ label: label.slice(0, 15), value: cpa });
    }
  }
  if (cpaData.length > 0) charts.push({ type: 'bar', title: 'CPA by Campaign ($)', data: cpaData, options: { colors: ['#0891b2'] } });

  // 4. ROAS by Campaign
  const roasData: ChartDataPoint[] = [];
  for (const c of campaigns) {
    const label = (c.campaign ?? c.name ?? '') as string;
    const metrics = c.metrics as Record<string, unknown> | undefined;
    const roas = metrics?.roas as number | undefined;
    if (label && typeof roas === 'number') {
      const color = roas >= 3 ? '#059669' : roas >= 1 ? '#f59e0b' : '#dc2626';
      roasData.push({ label: label.slice(0, 15), value: roas, color });
    }
  }
  if (roasData.length > 0) charts.push({ type: 'bar', title: 'ROAS by Campaign', data: roasData });

  // 5. Pacing (% of budget spent)
  const pacingData: ChartDataPoint[] = [];
  for (const c of campaigns) {
    const label = (c.campaign ?? c.name ?? '') as string;
    const metrics = c.metrics as Record<string, unknown> | undefined;
    const pacing = metrics?.pacing_pct as number | undefined;
    if (label && typeof pacing === 'number') {
      const color = pacing > 110 ? '#dc2626' : pacing < 80 ? '#f59e0b' : '#059669';
      pacingData.push({ label: label.slice(0, 15), value: pacing, color });
    }
  }
  if (pacingData.length > 0) charts.push({ type: 'bar', title: 'Budget Pacing (%)', data: pacingData });

  // Fallback: generic budget allocation
  if (campaigns.length > 0 && priorityData.length === 0) {
    const allocData: ChartDataPoint[] = [];
    for (const c of campaigns) {
      const label = (c.campaign ?? c.channel ?? c.name ?? c.label ?? '') as string;
      const value = (c.budget ?? c.spend ?? c.allocation ?? c.value) as number | undefined;
      if (typeof label === 'string' && typeof value === 'number' && value > 0) {
        allocData.push({ label, value });
      }
    }
    if (allocData.length > 0) charts.push({ type: 'pie', title: 'Budget Allocation', data: allocData });
  }
}

// ─── EXECUTIVE BRIDGE charts ────────────────────────────────────────

function extractExecutiveBridgeCharts(data: Record<string, unknown>, charts: ChartData[]): void {
  // 1. Channel Performance (spend vs revenue vs ROAS)
  const channels = arrFrom(data, 'channels');
  if (channels.length > 0) {
    // Spend by channel
    const spendData: ChartDataPoint[] = [];
    const roasData: ChartDataPoint[] = [];
    for (const ch of channels) {
      const label = (ch.channel ?? ch.name ?? '') as string;
      const spend = ch.spend as number | undefined;
      const l2 = ch.l2_metrics as Record<string, unknown> | undefined;
      const roas = l2?.roas as number | undefined;
      if (label && typeof spend === 'number') {
        spendData.push({ label, value: spend, series: 'Spend' });
        const revenue = ch.revenue as number | undefined;
        if (typeof revenue === 'number') {
          spendData.push({ label, value: revenue, series: 'Revenue' });
        }
      }
      if (label && typeof roas === 'number') {
        const color = roas >= 3 ? '#059669' : roas >= 1 ? '#f59e0b' : '#dc2626';
        roasData.push({ label, value: roas, color });
      }
    }
    if (spendData.length > 0) charts.push({ type: 'bar', title: 'Spend vs Revenue by Channel', data: spendData });
    if (roasData.length > 0) charts.push({ type: 'bar', title: 'ROAS by Channel', data: roasData });

    // CPA by channel
    const cpaData: ChartDataPoint[] = [];
    for (const ch of channels) {
      const label = (ch.channel ?? ch.name ?? '') as string;
      const l2 = ch.l2_metrics as Record<string, unknown> | undefined;
      const cpa = l2?.cpa as number | undefined;
      if (label && typeof cpa === 'number' && cpa > 0) {
        cpaData.push({ label, value: cpa });
      }
    }
    if (cpaData.length > 0) charts.push({ type: 'bar', title: 'CPA by Channel ($)', data: cpaData, options: { colors: ['#0891b2'] } });
  }

  // 2. L1 Financial Metrics pie (spend vs margin)
  const l1 = data.l1_metrics as Record<string, unknown> | undefined;
  if (l1) {
    const totalSpend = l1.total_spend as number | undefined;
    const totalRevenue = l1.total_revenue as number | undefined;
    if (typeof totalSpend === 'number' && typeof totalRevenue === 'number' && totalRevenue > totalSpend) {
      charts.push({
        type: 'pie',
        title: 'Revenue Composition',
        data: [
          { label: 'Marketing Cost', value: totalSpend, color: '#dc2626' },
          { label: 'Marketing Margin', value: totalRevenue - totalSpend, color: '#059669' },
        ],
      });
    }
  }

  // 3. Shapley Attribution (shapley-attribute output)
  const shapleyChannels = arrFrom(data, 'channels');
  if (shapleyChannels.length > 0 && shapleyChannels[0]?.shapley_value !== undefined) {
    // Shapley share pie
    const shapleyPie: ChartDataPoint[] = [];
    for (const ch of shapleyChannels) {
      const label = (ch.channel ?? '') as string;
      const value = ch.shapley_value as number | undefined;
      if (label && typeof value === 'number' && value > 0) {
        shapleyPie.push({ label, value });
      }
    }
    if (shapleyPie.length > 0) charts.push({ type: 'pie', title: 'Shapley Attribution', data: shapleyPie });

    // Shapley vs Last-Click comparison
    const compData: ChartDataPoint[] = [];
    for (const ch of shapleyChannels) {
      const label = (ch.channel ?? '') as string;
      const shapleyPct = ch.shapley_share_pct as number | undefined;
      const lastClickPct = ch.last_click_share_pct as number | undefined;
      if (label && typeof shapleyPct === 'number' && typeof lastClickPct === 'number') {
        compData.push({ label, value: shapleyPct, series: 'Shapley' });
        compData.push({ label, value: lastClickPct, series: 'Last-Click' });
      }
    }
    if (compData.length > 2) charts.push({ type: 'bar', title: 'Shapley vs Last-Click Attribution', data: compData });
  }

  // 4. KPI Trends fallback
  const trends = arrFrom(data, 'trends', 'kpi_trends', 'time_series', 'monthly_metrics');
  if (trends.length > 0) {
    const trendData: ChartDataPoint[] = [];
    for (const item of trends) {
      const label = (item.period ?? item.month ?? item.date ?? item.label ?? '') as string;
      const value = (item.value ?? item.roas ?? item.roi ?? item.cpa) as number | undefined;
      const series = item.metric ?? item.kpi ?? item.series;
      if (label && typeof value === 'number') {
        trendData.push({ label, value, series: typeof series === 'string' ? series : undefined });
      }
    }
    if (trendData.length > 0) charts.push({ type: 'line', title: 'KPI Trends', data: trendData });
  }
}
