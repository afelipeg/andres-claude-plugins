import { describe, it, expect } from 'vitest';
import { parseFile } from '../src/data/file-parser';
import { detectPlatform } from '../src/data/platform-detect';

// Helper: encode string to ArrayBuffer
function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe('parseFile', () => {
  // ─── CSV passthrough ─────────────────────────────────────────────
  describe('CSV/JSON passthrough', () => {
    it('parses CSV text files via parseInput', async () => {
      const csv = 'Campaign,Spend,Clicks\nBrand,1000,50\nRetarget,2000,80';
      const result = await parseFile(toBuffer(csv), 'report.csv');
      expect(result.format).toBe('csv');
      expect(result.columns).toEqual(['Campaign', 'Spend', 'Clicks']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]['Campaign']).toBe('Brand');
      expect(result.data[0]['Spend']).toBe(1000);
    });

    it('parses TSV files', async () => {
      const tsv = 'Campaign\tSpend\nBrand\t1000';
      const result = await parseFile(toBuffer(tsv), 'report.tsv');
      expect(result.format).toBe('csv');
      expect(result.data[0]['Campaign']).toBe('Brand');
    });

    it('parses JSON files', async () => {
      const json = JSON.stringify([{ campaign: 'Brand', spend: 1000 }]);
      const result = await parseFile(toBuffer(json), 'data.json');
      expect(result.format).toBe('json');
      expect(result.data[0]['campaign']).toBe('Brand');
    });

    it('parses .txt files as CSV', async () => {
      const csv = 'a,b\n1,2';
      const result = await parseFile(toBuffer(csv), 'export.txt');
      expect(result.format).toBe('csv');
      expect(result.data).toHaveLength(1);
    });
  });

  // ─── Excel parsing ──────────────────────────────────────────────
  describe('Excel parsing', () => {
    // Dynamically import xlsx to create test workbooks
    async function createExcelBuffer(
      data: unknown[][],
      sheetName = 'Sheet1',
    ): Promise<ArrayBuffer> {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return buf;
    }

    it('parses a simple Excel file', async () => {
      const buf = await createExcelBuffer([
        ['Campaign', 'Spend', 'Clicks'],
        ['Brand', 1000, 50],
        ['Retarget', 2000, 80],
      ]);
      const result = await parseFile(buf, 'report.xlsx');
      expect(result.format).toBe('xlsx');
      expect(result.columns).toEqual(['Campaign', 'Spend', 'Clicks']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]['Campaign']).toBe('Brand');
      expect(result.data[0]['Spend']).toBe(1000);
      expect(result.data[1]['Clicks']).toBe(80);
    });

    it('cleans currency and comma formatting in Excel cells', async () => {
      const buf = await createExcelBuffer([
        ['Campaign', 'Spend', 'CTR'],
        ['Brand', '$1,500.00', '5.2%'],
        ['Retarget', '$2,300.50', '3.1%'],
      ]);
      const result = await parseFile(buf, 'report.xlsx');
      expect(result.data[0]['Spend']).toBe(1500);
      expect(result.data[0]['CTR']).toBe(5.2);
      expect(result.data[1]['Spend']).toBe(2300.5);
    });

    it('handles empty Excel workbook', async () => {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Empty');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const result = await parseFile(buf, 'empty.xlsx');
      expect(result.format).toBe('xlsx');
      expect(result.data).toHaveLength(0);
      expect(result.columns).toEqual([]);
    });

    it('handles .xls extension', async () => {
      const buf = await createExcelBuffer([
        ['Name', 'Value'],
        ['Test', 42],
      ]);
      const result = await parseFile(buf, 'legacy.xls');
      expect(result.format).toBe('xlsx');
      expect(result.data).toHaveLength(1);
    });

    it('reads only first sheet of multi-sheet workbook', async () => {
      const XLSX = await import('xlsx');
      const ws1 = XLSX.utils.aoa_to_sheet([['A'], [1]]);
      const ws2 = XLSX.utils.aoa_to_sheet([['B'], [2]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'First');
      XLSX.utils.book_append_sheet(wb, ws2, 'Second');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const result = await parseFile(buf, 'multi.xlsx');
      expect(result.columns).toEqual(['A']);
      expect(result.data[0]['A']).toBe(1);
    });
  });

  // ─── Platform detection integration ────────────────────────────
  describe('Excel + platform detection', () => {
    async function createExcelBuffer(data: unknown[][]): Promise<ArrayBuffer> {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    }

    it('detects Google Ads from Excel headers', async () => {
      const buf = await createExcelBuffer([
        ['Campaign', 'Impr.', 'Clicks', 'Cost', 'Conv.', 'Conv. value', 'Avg. CPC'],
        ['Brand Search', 15000, 750, 1200, 45, 4500, 1.6],
      ]);
      const result = await parseFile(buf, 'google-export.xlsx');
      const mapping = detectPlatform(result.columns);
      expect(mapping.platform).toBe('google_ads');
      expect(mapping.confidence).toBeGreaterThan(0);
    });

    it('detects Meta Ads from Excel headers', async () => {
      const buf = await createExcelBuffer([
        ['Campaign Name', 'Amount Spent', 'Impressions', 'Clicks (all)', 'CTR (all)', 'Reach'],
        ['Summer Sale', 5000, 200000, 3500, 1.75, 180000],
      ]);
      const result = await parseFile(buf, 'meta-export.xlsx');
      const mapping = detectPlatform(result.columns);
      expect(mapping.platform).toBe('meta_ads');
    });

    it('detects TikTok Ads from Excel headers', async () => {
      const buf = await createExcelBuffer([
        ['Campaign Name', 'Spend', 'Impressions', 'Clicks', 'CVR', 'Video Views'],
        ['Holiday Push', 3000, 500000, 8000, 2.5, 350000],
      ]);
      const result = await parseFile(buf, 'tiktok-export.xlsx');
      const mapping = detectPlatform(result.columns);
      expect(mapping.platform).toBe('tiktok_ads');
    });
  });

  // ─── Error cases ──────────────────────────────────────────────
  describe('error handling', () => {
    it('throws for unsupported file extensions', async () => {
      await expect(parseFile(toBuffer('hello'), 'file.docx')).rejects.toThrow(
        'Unsupported file type',
      );
    });

    it('throws for files with no extension', async () => {
      await expect(parseFile(toBuffer('hello'), 'noext')).rejects.toThrow(
        'Unsupported file type',
      );
    });
  });
});
