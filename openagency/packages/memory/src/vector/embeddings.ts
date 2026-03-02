// ─── Embedding Generation ───────────────────────────────────────────
// Uses OpenAI text-embedding-ada-002 when OPENAI_API_KEY is set,
// otherwise returns null (caller falls back to keyword search).

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: text, model: 'text-embedding-ada-002' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
        return data.data[0]?.embedding ?? null;
      }
    } catch {
      // Silently fall back to keyword search
    }
  }
  return null;
}
