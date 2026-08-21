import { describe, expect, it } from 'vitest';
import {
  MAX_GUIDELINE_PDF_BYTES,
  fileSizeMb,
  isTooLarge,
  looksLikePdf,
} from '../guidelinePdf';

function fileOfSize(bytes: number, name = 'guideline.pdf', type = 'application/pdf'): File {
  const f = new File(['x'], name, { type });
  // Constructing a real 25 MB blob per case is wasteful; size is the only
  // property under test.
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('guideline PDF upload rules', () => {
  it('accepts a file at exactly the limit and rejects one byte more', () => {
    expect(isTooLarge(fileOfSize(MAX_GUIDELINE_PDF_BYTES))).toBe(false);
    expect(isTooLarge(fileOfSize(MAX_GUIDELINE_PDF_BYTES + 1))).toBe(true);
  });

  it('reports the size in MB for the error message', () => {
    expect(fileSizeMb(fileOfSize(30 * 1024 * 1024))).toBe('30.0');
    expect(fileSizeMb(fileOfSize(1024 * 1024 * 3.55))).toBe('3.5');
  });

  it('recognises a PDF by extension even when the browser reports no type', () => {
    expect(looksLikePdf(fileOfSize(10, '모집요강.pdf', ''))).toBe(true);
    expect(looksLikePdf(fileOfSize(10, 'GUIDELINE.PDF', ''))).toBe(true);
  });

  it('rejects a non-PDF that names itself otherwise', () => {
    expect(looksLikePdf(fileOfSize(10, 'guideline.hwp', 'application/x-hwp'))).toBe(false);
  });
});
