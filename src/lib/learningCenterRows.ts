// Pure helpers for the learning center portal, kept apart from the hooks so
// they can be tested without a Supabase client.

export interface NewCenterStudent {
  full_name: string;
  phone: string;
  city?: string | null;
  age?: number | null;
  korean_level?: string | null;
  english_level?: string | null;
  notes?: string | null;
}

/**
 * Parse pasted rows ("Ism Familiya, +998 90 123 45 67" — one per line; comma,
 * semicolon or tab separated, as copied from Excel). The phone is the first
 * cell with 9+ digits; the name is the first other cell.
 */
export function parseStudentRows(text: string): { rows: NewCenterStudent[]; invalid: string[] } {
  const rows: NewCenterStudent[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/[,;\t]/).map((c) => c.trim()).filter(Boolean);
    const phoneIdx = cells.findIndex((c) => c.replace(/\D/g, '').length >= 9);
    const name = cells.find((_, i) => i !== phoneIdx);
    if (phoneIdx === -1 || !name) {
      invalid.push(line);
      continue;
    }
    rows.push({ full_name: name, phone: cells[phoneIdx] });
  }
  return { rows, invalid };
}

/** Digits a phone is compared on — the same last-9 rule the database uses. */
export const phoneKey = (phone: string) => phone.replace(/\D/g, '').slice(-9);
