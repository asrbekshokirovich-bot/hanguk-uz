// Shared region helpers for the document auto-fill pipeline.
//
// A student's region is derived from the "given by" / issuing-authority section
// of their passport (e.g. "Berilgan: Toshkent shahar IIB" -> Toshkent shahri).
// The labels here MUST match the region labels offered in the add/edit student
// dialogs so the value round-trips cleanly through the UI selects.

export interface RegionDef {
  value: string;
  label: string;
  // lowercase keyword fragments (latin + common cyrillic) that, when present in
  // the issuing-authority text, identify this region.
  keywords: string[];
}

export const UZBEKISTAN_REGIONS: RegionDef[] = [
  { value: "tashkent_city", label: "Toshkent shahri", keywords: ["toshkent shahar", "toshkent shahri", "tashkent city", "город ташкент", "г. ташкент", "ташкент шахар"] },
  { value: "tashkent", label: "Toshkent viloyati", keywords: ["toshkent viloyat", "tashkent region", "ташкентск"] },
  { value: "andijan", label: "Andijon viloyati", keywords: ["andijon", "andijan", "андижан"] },
  { value: "bukhara", label: "Buxoro viloyati", keywords: ["buxoro", "bukhara", "бухар"] },
  { value: "fergana", label: "Farg'ona viloyati", keywords: ["farg'ona", "fargona", "fergana", "ферган"] },
  { value: "jizzakh", label: "Jizzax viloyati", keywords: ["jizzax", "jizzakh", "джизак"] },
  { value: "khorezm", label: "Xorazm viloyati", keywords: ["xorazm", "khorezm", "хорезм"] },
  { value: "namangan", label: "Namangan viloyati", keywords: ["namangan", "наманган"] },
  { value: "navoiy", label: "Navoiy viloyati", keywords: ["navoiy", "navoi", "навои"] },
  { value: "kashkadarya", label: "Qashqadaryo viloyati", keywords: ["qashqadaryo", "kashkadarya", "кашкадар"] },
  { value: "samarkand", label: "Samarqand viloyati", keywords: ["samarqand", "samarkand", "самарканд"] },
  { value: "sirdarya", label: "Sirdaryo viloyati", keywords: ["sirdaryo", "syrdarya", "сырдар"] },
  { value: "surkhandarya", label: "Surxondaryo viloyati", keywords: ["surxondaryo", "surkhandarya", "сурхандар"] },
  { value: "karakalpakstan", label: "Qoraqalpog'iston", keywords: ["qoraqalpog", "karakalpak", "каракалпак"] },
];

/**
 * Map a passport issuing-authority / "given by" string to a region label.
 * Returns the region's label (what the UI selects store) or null when no
 * confident match is found — staff can fill it in via the edit dialog.
 */
export function regionFromIssuingAuthority(text: string | null | undefined): string | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  for (const region of UZBEKISTAN_REGIONS) {
    if (region.keywords.some((kw) => haystack.includes(kw))) {
      return region.label;
    }
  }
  return null;
}
