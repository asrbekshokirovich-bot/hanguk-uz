import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHANNEL_STYLE } from './channelStyle';
import type { Suggestion } from './useLeadProfile';

interface SuggestionRowProps {
  suggestion: Suggestion;
  /** Work items get a wider, warmer treatment than plain attributes. */
  emphasis: boolean;
  busy: boolean;
  onAccept: (id: string, value?: string) => void;
  onReject: (id: string) => void;
  onShowEvidence: (suggestion: Suggestion) => void;
}

/**
 * Confidence as four ticks rather than "0.9".
 *
 * A decimal invites arithmetic nobody should do — 0.82 is not meaningfully
 * worse than 0.85, and showing the digits implies it is. Four steps say the
 * only thing the operator needs: read the evidence carefully, or glance at it.
 */
function Confidence({ value }: { value: number }) {
  const { t } = useTranslation();
  const steps = Math.max(1, Math.min(4, Math.round(value * 4)));
  return (
    <span
      className="flex items-center gap-1"
      title={t('leads.profile.ai.confidenceTitle', { percent: Math.round(value * 100) })}
    >
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={cn(
            'h-1 w-3.5 rounded-full',
            step <= steps ? 'bg-primary/70' : 'bg-border',
          )}
        />
      ))}
      <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {t('leads.profile.ai.confidence')}
      </span>
    </span>
  );
}

export function SuggestionRow({
  suggestion,
  emphasis,
  busy,
  onAccept,
  onReject,
  onShowEvidence,
}: SuggestionRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(suggestion.suggested_value);

  const decided = suggestion.status !== 'pending';
  const channel = suggestion.evidence_channel;
  const style = channel ? CHANNEL_STYLE[channel] : null;
  const shown = suggestion.corrected_value ?? suggestion.suggested_value;

  return (
    <div
      className={cn(
        'rounded-lg border px-3.5 py-3',
        emphasis ? 'border-amber-300 bg-amber-50/60' : 'border-border bg-card',
        decided && 'opacity-75',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        {/* Left: what is proposed */}
        <div className="min-w-0 md:w-[220px] md:shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {t(`leads.profile.fields.${suggestion.field}`, suggestion.field)}
          </p>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full rounded-md border border-primary/50 bg-background px-2 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <p className="mt-0.5 break-words text-[13.5px] font-bold leading-snug text-foreground">
              {shown}
            </p>
          )}
          <div className="mt-1.5">
            <Confidence value={Number(suggestion.confidence ?? 0)} />
          </div>
        </div>

        {/* Middle: why. The evidence is the reason this row can be trusted, so
            it gets the width, not the value. */}
        <div className="min-w-0 flex-1">
          {suggestion.evidence ? (
            <>
              <p className="break-words text-[12.5px] italic leading-relaxed text-foreground">
                “{suggestion.evidence}”
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                {style && channel && (
                  <span className={cn('flex items-center gap-1 font-semibold', style.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
                    {t(`leads.profile.channels.${channel}`)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onShowEvidence(suggestion)}
                  className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {t('leads.profile.ai.showInFeed')}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[12px] italic text-muted-foreground">
              {t('leads.profile.ai.noEvidence')}
            </p>
          )}
        </div>

        {/* Right: the decision */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:justify-end">
          {decided ? (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                suggestion.status === 'rejected'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {t(`leads.profile.ai.status.${suggestion.status}`)}
              {suggestion.decided_at
                ? ` · ${new Date(suggestion.decided_at).toLocaleDateString()}`
                : ''}
            </span>
          ) : editing ? (
            <>
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => {
                  onAccept(suggestion.id, draft);
                  setEditing(false);
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {t('leads.profile.ai.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(suggestion.suggested_value);
                  setEditing(false);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted"
              >
                {t('leads.profile.ai.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(suggestion.id)}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {t('leads.profile.ai.accept')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t('leads.profile.ai.edit')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReject(suggestion.id)}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t('leads.profile.ai.reject')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
