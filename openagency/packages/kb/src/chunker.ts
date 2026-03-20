// ─── Knowledge Base Chunker ──────────────────────────────────────────
// 6 chunking strategies based on document source type.
// All functions are synchronous and pure — no I/O.

export interface Chunk {
  content: string;
  token_count: number;
  metadata: Record<string, unknown>;
  chunk_index: number;
}

// ─── Token estimation ────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Sentence-aware text splitter ────────────────────────────────────

export function splitByTokens(
  text: string,
  maxTokens: number,
  overlap: number,
): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|(?<=\n)/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && current.length > 0) {
      chunks.push(current.join(''));

      // Build overlap from the end of current chunk
      if (overlap > 0) {
        const overlapParts: string[] = [];
        let overlapTokens = 0;
        for (let i = current.length - 1; i >= 0; i--) {
          const part = current[i]!;
          const partTokens = estimateTokens(part);
          if (overlapTokens + partTokens > overlap) break;
          overlapParts.unshift(part);
          overlapTokens += partTokens;
        }
        current = overlapParts;
        currentTokens = overlapTokens;
      } else {
        current = [];
        currentTokens = 0;
      }
    }

    current.push(sentence);
    currentTokens += sentenceTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join(''));
  }

  return chunks;
}

// ─── Strategy 1: Engine output (JSON) ────────────────────────────────

function chunkEngineOutput(
  content: string | Record<string, unknown>,
  metadata: Record<string, unknown>,
): Chunk[] {
  const obj =
    typeof content === 'string' ? (JSON.parse(content) as Record<string, unknown>) : content;

  // Check if this is a manifest (Strategy 4)
  const filename = metadata['filename'] as string | undefined;
  if (filename === 'manifest.json') {
    return chunkManifest(content, metadata);
  }

  // Check if this is chart metadata (Strategy 6)
  if (metadata['is_chart']) {
    return chunkChart(obj, metadata);
  }

  const chunks: Chunk[] = [];
  let index = 0;

  for (const [key, value] of Object.entries(obj)) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const tokens = estimateTokens(serialized);

    if (tokens > 1000 && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Sub-split by top-level keys of this object
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        const subSerialized =
          typeof subValue === 'string' ? subValue : JSON.stringify(subValue, null, 2);
        chunks.push({
          content: `${key}.${subKey}: ${subSerialized}`,
          token_count: estimateTokens(subSerialized) + estimateTokens(`${key}.${subKey}: `),
          metadata: {
            ...metadata,
            skill_key: key,
            sub_key: subKey,
            engine_name: metadata['engine_name'],
            skill_name: metadata['skill_name'],
          },
          chunk_index: index++,
        });
      }
    } else {
      chunks.push({
        content: `${key}: ${serialized}`,
        token_count: tokens + estimateTokens(`${key}: `),
        metadata: {
          ...metadata,
          skill_key: key,
          engine_name: metadata['engine_name'],
          skill_name: metadata['skill_name'],
        },
        chunk_index: index++,
      });
    }
  }

  return chunks;
}

// ─── Strategy 2: Delivery document (PPTX/PDF/DOCX) ──────────────────

function chunkDeliveryDoc(
  content: string,
  metadata: Record<string, unknown>,
): Chunk[] {
  // Split by section markers
  const sectionPattern = /(?=\n## |\n### |^## |^### |---|\n---|\[slide ?\d+\])/i;
  const sections = content.split(sectionPattern).filter((s) => s.trim().length > 0);

  const chunks: Chunk[] = [];
  let index = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!.trim();
    if (!section) continue;

    const tokens = estimateTokens(section);

    if (tokens <= 1000) {
      chunks.push({
        content: section,
        token_count: tokens,
        metadata: {
          ...metadata,
          section_index: i,
          page_number: i + 1,
        },
        chunk_index: index++,
      });
    } else {
      // Sub-split large sections with overlap
      const subChunks = splitByTokens(section, 1000, 200);
      for (const sub of subChunks) {
        chunks.push({
          content: sub,
          token_count: estimateTokens(sub),
          metadata: {
            ...metadata,
            section_index: i,
            page_number: i + 1,
          },
          chunk_index: index++,
        });
      }
    }
  }

  // If no section markers found, fall back to token splitting
  if (chunks.length === 0 && content.trim().length > 0) {
    const subChunks = splitByTokens(content, 1000, 200);
    for (const sub of subChunks) {
      chunks.push({
        content: sub,
        token_count: estimateTokens(sub),
        metadata: { ...metadata, page_number: index + 1 },
        chunk_index: index++,
      });
    }
  }

  return chunks;
}

// ─── Strategy 3: CSV / Tabular data ─────────────────────────────────

