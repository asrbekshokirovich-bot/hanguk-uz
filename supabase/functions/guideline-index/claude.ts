// Claude reads the guideline PDFs that pdf.js cannot: scans with no text layer
// (no_text), PDFs too heavy for the edge CPU limit (failed after 3 tries) and
// files over 40 MB (skipped). Claude takes the PDF straight from a signed
// Storage URL (up to 128 MB per request, per the Claude PDF docs) and
// transcribes a few pages per call; the document block is prompt-cached, so the
// following calls of the same PDF (every 3 minutes) read it from the cache.
//
// Progress lives in guideline_index_state.error as "claude: <done>/<total>
// url=<signed URL>" (the status check allows no new status), "claude: done
// <n>/<n>" at the end, and "claude failed (<k>): …" after a failure — three
// failures stop it. The signed URL (7 days) is kept so every call of one PDF
// sends the same document block; a failure drops it and the next call signs anew.
//
// Files over FILES_OVER (2026-11-03): Claude refused the 54 MB and 63 MB PDFs
// by URL ("The file exceeds the maximum allowed size"), so such a PDF is
// uploaded once to the Claude Files API (500 MB per file, kept 7 days) and
// sent as {source: {type: "file", file_id}}; progress then keeps
// "file=<file_id>" instead of the URL.
//
// deno-lint-ignore-file no-explicit-any

export const PAGES_PER_CALL = 4;

/** Above this size a PDF goes through the Files API (30 MB by URL worked, 54 MB did not). */
export const FILES_OVER = 30e6;

export interface Progress {
  done: number; total: number | null; failures: number; url: string | null; file: string | null;
}

/** "claude: 8/60 url=…" or "claude: 8/60 file=file_…" → progress; "claude failed (2): …" → failures. */
export function parseProgress(error: string | null | undefined): Progress {
  const e = error ?? "";
  const ok = e.match(/^claude: (\d+)\/(\d+)(?: url=(\S+))?(?: file=(\S+))?/);
  if (ok) return { done: Number(ok[1]), total: Number(ok[2]), failures: 0, url: ok[3] ?? null, file: ok[4] ?? null };
  const bad = e.match(/^claude failed \((\d+)\)(?:.*?\[(\d+)\/(\d+)\])?/);
  if (bad) {
    return {
      done: bad[2] ? Number(bad[2]) : 0, total: bad[3] ? Number(bad[3]) : null, failures: Number(bad[1]),
      url: null, file: null,
    };
  }
  return { done: 0, total: null, failures: 0, url: null, file: null };
}

/** The document block: a Files API id ("file_…") or a URL. */
export function documentSource(ref: string): Record<string, string> {
  return ref.startsWith("file_") ? { type: "file", file_id: ref } : { type: "url", url: ref };
}

/** Uploads the PDF behind `url` to the Claude Files API; returns the file id. */
export async function uploadToFiles(
  url: string,
  name: string,
  key: string,
  doFetch: typeof fetch = fetch,
): Promise<string> {
  const src = await doFetch(url);
  if (!src.ok) throw new Error(`download ${src.status}`);
  const form = new FormData();
  form.append("file", new Blob([await src.arrayBuffer()], { type: "application/pdf" }), name);
  form.append("expires_in_seconds", String(7 * 24 * 3600));
  const res = await doFetch("https://api.anthropic.com/v1/files", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: form,
  });
  if (!res.ok) throw new Error(`files ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (!data?.id) throw new Error("files: no id");
  return String(data.id);
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
  ref: string, // signed URL or Files API id

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
      // No temperature: claude-sonnet-5-5 rejects it ("`temperature` is deprecated
      // for this model", 400, 2026-11-03).
      messages: [{
        role: "user",
        content: [
          { type: "document", source: documentSource(ref), cache_control: { type: "ephemeral" } },
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
