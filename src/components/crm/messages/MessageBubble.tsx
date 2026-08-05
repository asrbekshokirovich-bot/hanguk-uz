import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageAttachment } from './MessageAttachment';
import type { MessageVM } from './types';

interface MessageBubbleProps {
  message: MessageVM;
  expanded: boolean;
  translating: boolean;
  onToggleTranslation: () => void;
  /** Re-deliver a failed outbound message. Present only for `out` bubbles. */
  onRetry?: () => void;
}

/**
 * Inbound / outbound bubble with the inline translation block and, for
 * outbound messages, the Telegram-style delivery lifecycle:
 *
 *   🕐 sending → ✓ sent → (on failure) red bubble + reason + Retry.
 *
 * A failed message never disappears — the operator sees exactly what did not
 * go out and resends it with one click, without retyping.
 */
export function MessageBubble({ message: m, expanded, translating, onToggleTranslation, onRetry }: MessageBubbleProps) {
  const { t, i18n } = useTranslation();
  const outbound = m.kind === 'out';
  const failed = outbound && m.deliveryStatus === 'failed';
  const sending = outbound && m.deliveryStatus === 'sending';
  const time = new Date(m.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[560px]">
        <div
          className={cn(
            'px-3.5 py-2.5 shadow-card transition-opacity',
            sending && 'opacity-60',
            outbound
              ? 'rounded-[14px_14px_4px_14px] bg-primary'
              : 'rounded-[14px_14px_14px_4px] border border-border bg-card',
            failed && 'ring-2 ring-destructive/60',
          )}
        >
          {m.media && (
            <div className={cn(m.text && 'mb-2')}>
              <MessageAttachment media={m.media} onPrimary={outbound} />
            </div>
          )}

          {m.text && (
            <p
              className={cn(
                'whitespace-pre-wrap text-sm leading-[1.55]',
                outbound ? 'text-primary-foreground' : 'text-foreground',
              )}
              style={{ textWrap: 'pretty' } as React.CSSProperties}
            >
              {m.text}
            </p>
          )}

          {expanded && m.translation && (
            <div
              className={cn(
                'mt-2.5 border-t border-dashed pt-2.5',
                outbound ? 'border-primary-foreground/30' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'inline-block rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]',
                  outbound ? 'text-accent' : 'bg-accent/20 text-spring',
                )}
              >
                {t('messages.thread.translationBadge', {
                  from: m.translation.sourceLang,
                  to: m.translation.targetLang,
                })}
              </span>
              <p
                className={cn(
                  'mt-1 text-[13.5px] leading-[1.5]',
                  outbound ? 'text-primary-foreground/80' : 'text-foreground/75',
                )}
              >
                {m.translation.text}
              </p>
            </div>
          )}
        </div>

        {failed && (
          <div className="mt-1.5 flex items-center justify-end gap-2 px-0.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
            <span className="max-w-[380px] truncate text-[11px] font-medium text-destructive">
              {m.deliveryError || t('messages.thread.sendFailed', 'Not delivered')}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex min-h-0 min-w-0 items-center gap-1 rounded-sm border border-destructive/40 px-1.5 py-0.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {t('messages.thread.retry', 'Retry')}
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            'mt-1.5 flex items-center gap-2.5 px-0.5',
            outbound ? 'justify-end' : 'justify-start',
          )}
        >
          {outbound && m.translatable && (
            <TranslationToggle
              expanded={expanded}
              translating={translating}
              hasTranslation={!!m.translation}
              onClick={onToggleTranslation}
            />
          )}

          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            {[outbound ? m.senderLabel : null, sending ? t('messages.thread.sending') : time]
              .filter(Boolean)
              .join(' · ')}
            {outbound && !failed && (
              sending ? (
                <Clock className="h-3 w-3" aria-label={t('messages.thread.sending')} />
              ) : (
                <Check className="h-3.5 w-3.5 text-primary" aria-label={t('messages.thread.sent', 'Sent')} />
              )
            )}
          </span>

          {!outbound && m.translatable && (
            <TranslationToggle
              expanded={expanded}
              translating={translating}
              hasTranslation={!!m.translation}
              onClick={onToggleTranslation}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TranslationToggle({
  expanded,
  translating,
  hasTranslation,
  onClick,
}: {
  expanded: boolean;
  translating: boolean;
  hasTranslation: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const label = translating
    ? t('messages.thread.translating')
    : expanded && hasTranslation
      ? t('messages.thread.hideTranslation')
      : t('messages.thread.translate');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={translating}
      className="min-h-0 min-w-0 rounded-sm text-[11px] font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
    </button>
  );
}
