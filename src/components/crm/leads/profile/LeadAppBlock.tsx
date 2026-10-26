import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { operatorLink } from '@/lib/appLink';
import { plan } from '@/components/crm/appAnalytics/planUi';
import {
  PLATFORM_LABEL,
  TARIFF_LABEL,
  sourceChips,
  useAiStarter,
  usePerson,
  whenLabel,
  type Person,
} from '@/components/crm/appAnalytics/person';
import type { LeadRecord } from './useLeadProfile';

const JourneyDialog = lazy(() => import('@/components/crm/appAnalytics/JourneyDialog'));

interface LeadAppBlockProps {
  lead: LeadRecord;
}

/**
 * «Ilovada» on the lead's card — the marketing plan's mock-up (2026-10-22),
 * row by row: Faollik, Manba, Kim uchun, Tanlovlari ♥, Viza testi, Hisobot,
 * Mos tarif, Gapni boshlash; then «Ilova havolasini yuborish» and «To'liq
 * yo'lni ochish». With no phone tied to the lead it says so (K8), and the
 * operator can still send the link (B2: the operator decides to whom).
 */
export function LeadAppBlock({ lead }: LeadAppBlockProps) {
  const { t } = useTranslation();
  const { data: person, loading, error } = usePerson(lead.id);
  const [journeyOpen, setJourneyOpen] = useState(false);

  const link = lead.link_code ? operatorLink(lead.link_code) : null;
  const sendLink = async () => {
    if (!link) return;
    const text = t('leads.profile.links.appInviteText', { link });
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('appPerson.linkCopied'));
    } catch {
      toast.error(t('leads.profile.links.copyFailed'));
    }
  };

  return (
    <section className={plan.frame} aria-label={t('appPerson.title')}>
      <div className={plan.bar}>
        <span>{t('appPerson.title')}</span>
      </div>
      {loading ? (
        <p className={cn(plan.body, plan.note)}>{t('appActivity.loading')}</p>
      ) : error ? (
        <p className={cn(plan.body, 'text-[13px] text-[#B4232E]')}>{t('appActivity.error')}</p>
      ) : !person ? (
        <p className={cn(plan.body, plan.note)}>{t('appPerson.noDevice')}</p>
      ) : (
        <PersonRows person={person} />
      )}
      <div className={plan.foot}>
        <button type="button" className={plan.btnPrimary} onClick={sendLink} disabled={!link}>
          {t('appPerson.sendLink')}
        </button>
        {person && (
          <button type="button" className={plan.btn} onClick={() => setJourneyOpen(true)}>
            {t('appPerson.openJourney')}
          </button>
        )}
      </div>
      {journeyOpen && (
        <Suspense fallback={null}>
          <JourneyDialog leadId={lead.id} person={person} open={journeyOpen} onOpenChange={setJourneyOpen} />
        </Suspense>
      )}
    </section>
  );
}

function PersonRows({ person: p }: { person: Person }) {
  const { t } = useTranslation();
  const ai = useAiStarter(p);
  const sources = sourceChips(p, t);
  const picks = p.picks.map((u) => u.name_en || u.name_ko).filter(Boolean) as string[];

  const activity = [
    whenLabel(p.last_seen_at, t),
    t('appPerson.visits', { count: p.visits }),
    p.platform ? PLATFORM_LABEL[p.platform] ?? p.platform : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <dl className={plan.body}>
      <Row label={t('appPerson.rows.activity')}>{activity}</Row>
      <Row label={t('appPerson.rows.source')}>
        {sources.length ? (
          <div className={plan.chips}>
            {sources.map((s, i) => (
              <span key={s} className={plan.chip}>
                {i === 0 ? t('appPerson.firstSource', { source: s }) : `${i + 1}: ${s}`}
              </span>
            ))}
          </div>
        ) : (
          '—'
        )}
      </Row>
      <Row label={t('appPerson.rows.forWhom')}>
        {p.for_whom ? t(`appPerson.forWhom.${p.for_whom}`, { defaultValue: p.for_whom }) : '—'}
      </Row>
      <Row label={t('appPerson.rows.picks')}>
        {picks.length ? (
          <div className={plan.chips}>
            {picks.map((name) => (
              <span key={name} className={plan.chip}>
                {name}
              </span>
            ))}
          </div>
        ) : (
          '—'
        )}
      </Row>
      <Row label={t('appPerson.rows.visa')}>
        <VisaLine person={p} />
      </Row>
      <Row label={t('appPerson.rows.report')}>
        {p.report_views > 0 ? t('appPerson.reportSeen', { count: p.report_views }) : t('appPerson.reportNotSeen')}
      </Row>
      <Row label={t('appPerson.rows.tariff')}>
        {p.tariff ? (
          <>
            <span className={plan.chipLime}>{TARIFF_LABEL[p.tariff] ?? p.tariff}</span> {t('appPerson.tariffRule')}
          </>
        ) : (
          '—'
        )}
      </Row>
      <Row label={t('appPerson.rows.starter')}>
        {ai.starter ? ai.starter : ai.loading ? <span className={plan.muted}>…</span> : '—'}
      </Row>
    </dl>
  );
}

/** «O'rta · past omil: til darajasi (TOPIK 2) · moliya: rasmiy daromad bor». */
function VisaLine({ person: p }: { person: Person }) {
  const { t } = useTranslation();
  const v = p.visa;
  if (!v) return <>—</>;
  const parts: string[] = [];
  if (v.low) {
    const what =
      v.low === 'language'
        ? t('appPerson.low.language', {
            level: v.topik ? `TOPIK ${v.topik}` : t('appPerson.noTopik'),
          })
        : t(`appPerson.low.${v.low}`, { defaultValue: v.low });
    parts.push(t('appPerson.lowFactor', { what }));
  }
  if (v.income) parts.push(t(`appPerson.income.${v.income}`));
  return (
    <>
      <b>{t(`appPerson.band.${v.band}`, { defaultValue: v.band })}</b>
      {parts.map((s) => ` · ${s}`).join('')}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={plan.kv}>
      <dt className={plan.dt}>{label}</dt>
      <dd className={plan.dd}>{children}</dd>
    </div>
  );
}
