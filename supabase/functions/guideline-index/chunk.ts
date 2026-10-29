// Splits a PDF's pages into overlapping chunks that never cross a page, so
// every chunk can be cited with its page number.

export interface Chunk {
  page: number;
  index: number;
  text: string;
}

/** Whitespace tidy-up: pdf.js leaves runs of spaces and empty lines. */
export function cleanText(s: string): string {
  return s
    .split(String.fromCharCode(0)).join("")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkPages(pages: string[], opts: { size?: number; overlap?: number; min?: number } = {}): Chunk[] {
  const size = opts.size ?? 1500;
  const overlap = opts.overlap ?? 200;
  const min = opts.min ?? 40;
  const out: Chunk[] = [];
  pages.forEach((raw, i) => {
    const text = cleanText(raw ?? "");
    if (text.length < min) return;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) {
        // Prefer to cut at a line break, then at a space, in the last third.
        const window = text.slice(start + Math.floor(size * 0.66), end);
        const nl = window.lastIndexOf("\n");
        const sp = window.lastIndexOf(" ");
        const cut = nl >= 0 ? nl : sp;
        if (cut >= 0) end = start + Math.floor(size * 0.66) + cut;
      }
      const piece = text.slice(start, end).trim();
      if (piece.length >= min) out.push({ page: i + 1, index: out.length, text: piece });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });
  return out;
}
