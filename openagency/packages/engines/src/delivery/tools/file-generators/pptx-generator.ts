// ─── PPTX Generator ──────────────────────────────────────────────────
// Generates PowerPoint files with Plinth brand using pptxgenjs.
// Supports native pptxgenjs charts (bar, pie, line, etc.).

import fs from 'node:fs';
import type { PlinthTemplate } from '@openagency/types';
import { PLINTH_TEMPLATE } from '../../templates/base-template.js';
import type { ChartData } from '../chart-generator.js';
import { toPptxChartData, CHART_PALETTE } from '../chart-generator.js';

export interface PptxSlide {
  heading: string;
  body?: string;
  table?: { headers: string[]; rows: string[][] };
  kpis?: { label: string; value: string; delta?: string }[];
  /** Optional chart rendered using pptxgenjs native chart API. */
  chart?: ChartData;
}

export interface PptxGeneratorInput {
  template?: PlinthTemplate;
  title: string;
  subtitle?: string;
  slides: PptxSlide[];
  output_path: string;
}

export async function generatePptx(
  input: PptxGeneratorInput,
): Promise<{ path: string; size_bytes: number }> {
  // Dynamic import — pptxgenjs is large, only load when needed
  const pptxgenModule = await import('pptxgenjs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PptxGen: any = pptxgenModule.default ?? pptxgenModule;
  const prs = new PptxGen();
  const tpl = input.template ?? PLINTH_TEMPLATE;
  const { colors } = tpl;

  prs.layout = 'LAYOUT_WIDE';
  prs.author = 'Plinth by Polanyi';
  prs.company = 'Polanyi';

  // ── Title slide ─────────────────────────────────────────────────
  const titleSlide = prs.addSlide();
  titleSlide.background = { color: colors.primary.replace('#', '') };
  titleSlide.addText(input.title, {
    x: 0.5, y: 2.5, w: '90%',
    fontSize: 36, bold: true,
    color: colors.accent.replace('#', ''),
    fontFace: 'Arial',
    align: 'center',
  });
  if (input.subtitle) {
    titleSlide.addText(input.subtitle, {
      x: 0.5, y: 3.5, w: '90%',
      fontSize: 16,
      color: colors.secondary.replace('#', ''),
      fontFace: 'Arial',
      align: 'center',
    });
  }
  addFooterToSlide(titleSlide, tpl);

  // ── Content slides ───────────────────────────────────────────────
  for (const slide of input.slides) {
    const s = prs.addSlide();
    s.background = { color: 'FFFFFF' };

    // Heading bar
    s.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.7,
      fill: { color: colors.primary.replace('#', '') },
    });
    s.addText(slide.heading, {
      x: 0.3, y: 0.1, w: '90%', h: 0.5,
      fontSize: 18, bold: true,
      color: colors.accent.replace('#', ''),
      fontFace: 'Arial',
    });

    addFooterToSlide(s, tpl);

    // Body text
    if (slide.body) {
      s.addText(slide.body, {
        x: 0.5, y: 0.9, w: '90%', h: slide.chart ? 1.8 : 4.5,
        fontSize: 13,
        color: '333333',
        fontFace: 'Arial',
        valign: 'top',
        wrap: true,
      });
    }

    // Table
    if (slide.table) {
      const tableRows = [
        slide.table.headers.map((h: string) => ({
          text: h,
          options: {
            bold: true,
            color: colors.accent.replace('#', ''),
            fill: colors.primary.replace('#', ''),
          },
        })),
        ...slide.table.rows.map((row: string[]) =>
          row.map((cell: string) => ({ text: cell, options: { color: '333333' } })),
        ),
      ];
      s.addTable(tableRows, {
        x: 0.5, y: 0.9, w: 9,
        fontSize: 11,
        border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
        rowH: 0.4,
      });
    }

    // KPI grid (up to 9 — 3 cols x 3 rows)
    if (slide.kpis) {
      slide.kpis.slice(0, 9).forEach((kpi: { label: string; value: string; delta?: string }, i: number) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 0.5 + col * 3.3;
        const y = 1.0 + row * 1.6;

        s.addShape(prs.ShapeType.roundRect, {
          x, y, w: 3.0, h: 1.4,
          fill: { color: 'F8F8F8' },
          line: { color: 'E0E0E0', pt: 1 },
        });
        s.addText(kpi.label, {
          x, y: y + 0.1, w: 3.0, h: 0.3,
          fontSize: 9, color: '888888',
          fontFace: 'Arial', align: 'center',
        });
        s.addText(kpi.value, {
          x, y: y + 0.4, w: 3.0, h: 0.6,
          fontSize: 26, bold: true,
          color: colors.primary.replace('#', ''),
          fontFace: 'Arial', align: 'center',
        });
        if (kpi.delta) {
          s.addText(kpi.delta, {
            x, y: y + 1.0, w: 3.0, h: 0.3,
            fontSize: 10,
            color: colors.highlight.replace('#', ''),
            fontFace: 'Arial', align: 'center',
          });
        }
      });
    }

    // Chart (using pptxgenjs native chart API)
    if (slide.chart && slide.chart.data.length > 0) {
      try {
        addChartToSlide(prs, s, slide.chart, slide.body ? 3.0 : 0.9);
      } catch {
        // Graceful fallback — add a text note instead of crashing
        s.addText('[Chart could not be rendered]', {
          x: 0.5, y: slide.body ? 3.0 : 0.9, w: 9, h: 0.4,
          fontSize: 11, color: '999999', fontFace: 'Arial', italic: true,
        });
      }
    }
  }

  await prs.writeFile({ fileName: input.output_path });
  const stat = await fs.promises.stat(input.output_path);
  return { path: input.output_path, size_bytes: stat.size };
}

