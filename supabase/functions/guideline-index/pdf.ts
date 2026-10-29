// PDF → text per page. Korean guidelines use CID fonts whose character maps
// (CMaps) pdf.js loads on demand; without them every page comes back empty
// (checked 2026-10-31 with a generated 모집요강 PDF). The serverless pdf.js
// build has no file reader, so CMaps are fetched from the CDN copy of the same
// pdfjs-dist version and cached for the isolate.
//
// deno-lint-ignore-file no-explicit-any

export const CMAP_BASE = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/cmaps/";

const cache = new Map<string, Uint8Array>();

export function makeCMapReader(load: (url: string) => Promise<Uint8Array>) {
  return class CMapReader {
    baseUrl: string;
    isCompressed: boolean;
    constructor({ baseUrl, isCompressed }: { baseUrl: string; isCompressed: boolean }) {
      this.baseUrl = baseUrl || CMAP_BASE;
      this.isCompressed = isCompressed;
    }
    async fetch({ name }: { name: string }) {
      const url = this.baseUrl + name + (this.isCompressed ? ".bcmap" : "");
      let data = cache.get(url);
      if (!data) {
        data = await load(url);
        cache.set(url, data);
      }
      return { cMapData: data, compressionType: this.isCompressed ? 1 : 0 };
    }
  };
}

export const fetchBytes = async (url: string): Promise<Uint8Array> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`CMap ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

/** unpdf's getDocumentProxy + extractText, injected so tests can pass the npm build. */
export async function extractPages(
  unpdf: { getDocumentProxy: (d: Uint8Array, o?: any) => Promise<any>; extractText: (p: any, o?: any) => Promise<any> },
  bytes: Uint8Array,
  load: (url: string) => Promise<Uint8Array> = fetchBytes,
): Promise<string[]> {
  const pdf = await unpdf.getDocumentProxy(bytes, {
    cMapUrl: CMAP_BASE,
    cMapPacked: true,
    CMapReaderFactory: makeCMapReader(load),
    isEvalSupported: false,
  });
  const { text } = await unpdf.extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [String(text ?? "")];
}
