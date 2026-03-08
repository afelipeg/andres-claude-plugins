// ─── PDF Generator ───────────────────────────────────────────────────
// Generates PDF files using pdfkit (pure Node.js, no browser required).

import fs from 'node:fs';
import type { PlinthTemplate } from '@openagency/types';
import { PLINTH_TEMPLATE } from '../../templates/base-template.js';

export interface PdfSection {
  heading: string;
  content: string;  // plain text (newlines respected)
  table?: { headers: string[]; rows: string[][] };
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
