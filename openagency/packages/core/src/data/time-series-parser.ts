// ─── Time-Series Detector ───────────────────────────────────────────
// Detects weekly time-series structure in uploaded campaign data.
// When detected, structures it for Bayesian MMM batch processing.
// Returns null when the data is flat (non-temporal) campaign data.

export interface TimeSeriesData {
  weekly_kpi: number[];
  channels: Array<{ channel: string; weekly_spend: number[] }>;
  time_periods: number;
  date_range: { start: string; end: string };
  kpi_column: string;
  date_column: string;
}

// ─── Column detection patterns ──────────────────────────────────────

const DATE_PATTERNS = [
  /^date$/i,
  /^week$/i,
  /^period$/i,
  /^fecha$/i,
  /^semana$/i,
  /date$/i,
  /^week_start/i,
  /^week_end/i,
  /^time_period/i,
  /^periodo/i,
];

const KPI_PATTERNS = [
  /^revenue$/i,
  /^sales$/i,
  /^conversions$/i,
  /^kpi$/i,
  /^ventas$/i,
  /^ingresos$/i,
  /^total_revenue/i,
  /^total_sales/i,
  /^net_revenue/i,
  /^gross_revenue/i,
  /^orders$/i,
  /^transactions$/i,
];

const SPEND_PATTERNS = [
  /spend/i,
  /cost/i,
  /gasto/i,
  /budget/i,
  /investment/i,
  /inversion/i,
];

const PLATFORM_NAMES = [
  'google', 'meta', 'facebook', 'instagram', 'tiktok', 'twitter',
  'linkedin', 'snapchat', 'pinterest', 'youtube', 'dv360', 'amazon',
  'programmatic', 'display', 'search', 'social', 'video', 'tv',
  'radio', 'print', 'ooh', 'email', 'sms', 'affiliate',
];

function matchesAny(col: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(col));
}

function isSpendColumn(col: string): boolean {
  const lower = col.toLowerCase();
  if (matchesAny(col, SPEND_PATTERNS)) return true;
  // Check for platform-named columns (e.g., "google_ads", "meta_spend")
  return PLATFORM_NAMES.some((p) => lower.includes(p));
}

function channelName(col: string): string {
  const lower = col.toLowerCase();
  // Strip common suffixes to get clean channel name
  return lower
    .replace(/_spend$/i, '')
    .replace(/_cost$/i, '')
    .replace(/_budget$/i, '')
    .replace(/_investment$/i, '')
    .replace(/_gasto$/i, '')
    .replace(/_ads$/i, '')
    .trim();
}

// ─── Date parsing helpers ───────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY format
  const parts = str.split(/[/\-.]/).map(Number);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    // Heuristic: if first > 12, it's DD/MM/YYYY
    if (a! > 12 && b! <= 12) {
      const d2 = new Date(c!, b! - 1, a!);
      if (!isNaN(d2.getTime())) return d2;
    }
  }
  return null;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekKey(d: Date): string {
  // ISO week start (Monday)
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return toISODate(monday);
}

// ─── Main detector ──────────────────────────────────────────────────

/**
 * Detect time-series structure in parsed row data.
 * Returns structured TimeSeriesData if weekly/daily temporal data is found,
 * or null if the data is flat (non-temporal).
 */
export function detectTimeSeries(
  rows: Record<string, unknown>[],
  columns: string[],
): TimeSeriesData | null {
  if (!rows || rows.length < 4 || !columns || columns.length < 3) {
    return null;
  }

  // 1. Find date column
  const dateCol = columns.find((c) => matchesAny(c, DATE_PATTERNS));
  if (!dateCol) return null;

  // Verify the column actually contains parseable dates
  const sampleDates = rows.slice(0, 5).map((r) => parseDate(r[dateCol]));
  const validDates = sampleDates.filter((d) => d !== null);
  if (validDates.length < 3) return null; // Not enough valid dates

  // 2. Find KPI column
  const kpiCol = columns.find((c) => matchesAny(c, KPI_PATTERNS));
  if (!kpiCol) return null;

  // 3. Find spend columns (need at least 1)
  const spendCols = columns.filter((c) => c !== dateCol && c !== kpiCol && isSpendColumn(c));
  if (spendCols.length === 0) return null;

  // 4. Parse all rows with valid dates
  const parsed: Array<{
    date: Date;
    kpi: number;
    spends: Map<string, number>;
  }> = [];

  for (const row of rows) {
    const d = parseDate(row[dateCol]);
    if (!d) continue;
    const kpi = Number(row[kpiCol]) || 0;
    const spends = new Map<string, number>();
    for (const sc of spendCols) {
      spends.set(sc, Number(row[sc]) || 0);
    }
    parsed.push({ date: d, kpi, spends });
  }

  if (parsed.length < 4) return null;

  // Sort by date
  parsed.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 5. Detect granularity: are dates roughly 1 day or 7 days apart?
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(parsed.length, 20); i++) {
    const diffDays = (parsed[i]!.date.getTime() - parsed[i - 1]!.date.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 0) gaps.push(diffDays);
  }
  if (gaps.length === 0) return null;

  const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
  const isDaily = medianGap < 4;
  const isWeekly = medianGap >= 4 && medianGap <= 10;

  if (!isDaily && !isWeekly) return null; // Monthly or irregular — not supported for MMM

  // 6. Aggregate to weekly if daily
  let weeklyData: Map<string, { kpi: number; spends: Map<string, number> }>;

  if (isDaily) {
    weeklyData = new Map();
    for (const p of parsed) {
      const wk = weekKey(p.date);
      const existing = weeklyData.get(wk);
      if (existing) {
        existing.kpi += p.kpi;
        for (const [sc, val] of p.spends) {
          existing.spends.set(sc, (existing.spends.get(sc) ?? 0) + val);
        }
      } else {
        weeklyData.set(wk, { kpi: p.kpi, spends: new Map(p.spends) });
      }
    }
  } else {
    // Already weekly
    weeklyData = new Map();
    for (const p of parsed) {
      const wk = toISODate(p.date);
      weeklyData.set(wk, { kpi: p.kpi, spends: p.spends });
    }
  }

  // Sort weeks chronologically
  const sortedWeeks = Array.from(weeklyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (sortedWeeks.length < 4) return null;

  // 7. Build output
  const weekly_kpi = sortedWeeks.map(([, w]) => w.kpi);
  const channels: Array<{ channel: string; weekly_spend: number[] }> = [];

  for (const sc of spendCols) {
    channels.push({
      channel: channelName(sc),
      weekly_spend: sortedWeeks.map(([, w]) => w.spends.get(sc) ?? 0),
    });
  }

  return {
    weekly_kpi,
    channels,
    time_periods: sortedWeeks.length,
    date_range: {
      start: sortedWeeks[0]![0],
      end: sortedWeeks[sortedWeeks.length - 1]![0],
    },
    kpi_column: kpiCol,
    date_column: dateCol,
  };
}
