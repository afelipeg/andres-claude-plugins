// ─── PDF Generator ───────────────────────────────────────────────────
// Generates PDF files using pdfkit (pure Node.js, no browser required).
// Supports inline chart rendering via pdfkit drawing primitives.

import fs from 'node:fs';
import type { PlinthTemplate } from '@openagency/types';
import { PLINTH_TEMPLATE } from '../../templates/base-template.js';
import type { ChartData, ChartDataPoint } from '../chart-generator.js';
import { CHART_PALETTE } from '../chart-generator.js';

export interface PdfSection {
  heading: string;
  content: string;  // plain text (newlines respected)
  table?: { headers: string[]; rows: string[][] };
  /** Optional chart to render in this section (drawn using pdfkit primitives). */
  chart?: ChartData;
}

export interface PdfGeneratorInput {
  template?: PlinthTemplate;
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  output_path: string;
}

export async function generatePdf(
  input: PdfGeneratorInput,
): Promise<{ path: string; size_bytes: number }> {
  const { default: PDFDocument } = await import('pdfkit');
  const tpl = input.template ?? PLINTH_TEMPLATE;
  const { colors, footer, fonts } = tpl;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: { Title: input.title, Author: 'Plinth by Polanyi' },
    });

    const stream = fs.createWriteStream(input.output_path);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;
    const marginX = 60;
    const contentW = W - marginX * 2;

    // ── Title page ─────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(colors.primary);
    doc
      .fillColor(colors.accent)
      .fontSize(32)
      .font(fonts.heading)
      .text(input.title, marginX, H * 0.35, { width: contentW, align: 'center' });

    if (input.subtitle) {
      doc
        .fillColor(colors.secondary)
        .fontSize(14)
        .font(fonts.body)
        .text(input.subtitle, marginX, H * 0.35 + 60, { width: contentW, align: 'center' });
    }

    // Footer on title page
    doc
      .fillColor(colors.secondary)
      .fontSize(9)
      .font(fonts.body)
      .text(footer, marginX, H - 80, { width: contentW, align: 'center' });

    // ── Content sections ────────────────────────────────────────────
    for (const section of input.sections) {
      doc.addPage();

      // Section heading bar
      doc.rect(marginX, 60, contentW, 2).fill(colors.primary);
      doc
        .fillColor(colors.primary)
        .fontSize(20)
        .font(fonts.heading)
        .text(section.heading, marginX, 72);

      // Highlight underline
      const headY = doc.y + 2;
      doc.rect(marginX, headY, 60, 3).fill(colors.highlight);
      doc.moveDown(1.2);

      // Body content
      doc
        .fillColor('#333333')
        .fontSize(11)
        .font(fonts.body);

      for (const line of section.content.split('\n')) {
        doc.text(line || ' ', marginX, doc.y, { width: contentW, lineGap: 3 });
      }

      // Table
      if (section.table && section.table.headers.length > 0) {
        doc.moveDown(1);
        const cols = section.table.headers.length;
        const cellW = contentW / cols;
        const cellH = 22;

        // Header row
        const headerY = doc.y;
        section.table.headers.forEach((h, i) => {
          doc.rect(marginX + i * cellW, headerY, cellW, cellH).fill(colors.primary);
          doc
            .fillColor(colors.accent)
            .fontSize(9)
            .font(fonts.heading)
            .text(h, marginX + i * cellW + 4, headerY + 6, { width: cellW - 8 });
        });
        doc.moveDown(cellH / (doc.currentLineHeight() || 14));

        // Data rows
        for (const row of section.table.rows) {
          const rowY = doc.y;
          // Alternate row background
          const rowIndex = section.table.rows.indexOf(row);
          if (rowIndex % 2 === 0) {
            doc.rect(marginX, rowY, contentW, cellH).fill('#F5F5F5');
          }
          row.forEach((cell, i) => {
            doc.rect(marginX + i * cellW, rowY, cellW, cellH).stroke('#DDDDDD');
            doc
              .fillColor('#333333')
              .fontSize(9)
              .font(fonts.body)
              .text(cell, marginX + i * cellW + 4, rowY + 6, { width: cellW - 8 });
          });
          doc.moveDown(cellH / (doc.currentLineHeight() || 14));
        }
      }

      // Chart (rendered using pdfkit drawing primitives)
      if (section.chart && section.chart.data.length > 0) {
        doc.moveDown(1);
        try {
          addChartToPdf(doc, section.chart, marginX, doc.y, contentW, 220);
        } catch {
          // Graceful fallback — chart rendering failed, continue without it
          doc
            .fillColor('#999999')
            .fontSize(9)
            .font(fonts.body)
            .text('[Chart could not be rendered]', marginX, doc.y, { width: contentW });
        }
      }

      // Footer
      doc
        .fillColor(colors.secondary)
        .fontSize(8)
        .font(fonts.body)
        .text(footer, marginX, H - 50, { width: contentW, align: 'center' });
    }

    doc.end();

    stream.on('finish', async () => {
      try {
        const stat = await fs.promises.stat(input.output_path);
        resolve({ path: input.output_path, size_bytes: stat.size });
      } catch (err) {
        reject(err);
      }
    });

    stream.on('error', reject);
  });
}

