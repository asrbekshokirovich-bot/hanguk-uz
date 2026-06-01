/**
 * Student-facing university browser + admissions detail.
 *
 * Replaces the (coordinate-less, demo-only) map as the primary way students
 * explore universities. Lists every visible institution as a searchable card
 * grid; opening one shows a student-friendly admissions detail built from the
 * real uni_db tables (via useUniversityAdmissions).
 *
 * Design intent: most admissions content is still Korean-only (translation is a
 * later phase), so this view LEADS with the language-neutral facts a student
 * actually needs — TOPIK level, GPA floor, fees, deadlines (numbers/dates) — and
 * de-emphasizes raw Korean prose. Korean admission-track jargon (전형) is mapped
 * to friendly labels, and the international-applicant tracks are surfaced first
 * since that is what this audience needs.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Institution } from '@/hooks/useUniversities';
import {
  useUniversityAdmissions,
  type AdmissionRequirement,
  type RequiredDocument,
} from '@/hooks/useUniversityAdmissions';
import {
  useInstitutionContentCounts,
  hasAnyContent,
  type InstitutionContentCounts,
} from '@/hooks/useInstitutionContentCounts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  MapPin,
  Star,
  GraduationCap,
  FileCheck2,
  Wallet,
  CalendarClock,
  Award,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Building2,
  Languages,
  ClipboardList,
} from 'lucide-react';

const KRW_PER_USD = 1330; // rough, for ballpark only

type Lang = 'uz' | 'ru' | 'en' | 'ko';

function localizedName(inst: Institution, lang: Lang): string {
  const dn = inst.display_names as Record<string, string> | null;
  return dn?.[lang] || inst.name_en || inst.name_ko || '';
}

function fmtKrw(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const usd = Math.round(n / KRW_PER_USD);
  return `₩${n.toLocaleString('en-US')} (≈$${usd.toLocaleString('en-US')})`;
}

function fmtDate(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : '—';
}

/** Map Korean admission-track jargon to a friendly label + whether it targets
 * international applicants (the audience here). */
function categoryInfo(ko: string | null): { label: string; international: boolean } {
  const c = ko ?? '';
  if (c.includes('외국인')) return { label: 'International applicants', international: true };
  if (c.includes('재외국민')) return { label: 'Overseas Koreans', international: false };
  if (c.includes('북한이탈') || c.includes('새터민')) return { label: 'North Korean defectors', international: false };
  if (c.includes('결혼이주') || c.includes('귀화')) return { label: 'Marriage migrants / naturalized', international: false };
  if (!c) return { label: 'General', international: true };
  return { label: ko as string, international: false };
}

function contentSummary(c: InstitutionContentCounts | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.requirements) out.push(`${c.requirements} admission track${c.requirements > 1 ? 's' : ''}`);
  if (c.documents) out.push(`${c.documents} document${c.documents > 1 ? 's' : ''}`);
  if (c.scholarships) out.push(`${c.scholarships} scholarship${c.scholarships > 1 ? 's' : ''}`);
  if (c.periods) out.push(`${c.periods} deadline${c.periods > 1 ? 's' : ''}`);
  return out;
}

/** Student-safety notices derived from institution kind/flags (audit Phase 0). */
type InstNoticeTone = 'destructive' | 'warning' | 'muted';
interface InstNotice { short: string; full: string; tone: InstNoticeTone }
function institutionNotices(inst: Institution): InstNotice[] {
  const f = inst as { institution_type?: string | null; is_women_only?: boolean | null };
  const out: InstNotice[] = [];
  if (f.institution_type === 'cyber')
    out.push({ short: 'Online · no D-2 visa', full: 'Online (cyber) university — cannot sponsor a D-2 student visa, so it is not a study-in-Korea route.', tone: 'destructive' });
  if (f.institution_type === 'junior_college')
    out.push({ short: 'Vocational (2–3 yr)', full: 'Vocational junior college — programs are mostly 2–3 years and award an associate degree, not a bachelor’s.', tone: 'warning' });
  if (f.institution_type === 'specialized')
    out.push({ short: 'Seminary', full: 'Specialized institution — theology / ministry-focused programs only.', tone: 'muted' });
  if (f.is_women_only)
    out.push({ short: 'Women-only', full: 'Women-only admission — open to female applicants only.', tone: 'muted' });
  return out;
}

// ─── Requirement / document rows ──────────────────────────────────────────────

