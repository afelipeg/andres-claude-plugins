// ─── PPTX Generator ──────────────────────────────────────────────────
// Generates PowerPoint files with Plinth brand using pptxgenjs.

import fs from 'node:fs';
import type { PlinthTemplate } from '@openagency/types';
import { PLINTH_TEMPLATE } from '../../templates/base-template.js';

export interface PptxSlide {
  heading: string;
  body?: string;
  table?: { headers: string[]; rows: string[][] };
  kpis?: { label: string; value: string; delta?: string }[];
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
        x: 0.5, y: 0.9, w: '90%', h: 4.5,
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

    // KPI grid (up to 9 — 3 cols × 3 rows)
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
  }

  await prs.writeFile({ fileName: input.output_path });
  const stat = await fs.promises.stat(input.output_path);
  return { path: input.output_path, size_bytes: stat.size };
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