// ─── Chart Drawing (pdfkit primitives) ──────────────────────────────

// pdfkit PDFDocument is dynamically imported — use PDFKit namespace from @types/pdfkit
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;

function fmtVal(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/**
 * Draw a chart into the PDF at the given position using pdfkit primitives.
 * Supports bar, pie, line, stacked_bar, and waterfall chart types.
 */
export function addChartToPdf(
  doc: PDFDoc,
  chart: ChartData,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const palette = chart.options?.colors ?? CHART_PALETTE;

  // Chart title
  doc
    .save()
    .fillColor('#333333')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(chart.title, x, y, { width, align: 'center' });

  const titleH = 20;
  const chartY = y + titleH;
  const chartH = height - titleH;

  switch (chart.type) {
    case 'bar':
      drawBarChart(doc, chart.data, x, chartY, width, chartH, palette);
      break;
    case 'pie':
      drawPieChart(doc, chart.data, x, chartY, width, chartH, palette);
      break;
    case 'line':
      drawLineChart(doc, chart.data, x, chartY, width, chartH, palette);
      break;
    case 'stacked_bar':
      drawStackedBarChart(doc, chart.data, x, chartY, width, chartH, palette);
      break;
    case 'waterfall':
      drawWaterfallChart(doc, chart.data, x, chartY, width, chartH, palette);
      break;
  }

  doc.restore();
  // Move doc.y past the chart
  doc.y = y + height + 10;
}

function drawBarChart(
  doc: PDFDoc,
  data: ChartDataPoint[],
  x: number, y: number, w: number, h: number,
  palette: string[],
): void {
  const padLeft = 50;
  const padBottom = 30;
  const padRight = 10;
  const chartW = w - padLeft - padRight;
  const chartH = h - padBottom;

  const maxVal = Math.max(...data.map((d: ChartDataPoint) => Math.abs(d.value)), 1);
  const barW = Math.min(35, (chartW / data.length) * 0.6);
  const gap = (chartW - barW * data.length) / (data.length + 1);

  // Y-axis gridlines
  for (let i = 0; i <= 4; i++) {
    const gy = y + (chartH / 4) * i;
    doc.save().strokeColor('#E5E7EB').lineWidth(0.5)
      .moveTo(x + padLeft, gy).lineTo(x + w - padRight, gy).stroke().restore();
    const val = maxVal - (maxVal / 4) * i;
    doc.save().fillColor('#999999').fontSize(7).font('Helvetica')
      .text(fmtVal(val), x, gy - 4, { width: padLeft - 6, align: 'right' }).restore();
  }

  // Bars
  data.forEach((d: ChartDataPoint, i: number) => {
    const bx = x + padLeft + gap + i * (barW + gap);
    const barH = (Math.abs(d.value) / maxVal) * chartH;
    const by = y + chartH - barH;
    const color = d.color ?? palette[i % palette.length]!;

    doc.save().rect(bx, by, barW, barH).fill(color).restore();

    // Value
    doc.save().fillColor('#333333').fontSize(7).font('Helvetica-Bold')
      .text(fmtVal(d.value), bx - 5, by - 10, { width: barW + 10, align: 'center' }).restore();

    // Label
    doc.save().fillColor('#666666').fontSize(7).font('Helvetica')
      .text(d.label, bx - 10, y + chartH + 3, { width: barW + 20, align: 'center' }).restore();
  });

  // Baseline
  doc.save().strokeColor('#333333').lineWidth(0.5)
    .moveTo(x + padLeft, y + chartH).lineTo(x + w - padRight, y + chartH).stroke().restore();
}

function drawPieChart(
  doc: PDFDoc,
  data: ChartDataPoint[],
  x: number, y: number, w: number, h: number,
  palette: string[],
): void {
  const positiveData = data.filter((d: ChartDataPoint) => d.value > 0);
  if (positiveData.length === 0) return;

  const total = positiveData.reduce((s: number, d: ChartDataPoint) => s + d.value, 0);
  const cx = x + w * 0.35;
  const cy = y + h / 2;
  const r = Math.min(w * 0.28, h * 0.42);

  let startAngle = -Math.PI / 2;

  positiveData.forEach((d: ChartDataPoint, i: number) => {
    const pct = d.value / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const color = d.color ?? palette[i % palette.length]!;

    // Draw arc segment as a filled path
    // pdfkit doesn't have a pie/arc method, so we approximate with a polygon
    const steps = Math.max(Math.ceil(angle / 0.1), 4);
    doc.save();
    doc.moveTo(cx, cy);
    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (angle / steps) * s;
      doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    doc.lineTo(cx, cy);
    doc.fill(color);
    doc.restore();

    // Label on arc midpoint
    const midAngle = startAngle + angle / 2;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    if (pct >= 0.05) {
      doc.save().fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text(`${(pct * 100).toFixed(0)}%`, lx - 15, ly - 4, { width: 30, align: 'center' }).restore();
    }

    startAngle = endAngle;
  });

  // Legend on the right side
  const legendX = x + w * 0.65;
  positiveData.forEach((d: ChartDataPoint, i: number) => {
    const ly = y + 10 + i * 16;
    const color = d.color ?? palette[i % palette.length]!;
    doc.save().rect(legendX, ly, 8, 8).fill(color).restore();
    doc.save().fillColor('#333333').fontSize(8).font('Helvetica')
      .text(`${d.label} (${fmtVal(d.value)})`, legendX + 12, ly - 1, { width: w * 0.3 }).restore();
  });
}

function drawLineChart(
  doc: PDFDoc,
  data: ChartDataPoint[],
  x: number, y: number, w: number, h: number,
  palette: string[],
): void {
  const padLeft = 50;
  const padBottom = 30;
  const padRight = 10;
  const chartW = w - padLeft - padRight;
  const chartH = h - padBottom;

  const allValues = data.map((d: ChartDataPoint) => d.value);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  // Group by series
  const seriesMap = new Map<string, ChartDataPoint[]>();
  for (const d of data) {
    const key = d.series ?? 'default';
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    seriesMap.get(key)!.push(d);
  }

  const xLabels = [...new Set(data.map((d: ChartDataPoint) => d.label))];
  const xStep = chartW / Math.max(xLabels.length - 1, 1);

  // Grid
  for (let i = 0; i <= 4; i++) {
    const gy = y + (chartH / 4) * i;
    doc.save().strokeColor('#E5E7EB').lineWidth(0.5)
      .moveTo(x + padLeft, gy).lineTo(x + w - padRight, gy).stroke().restore();
    const val = maxVal - (range / 4) * i;
    doc.save().fillColor('#999999').fontSize(7).font('Helvetica')
      .text(fmtVal(val), x, gy - 4, { width: padLeft - 6, align: 'right' }).restore();
  }

  // X labels
  xLabels.forEach((label: string, i: number) => {
    const lx = x + padLeft + i * xStep;
    doc.save().fillColor('#666666').fontSize(7).font('Helvetica')
      .text(label, lx - 20, y + chartH + 3, { width: 40, align: 'center' }).restore();
  });

  // Lines
  let si = 0;
  for (const [, points] of seriesMap) {
    const color = palette[si % palette.length]!;
    const coords: { px: number; py: number }[] = [];

    for (const p of points) {
      const xi = xLabels.indexOf(p.label);
      if (xi < 0) continue;
      const px = x + padLeft + xi * xStep;
      const py = y + chartH - ((p.value - minVal) / range) * chartH;
      coords.push({ px, py });
    }

    if (coords.length > 1) {
      doc.save().strokeColor(color).lineWidth(2);
      doc.moveTo(coords[0]!.px, coords[0]!.py);
      for (let i = 1; i < coords.length; i++) {
        doc.lineTo(coords[i]!.px, coords[i]!.py);
      }
      doc.stroke().restore();
    }

    for (const c of coords) {
      doc.save().circle(c.px, c.py, 3).fill(color).restore();
    }
    si++;
  }

  // Axes
  doc.save().strokeColor('#333333').lineWidth(0.5)
    .moveTo(x + padLeft, y).lineTo(x + padLeft, y + chartH).stroke()
    .moveTo(x + padLeft, y + chartH).lineTo(x + w - padRight, y + chartH).stroke()
    .restore();
}

function drawStackedBarChart(
  doc: PDFDoc,
  data: ChartDataPoint[],
  x: number, y: number, w: number, h: number,
  palette: string[],
): void {
  const padLeft = 50;
  const padBottom = 30;
  const padRight = 10;
  const chartW = w - padLeft - padRight;
  const chartH = h - padBottom;

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

  let maxStack = 0;
  for (const seriesVals of stacks.values()) {
    let sum = 0;
    for (const v of seriesVals.values()) sum += Math.abs(v);
    if (sum > maxStack) maxStack = sum;
  }
  if (maxStack === 0) maxStack = 1;

  const barW = Math.min(35, (chartW / labels.length) * 0.6);
  const gap = (chartW - barW * labels.length) / (labels.length + 1);

  labels.forEach((label: string, li: number) => {
    const bx = x + padLeft + gap + li * (barW + gap);
    let yOffset = 0;
    const seriesVals = stacks.get(label)!;

    for (let si = 0; si < seriesNames.length; si++) {
      const val = seriesVals.get(seriesNames[si]!) ?? 0;
      if (val === 0) continue;
      const segH = (Math.abs(val) / maxStack) * chartH;
      const by = y + chartH - yOffset - segH;
      const color = palette[si % palette.length]!;
      doc.save().rect(bx, by, barW, segH).fill(color).restore();
      yOffset += segH;
    }

    doc.save().fillColor('#666666').fontSize(7).font('Helvetica')
      .text(label, bx - 10, y + chartH + 3, { width: barW + 20, align: 'center' }).restore();
  });

  // Legend
  seriesNames.forEach((name: string, i: number) => {
    const lx = x + padLeft + i * 90;
    const ly = y + h - 8;
    doc.save().rect(lx, ly, 8, 8).fill(palette[i % palette.length]!).restore();
    doc.save().fillColor('#333333').fontSize(7).font('Helvetica')
      .text(name, lx + 12, ly - 1).restore();
  });

  doc.save().strokeColor('#333333').lineWidth(0.5)
    .moveTo(x + padLeft, y + chartH).lineTo(x + w - padRight, y + chartH).stroke().restore();
}

function drawWaterfallChart(
  doc: PDFDoc,
  data: ChartDataPoint[],
  x: number, y: number, w: number, h: number,
  palette: string[],
): void {
  const padLeft = 50;
  const padBottom = 30;
  const padRight = 10;
  const chartW = w - padLeft - padRight;
  const chartH = h - padBottom;

  const positiveColor = palette[1] ?? '#059669';
  const negativeColor = palette[2] ?? '#dc2626';

  // Running totals
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

  const barW = Math.min(35, (chartW / bars.length) * 0.6);
  const gap = (chartW - barW * bars.length) / (bars.length + 1);

  const toY = (v: number) => y + chartH - ((v - minVal) / range) * chartH;

  bars.forEach((b, i) => {
    const bx = x + padLeft + gap + i * (barW + gap);
    const y1 = toY(b.start);
    const y2 = toY(b.end);
    const top = Math.min(y1, y2);
    const barH = Math.max(Math.abs(y1 - y2), 1);
    const color = b.value >= 0 ? positiveColor : negativeColor;

    doc.save().rect(bx, top, barW, barH).fill(color).restore();

    // Connector to next
    if (i < bars.length - 1) {
      const nextX = x + padLeft + gap + (i + 1) * (barW + gap);
      doc.save().strokeColor('#E5E7EB').lineWidth(0.5).dash(3, { space: 2 })
        .moveTo(bx + barW, toY(b.end)).lineTo(nextX, toY(b.end)).stroke().restore();
    }

    // Value label
    const prefix = b.value >= 0 ? '+' : '';
    const valY = b.value >= 0 ? top - 10 : top + barH + 2;
    doc.save().fillColor(color).fontSize(7).font('Helvetica-Bold')
      .text(`${prefix}${fmtVal(b.value)}`, bx - 5, valY, { width: barW + 10, align: 'center' }).restore();

    // X label
    doc.save().fillColor('#666666').fontSize(7).font('Helvetica')
      .text(b.label, bx - 10, y + chartH + 3, { width: barW + 20, align: 'center' }).restore();
  });

  // Zero line
  doc.save().strokeColor('#333333').lineWidth(0.5).dash(4, { space: 2 })
    .moveTo(x + padLeft, toY(0)).lineTo(x + w - padRight, toY(0)).stroke().restore();
}
