import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Languages } from 'lucide-react';
import {
  reviewLang,
  confidenceBand,
  getSummary,
  parseReliabilityChecks,
  REVIEW_SECTIONS,
  type ReviewSection,
} from './reviewFriendly';

/**
 * Shared building blocks that make uni-db data readable for non-technical,
 * Uzbek/English-speaking staff: traffic-light confidence (no raw percentages
 * in view), the extractor's plain-language summary, Korean originals collapsed
 * behind a disclosure, the reliability gauntlet as a plain pass/fail list, and
 * a per-university completeness strip. Reused by the review queue, the
 * auto-published flags tab, and the read-only Admissions drawer.
 */

const BAND_DOT: Record<string, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-destructive',
};

const BAND_TEXT: Record<string, string> = {
  green: 'text-success',
  yellow: 'text-warning',
  red: 'text-destructive',
};

/**
 * Confidence as a traffic light with a plain-language label; the raw
 * percentage only appears in the tooltip.
 */
export function ConfidenceLight({ score }: { score: number | null | undefined }) {
  const { t } = useTranslation();
  const band = confidenceBand(score);
  if (!band) return null;
  const pct = `${Math.round((score as number) * 100)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${BAND_TEXT[band]}`}
      title={t('uniReview.confidence.tooltip', { pct })}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${BAND_DOT[band]}`} aria-hidden />
      {t(`uniReview.confidence.${band}`)}
    </span>
  );
}

/** Korean source text, collapsed behind "Show original text". */
export function OriginalTextToggle({ texts }: { texts: string[] }) {
  const { t } = useTranslation();
  if (texts.length === 0) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
        <Languages className="h-3 w-3" /> {t('uniReview.showOriginal')}
      </summary>
      <div className="mt-1 space-y-1 rounded bg-muted/50 p-2">
        {texts.map((s, i) => (
          <p key={i} className="whitespace-pre-wrap break-words text-muted-foreground" lang="ko">
            {s}
          </p>
        ))}
      </div>
    </details>
  );
}

/**
 * The reliability gauntlet's verdict as a plain-language pass/fail list,
 * collapsed by default. Raw gate output stays visible as secondary detail so
 * a power user can still read it.
 */
export function ReliabilityChecklist({ detail }: { detail: string | null }) {
  const { t } = useTranslation();
  const checks = parseReliabilityChecks(detail);
  if (!checks) return null;
  return (
    <details className="mb-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {t('uniReview.reliability.title')}
      </summary>
      <div className="mt-1 space-y-1 rounded bg-muted/50 p-2">
        {checks.allPassed ? (
          <div className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {t('uniReview.reliability.allPassed')}
          </div>
        ) : (
          checks.failures.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <span className="font-medium">{t(`uniReview.reliability.checks.${f.kind}`)}</span>
                <div className="break-words font-mono text-[11px] text-muted-foreground">
                  {f.detail}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

/**
 * The extractor's 2-4 sentence plain-language summary, shown prominently.
 * Old payloads (no summary_uz / summary_en) render nothing here — the
 * structured field view below remains the fallback.
 */
export function SummaryBlock({ parsedOutput }: { parsedOutput: unknown }) {
  const { i18n } = useTranslation();
  const summary = getSummary(parsedOutput, reviewLang(i18n.language));
  if (!summary) return null;
  return (
    <p className="mb-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">
      {summary}
    </p>
  );
}

/**
 * Which of the five info groups this university's guideline covers —
 * "O'qish to'lovi: hali yo'q / not yet" at a glance.
 */
export function CompletenessStrip({ present }: { present: Set<ReviewSection> }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {REVIEW_SECTIONS.map((s) => {
        const has = present.has(s);
        return (
          <span
            key={s}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              has
                ? 'border-success/40 text-success'
                : 'border-border text-muted-foreground'
            }`}
          >
            {has ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
            ) : null}
            {t(`uniReview.section.${s}`)}
            {has ? '' : `: ${t('uniReview.completeness.notYet')}`}
          </span>
        );
      })}
    </div>
  );
}
