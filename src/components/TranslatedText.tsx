import { useTranslation } from 'react-i18next';
import { localizeText, type LocalizeInput } from '@/hooks/useTranslations';

/**
 * Renders a Korean source field in the user's language using a precomputed
 * translation, falling back gracefully (translation → inline English → Korean).
 * When the requested language isn't available and `showHint` is set, appends a
 * subtle "(not translated yet)" note.
 *
 * `lang` defaults to the active i18n language.
 */
export function TranslatedText({
  ko,
  en,
  translation,
  lang,
  showHint = false,
  className,
}: Omit<LocalizeInput, 'lang'> & {
  lang?: string;
  showHint?: boolean;
  className?: string;
}) {
  const { i18n } = useTranslation();
  const result = localizeText({ lang: lang ?? i18n.language ?? 'uz', ko, en, translation });
  if (!result.text) return null;
  return (
    <span className={className} lang={result.lang}>
      {result.text}
      {showHint && result.fallback ? (
        <span className="ml-1 text-xs italic text-muted-foreground">(not translated yet)</span>
      ) : null}
    </span>
  );
}
