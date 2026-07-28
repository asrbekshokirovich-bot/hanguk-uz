import { useTranslation } from 'react-i18next';
import { Check, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConversationVM, StudentContextVM } from './types';

interface StudentContextRailProps {
  conversation: ConversationVM;
  student: StudentContextVM | null;
  loading: boolean;
}

/**
 * Right rail: who the operator is actually talking to.
 *
 * Everything here is read-only context pulled from `profiles`, `applications`,
 * `documents`, `payments` and `calls` — the point is that the operator never
 * has to leave the inbox to answer "where is this student up to?".
 *
 * Hidden below the xl breakpoint; the thread pane keeps its 520px minimum and
 * the workspace row scrolls instead of compressing.
 */
export function StudentContextRail({ conversation, student, loading }: StudentContextRailProps) {
  const { t, i18n } = useTranslation();

  return (
    <aside
      aria-label={t('messages.rail.label')}
      className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-border bg-card px-4 pb-7 pt-4 xl:block"
    >
      {!conversation.studentId ? (
        <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">{t('messages.rail.noStudentTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('messages.rail.noStudentBody')}</p>
        </div>
      ) : loading || !student ? (
        <div className="space-y-4">
          <Skeleton className="mx-auto h-14 w-14 rounded-full" />
          <Skeleton className="mx-auto h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {/* Student card */}
          <div className="flex flex-col items-center gap-2 border-b border-border/60 pb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-[19px] font-bold text-primary">
              {student.initials || conversation.initials}
            </div>
            <p className="text-[15px] font-bold text-foreground">{student.name || conversation.name}</p>
            {student.phone && <p className="text-xs text-muted-foreground">{student.phone}</p>}
            <div className="mt-0.5 flex flex-wrap justify-center gap-1.5">
              {student.plan && (
                <span className="rounded-pill bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {student.plan}
                </span>
              )}
              {student.magicCode && (
                <span className="rounded-pill bg-muted px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] text-foreground/75">
                  {student.magicCode}
                </span>
              )}
            </div>
          </div>

          {/* Application progress */}
          <RailSection title={t('messages.rail.progress')}>
            <ol className="flex flex-col gap-2.5">
              {student.steps.map((step) => (
                <li key={step.label} className="flex items-center gap-2.5">
                  {step.state === 'done' ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Check className="h-3 w-3" strokeWidth={3.4} aria-hidden="true" />
                    </span>
                  ) : step.state === 'current' ? (
                    <span className="h-5 w-5 shrink-0 rounded-full border-[3px] border-accent bg-card" />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded-full border border-border bg-muted" />
                  )}
                  <span className="text-[13px] font-medium text-foreground/75">{step.label}</span>
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground">{step.note}</span>
                  <span className="sr-only">{t(`messages.rail.state.${step.state}`)}</span>
                </li>
              ))}
            </ol>
          </RailSection>

          {/* Documents */}
          {student.documents.length > 0 && (
            <RailSection title={t('messages.rail.documents')}>
              <ul className="flex flex-col gap-1.5">
                {student.documents.map((doc) => (
                  <li key={doc.label} className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground/75">{doc.label}</span>
                    <span
                      className={cn(
                        'ml-auto shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold',
                        doc.state === 'received' && 'bg-success/10 text-success',
                        doc.state === 'review' && 'bg-warning/10 text-warning',
                        doc.state === 'missing' && 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {t(`messages.rail.doc.${doc.state}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </RailSection>
          )}

          {/* Payment */}
          {student.payment && (
            <RailSection title={t('messages.rail.payment')}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-xl font-extrabold text-foreground">
                  {formatMoney(student.payment.paid, student.payment.currency, i18n.language)}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {t('messages.rail.ofTotal', {
                    total: formatMoney(student.payment.total, student.payment.currency, i18n.language),
                  })}
                </span>
              </div>
              <div
                className="h-[7px] overflow-hidden rounded-pill bg-muted"
                role="progressbar"
                aria-valuenow={percent(student.payment.paid, student.payment.total)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('messages.rail.payment')}
              >
                <div
                  className="h-full rounded-pill bg-primary transition-all"
                  style={{ width: `${percent(student.payment.paid, student.payment.total)}%` }}
                />
              </div>
              {student.payment.nextDue && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  {t('messages.rail.nextInstalment', {
                    date: new Date(student.payment.nextDue).toLocaleDateString(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                    }),
                  })}
                </p>
              )}
            </RailSection>
          )}

          {/* Recent activity */}
          {student.activity.length > 0 && (
            <RailSection title={t('messages.rail.activity')} last>
              <ul className="flex flex-col gap-2.5">
                {student.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-foreground/75">{a.text}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {new Date(a.at).toLocaleDateString(i18n.language, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </RailSection>
          )}
        </>
      )}
    </aside>
  );
}

function RailSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn('py-4', !last && 'border-b border-border/60')}>
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function percent(paid: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

function formatMoney(value: number, currency: string, locale: string): string {
  const compact = value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value.toLocaleString(locale);
  return `${compact} ${currency}`;
}
