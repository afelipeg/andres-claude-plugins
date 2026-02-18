// ─── Data Parser ────────────────────────────────────────────────────
// Auto-detect CSV or JSON input and parse to typed objects

export type ParsedFormat = 'json' | 'csv';

export interface ParseResult {
  format: ParsedFormat;
  data: Record<string, unknown>[];
  columns: string[];
}

/**
 * Auto-detect format and parse input string.
 */
export function parseInput(raw: string): ParseResult {
  const trimmed = raw.trim();

  // Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const data = Array.isArray(parsed) ? parsed : [parsed];
      const columns = data.length > 0 ? Object.keys(data[0]) : [];
      return { format: 'json', data, columns };
    } catch {
      // Fall through to CSV
    }
  }

  // Parse as CSV
  return parseCSV(trimmed);
}

function parseCSV(raw: string): ParseResult {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { format: 'csv', data: [], columns: [] };

  const delimiter = raw.includes('\t') ? '\t' : ',';
  const columns = parseCsvLine(lines[0], delimiter);
  const data: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < columns.length; j++) {
      const val = values[j] ?? '';
      // Auto-convert numbers
      const num = Number(val);
      row[columns[j]] = val !== '' && !isNaN(num) ? num : val;
    }
    data.push(row);
  }

  return { format: 'csv', data, columns };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}