// ─── Chart slide helper ─────────────────────────────────────────────

/**
 * Add a standalone chart slide to the presentation.
 * Uses pptxgenjs native chart support for bar, pie, line, and doughnut.
 */
export function addChartSlide(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pres: any,
  chart: ChartData,
  slideTitle: string,
  template?: PlinthTemplate,
): void {
  const tpl = template ?? PLINTH_TEMPLATE;
  const { colors } = tpl;
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };

  // Heading bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.7,
    fill: { color: colors.primary.replace('#', '') },
  });
  s.addText(slideTitle, {
    x: 0.3, y: 0.1, w: '90%', h: 0.5,
    fontSize: 18, bold: true,
    color: colors.accent.replace('#', ''),
    fontFace: 'Arial',
  });

  addFooterToSlide(s, tpl);
  addChartToSlide(pres, s, chart, 0.9);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addChartToSlide(pres: any, slide: any, chart: ChartData, yPos: number): void {
  const chartData = toPptxChartData(chart);
  const chartColors = (chart.options?.colors ?? CHART_PALETTE).map(c => c.replace('#', ''));

  const baseOpts = {
    x: 0.5,
    y: yPos,
    w: 9,
    h: 7.5 - yPos - 0.8,
    showTitle: true,
    title: chart.title,
    titleFontSize: 14,
    titleColor: '333333',
    showValue: chart.options?.showValues ?? false,
    showLegend: chart.options?.showLegend ?? (chartData.length > 1),
    legendPos: 'b' as const,
    legendFontSize: 9,
    chartColors,
    valAxisLabelFontSize: 9,
    catAxisLabelFontSize: 9,
    catAxisLabelRotate: chartData[0] && chartData[0].labels.some(l => l.length > 8) ? 315 : 0,
  };

  switch (chart.type) {
    case 'bar':
      slide.addChart(pres.charts.BAR, chartData, {
        ...baseOpts,
        barDir: 'col',
        barGapWidthPct: 80,
        valAxisMajorUnit: undefined,
      });
      break;

    case 'pie':
      slide.addChart(pres.charts.DOUGHNUT, chartData, {
        ...baseOpts,
        showPercent: true,
        showValue: false,
        showLegend: true,
        legendPos: 'r',
        dataLabelPosition: 'outEnd',
        dataLabelFontSize: 10,
      });
      break;

    case 'line':
      slide.addChart(pres.charts.LINE, chartData, {
        ...baseOpts,
        lineSize: 2,
        lineSmooth: false,
        showMarker: true,
        markerSize: 6,
      });
      break;

    case 'stacked_bar':
      slide.addChart(pres.charts.BAR, chartData, {
        ...baseOpts,
        barDir: 'col',
        barGrouping: 'stacked',
        barGapWidthPct: 80,
        showLegend: true,
      });
      break;

    case 'waterfall': {
      // pptxgenjs doesn't have a native waterfall type.
      // Approximate using a stacked bar with invisible base segments.
      const waterfallData = buildWaterfallStacked(chart);
      slide.addChart(pres.charts.BAR, waterfallData.series, {
        ...baseOpts,
        barDir: 'col',
        barGrouping: 'stacked',
        barGapWidthPct: 60,
        showLegend: false,
        chartColors: waterfallData.colors,
      });
      break;
    }
  }
}

/** Build stacked bar data to simulate a waterfall chart in pptxgenjs. */
function buildWaterfallStacked(chart: ChartData): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  series: any[];
  colors: string[];
} {
  const labels = chart.data.map(d => d.label);
  const invisBase: number[] = [];
  const posValues: number[] = [];
  const negValues: number[] = [];

  let running = 0;
  for (const d of chart.data) {
    if (d.value >= 0) {
      invisBase.push(running);
      posValues.push(d.value);
      negValues.push(0);
      running += d.value;
    } else {
      running += d.value; // running goes down
      invisBase.push(running);
      posValues.push(0);
      negValues.push(Math.abs(d.value));
    }
  }

  return {
    series: [
      { name: '_base', labels, values: invisBase },
      { name: 'Increase', labels, values: posValues },
      { name: 'Decrease', labels, values: negValues },
    ],
    colors: ['FFFFFF', '059669', 'DC2626'], // invisible, green, red
  };
}

function addFooterToSlide(slide: unknown, tpl: PlinthTemplate): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (slide as any).addText(tpl.footer, {
    x: 0.3, y: 7.1, w: '90%', h: 0.25,
    fontSize: 7,
    color: tpl.colors.secondary.replace('#', ''),
    fontFace: 'Arial',
    italic: true,
    align: 'center',
  });
}
