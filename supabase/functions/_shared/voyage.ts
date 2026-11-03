// Voyage AI embeddings for the guideline PDF index (2026-11-03): Anthropic has no
// embedding model of its own and points to Voyage; Gemini's free quota kept
// answering 429. voyage-4 @1024 (multilingual, 200M free tokens, then $0.06/1M —
// docs.voyageai.com/docs/pricing), same 1024 dims as the embedding_chunks column.
// VOYAGE_API_KEY set → the index and the query use Voyage; unset → Gemini as before.
//
// deno-lint-ignore-file no-explicit-any

export const VOYAGE_MODEL = "voyage-4";
export const VOYAGE_DIMS = 1024;

const env = (k: string): string => {
  try {
    return (globalThis as any).Deno?.env?.get(k) ?? "";
  } catch {
    return "";
  }
};

export const voyageKey = (): string => env("VOYAGE_API_KEY");

/** Embeds texts (≤1000 per call); "document" for the index, "query" for a question. */
export async function voyageEmbed(
  texts: string[],
  inputType: "document" | "query",
  key = voyageKey(),
  doFetch: typeof fetch = fetch,
): Promise<number[][]> {
  if (!key) throw new Error("VOYAGE_API_KEY is not configured");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 128) {
    const part = texts.slice(i, i + 128).map((t) => t.slice(0, 8000));
    const res = await doFetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: part, model: VOYAGE_MODEL, input_type: inputType, output_dimension: VOYAGE_DIMS }),
    });
    if (!res.ok) throw new Error(`voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const rows = [...(j?.data ?? [])].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    for (const r of rows) out.push(r.embedding);
  }
  if (out.length !== texts.length) throw new Error(`voyage returned ${out.length}/${texts.length}`);
  return out;
}
