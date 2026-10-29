import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { isLaunchScreen, screenLabel } from '@/components/crm/appActivity/describe';
import { plan } from './planUi';
import { STEP_ICON, duration, useStepDescriber } from './steps';
import {
  PLATFORM_LABEL,
  channelLabel,
  groupBySession,
  useJourney,
  whenLabel,
  type Person,
} from './person';

interface JourneyDialogProps {
  leadId: string;
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * «To'liq yo'l»: the person's visits over the last 30 days, newest first, each
 * with its steps — screens with the time spent on them, what was pressed,
 * what was chosen and sent. Opening it is logged (analytics_access_log).
 */
export default function JourneyDialog({ leadId, person, open, onOpenChange }: JourneyDialogProps) {
  const { t } = useTranslation();
  const { data, loading, error } = useJourney(leadId, open);
  const describe = useStepDescriber(data?.steps, t);
  const groups = useMemo(() => (data ? groupBySession(data.sessions, data.steps) : []), [data]);

  const channel = person ? channelLabel(person.contact_channel, person.lead_source, t) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('appPerson.journeyTitle')}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
            {[
              [t('appPerson.kind.lead'), channel].filter(Boolean).join(' · '),
              person?.how_heard ? t('appPerson.ownSource', { source: person.how_heard }) : null,
              person?.platform ? PLATFORM_LABEL[person.platform] ?? person.platform : null,
              data ? t('appPerson.sessions', { count: data.sessions.length }) : null,
            ]
              .filter(Boolean)
              .map((x) => (
                <span key={x as string}>{x}</span>
              ))}
          </DialogDescription>
        </DialogHeader>

        {person?.ai_summary && <p className="text-[13.5px] leading-relaxed">{person.ai_summary}</p>}

        {loading ? (
          <p className={plan.note}>{t('appActivity.loading')}</p>
        ) : error ? (
          <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>
        ) : !groups.length ? (
          <p className={plan.note}>{t('appPerson.noSteps')}</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g, i) => (
              <section key={i} className="space-y-1.5">
                <h3 className="flex flex-wrap gap-x-3 text-[13px] font-bold">
                  <span>
                    {whenLabel(g.session?.started_at ?? g.steps[g.steps.length - 1]?.at, t)}
                    {g.session?.duration_s != null ? ` · ${duration(g.session.duration_s, t)}` : ''}
                  </span>
                  {g.session && (
                    <span className={cn('font-semibold', plan.muted)}>
                      {t('appPerson.entryExit', {
                        entry: (isLaunchScreen(g.session.entry_screen) ? t('appActivity.screens.home') : screenLabel(g.session.entry_screen, t)) || '—',
                        exit: screenLabel(g.session.exit_screen, t) || '—',
                      })}
                    </span>
                  )}
                </h3>
                <ol className="space-y-1">
                  {[...g.steps].reverse().map((s, k) => (
                    <li key={k} className="grid grid-cols-[4.6rem_1.2rem_minmax(0,1fr)_auto] items-baseline gap-2 text-[13px]">
                      <span className={cn('font-mono tabular-nums', plan.muted)}>
                        {new Date(s.at).toLocaleTimeString('en-GB')}
                      </span>
                      <span aria-hidden className="text-center">
                        {STEP_ICON[s.event] ?? '·'}
                      </span>
                      <span className="min-w-0">{describe(s)}</span>
                      <span className={cn('whitespace-nowrap tabular-nums', plan.muted)}>
                        {s.duration_ms ? duration(s.duration_ms / 1000, t) : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {data?.truncated && <p className={plan.note}>{t('appPerson.truncated')}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
