import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { screenLabel } from '@/components/crm/appActivity/describe';
import { cn } from '@/lib/utils';
import { plan } from './planUi';
import { useStepDescriber } from './steps';
import { liveWhat, liveWho, useLive } from './live';

/**
 * «Jonli» as the plan draws it: the green dot, how many devices are in the
 * app now (the last five minutes) and how many of them are known leads, then
 * the last hour's steps, newest first — «14:26  Ism · Lid · Instagram —
 * konsultant formasini ochdi». Read again every ten seconds; test devices
 * aside. A lead's line opens the card.
 */
export default function LiveTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, error } = useLive();
  const describe = useStepDescriber(data?.events, t);
  const screen = (s: string | null) => screenLabel(s, t);

  return (
    <section className={plan.frame}>
      <div className={plan.bar}>
        <span>{t('live.title')}</span>
      </div>
      <div className={plan.body}>
        {error && !data ? (
          <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>
        ) : !data ? (
          <p className={plan.note}>{t('appActivity.loading')}</p>
        ) : (
          <>
            <div className={plan.liveN}>
              <span className={plan.dot} aria-hidden />
              <b className={plan.liveValue}>{data.devices}</b>
              <span className={cn('text-[15px]', plan.muted)}>{t('live.now', { count: data.devices, leads: data.leads })}</span>
            </div>
            {data.events.length ? (
              <ul className={plan.feed}>
                {data.events.map((e, i) => {
                  const who = liveWho(e, t);
                  const open = e.kind === 'lead' && e.lead_id ? () => navigate(`/crm/leads/${e.lead_id}`) : undefined;
                  return (
                    <li key={`${e.at}-${i}`} className={plan.feedRow}>
                      <span className={plan.feedTime}>
                        {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="min-w-0">
                        {open ? (
                          <b role="link" tabIndex={0} onClick={open} onKeyDown={(k) => k.key === 'Enter' && open()} className="cursor-pointer font-bold hover:underline">
                            {who}
                          </b>
                        ) : (
                          who
                        )}{' '}
                        — {liveWhat(e, describe, screen, t)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={plan.note}>{t('live.empty')}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
