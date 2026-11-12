// No imports: the web tests (src/lib/__tests__/extractPhone.test.ts) load this file.

/**
 * Uzbek mobile number a customer typed, as 9 local digits ("901112233").
 *
 * Mirrors the database's fn_extract_phone: digits are joined only across the
 * spaces/dashes/dots/brackets INSIDE one number, never across words or lines.
 * The old version stripped every non-digit from the whole message first, so a
 * Meta lead form ("Qachon ketmoqchisiz?: 2027-yil … Phone number: 8 90 111 22
 * 33") became "…2027 8901112233" and "202789011" was saved — dozens of
 * Instagram leads got such a number (2026-11-12). The form's "Phone number:"
 * line is read first; a leading 8 or 998 is a prefix, not part of the number.
 */
const UZ_MOBILE = /(?<![0-9])(?:\+?998|8)?((?:20|33|50|55|6[1-9]|7[0-9]|88|9[0-9])[0-9]{7})(?![0-9])/;

function uzMobileIn(chunk: string): string | null {
  const joined = chunk.replace(/(?<=[0-9+])[ \t\u00a0\-.()]+(?=[0-9(])/g, "");
  return joined.match(UZ_MOBILE)?.[1] ?? null;
}

export function extractPhoneFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const noUrls = text.replace(/https?:\/\/\S+/gi, " ");
  const formLine = noUrls.match(/(?:phone(?:\s*number)?|telefon(?:\s*raqam\w*)?|номер(?:\s*телефона)?|телефон)\s*:+\s*([^\n]+)/i);
  if (formLine) {
    const fromLine = uzMobileIn(formLine[1]);
    if (fromLine) return fromLine;
  }
  for (const line of noUrls.split(/\r?\n/)) {
    const found = uzMobileIn(line);
    if (found) return found;
  }
  return null;
}
