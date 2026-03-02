// ─── PostgreSQL Full-Text Search Fallback ───────────────────────────
// Used when pgvector is unavailable — converts a free-text query
// into a tsquery-compatible AND expression.

export function buildKeywordQuery(query: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  return tokens.map((t) => `'${t.replace(/'/g, "''")}'`).join(' & ');
}