function chunkTabular(
  content: string | Record<string, unknown>,
  metadata: Record<string, unknown>,
): Chunk[] {
  let rows: string[];
  let header: string;

  if (typeof content === 'string') {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    header = lines[0]!;
    rows = lines.slice(1);
  } else if (Array.isArray(content)) {
    // JSON array of objects
    if (content.length === 0) return [];
    const keys = Object.keys(content[0] as Record<string, unknown>);
    header = keys.join(',');
    rows = content.map((row) => {
      const r = row as Record<string, unknown>;
      return keys.map((k) => String(r[k] ?? '')).join(',');
    });
  } else {
    // Treat as JSON with a data array
    const data = (content as Record<string, unknown>)['data'];
    if (Array.isArray(data)) {
      return chunkTabular(data as unknown as Record<string, unknown>, metadata);
    }
    // Fallback: serialize as single chunk
    const serialized = JSON.stringify(content, null, 2);
    return [{
      content: serialized,
      token_count: estimateTokens(serialized),
      metadata: { ...metadata },
      chunk_index: 0,
    }];
  }

  const ROWS_PER_CHUNK = 50;
  const chunks: Chunk[] = [];
  let index = 0;

  for (let i = 0; i < rows.length; i += ROWS_PER_CHUNK) {
    const batch = rows.slice(i, i + ROWS_PER_CHUNK);
    const chunkContent = [header, ...batch].join('\n');
    chunks.push({
      content: chunkContent,
      token_count: estimateTokens(chunkContent),
      metadata: {
        ...metadata,
        row_start: i + 1,
        row_end: i + batch.length,
        total_rows: rows.length,
      },
      chunk_index: index++,
    });
  }

  return chunks;
}

// ─── Strategy 4: Manifest JSON ───────────────────────────────────────

function chunkManifest(
  content: string | Record<string, unknown>,
  metadata: Record<string, unknown>,
): Chunk[] {
  const serialized =
    typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  return [
    {
      content: serialized,
      token_count: estimateTokens(serialized),
      metadata: { ...metadata, is_manifest: true },
      chunk_index: 0,
    },
  ];
}

// ─── Strategy 5: Benchmark JSON ─────────────────────────────────────

function chunkBenchmark(
  content: string | Record<string, unknown>,
  metadata: Record<string, unknown>,
): Chunk[] {
  const obj =
    typeof content === 'string' ? (JSON.parse(content) as Record<string, unknown>) : content;

  const METRIC_CATEGORIES = ['channels', 'waste', 'roas', 'roi', 'mds', 'spend', 'performance'];
  const chunks: Chunk[] = [];
  let index = 0;

  // Extract period from the object
  const period = (obj['period'] as string | undefined) ?? (obj['date'] as string | undefined) ?? 'unknown';

  for (const [key, value] of Object.entries(obj)) {
    const isCategory = METRIC_CATEGORIES.some(
      (cat) => key.toLowerCase().includes(cat),
    );
    if (!isCategory && key !== 'period' && key !== 'date') continue;

    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    chunks.push({
      content: `${key}: ${serialized}`,
      token_count: estimateTokens(serialized) + estimateTokens(`${key}: `),
      metadata: {
        ...metadata,
        metric_category: key,
        period,
      },
      chunk_index: index++,
    });
  }

  // If no categories matched, emit the whole thing as one chunk
  if (chunks.length === 0) {
    const serialized = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    chunks.push({
      content: serialized,
      token_count: estimateTokens(serialized),
      metadata: { ...metadata, period },
      chunk_index: 0,
    });
  }

  return chunks;
}

// ─── Strategy 6: Chart metadata ─────────────────────────────────────

function chunkChart(
  obj: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Chunk[] {
  // Build a text description instead of embedding SVG/raw chart data
  const chartType = (obj['chart_type'] as string | undefined) ?? (obj['type'] as string | undefined) ?? 'chart';
  const title = (obj['title'] as string | undefined) ?? 'Untitled Chart';
  const dataSource = (obj['data_source'] as string | undefined) ?? 'unknown';

  const parts: string[] = [`${chartType}: ${title}`];

  // Extract data points for description
  const data = obj['data'] ?? obj['values'] ?? obj['series'];
  if (Array.isArray(data)) {
    const items = data.slice(0, 20).map((item) => {
      if (typeof item === 'object' && item !== null) {
        const r = item as Record<string, unknown>;
        const label = r['label'] ?? r['name'] ?? r['channel'] ?? r['key'] ?? '';
        const value = r['value'] ?? r['amount'] ?? r['spend'] ?? '';
        return `${label} ${value}`;
      }
      return String(item);
    });
    parts.push(`Data: ${items.join(', ')}`);
  } else if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>).slice(0, 20);
    parts.push(`Data: ${entries.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }

  const description = parts.join(' — ');

  return [
    {
      content: description,
      token_count: estimateTokens(description),
      metadata: {
        ...metadata,
        chart_type: chartType,
        chart_title: title,
        data_source: dataSource,
        is_chart: true,
      },
      chunk_index: 0,
    },
  ];
}

// ─── Main entry point ───────────────────────────────────────────────

export function chunkDocument(
  content: string | Record<string, unknown>,
  sourceType: string,
  metadata?: Record<string, unknown>,
): Chunk[] {
  const meta = metadata ?? {};

  switch (sourceType) {
    case 'engine_output':
      return chunkEngineOutput(content, meta);

    case 'hfl_delivery':
      return chunkDeliveryDoc(
        typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        meta,
      );

    case 'connector_sync':
    case 'manual_upload':
      return chunkTabular(content, meta);

    case 'benchmark_snapshot':
      return chunkBenchmark(content, meta);

    default: {
      // Unknown source type — use delivery doc strategy (general text splitting)
      const text =
        typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      return chunkDeliveryDoc(text, meta);
    }
  }
}
