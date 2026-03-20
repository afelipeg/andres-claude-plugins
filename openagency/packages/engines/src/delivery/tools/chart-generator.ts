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
 * Attempts to pull spend-by-channel, ROAS, waste decomposition, etc.
 * Returns an array of ChartData ready for rendering.
 * Gracefully returns empty array if data is missing or malformed.
 */
export function extractChartsFromLayerOne(layerOne: unknown): ChartData[] {
  const charts: ChartData[] = [];
  if (!layerOne || typeof layerOne !== 'object') return charts;

  const obj = layerOne as Record<string, unknown>;

  try {
    // ── Leak Detector waste decomposition → waterfall ──────────
    const leak = obj.leak_detector as Record<string, unknown> | undefined;
    if (leak) {
      const wasteItems = extractWasteItems(leak);
      if (wasteItems.length > 0) {
        charts.push({
          type: 'waterfall',
          title: 'Waste Decomposition',
          data: wasteItems,
        });
      }
    }

    // ── Media Architect channel spend → bar chart ─────────────
    const media = obj.media_architect as Record<string, unknown> | undefined;
    if (media) {
      const channelSpend = extractChannelSpend(media);
      if (channelSpend.length > 0) {
        charts.push({
          type: 'bar',
          title: 'Spend by Channel',
          data: channelSpend,
        });
      }

      const channelRoas = extractChannelRoas(media);
      if (channelRoas.length > 0) {
        charts.push({
          type: 'bar',
          title: 'ROAS by Channel',
          data: channelRoas,
          options: { colors: ['#059669'] },
        });
      }
    }

    // ── Campaign Ops → pie chart of budget allocation ─────────
    const campaigns = obj.campaign_ops as Record<string, unknown> | undefined;
    if (campaigns) {
      const alloc = extractBudgetAllocation(campaigns);
      if (alloc.length > 0) {
        charts.push({
          type: 'pie',
          title: 'Budget Allocation',
          data: alloc,
        });
      }
    }

    // ── Executive Bridge → line chart for KPI trends ──────────
    const exec = (obj.executive_bridge ?? obj.l1_metrics) as Record<string, unknown> | undefined;
    if (exec) {
      const trends = extractKpiTrends(exec);
      if (trends.length > 0) {
        charts.push({
          type: 'line',
          title: 'KPI Trends',
          data: trends,
        });
      }
    }
  } catch {
    // Graceful — return whatever charts we managed to extract
  }

  return charts;
}

// ─── Data extractors (best-effort from engine outputs) ──────────────

function extractWasteItems(leak: Record<string, unknown>): ChartDataPoint[] {
  const items: ChartDataPoint[] = [];
  // Look for waste_categories, waste_breakdown, or similar arrays
  const candidates = ['waste_categories', 'waste_breakdown', 'categories', 'breakdown'];
  for (const key of candidates) {
    const arr = leak[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const label = (item as Record<string, unknown>).category ?? (item as Record<string, unknown>).name ?? (item as Record<string, unknown>).label;
          const value = (item as Record<string, unknown>).amount ?? (item as Record<string, unknown>).waste ?? (item as Record<string, unknown>).value;
          if (typeof label === 'string' && typeof value === 'number') {
            items.push({ label, value: -Math.abs(value) }); // waste is negative
          }
        }
      }
      if (items.length > 0) break;
    }
  }
  // Add total spend as starting positive if we have it
  const totalSpend = leak.total_spend ?? leak.gross_spend ?? leak.ad_spend;
  if (typeof totalSpend === 'number' && items.length > 0) {
    items.unshift({ label: 'Total Spend', value: totalSpend });
  }
  return items;
}

function extractChannelSpend(media: Record<string, unknown>): ChartDataPoint[] {
  const items: ChartDataPoint[] = [];
  const candidates = ['channels', 'channel_breakdown', 'channel_performance', 'channel_spend'];
  for (const key of candidates) {
    const arr = media[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const label = r.channel ?? r.platform ?? r.name ?? r.label;
          const value = r.spend ?? r.budget ?? r.cost ?? r.value;
          if (typeof label === 'string' && typeof value === 'number') {
            items.push({ label, value });
          }
        }
      }
      if (items.length > 0) break;
    }
  }
  return items;
}

function extractChannelRoas(media: Record<string, unknown>): ChartDataPoint[] {
  const items: ChartDataPoint[] = [];
  const candidates = ['channels', 'channel_breakdown', 'channel_performance'];
  for (const key of candidates) {
    const arr = media[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const label = r.channel ?? r.platform ?? r.name ?? r.label;
          const roas = r.roas ?? r.roi;
          if (typeof label === 'string' && typeof roas === 'number') {
            items.push({ label, value: roas });
          }
        }
      }
      if (items.length > 0) break;
    }
  }
  return items;
}

function extractBudgetAllocation(campaigns: Record<string, unknown>): ChartDataPoint[] {
  const items: ChartDataPoint[] = [];
  const candidates = ['allocation', 'budget_allocation', 'campaigns', 'campaign_breakdown'];
  for (const key of candidates) {
    const arr = campaigns[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const label = r.campaign ?? r.channel ?? r.name ?? r.label;
          const value = r.budget ?? r.spend ?? r.allocation ?? r.value;
          if (typeof label === 'string' && typeof value === 'number' && value > 0) {
            items.push({ label, value });
          }
        }
      }
      if (items.length > 0) break;
    }
  }
  return items;
}

function extractKpiTrends(exec: Record<string, unknown>): ChartDataPoint[] {
  const items: ChartDataPoint[] = [];
  const candidates = ['trends', 'kpi_trends', 'time_series', 'monthly_metrics'];
  for (const key of candidates) {
    const arr = exec[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const label = r.period ?? r.month ?? r.date ?? r.label;
          const value = r.value ?? r.roas ?? r.roi ?? r.cpa;
          const series = r.metric ?? r.kpi ?? r.series;
          if (typeof label === 'string' && typeof value === 'number') {
            items.push({ label, value, series: typeof series === 'string' ? series : undefined });
          }
        }
      }
      if (items.length > 0) break;
    }
  }
  return items;
}
