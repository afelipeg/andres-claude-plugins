// ─── XLSX Generator ──────────────────────────────────────────────────
// Generates Excel spreadsheets using exceljs.

import fs from 'node:fs';
import type { PlinthTemplate } from '@openagency/types';
import { PLINTH_TEMPLATE } from '../../templates/base-template.js';

export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  /** Optional column widths (chars). Defaults to 20. */
  columnWidths?: number[];
}

export interface XlsxGeneratorInput {
  template?: PlinthTemplate;
  title: string;
  sheets: XlsxSheet[];
  output_path: string;
}

export async function generateXlsx(
  input: XlsxGeneratorInput,
): Promise<{ path: string; size_bytes: number }> {
  const { default: ExcelJS } = await import('exceljs');
  const tpl = input.template ?? PLINTH_TEMPLATE;
  const { colors } = tpl;

  // hex → ExcelJS ARGB (FF + hex without #)
  const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Plinth by Polanyi';
  wb.created = new Date();
  wb.modified = new Date();
  wb.title = input.title;

  for (const sheet of input.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: 'frozen', ySplit: 1 }], // freeze header row
    });

    // Column definitions
    ws.columns = sheet.headers.map((header, i) => ({
      header,
      key: `col${i}`,
      width: sheet.columnWidths?.[i] ?? 22,
    }));

    // Style header row (row 1)
    ws.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(colors.primary) },
      };
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: argb(colors.accent) },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      cell.border = {
        bottom: { style: 'thin', color: { argb: argb(colors.highlight) } },
      };
    });
    ws.getRow(1).height = 24;

    // Data rows
    sheet.rows.forEach((rowData, idx) => {
      const wsRow = ws.addRow(rowData);
      wsRow.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', wrapText: false };
        // Alternating row shade
        if (idx % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
        }
        // Right-align numbers
        if (typeof cell.value === 'number') {
          cell.alignment = { ...cell.alignment, horizontal: 'right' };
          cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.00';
        }
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE0E0E0' } },
        };
      });
    });

    // Auto-fit columns based on content (ExcelJS doesn't auto-fit natively)
    ws.columns.forEach(col => {
      let maxLen = (col.header as string)?.length ?? 10;
      col.eachCell?.({ includeEmpty: false }, cell => {
        const len = cell.value != null ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(Math.max(maxLen + 2, 12), 50);
    });
  }

  await wb.xlsx.writeFile(input.output_path);
  const stat = await fs.promises.stat(input.output_path);
  return { path: input.output_path, size_bytes: stat.size };
}