function RequirementRow({ r }: { r: AdmissionRequirement }) {
  const cat = categoryInfo(r.applicant_category);
  const facts: { label: string; value: string }[] = [];
  if (r.topik_min_level != null)
    facts.push({ label: 'TOPIK', value: `Level ${r.topik_min_level}${r.topik_deferred ? '+ (can defer)' : ''}` });
  if (r.gpa_floor_pct != null) facts.push({ label: 'GPA', value: `≥ ${r.gpa_floor_pct}%` });
  if (r.interview_required) facts.push({ label: 'Interview', value: 'required' });
  if (r.practical_exam_required) facts.push({ label: 'Practical exam', value: 'required' });

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{cat.label}</span>
        {cat.international ? <Badge className="text-[10px]">For you</Badge> : null}
      </div>
      {facts.length ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {facts.map((f) => (
            <Badge key={f.label} variant="secondary" className="font-normal">
              <span className="text-muted-foreground mr-1">{f.label}</span> {f.value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">No specific test/GPA threshold listed.</p>
      )}
      {r.prose_ko ? (
        <details className="mt-2 group">
          <summary className="text-xs text-muted-foreground cursor-pointer inline-flex items-center gap-1">
            <Languages className="h-3 w-3" /> Show original (Korean)
          </summary>
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.prose_ko}</p>
        </details>
      ) : null}
    </div>
  );
}

function DocumentRow({ d }: { d: RequiredDocument }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border p-2.5">
      <FileCheck2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">{d.document_type}</span>
          {d.is_required === false ? <Badge variant="secondary" className="text-[10px]">optional</Badge> : null}
          {d.is_apostille_required ? <Badge variant="outline" className="text-[10px]">apostille</Badge> : null}
        </div>
        {d.notes_ko ? <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{d.notes_ko}</p> : null}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      {subtitle ? <p className="text-xs text-muted-foreground -mt-1">{subtitle}</p> : null}
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-2">{children}</p>;
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function UniversityDetail({ inst, lang }: { inst: Institution; lang: Lang }) {
  const { data, isLoading, error } = useUniversityAdmissions(inst.id);

  const requirements = useMemo(
    () => (data?.cycles ?? []).flatMap((c) => c.requirements ?? []),
    [data],
  );
  const documents = useMemo(
    () => (data?.cycles ?? []).flatMap((c) => c.documents_required ?? []),
    [data],
  );
  const intl = requirements.filter((r) => categoryInfo(r.applicant_category).international);
  const other = requirements.filter((r) => !categoryInfo(r.applicant_category).international);

  if (isLoading) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (error) {
    return <EmptyHint>Could not load admissions data: {error.message}</EmptyHint>;
  }

  const nothing =
    requirements.length === 0 &&
    documents.length === 0 &&
    (data?.scholarships.length ?? 0) === 0 &&
    (data?.tuition.length ?? 0) === 0 &&
    (data?.periods.length ?? 0) === 0;

  if (nothing) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="font-medium">Admissions details coming soon</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We don't have published admissions information for this university yet. Check the
          official site below in the meantime.
        </p>
        {inst.primary_admissions_url_ko ? (
          <a href={inst.primary_admissions_url_ko} target="_blank" rel="noopener noreferrer" className="mt-4">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Official admissions site
            </Button>
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-5 space-y-6">
        {/* Can I apply? */}
        <Section
          icon={<GraduationCap className="h-4 w-4 text-primary" />}
          title="Can I apply?"
          subtitle="Entry requirements for international applicants"
        >
          {intl.length ? (
            <div className="space-y-2">{intl.map((r) => <RequirementRow key={r.id} r={r} />)}</div>
          ) : (
            <EmptyHint>No international-applicant track listed yet.</EmptyHint>
          )}
          {other.length ? (
            <Accordion type="single" collapsible className="mt-1">
              <AccordionItem value="other" className="border-none">
                <AccordionTrigger className="text-xs text-muted-foreground py-1.5">
                  Other applicant categories ({other.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">{other.map((r) => <RequirementRow key={r.id} r={r} />)}</div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </Section>

        {/* Documents */}
        {documents.length ? (
          <>
            <Separator />
            <Section
              icon={<ClipboardList className="h-4 w-4 text-primary" />}
              title="Documents you'll need"
            >
              <div className="space-y-1.5">
                {documents.map((d) => <DocumentRow key={d.id} d={d} />)}
              </div>
            </Section>
          </>
        ) : null}

        {/* Cost */}
        {data && data.tuition.length ? (
          <>
            <Separator />
            <Section icon={<Wallet className="h-4 w-4 text-primary" />} title="Tuition & fees" subtitle="Per semester unless noted">
              <div className="space-y-1.5">
                {data.tuition.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <span>{t.faculty_group || 'All faculties'}{t.academic_year ? ` · ${t.academic_year}` : ''}</span>
                    <span className="font-medium">{fmtKrw(t.amount_krw)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {/* Scholarships */}
        {data && data.scholarships.length ? (
          <>
            <Separator />
            <Section icon={<Award className="h-4 w-4 text-primary" />} title="Scholarships">
              <div className="space-y-1.5">
                {data.scholarships.map((s) => (
                  <div key={s.id} className="rounded-lg border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{s.name_en || s.name_ko || 'Scholarship'}</span>
                      {s.award_type === 'tuition_waiver_pct' && s.award_value != null ? (
                        <Badge variant="secondary">{s.award_value}% off tuition</Badge>
                      ) : null}
                    </div>
                    {s.prose_ko ? <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.prose_ko}</p> : null}
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {/* Dates */}
        {data && data.periods.length ? (
          <>
            <Separator />
            <Section icon={<CalendarClock className="h-4 w-4 text-primary" />} title="Key dates">
              <div className="space-y-1.5">
                {data.periods.map((p) => (
                  <div key={p.id} className="rounded-lg border p-2.5 text-sm">
                    <div className="font-medium">
                      {[p.year, p.semester].filter(Boolean).join(' · ') || 'Intake'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span>Apply: {fmtDate(p.application_start)} → {fmtDate(p.application_end)}</span>
                      <span>Docs due: {fmtDate(p.document_deadline)}</span>
                      <span>Result: {fmtDate(p.result_announcement)}</span>
                      {p.application_fee_krw != null ? <span>Fee: {fmtKrw(p.application_fee_krw)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {inst.primary_admissions_url_ko ? (
          <a href={inst.primary_admissions_url_ko} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Official admissions site
            </Button>
          </a>
        ) : null}
      </div>
    </ScrollArea>
  );
}

// ─── Browse list ──────────────────────────────────────────────────────────────

interface Props {
  institutions: Institution[];
  focusUniversityId?: string | null;
}

export function StudentUniversities({ institutions, focusUniversityId }: Props) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as Lang) || 'uz';
  const { data: counts } = useInstitutionContentCounts();
  const [search, setSearch] = useState('');
  const [onlyWithInfo, setOnlyWithInfo] = useState(false);
  const [selected, setSelected] = useState<Institution | null>(
    () => institutions.find((i) => i.id === focusUniversityId) ?? null,
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return institutions
      .filter((inst) => {
        if (onlyWithInfo && !hasAnyContent(counts?.[inst.id])) return false;
        if (!q) return true;
        return (
          (inst.name_en ?? '').toLowerCase().includes(q) ||
          (inst.name_ko ?? '').toLowerCase().includes(q) ||
          localizedName(inst, lang).toLowerCase().includes(q) ||
          (inst.city_ko ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // universities with info first, then by name
        const ha = hasAnyContent(counts?.[a.id]) ? 0 : 1;
        const hb = hasAnyContent(counts?.[b.id]) ? 0 : 1;
        if (ha !== hb) return ha - hb;
        return localizedName(a, lang).localeCompare(localizedName(b, lang));
      });
  }, [institutions, search, onlyWithInfo, counts, lang]);

  const withInfoCount = useMemo(
    () => institutions.filter((i) => hasAnyContent(counts?.[i.id])).length,
    [institutions, counts],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search', 'Search') + ' ' + t('navigation.universities', 'universities') + '…'}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={onlyWithInfo ? 'default' : 'outline'} onClick={() => setOnlyWithInfo((v) => !v)}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {t('student.withInfo', 'With admissions info')} ({withInfoCount})
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('student.noUniversitiesMatch', 'No universities match your search.')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((inst) => {
            const c = counts?.[inst.id];
            const summary = contentSummary(c);
            const has = hasAnyContent(c);
            const notices = institutionNotices(inst);
            return (
              <button key={inst.id} onClick={() => setSelected(inst)} className="text-left">
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{localizedName(inst, lang)}</div>
                        {inst.name_ko && localizedName(inst, lang) !== inst.name_ko ? (
                          <div className="text-xs text-muted-foreground truncate">{inst.name_ko}</div>
                        ) : null}
                      </div>
                      {inst.is_partner ? <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" /> : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" /> {inst.city_ko ?? '—'}
                    </div>
                    {notices.length ? (
                      <div className="flex flex-wrap gap-1">
                        {notices.map((n) => (
                          <Badge
                            key={n.short}
                            variant={n.tone === 'destructive' ? 'destructive' : n.tone === 'muted' ? 'secondary' : 'outline'}
                            className={`text-[10px] font-normal ${n.tone === 'warning' ? 'border-amber-500 text-amber-700 dark:text-amber-500' : ''}`}
                          >
                            {n.short}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {has ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {summary.map((s) => (
                          <Badge key={s} variant="secondary" className="font-normal text-[11px]">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground font-normal">
                        {t('student.infoComingSoon', 'Info coming soon')}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          {selected ? (
            <>
              <SheetHeader className="p-5 pb-3">
                <SheetTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 shrink-0" />
                  <span className="truncate">{localizedName(selected, lang)}</span>
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {selected.city_ko ?? '—'}
                  {selected.name_ko && localizedName(selected, lang) !== selected.name_ko
                    ? ` · ${selected.name_ko}`
                    : ''}
                </SheetDescription>
              </SheetHeader>
              {institutionNotices(selected).length ? (
                <div className="px-5 pb-3 flex flex-col gap-1.5">
                  {institutionNotices(selected).map((n) => (
                    <div
                      key={n.short}
                      className={`text-xs rounded-md px-2.5 py-1.5 ${
                        n.tone === 'destructive'
                          ? 'bg-destructive/10 text-destructive'
                          : n.tone === 'warning'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-500'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {n.full}
                    </div>
                  ))}
                </div>
              ) : null}
              <Separator />
              <UniversityDetail inst={selected} lang={lang} />
            </>
          ) : (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
