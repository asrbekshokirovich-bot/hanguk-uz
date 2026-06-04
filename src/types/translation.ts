// Structured translation model — mirrors the shape produced by the
// translate-document edge function and stored in translation_jobs.structured_translation.

export type TranslationBlock =
  | { type: 'title'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'field'; label: string; value: string }
  | { type: 'paragraph'; text: string }
  | { type: 'table'; header?: string[]; rows: string[][] }
  | { type: 'annotation'; text: string }
  | { type: 'spacer' };

export interface VerifiedNames {
  student?: string;
  father?: string;
  mother?: string;
}

export interface DetectedSupportingDoc {
  role: string;
  documentType: string;
  extractedName: string;
}

export interface StructuredTranslation {
  detectedSupportingDocs: DetectedSupportingDoc[];
  verifiedNames: VerifiedNames;
  blocks: TranslationBlock[];
  unclearItems: string[];
}

export interface TranslationResult {
  structured: StructuredTranslation;
  plainText: string;
  docxPath: string;
  documentType: { code: string; name: string; nameEn: string | null };
}

export interface TranslationFileInput {
  path: string;
  bucket: string;
  role?: string;
}
