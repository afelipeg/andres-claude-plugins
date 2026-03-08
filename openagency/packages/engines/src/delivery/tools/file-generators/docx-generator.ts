// ─── DOCX Generator ──────────────────────────────────────────────────
// Generates Word documents using the `docx` npm package.

import fs from 'node:fs';
import type { PlinthTemplate } from '@openagency/types';
import type { Paragraph, Table } from 'docx';
import { PLINTH_TEMPLATE } from '../../templates/base-template.js';

export interface DocxSection {
  heading: string;
  content: string;  // plain text (newlines respected)
  table?: { headers: string[]; rows: string[][] };
}

export interface DocxGeneratorInput {
  template?: PlinthTemplate;
  title: string;
  subtitle?: string;
  sections: DocxSection[];
  output_path: string;
}

export async function generateDocx(
  input: DocxGeneratorInput,
): Promise<{ path: string; size_bytes: number }> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, ShadingType,
    AlignmentType, BorderStyle,
  } = await import('docx');

  const tpl = input.template ?? PLINTH_TEMPLATE;
  const { colors } = tpl;

  // hex → docx color (strip leading #)
  const c = (hex: string) => hex.replace('#', '').toUpperCase();

  // ── Title paragraph ─────────────────────────────────────────────
  const titleSection = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: input.title, bold: true, color: c(colors.primary), size: 56 }),
      ],
    }),
    ...(input.subtitle
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
            children: [
              new TextRun({ text: input.subtitle, color: c(colors.secondary), size: 28, italics: true }),
            ],
          }),
        ]
      : []),
  ];

  // ── Content sections ────────────────────────────────────────────
  const contentChildren = input.sections.flatMap(section => {
    const items: (Paragraph | Table)[] = [];

    // Section heading
    items.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: section.heading, bold: true, color: c(colors.primary), size: 36 }),
        ],
        border: { bottom: { color: c(colors.highlight), size: 6, space: 4, style: BorderStyle.SINGLE } },
      }),
    );

    // Body paragraphs
    for (const line of section.content.split('\n')) {
      items.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: line || ' ', color: '333333', size: 22 })],
        }),
      );
    }

    // Table
    if (section.table && section.table.headers.length > 0) {
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          // Header row
          new TableRow({
            tableHeader: true,
            children: section.table.headers.map(
              h =>
                new TableCell({
                  shading: { fill: c(colors.primary), type: ShadingType.SOLID, color: 'auto' },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: h, bold: true, color: c(colors.accent), size: 20 }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
          // Data rows
          ...section.table.rows.map(
            (row, rowIdx) =>
              new TableRow({
                children: row.map(
                  cell =>
                    new TableCell({
                      shading:
                        rowIdx % 2 === 0
                          ? { fill: 'F5F5F5', type: ShadingType.SOLID, color: 'auto' }
                          : undefined,
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: cell, size: 20 })],
                        }),
                      ],
                    }),
                ),
              }),
          ),
        ],
      });
      items.push(table);
      // Space after table
      items.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
    }

    return items;
  });

  // ── Footer ──────────────────────────────────────────────────────
  const footerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [
      new TextRun({ text: tpl.footer, color: c(colors.secondary), size: 16, italics: true }),
    ],
  });

  const doc = new Document({
    creator: 'Plinth by Polanyi',
    title: input.title,
    sections: [
      {
        properties: {},
        children: [...titleSection, ...contentChildren, footerParagraph],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(input.output_path, buffer);
  return { path: input.output_path, size_bytes: buffer.byteLength };
}
