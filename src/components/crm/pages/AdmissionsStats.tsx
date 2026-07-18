import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BarChart3, ChevronDown, GraduationCap, MapPin, Trophy, Clock } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { outcomeOf } from './applicationOutcome';

// Admissions statistics for the Applications board. Uses the board's OWN
// definition of "accepted" (outcomeOf) so every number here matches the green
// "Qabul qilindi" cards exactly: an application counts as accepted when its
// decision says so, or its status is completed/accepted.

type AppLike = Tables<'applications'> & { university?: Tables<'institutions'> | null };
type StudentLike = Pick<Tables<'profiles'>, 'user_id' | 'city'>;

interface Props {
  applications: AppLike[];
  students: StudentLike[];
  currentLang: string;
}

export function AdmissionsStats({ applications, students, currentLang }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const s = useMemo(() => {
    const cityOf = new Map<string, string>();
    for (const st of students) cityOf.set(st.user_id, (st.city || '').trim());

    const uniLabel = (a: AppLike): string => {
      const u = a.university;
      if (!u) return t('applications.unknownUniversity', { defaultValue: "Noma'lum universitet" });
      const localized = (u as Record<string, unknown>)[`name_${currentLang}`];
      return (typeof localized === 'string' && localized) || u.name_en || u.name_ko || '—';
    };

    // Per student: the distinct universities that ACCEPTED them.
    const acceptedUnis = new Map<string, Set<string>>();
    const withApps = new Set<string>();
    // Per university: distinct students accepted there.
    const uniAccepted = new Map<string, { name: string; students: Set<string> }>();

    for (const a of applications) {
      withApps.add(a.student_id);
      if (outcomeOf(a) !== 'accepted') continue;
      const uniKey = a.institution_id || a.id;
      if (!acceptedUnis.has(a.student_id)) acceptedUnis.set(a.student_id, new Set());
      acceptedUnis.get(a.student_id)!.add(uniKey);
      const e = uniAccepted.get(uniKey) ?? { name: uniLabel(a), students: new Set<string>() };
      e.students.add(a.student_id);
      uniAccepted.set(uniKey, e);
    }

    let by1 = 0, by2 = 0, by3plus = 0, waiting = 0;
    const cityAgg = new Map<string, { accepted: number; waiting: number }>();
    for (const sid of withApps) {
      const n = acceptedUnis.get(sid)?.size ?? 0;
      const city = cityOf.get(sid) || t('applications.unknownCity', { defaultValue: "Noma'lum shahar" });
      const c = cityAgg.get(city) ?? { accepted: 0, waiting: 0 };
      if (n === 0) { waiting++; c.waiting++; }
      else { if (n === 1) by1++; else if (n === 2) by2++; else by3plus++; c.accepted++; }
      cityAgg.set(city, c);
    }

    const universities = Array.from(uniAccepted.values())
      .map((u) => ({ name: u.name, count: u.students.size }))
      .sort((a, b) => b.count - a.count);
    const cities = Array.from(cityAgg.entries())
      .map(([city, v]) => ({ city, ...v, total: v.accepted + v.waiting }))
      .sort((a, b) => b.total - a.total);

    return {
      totalWithApps: withApps.size,
      acceptedAny: by1 + by2 + by3plus,
      by1, by2, by3plus, waiting, universities, cities,
    };
  }, [applications, students, currentLang, t]);

  const tiles: { label: string; value: number; tone: string }[] = [
    { label: t('admStats.applicants', { defaultValue: 'Arizachi talabalar' }), value: s.totalWithApps, tone: 'text-foreground' },
    { label: t('admStats.acceptedAny', { defaultValue: 'Qabul qilingan' }), value: s.acceptedAny, tone: 'text-success' },
    { label: t('admStats.by1', { defaultValue: '1 universitetga' }), value: s.by1, tone: 'text-success' },
    { label: t('admStats.by2', { defaultValue: '2 universitetga' }), value: s.by2, tone: 'text-success' },
    { label: t('admStats.by3', { defaultValue: '3+ universitetga' }), value: s.by3plus, tone: 'text-success' },
    { label: t('admStats.waiting', { defaultValue: 'Natija kutmoqda' }), value: s.waiting, tone: 'text-warning' },
  ];

  const maxUni = Math.max(1, ...s.universities.map((u) => u.count));
  const maxCity = Math.max(1, ...s.cities.map((c) => c.total));

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <BarChart3 className="h-5 w-5 text-primary" />
        <span className="text-sm font-bold text-foreground">
          {t('admStats.title', { defaultValue: 'Qabul statistikasi' })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('admStats.summary', {
            accepted: s.acceptedAny,
            total: s.totalWithApps,
            defaultValue: `${s.acceptedAny}/${s.totalWithApps} qabul qilingan`,
          })}
        </span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <div className={cn('text-2xl font-bold tabular-nums', tile.tone)}>{tile.value}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{tile.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* By university */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-success" />
                {t('admStats.byUniversity', { defaultValue: 'Universitetlar bo‘yicha qabul' })}
              </div>
              {s.universities.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground/60">—</p>
              ) : (
                <div className="space-y-1.5">
                  {s.universities.slice(0, 8).map((u) => (
                    <div key={u.name} className="flex items-center gap-2">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="w-40 shrink-0 truncate text-xs text-foreground" title={u.name}>{u.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-success" style={{ width: `${(u.count / maxUni) * 100}%` }} />
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By city */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-info" />
                {t('admStats.byCity', { defaultValue: 'Shaharlar bo‘yicha' })}
              </div>
              {s.cities.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground/60">—</p>
              ) : (
                <div className="space-y-1.5">
                  {s.cities.slice(0, 8).map((c) => (
                    <div key={c.city} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-xs text-foreground" title={c.city}>{c.city}</span>
                      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-success" style={{ width: `${(c.accepted / maxCity) * 100}%` }} />
                        <div className="h-full bg-warning/70" style={{ width: `${(c.waiting / maxCity) * 100}%` }} />
                      </div>
                      <span className="shrink-0 text-right text-xs font-semibold tabular-nums">
                        <span className="text-success">{c.accepted}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-warning">{c.waiting}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />{t('admStats.accepted', { defaultValue: 'Qabul qilingan' })}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-warning" />{t('admStats.waitingShort', { defaultValue: 'Kutmoqda' })}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
