// Claude reads the guideline PDFs that pdf.js cannot: scans with no text layer
// (no_text), PDFs too heavy for the edge CPU limit (failed after 3 tries) and
// files over 40 MB (skipped). Claude takes the PDF straight from a signed
// Storage URL (up to 128 MB per request, per the Claude PDF docs) and
// transcribes a few pages per call; the document block is prompt-cached, so the
// following calls of the same PDF (every 3 minutes) read it from the cache.
//
// Progress lives in guideline_index_state.error as "claude: <done>/<total>"
// (the status check allows no new status), "claude: done <n>/<n>" at the end,
// and "claude failed (<k>): …" after a failure — three failures stop it.
//
// deno-lint-ignore-file no-explicit-any

export const PAGES_PER_CALL = 4;

/** "claude: 8/60" → { done: 8, total: 60 }; "claude failed (2): …" → failures. */
export function parseProgress(error: string | null | undefined): { done: number; total: number | null; failures: number } {
  const e = error ?? "";
  const ok = e.match(/^claude: (\d+)\/(\d+)/);
  if (ok) return { done: Number(ok[1]), total: Number(ok[2]), failures: 0 };
  const bad = e.match(/^claude failed \((\d+)\)(?:.*?\[(\d+)\/(\d+)\])?/);
  if (bad) {
    return { done: bad[2] ? Number(bad[2]) : 0, total: bad[3] ? Number(bad[3]) : null, failures: Number(bad[1]) };
  }
  return { done: 0, total: null, failures: 0 };
}

export function transcribePrompt(from: number, to: number): string {
  return [
    `Transcribe pages ${from} to ${to} of this PDF, a Korean university admission guideline (모집요강).`,
    "Write exactly this, nothing else:",
    "TOTAL_PAGES: <number of pages in the whole PDF>",
    `=== PAGE ${from} ===`,
    "<every piece of text on that page, in its original language and order; table rows on one line with cells separated by \" | \">",
    "…and the same for each following page up to " + to + ".",
    "Do not translate, summarise or comment. If a page has no text, write (empty). Stop after the last page of the PDF.",
  ].join("\n");
}

/** Claude's transcript → total page count and the text of each page read. */
export function parseTranscript(text: string): { total: number | null; pages: Map<number, string> } {
  const total = text.match(/TOTAL_PAGES:\s*(\d+)/i);
  const pages = new Map<number, string>();
  const re = /^=== PAGE (\d+) ===[ \t]*$/gm;
  const marks: { page: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) marks.push({ page: Number(m[1]), start: m.index + m[0].length, end: m.index });
  marks.forEach((k, i) => {
    const body = text.slice(k.start, i + 1 < marks.length ? marks[i + 1].end : text.length).trim();
    pages.set(k.page, body === "(empty)" ? "" : body);
  });
  return { total: total ? Number(total[1]) : null, pages };
}

export async function claudeTranscribe(
  url: string,
  from: number,
  to: number,
  key: string,
  model: string,
  doFetch: typeof fetch = fetch,
): Promise<{ text: string; usage: any }> {
  const res = await doFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 12000,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "url", url }, cache_control: { type: "ephemeral" } },
          { type: "text", text: transcribePrompt(from, to) },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { text, usage: data?.usage ?? {} };
}
