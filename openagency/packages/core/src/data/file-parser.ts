// ─── File Parser ─────────────────────────────────────────────────────
// Parse uploaded files (CSV, JSON, TSV, Excel, PDF) into row arrays.
// Delegates text-based formats to the existing parseInput() and adds
// binary format support via xlsx (SheetJS) and pdfjs-dist (PDF.js).

import { parseInput, type ParseResult } from './parser.js';

export type FileFormat = 'csv' | 'json' | 'xlsx' | 'pdf' | 'docx';

export interface FileParseResult {
  format: FileFormat;
  data: Record<string, unknown>[];
  columns: string[];
}

const TEXT_EXTENSIONS = new Set(['.csv', '.tsv', '.txt', '.json']);
const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const WORD_EXTENSIONS = new Set(['.docx', '.doc']);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

/**
 * Parse a file buffer into structured row data.
 * Supports CSV, JSON, TSV, Excel (.xlsx/.xls), and PDF.
 */
export async function parseFile(
  buffer: ArrayBuffer,
  filename: string,
): Promise<FileParseResult> {
  const ext = getExtension(filename);

  if (TEXT_EXTENSIONS.has(ext)) {
    const text = new TextDecoder().decode(buffer);
    const result: ParseResult = parseInput(text);
    return {
      format: result.format === 'json' ? 'json' : 'csv',
      data: result.data,
      columns: result.columns,
    };
  }

  if (EXCEL_EXTENSIONS.has(ext)) {
    return parseExcel(buffer);
  }

  if (PDF_EXTENSIONS.has(ext)) {
    return parsePdf(buffer);
  }

  if (WORD_EXTENSIONS.has(ext)) {
    return parseWord(buffer);
  }

  throw new Error(
    `Unsupported file type: ${ext || 'unknown'}. Supported: .csv, .tsv, .json, .xlsx, .xls, .pdf, .docx`,
  );
}

/**
 * Parse Excel files using SheetJS (xlsx).
 * Reads the first sheet by default and converts to row objects.
 */
async function parseExcel(buffer: ArrayBuffer): Promise<FileParseResult> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { format: 'xlsx', data: [], columns: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  // Clean numeric values: strip currency symbols, commas, etc.
  const cleaned = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      out[key] = cleanCellValue(val);
    }
    return out;
  });

  const columns = cleaned.length > 0 ? Object.keys(cleaned[0]) : [];
  return { format: 'xlsx', data: cleaned, columns };
}

/**
 * Clean a cell value from Excel:
 * - If already a number, return as-is
 * - If string looks numeric after stripping $, commas, %, return number
 * - Otherwise return string
 */
function cleanCellValue(val: unknown): unknown {
  if (val == null || val === '') return '';
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return val;

  const stripped = val.replace(/[$€£¥,\s]/g, '').trim();
  if (stripped === '' || stripped === '--' || stripped === 'N/A') return val;

  // Handle percentages: "5.2%" -> 5.2 (keep as percentage number)
  if (stripped.endsWith('%')) {
    const num = Number(stripped.slice(0, -1));
    if (!isNaN(num)) return num;
  }

  const num = Number(stripped);
  if (!isNaN(num)) return num;
  return val;
}

/**
 * Parse PDF files using pdfjs-dist.
 * Extracts text content and attempts to reconstruct tabular data.
 */
async function parsePdf(buffer: ArrayBuffer): Promise<FileParseResult> {
  // Dynamic import to avoid bundling issues in environments without canvas
  const pdfjsLib = await import('pdfjs-dist');

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    .promise;

  const allLines: string[][] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y position to reconstruct rows
    const lineMap = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      // Round Y to nearest 2px to group items on the same line
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, text: item.str.trim() });
    }

    // Sort lines by Y (descending — PDF coordinates are bottom-up)
    const sortedLines = [...lineMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map((item) => item.text),
      );

    allLines.push(...sortedLines);
  }

  if (allLines.length === 0) {
    return { format: 'pdf', data: [], columns: [] };
  }

  // First non-empty line with multiple cells is likely the header
  const headerIdx = allLines.findIndex((line) => line.length > 1);
  if (headerIdx < 0) {
    // Single-column or unstructured PDF — return raw lines
    return {
      format: 'pdf',
      data: allLines.map((line) => ({ text: line.join(' ') })),
      columns: ['text'],
    };
  }

  const columns = allLines[headerIdx];
  const data: Record<string, unknown>[] = [];

  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const values = allLines[i];
    if (values.length === 0) continue;
    // Skip lines that look like the header repeated
    if (values.join('|') === columns.join('|')) continue;

    const row: Record<string, unknown> = {};
    for (let j = 0; j < columns.length; j++) {
      const val = values[j] ?? '';
      row[columns[j]] = cleanCellValue(val);
    }
    data.push(row);
  }

  return { format: 'pdf', data, columns };
}

/**
 * Parse Word documents (.docx) using mammoth.
 * Extracts raw text and splits into paragraphs as rows.
 */
async function parseWord(buffer: ArrayBuffer): Promise<FileParseResult> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const text = result.value ?? '';

  // Split into non-empty paragraphs
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) {
    return { format: 'docx', data: [], columns: [] };
  }

  // Try to detect tabular data (tab-separated or pipe-separated)
  const firstLine = paragraphs[0];
  const separator = firstLine.includes('\t') ? '\t' : firstLine.includes('|') ? '|' : null;

  if (separator && paragraphs.length > 1) {
    const columns = firstLine.split(separator).map((c) => c.trim()).filter(Boolean);
    const data: Record<string, unknown>[] = [];
    for (let i = 1; i < paragraphs.length; i++) {
      const values = paragraphs[i].split(separator).map((v) => v.trim());
      if (values.length === 0 || values.join('') === '') continue;
      const row: Record<string, unknown> = {};
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]] = cleanCellValue(values[j] ?? '');
      }
      data.push(row);
    }
    if (data.length > 0) return { format: 'docx', data, columns };
  }

  // Unstructured text — return as paragraphs
  return {
    format: 'docx',
    data: paragraphs.map((p) => ({ text: p })),
    columns: ['text'],
  };
}
