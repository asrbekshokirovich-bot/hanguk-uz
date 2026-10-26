import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { plan } from '@/components/crm/appAnalytics/planUi';
import { useTodayInApp, signalText, signalWhen, timerText, type TodayRow } from '@/components/crm/appAnalytics/today';
import { studentPath } from '@/components/crm/appAnalytics/clients';

/**
 * «Bugun ilovada» — the marketing plan's operator list (2026-10-22), as its
 * mock-up draws it: three numbers on top (app requests waiting, with the
 * nearest timer; leads back in the app today; university offers the students
 * have not answered), then the open tasks — Kim, Signal, Qachon, Navbat,
 * Kimga — HOZIR first. All staff see it (S6). A row opens the lead's card.
 */
export default function TodayInAppContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error } = useTodayInApp();
  const [now, setNow] = useState(() => Date.now());

  // The timer runs by the second.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const open = (r: TodayRow) => {
    if (r.lead_id) navigate(`/crm/leads/${r.lead_id}`);
    else navigate(r.user_id ? studentPath(r.user_id) : '/crm/students');
  };

  const timer = data?.waiting && data.waiting_due_at ? timerText(data.waiting_due_at, now, t) : null;

  return (
    <div className="mx-auto max-w-5xl p-4">
      <section className={plan.frame}>
        <div className={plan.bar}>
          <h1 className="text-[12.5px] font-semibold">{t('todayInApp.title')}</h1>
        </div>
        <div className={plan.body}>
          <div className={plan.opk}>
            <div className={plan.opkItem}>
              <span className={plan.opkLabel}>{t('todayInApp.waiting')}</span>
              <span className={plan.opkValue}>
                {data?.waiting ?? '—'}
                {timer && <small className={plan.opkSmall}> · {timer}</small>}
              </span>
            </div>
            <div className={plan.opkItem}>
              <span className={plan.opkLabel}>{t('todayInApp.cameBack')}</span>
              <span className={plan.opkValue}>{data?.came_back ?? '—'}</span>
            </div>
            <div className={plan.opkItem}>
              <span className={plan.opkLabel}>{t('todayInApp.offers')}</span>
              <span className={plan.opkValue}>{data?.offers_waiting ?? '—'}</span>
            </div>
          </div>

          {loading && !data ? (
            <p className={plan.note}>{t('appActivity.loading')}</p>
          ) : error ? (
            <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>
          ) : !data?.rows.length ? (
            <p className={plan.note}>{t('todayInApp.empty')}</p>
          ) : (
            <div className={plan.tscroll}>
              <table className={plan.table}>
                <thead>
                  <tr>
                    <th className={plan.th}>{t('todayInApp.cols.who')}</th>
                    <th className={plan.th}>{t('todayInApp.cols.signal')}</th>
                    <th className={plan.th}>{t('todayInApp.cols.when')}</th>
                    <th className={plan.th}>{t('todayInApp.cols.queue')}</th>
                    <th className={plan.th}>{t('todayInApp.cols.to')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => open(r)}
                      className="cursor-pointer hover:bg-[#EEF2F9] dark:hover:bg-[#17235F]"
                    >
                      <td className={plan.td}>{who(r, t)}</td>
                      <td className={plan.td}>{signalText(r, t)}</td>
                      <td className={cn(plan.td, 'whitespace-nowrap')}>{signalWhen(r.asked_at, now, t)}</td>
                      <td className={plan.td}>
                        {r.queue === 'now' ? (
                          <span className={plan.stNow}>{t('todayInApp.now')}</span>
                        ) : (
                          <span className={plan.stToday}>{t('todayInApp.today')}</span>
                        )}
                      </td>
                      <td className={plan.td} title={r.target === 'owner' && r.assignee ? r.assignee : undefined}>
                        {t(`todayInApp.targets.${r.target}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** «Aziz Karimov · Lid · Instagram», «Dilnoza · Talaba». */
function who(r: TodayRow, t: (k: string, o?: Record<string, unknown>) => string): string {
  const channel = r.kind === 'lead' ? r.contact_channel || (r.source ? t(`appPerson.sources.${r.source}`, { defaultValue: r.source }) : null) : null;
  return [r.name, t(`appPerson.kind.${r.kind}`), channel].filter(Boolean).join(' · ');
}
