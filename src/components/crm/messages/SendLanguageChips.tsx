import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SEND_LANGUAGES } from './languages';
import type { SendLanguage } from './types';

interface SendLanguageChipsProps {
  value: SendLanguage;
  onChange: (value: SendLanguage) => void;
}

/**
 * "Send in" language selector. The operator writes in English or Uzbek and the
 * outbound message is translated to the student's language on send, so the
 * active chip is the one lime affordance in the composer.
 */
export function SendLanguageChips({ value, onChange }: SendLanguageChipsProps) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('messages.composer.sendIn')}
      className="ml-1.5 flex items-center gap-1.5 border-l border-border pl-3"
    >
      <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {t('messages.composer.sendIn')}
      </span>
      {SEND_LANGUAGES.map((lang) => {
        const active = value === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(lang.nameKey)}
            onClick={() => onChange(lang.code)}
            className={cn(
              'h-7 min-h-0 min-w-[34px] rounded-pill px-2.5 text-[11px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
              active
                ? 'bg-accent font-bold text-accent-foreground'
                : 'border border-border font-semibold text-muted-foreground hover:bg-muted hover:text-foreground/80',
            )}
          >
            {lang.code}
          </button>
        );
      })}
    </div>
  );
}
