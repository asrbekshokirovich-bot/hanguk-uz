/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ombor manzili. Boʻsh boʻlsa panel namuna toʻplami bilan ochiladi. */
  readonly VITE_SUPABASE_URL?: string;
  /** Faqat oʻqish uchun ochiq kalit — yozish huquqi yoʻq. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
