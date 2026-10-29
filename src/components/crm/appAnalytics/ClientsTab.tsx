import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { plan } from './planUi';
import { dayLabel, whenLabel } from './person';
import { slotName, studentPath, useClientsActivity, useSeasonRoster, waited } from './clients';

/**
 * «Mijozlar faolligi» (plan v2, stage 5): for the documents team, the
 * students who are waiting on something they have to do in the app — an
 * offer to answer (over 48 hours red; the reminder push goes by itself), a
 * document to upload or upload again, or the app itself, not opened for a
 * week. A row opens the student. Only the season picked in the top bar, as
 * on the other CRM pages: students who went to Korea seasons ago no longer
 * have documents to upload.
 */
export default function ClientsTab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: all, error } = useClientsActivity();
  const { activeIntake, activeIntakeId } = useActiveIntake();
  const roster = useSeasonRoster(activeIntakeId);
  const open = (id: string) => navigate(studentPath(id));
  const lang = i18n.language?.slice(0, 2) || 'uz';

  if (error && !all) return <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>;
  if (!all || roster === undefined) return <p className={plan.note}>{t('appActivity.loading')}</p>;

  const inSeason = <R extends { user_id: string }>(rows: R[]) => (roster ? rows.filter((r) => roster.has(r.user_id)) : rows);
  const data = { offers: inSeason(all.offers), documents: inSeason(all.documents), inactive: inSeason(all.inactive) };
  const season = activeIntake ? `${t(`intake.season.${activeIntake.season}`)} ${activeIntake.year}` : null;
  const seen = (iso: string | null) => (iso ? whenLabel(iso, t) : t('clients.never'));

  return (
    <div className="space-y-4">
      {roster && season && <p className={plan.note}>{t('clients.seasonNote', { season })}</p>}
      <section className={plan.frame}>
        <div className={plan.bar}>
          <span>{t('clients.offers')}</span>
          <span className={plan.badge}>{data.offers.length}</span>
        </div>
        <div className={plan.body}>
          {data.offers.length ? (
            <div className={plan.tscroll}>
              <table className={plan.table}>
                <thead>
                  <tr>
                    <th className={plan.th}>{t('clients.student')}</th>
                    <th className={plan.th}>{t('clients.university')}</th>
                    <th className={plan.th}>{t('clients.waiting')}</th>
                    <th className={plan.th}>{t('clients.reminder')}</th>
                    <th className={plan.th}>{t('clients.lastInApp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.offers.map((o) => (
                    <tr key={`${o.user_id}-${o.institution_id}`} onClick={() => open(o.user_id)} className="cursor-pointer hover:bg-[#EEF2F9] dark:hover:bg-[#17235F]">
                      <td className={cn(plan.td, 'font-semibold')}>{o.name || '—'}</td>
                      <td className={plan.td}>{o.university || '—'}</td>
                      <td className={plan.td}>
                        {o.overdue ? <span className={plan.stNow}>{waited(o.offered_at, t)}</span> : waited(o.offered_at, t)}
                      </td>
                      <td className={cn(plan.td, plan.muted)}>{o.reminded_at ? whenLabel(o.reminded_at, t) : '—'}</td>
                      <td className={cn(plan.td, plan.muted)}>{seen(o.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={plan.note}>{t('clients.noOffers')}</p>
          )}
          <p className={plan.note}>{t('clients.offersNote')}</p>
        </div>
      </section>

      <section className={plan.frame}>
        <div className={plan.bar}>
          <span>{t('clients.documents')}</span>
          <span className={plan.badge}>{data.documents.length}</span>
        </div>
        <div className={plan.body}>
          {data.documents.length ? (
            <div className={plan.tscroll}>
              <table className={plan.table}>
                <thead>
                  <tr>
                    <th className={plan.th}>{t('clients.student')}</th>
                    <th className={plan.th}>{t('clients.contract')}</th>
                    <th className={plan.th}>{t('clients.gaps')}</th>
                    <th className={plan.th}>{t('clients.lastUpload')}</th>
                    <th className={plan.th}>{t('clients.lastInApp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map((d) => (
                    <tr key={d.user_id} onClick={() => open(d.user_id)} className="cursor-pointer hover:bg-[#EEF2F9] dark:hover:bg-[#17235F]">
                      <td className={cn(plan.td, 'font-semibold')}>{d.name || '—'}</td>
                      <td className={cn(plan.td, 'whitespace-nowrap')}>{dayLabel(d.contract_date)}</td>
                      <td className={plan.td}>
                        <div className={plan.chips}>
                          {d.gaps.map((g) => (
                            <span key={g.slot} className={g.state === 'rejected' ? plan.stNow : plan.chip}>
                              {slotName(g.slot, lang)}
                              {g.state === 'rejected' ? ` · ${t('clients.rejected')}` : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={cn(plan.td, plan.muted)}>{d.last_upload_at ? whenLabel(d.last_upload_at, t) : '—'}</td>
                      <td className={cn(plan.td, plan.muted)}>{seen(d.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={plan.note}>{t('clients.noDocuments')}</p>
          )}
        </div>
      </section>

      <section className={plan.frame}>
        <div className={plan.bar}>
          <span>{t('clients.inactive')}</span>
          <span className={plan.badge}>{data.inactive.length}</span>
        </div>
        <div className={plan.body}>
          {data.inactive.length ? (
            <div className={plan.tscroll}>
              <table className={plan.table}>
                <thead>
                  <tr>
                    <th className={plan.th}>{t('clients.student')}</th>
                    <th className={plan.th}>{t('clients.contract')}</th>
                    <th className={plan.th}>{t('clients.lastInApp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inactive.map((s) => (
                    <tr key={s.user_id} onClick={() => open(s.user_id)} className="cursor-pointer hover:bg-[#EEF2F9] dark:hover:bg-[#17235F]">
                      <td className={cn(plan.td, 'font-semibold')}>{s.name || '—'}</td>
                      <td className={cn(plan.td, 'whitespace-nowrap')}>{dayLabel(s.contract_date)}</td>
                      <td className={cn(plan.td, s.last_seen_at ? plan.muted : plan.bad)}>
                        {s.last_seen_at ? `${whenLabel(s.last_seen_at, t)} · ${waited(s.last_seen_at, t)}` : t('clients.never')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={plan.note}>{t('clients.noInactive')}</p>
          )}
        </div>
      </section>
    </div>
  );
}
