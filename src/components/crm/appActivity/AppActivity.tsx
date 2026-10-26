import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';
import { describeEvent, pickedUniversities, sessionsOf } from './describe';
import { useAppActivity, type AppActivity as Activity } from './useAppActivity';

interface AppActivityProps {
  /** A lead's card: the installations the guest tied to this lead. */
  leadId?: string | null;
  /** A student's card: what they did signed in, and as a guest on the same phone. */
  userId?: string | null;
}

const VISITS_SHOWN = 5;

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function day(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * "Ilovadagi faollik": what this person opened and pressed in the student
 * app, newest visit first. A visit is a run of events with no gap over 30
 * minutes. Only what was done is recorded — never typed text.
 */
export function AppActivity({ leadId, userId }: AppActivityProps) {
  const { t } = useTranslation();
  const { data, loading, error } = useAppActivity({ leadId, userId });

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
          <Smartphone className="h-3.5 w-3.5" aria-hidden />
          {t('appActivity.title')}
        </h2>
        {data && data.events.length > 0 && (
          <p className="text-[11.5px] text-muted-foreground">
            {t('appActivity.lastSeen', { date: new Date(data.events[0].occurred_at).toLocaleString() })}
          </p>
        )}
      </div>
      {loading ? (
        <p className="mt-2 text-[12.5px] text-muted-foreground">{t('appActivity.loading')}</p>
      ) : error ? (
        <p className="mt-2 text-[12.5px] text-destructive">{t('appActivity.error')}</p>
      ) : !data || data.events.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {leadId && (!data || data.installs.length === 0)
            ? t('appActivity.emptyLead')
            : userId && !leadId
              ? t('appActivity.emptyStudent')
              : t('appActivity.empty')}
        </p>
      ) : (
        <ActivityBody data={data} />
      )}
    </section>
  );
}

function ActivityBody({ data }: { data: Activity }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const visits = sessionsOf(data.events);
  const shown = all ? visits : visits.slice(0, VISITS_SHOWN);
  const picked = pickedUniversities(data.events);
  const platforms = [...new Set(data.installs.map((i) => i.platform).filter(Boolean))].join(', ');

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full border border-border px-2.5 py-0.5 font-semibold text-foreground">
          {t('appActivity.visits', { count: visits.length })}
        </span>
        <span className="rounded-full border border-border px-2.5 py-0.5 font-semibold text-foreground">
          {t('appActivity.picked', { count: picked.length })}
        </span>
        {platforms && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">{platforms}</span>
        )}
      </div>
      <ol className="mt-2 space-y-3">
        {shown.map((visit) => {
          const first = visit[visit.length - 1];
          const last = visit[0];
          return (
            <li key={first.id}>
              <p className="text-[11.5px] font-semibold text-muted-foreground">
                {day(first.occurred_at)} · {time(first.occurred_at)}–{time(last.occurred_at)}
              </p>
              <ul className="mt-1 space-y-0.5 border-l border-border pl-3">
                {[...visit].reverse().map((e) => (
                  <li key={e.id} className="flex gap-2 text-[12.5px] text-foreground">
                    <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{time(e.occurred_at)}</span>
                    <span className="min-w-0">{describeEvent(e, t, data.names)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      {visits.length > VISITS_SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 text-[12px] font-semibold text-primary hover:underline"
        >
          {all ? t('appActivity.showLess') : t('appActivity.showAll', { count: visits.length })}
        </button>
      )}
    </>
  );
}
