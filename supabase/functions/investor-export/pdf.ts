// ---------------------------------------------------------------------------
// A very small PDF writer.
//
// Deliberately dependency-free. The alternative was pulling pdf-lib off
// esm.sh, which would add ~1MB to a cold start and put an export the
// investor relies on behind a third-party CDN. Everything here uses the
// base-14 fonts, which every PDF reader has built in, so no font bytes are
// embedded either.
//
// Two typefaces, matching the design system: Helvetica for labels and
// Courier for anything numeric. Courier is fixed-width at 600/1000 em, which
// is what makes right-alignment a multiplication rather than a font-metrics
// lookup — and it is also what TOKENS.md asks for on money and counts.
// ---------------------------------------------------------------------------

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;

export type Align = 'left' | 'right';
export type Face = 'sans' | 'sans-bold' | 'mono' | 'mono-bold';

const FONT_RES: Record<Face, string> = {
  sans: '/F1',
  'sans-bold': '/F2',
  mono: '/F3',
  'mono-bold': '/F4',
};

/** Courier advance width, in text-space units per point of font size. */
const MONO_ADVANCE = 0.6;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Palette lifted from TOKENS.md, converted to the 0..1 PDF colour space. */
export const INK: Rgb = { r: 0.075, g: 0.11, b: 0.18 };
export const INK_MUTED: Rgb = { r: 0.42, g: 0.47, b: 0.55 };
export const ROYAL: Rgb = { r: 0.102, g: 0.227, b: 0.424 };
export const LINE: Rgb = { r: 0.87, g: 0.89, b: 0.93 };
export const TINT: Rgb = { r: 0.933, g: 0.953, b: 0.984 };
export const WHITE: Rgb = { r: 1, g: 1, b: 1 };

/**
 * WinAnsi is what the base-14 fonts speak, so anything outside it has to be
 * folded down before it reaches the content stream. The typographic
 * characters below are the ones the app actually emits.
 */
const FOLD: Array<[RegExp, string]> = [
  [/[‘’ʼ]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, '-'],
  [/…/g, '...'],
  [/·/g, '-'],
  [/→/g, '->'],
  [/ /g, ' '],
];

function toWinAnsi(input: string): string {
  let s = input;
  for (const [re, to] of FOLD) s = s.replace(re, to);
  // Anything still above Latin-1 has no glyph in the base-14 fonts. Dropping
  // it silently would corrupt a name, so mark it instead.
  return s.replace(/[^\x20-\xFF\n]/g, '?');
}

function escapeText(s: string): string {
  return toWinAnsi(s).replace(/([\\()])/g, '\\$1');
}

function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

interface PageState {
  ops: string[];
  y: number;
}

export class Pdf {
  private pages: PageState[] = [];
  private page: PageState;
  readonly title: string;

  constructor(title: string) {
    this.title = title;
    this.page = { ops: [], y: A4.h - MARGIN };
    this.pages.push(this.page);
  }

  get x0(): number {
    return MARGIN;
  }

  get x1(): number {
    return A4.w - MARGIN;
  }

  get width(): number {
    return A4.w - MARGIN * 2;
  }

  get y(): number {
    return this.page.y;
  }

  set y(v: number) {
    this.page.y = v;
  }

  /** Starts a new page when the next `needed` points would run off this one. */
  ensure(needed: number): void {
    if (this.page.y - needed >= MARGIN) return;
    this.page = { ops: [], y: A4.h - MARGIN };
    this.pages.push(this.page);
  }

  text(
    s: string,
    x: number,
    size: number,
    opts: { face?: Face; colour?: Rgb; align?: Align; width?: number } = {},
  ): void {
    const face = opts.face ?? 'sans';
    const colour = opts.colour ?? INK;
    let tx = x;
    if (opts.align === 'right') {
      // Only mono is ever right-aligned; see the note at the top of the file.
      const w = toWinAnsi(s).length * MONO_ADVANCE * size;
      tx = x - w;
    }
    this.page.ops.push(
      `BT ${fmt(colour.r)} ${fmt(colour.g)} ${fmt(colour.b)} rg ` +
        `${FONT_RES[face]} ${fmt(size)} Tf 1 0 0 1 ${fmt(tx)} ${fmt(this.page.y)} Tm ` +
        `(${escapeText(s)}) Tj ET`,
    );
  }

  rect(x: number, y: number, w: number, h: number, colour: Rgb): void {
    this.page.ops.push(
      `${fmt(colour.r)} ${fmt(colour.g)} ${fmt(colour.b)} rg ` +
        `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f`,
    );
  }

  rule(colour: Rgb = LINE, inset = 0): void {
    this.rect(this.x0 + inset, this.page.y, this.width - inset * 2, 0.6, colour);
  }

  down(by: number): void {
    this.page.y -= by;
  }

  build(): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length; // 1-based object number
    };

    // Fonts first so their numbers are stable across pages.
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
    const f4 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');
    const resources =
      `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R /F4 ${f4} 0 R >> >>`;

    // Reserve the Pages object number before the page objects reference it.
    const pagesNum = objects.length + 1 + this.pages.length * 2;

    const pageNums: number[] = [];
    for (const p of this.pages) {
      const stream = p.ops.join('\n');
      const contentNum = add(
        `<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}\nendstream`,
      );
      pageNums.push(
        add(
          `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${fmt(A4.w)} ${fmt(A4.h)}] ` +
            `/Resources ${resources} /Contents ${contentNum} 0 R >>`,
        ),
      );
    }

    const pagesObj = add(
      `<< /Type /Pages /Count ${pageNums.length} /Kids [${pageNums
        .map((n) => `${n} 0 R`)
        .join(' ')}] >>`,
    );
    if (pagesObj !== pagesNum) throw new Error('pdf: page tree number drifted');

    const infoNum = add(
      `<< /Title (${escapeText(this.title)}) /Producer (Hanguk Consulting CRM) >>`,
    );
    const catalogNum = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(latin1Bytes(out).length);
      out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefAt = latin1Bytes(out).length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      out += `${off.toString().padStart(10, '0')} 00000 n \n`;
    }
    out +=
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R ` +
      `/Info ${infoNum} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

    return latin1Bytes(out);
  }
}
