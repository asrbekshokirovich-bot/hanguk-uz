import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MessageAttachment } from './MessageAttachment';
import type { MessageVM } from './types';

interface MessageBubbleProps {
  message: MessageVM;
  expanded: boolean;
  translating: boolean;
  onToggleTranslation: () => void;
}

/**
 * Inbound / outbound bubble with the inline translation block.
 *
 * Translation is the key feature of this redesign, so it lives INSIDE the
 * bubble under a dashed divider rather than in a tooltip or a side panel: the
 * operator reads the original and the English at the same glance, and the
 * `Uzbek → English` badge makes the direction explicit.
 *
 * The toggle is a real button whose label carries its state
 * ("Translate" / "Hide translation"), so it reads correctly to a screen reader
 * without a separate aria-label.
 */
export function MessageBubble({ message: m, expanded, translating, onToggleTranslation }: MessageBubbleProps) {
  const { t, i18n } = useTranslation();
  const outbound = m.kind === 'out';
  const time = new Date(m.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[560px]">
        <div
          className={cn(
            'px-3.5 py-2.5 shadow-card transition-opacity',
            m.pending && 'opacity-60',
            outbound
              ? 'rounded-[14px_14px_4px_14px] bg-primary'
              : 'rounded-[14px_14px_14px_4px] border border-border bg-card',
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

          <span className="text-[11px] font-medium text-muted-foreground">
            {[
              outbound ? m.senderLabel : null,
              m.pending ? t('messages.thread.sending') : time,
              outbound && !m.pending ? m.deliveryStatus : null,
            ]
              .filter(Boolean)
              .join(' · ')}
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
