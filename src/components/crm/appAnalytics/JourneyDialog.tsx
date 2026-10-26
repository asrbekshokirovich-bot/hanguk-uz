import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { describeEvent, screenLabel } from '@/components/crm/appActivity/describe';
import type { AppEvent } from '@/components/crm/appActivity/useAppActivity';
import elements from '@/components/crm/appActivity/appElements.json';
import { plan } from './planUi';
import {
  PLATFORM_LABEL,
  channelLabel,
  groupBySession,
  institutionNames,
  useEventNames,
  useJourney,
  whenLabel,
  type JourneyStep,
  type Person,
} from './person';

interface JourneyDialogProps {
  leadId: string;
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ElementInfo = { uz: string | null };
const ELEMENTS = elements as Record<string, ElementInfo>;

/** Events the CRM already words well (appActivity.events). */
const DESCRIBED = new Set([
  'screen_view', 'tab_open', 'university_open', 'university_save', 'university_unsave', 'university_skip',
  'slot_remove', 'slot_set', 'duel_pick', 'filter_apply', 'assessment_start', 'report_view', 'lead_submit',
  'sign_in', 'qr_scan', 'interview_start', 'interview_end', 'interview_leave', 'study_plan_feedback',
  'dictation_start', 'document_upload', 'contact_tap', 'language_set', 'search', 'app_open',
]);

const ICON: Record<string, string> = {
  app_open: '→',
  app_resume: '→',
  screen_leave: '▣',
  slot_set: '♥',
  slot_remove: '♡',
  form_open: '✎',
  field_focus: '✎',
  field_error: '✎',
  form_submit: '✎',
  question_answer: '✎',
  lead_submit: '✎',
  app_background: '×',
};

/** "41 s", "1 daq 12 s", "6 daq 40 s". */
function duration(seconds: number | null | undefined, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (seconds == null || seconds < 0) return '';
  const s = Math.round(seconds);
  if (s < 60) return t('appPerson.seconds', { s });
  return t('appPerson.minutes', { m: Math.floor(s / 60), s: s % 60 });
}

function elementLabel(name: string | null): string {
  if (!name) return '';
  return ELEMENTS[name]?.uz ?? name.replace(/[._]/g, ' ');
}

/**
 * «To'liq yo'l»: the person's visits over the last 30 days, newest first, each
 * with its steps — screens with the time spent on them, what was pressed,
 * what was chosen and sent. Opening it is logged (analytics_access_log).
 */
export default function JourneyDialog({ leadId, person, open, onOpenChange }: JourneyDialogProps) {
  const { t } = useTranslation();
  const { data, loading, error } = useJourney(leadId, open);
  const registry = useEventNames();
  const [unis, setUnis] = useState<Record<string, string>>({});

  // The universities the steps mention, by name.
  useEffect(() => {
    if (!data) return;
    const ids = new Set<string>();
    for (const s of data.steps) {
      for (const k of ['institution_id', 'other_id']) {
        const v = s.props?.[k];
        if (typeof v === 'string' && v) ids.add(v);
      }
    }
    if (!ids.size) return;
    let alive = true;
    void institutionNames([...ids]).then((names) => {
      if (alive) setUnis(names);
    });
    return () => {
      alive = false;
    };
  }, [data]);

  const groups = useMemo(() => (data ? groupBySession(data.sessions, data.steps) : []), [data]);

  const describe = (s: JourneyStep): string => {
    const event: AppEvent = {
      id: 0,
      install_id: '',
      user_id: null,
      event: s.event,
      screen: s.screen,
      props: s.props ?? {},
      occurred_at: s.at,
    };
    if (DESCRIBED.has(s.event)) return describeEvent(event, t, unis);
    const base = registry[s.event] ?? s.event;
    if (s.event === 'tap' || s.event === 'long_press') return `${base}: ${elementLabel(s.element)}`;
    if (s.event === 'screen_leave') return screenLabel(s.screen, t) || base;
    const form = typeof s.props?.form === 'string' ? ` · ${s.props.form}` : '';
    const what = typeof s.props?.q === 'string' ? ` · ${s.props.q}` : typeof s.props?.field === 'string' ? ` · ${s.props.field}` : '';
    return `${base}${form}${what}`;
  };

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
                        entry: screenLabel(g.session.entry_screen, t) || '—',
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
                        {ICON[s.event] ?? '·'}
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
