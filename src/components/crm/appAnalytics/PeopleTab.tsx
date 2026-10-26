import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { plan } from './planUi';
import { PLATFORM_LABEL, whenLabel } from './person';

const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface PeopleRow {
  person_key: string;
  kind: 'student' | 'lead' | 'guest';
  name: string | null;
  lead_id: string | null;
  user_id: string | null;
  how_heard: string | null;
  how_heard_key: string | null;
  for_whom: string | null;
  lead_status: string | null;
  lead_source: string | null;
  platform: string | null;
  last_seen_at: string;
  visits: number;
  score: number;
  picks: number;
  visa_band: string | null;
  report: boolean;
  request: boolean;
  is_test: boolean;
}

interface PeopleData {
  total: number;
  kinds: Record<string, number>;
  rows: PeopleRow[];
}

const KINDS = ['all', 'lead', 'guest', 'student'] as const;
const PERIODS = [7, 30, 90] as const;

/**
 * «Odamlar»: everyone seen in the app in the period — guests, leads and
 * students — with their own answer to «Qayerdan topdingiz?» (S3), the last
 * visit, visits, the app score and how far they got. Test devices only when
 * asked (S10). A lead or student row opens their card.
 */
export default function PeopleTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [days, setDays] = useState<number>(30);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all');
  const [q, setQ] = useState('');
  const [test, setTest] = useState(false);
  const [data, setData] = useState<PeopleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      db.rpc('analytics_people', {
        p_days: days,
        p_kind: kind === 'all' ? null : kind,
        p_include_test: test,
        p_search: q.trim() || null,
        p_limit: 200,
      }).then(({ data, error }: { data: PeopleData | null; error: { message: string } | null }) => {
        if (!alive) return;
        setError(error ? error.message : null);
        setData(error ? null : data);
        setLoading(false);
      });
    }, q ? 300 : 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [days, kind, q, test]);

  const open = (r: PeopleRow) => {
    if (r.lead_id && r.kind === 'lead') navigate(`/crm/leads/${r.lead_id}`);
    else if (r.kind === 'student') navigate('/crm/students');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn('rounded px-2.5 py-1 text-[12.5px] font-semibold', days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {t('appAnalytics.people.days', { count: d })}
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-border p-0.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn('rounded px-2.5 py-1 text-[12.5px] font-semibold', kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {t(`appAnalytics.people.kinds.${k}`)}
              {k !== 'all' && data?.kinds?.[k] != null ? ` · ${data.kinds[k]}` : ''}
            </button>
          ))}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('appAnalytics.people.search')}
          className="h-8 w-48 text-[13px]"
        />
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
          {t('appAnalytics.people.withTest')}
        </label>
      </div>

      <div className={plan.frame}>
        {loading ? (
          <p className={cn(plan.body, plan.note)}>{t('appActivity.loading')}</p>
        ) : error ? (
          <p className={cn(plan.body, 'text-[13px]', plan.bad)}>{t('appActivity.error')}</p>
        ) : !data?.rows.length ? (
          <p className={cn(plan.body, plan.note)}>{t('appAnalytics.people.empty')}</p>
        ) : (
          <div className={cn(plan.tscroll, 'px-2 py-1')}>
            <table className={plan.table}>
              <thead>
                <tr>
                  <th className={plan.th}>{t('appAnalytics.people.cols.who')}</th>
                  <th className={plan.th}>{t('appAnalytics.people.cols.source')}</th>
                  <th className={plan.th}>{t('appAnalytics.people.cols.last')}</th>
                  <th className={cn(plan.th, plan.num)}>{t('appAnalytics.people.cols.visits')}</th>
                  <th className={cn(plan.th, plan.num)}>{t('appAnalytics.people.cols.score')}</th>
                  <th className={plan.th}>{t('appAnalytics.people.cols.stage')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const who = [r.name, t(`appPerson.kind.${r.kind}`), r.platform ? PLATFORM_LABEL[r.platform] ?? r.platform : null]
                    .filter(Boolean)
                    .join(' · ');
                  const stage = [
                    r.picks ? t('appAnalytics.people.picks', { count: r.picks }) : null,
                    r.visa_band ? t('appAnalytics.people.visa', { band: t(`appPerson.band.${r.visa_band}`) }) : null,
                    r.report ? t('appAnalytics.people.report') : null,
                    r.request ? t('appAnalytics.people.request') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  const clickable = (r.kind === 'lead' && r.lead_id) || r.kind === 'student';
                  return (
                    <tr
                      key={r.person_key}
                      onClick={clickable ? () => open(r) : undefined}
                      className={cn(clickable && 'cursor-pointer hover:bg-[#EEF2F9] dark:hover:bg-[#17235F]')}
                    >
                      <td className={plan.td}>
                        {who}
                        {r.is_test && <span className={cn('ml-1.5 text-[11.5px]', plan.muted)}>{t('appAnalytics.people.test')}</span>}
                      </td>
                      <td className={plan.td}>{r.how_heard ?? '—'}</td>
                      <td className={cn(plan.td, 'whitespace-nowrap')}>{whenLabel(r.last_seen_at, t)}</td>
                      <td className={cn(plan.td, plan.num)}>{r.visits}</td>
                      <td className={cn(plan.td, plan.num)}>{r.score}</td>
                      <td className={plan.td}>{stage || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && data.total > data.rows.length && (
        <p className={plan.note}>{t('appAnalytics.people.more', { shown: data.rows.length, total: data.total })}</p>
      )}
    </div>
  );
}
