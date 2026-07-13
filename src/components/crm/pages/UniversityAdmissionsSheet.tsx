/**
 * Read-only admissions detail for one institution, shown in a side sheet from the
 * CRM Universities list. Restores the per-university view that was dropped in the
 * 2026-05-10 uni_db cutover, re-pointed at the normalized tables via
 * useUniversityAdmissions.
 *
 * Read-only by design: the uni_db pipeline auto-publishes this data; staff use
 * this to spot-check it (the needs_attention badge surfaces low-confidence rows).
 *
 * Uses the same friendly renderer conventions as the review queue: translated
 * labels (uz/en via the app i18n), human date/money/TOPIK formats, and Korean
 * source text collapsed behind "Show original text".
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Institution } from '@/hooks/useUniversities';
import {
  useUniversityAdmissions,
  type AdmissionCycle,
  type AdmissionRequirement,
  type RequiredDocument,
  type Scholarship,
  type TuitionRow,
  type AdmissionPeriod,
} from '@/hooks/useUniversityAdmissions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  AlertTriangle,
  GraduationCap,
  FileText,
  Award,
  Wallet,
  CalendarClock,
  CheckCircle2,
  StickyNote,
} from 'lucide-react';
import { InstitutionNotesPanel } from './InstitutionNotesPanel';
import { reviewLang, formatReviewDate, formatMoney, formatTopik } from './reviewFriendly';
import { OriginalTextToggle } from './ReviewFriendly';

interface Props {
  institution: Institution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FlagBadge({ reason }: { reason: string | null }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="border-warning/50 text-warning gap-1">
      <AlertTriangle className="h-3 w-3" />
      {reason ? t('uniReview.drawer.flagged') : t('uniReview.drawer.needsAttention')}
    </Badge>
  );
}

function useFmt() {
  const { t, i18n } = useTranslation();
  const lang = reviewLang(i18n.language);
  return {
    t,
    lang,
    money: (n: number | null | undefined) => formatMoney(n) ?? '—',
    date: (s: string | null | undefined) => formatReviewDate(s, lang) ?? '—',
  };
}

function SourceText({ text }: { text: string | null }) {
  if (!text) return null;
  return <OriginalTextToggle texts={[text]} />;
}

function RequirementRow({ r }: { r: AdmissionRequirement }) {
  const { t } = useFmt();
  const bits: string[] = [];
  const topik = formatTopik(r.topik_min_level);
  if (topik) bits.push(`${topik}${r.topik_deferred ? ` (${t('uniReview.values.deferred')})` : ''}`);
  if (r.gpa_floor_pct != null) bits.push(`${t('uniReview.fields.gpaFloor')} ≥ ${r.gpa_floor_pct}%`);
  if (r.interview_required) bits.push(t('uniReview.slots.interview'));
  if (r.practical_exam_required) bits.push(t('uniReview.fields.practicalExam').replace('?', ''));
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{r.applicant_category || '외국인전형'}</span>
        {r.needs_attention ? <FlagBadge reason={r.attention_reason} /> : null}
      </div>
      <div className="text-sm text-muted-foreground mt-0.5">
        {bits.length ? bits.join(' · ') : t('uniReview.drawer.noCriteria')}
      </div>
      <SourceText text={r.prose_ko || r.source_text_ko} />
    </div>
  );
}

function DocumentRow({ d }: { d: RequiredDocument }) {
  const { t } = useFmt();
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{d.document_type}</span>
        <div className="flex items-center gap-1">
          {d.is_required === false ? (
            <Badge variant="secondary">{t('uniReview.drawer.optional')}</Badge>
          ) : null}
          {d.is_apostille_required ? (
            <Badge variant="outline">{t('uniReview.drawer.apostilleBadge')}</Badge>
          ) : null}
          {d.needs_attention ? <FlagBadge reason={d.attention_reason} /> : null}
        </div>
      </div>
      {d.applicant_category ? (
        <div className="text-xs text-muted-foreground mt-0.5">{d.applicant_category}</div>
      ) : null}
      <SourceText text={d.notes_ko || d.source_text_ko} />
    </div>
  );
}

function CycleCard({ cycle }: { cycle: AdmissionCycle }) {
  const { t } = useFmt();
  const title = [cycle.intake_year, cycle.intake_term, cycle.cycle_track]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title || '—'}</span>
          {cycle.applicant_category ? (
            <Badge variant="secondary">{cycle.applicant_category}</Badge>
          ) : null}
          {cycle.status && cycle.status !== 'unverified' ? (
            <Badge variant="outline">{cycle.status}</Badge>
          ) : null}
        </div>
        {cycle.needs_attention ? <FlagBadge reason={cycle.attention_reason} /> : null}
      </div>

      {cycle.requirements?.length ? (
        <div className="space-y-1.5">
          {cycle.requirements.map((r) => <RequirementRow key={r.id} r={r} />)}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{t('uniReview.drawer.noTracksCycle')}</div>
      )}

      {cycle.documents_required?.length ? (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> {t('uniReview.section.documents_required')}
          </div>
          {cycle.documents_required.map((d) => <DocumentRow key={d.id} d={d} />)}
        </div>
      ) : null}
    </div>
  );
}

function ScholarshipRow({ s }: { s: Scholarship }) {
  const { t, money } = useFmt();
  const award =
    s.award_type === 'tuition_waiver_pct' && s.award_value != null
      ? t('uniReview.awards.waiverPct', { pct: s.award_value })
      : s.award_type === 'stipend_monthly' && s.award_value != null
        ? t('uniReview.awards.stipendMonthly', { amount: money(s.award_value) })
        : s.award_value != null
          ? `${s.award_value}`
          : s.award_type || '';
  const scope =
    s.scope && ['national', 'university', 'department', 'foundation', 'regional'].includes(s.scope)
      ? t(`uniReview.scopes.${s.scope}`)
      : s.scope;
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{s.name_en || s.name_ko || '—'}</span>
        <div className="flex items-center gap-1">
          {award ? <Badge variant="secondary">{award}</Badge> : null}
          {s.needs_attention ? <FlagBadge reason={s.attention_reason} /> : null}
        </div>
      </div>
      {scope ? <div className="text-xs text-muted-foreground mt-0.5">{scope}</div> : null}
      <SourceText text={s.prose_ko || s.source_text_ko} />
    </div>
  );
}

function TuitionRowView({ t: row }: { t: TuitionRow }) {
  const { t, money } = useFmt();
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{row.faculty_group || '전체'}</span>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">
            {money(row.amount_krw)} / {t('uniReview.drawer.perSemester')}
          </Badge>
          {row.needs_attention ? <FlagBadge reason={row.attention_reason} /> : null}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {[
          row.academic_year,
          row.semester_number ? `${t('uniReview.fields.semester')} ${row.semester_number}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        {row.admission_fee_krw != null
          ? ` · ${t('uniReview.drawer.admissionFee')} ${money(row.admission_fee_krw)}`
          : ''}
      </div>
      <SourceText text={row.source_text_ko} />
    </div>
  );
}

function PeriodRow({ p }: { p: AdmissionPeriod }) {
  const { t, money, date } = useFmt();
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {[p.year, p.semester, p.program_level, p.language_track].filter(Boolean).join(' · ')}
        </span>
        {p.needs_attention ? <FlagBadge reason={p.attention_reason} /> : null}
      </div>
      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span>
          {t('uniReview.drawer.apply')}: {date(p.application_start)} → {date(p.application_end)}
        </span>
        <span>
          {t('uniReview.drawer.docsDue')}: {date(p.document_deadline)}
        </span>
        <span>
          {t('uniReview.drawer.result')}: {date(p.result_announcement)}
        </span>
        {p.application_fee_krw != null ? (
          <span>
            {t('uniReview.drawer.fee')}: {money(p.application_fee_krw)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-8 text-center">{text}</div>;
}

export function UniversityAdmissionsSheet({ institution, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useUniversityAdmissions(open ? institution?.id ?? null : null);

  const counts = useMemo(() => {
    if (!data) return { req: 0, doc: 0, sch: 0, tui: 0, per: 0 };
    return {
      req: data.cycles.reduce((a, c) => a + (c.requirements?.length ?? 0), 0),
      doc: data.cycles.reduce((a, c) => a + (c.documents_required?.length ?? 0), 0),
      sch: data.scholarships.length,
      tui: data.tuition.length,
      per: data.periods.length,
    };
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3">
          <SheetTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {institution?.name_en ?? institution?.name_ko ?? '—'}
            {data && data.flaggedCount > 0 ? (
              <Badge variant="outline" className="border-warning/50 text-warning gap-1 ml-1">
                <AlertTriangle className="h-3 w-3" />
                {t('uniReview.drawer.flaggedBadge', { n: data.flaggedCount })}
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {institution?.name_en && institution?.name_ko ? (
              <span lang="ko">{institution.name_ko} · </span>
            ) : null}
            {t('uniReview.drawer.readOnly')}
          </SheetDescription>
        </SheetHeader>
        <Separator />

        {isLoading ? (
          <div className="flex items-center justify-center flex-1 py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-6">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('uniReview.drawer.loadError', { message: error.message })}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="requirements" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-5 mt-3 grid grid-cols-6">
              <TabsTrigger value="requirements" className="gap-1">
                <GraduationCap className="h-3.5 w-3.5" /> {t('uniReview.drawer.tabs.tracks')}
                <Badge variant="secondary" className="ml-1 px-1">{counts.req}</Badge>
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1">
                <FileText className="h-3.5 w-3.5" /> {t('uniReview.drawer.tabs.docs')}
                <Badge variant="secondary" className="ml-1 px-1">{counts.doc}</Badge>
              </TabsTrigger>
              <TabsTrigger value="scholarships" className="gap-1">
                <Award className="h-3.5 w-3.5" /> {t('uniReview.drawer.tabs.aid')}
                <Badge variant="secondary" className="ml-1 px-1">{counts.sch}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tuition" className="gap-1">
                <Wallet className="h-3.5 w-3.5" /> {t('uniReview.drawer.tabs.tuition')}
                <Badge variant="secondary" className="ml-1 px-1">{counts.tui}</Badge>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> {t('uniReview.drawer.tabs.calendar')}
                <Badge variant="secondary" className="ml-1 px-1">{counts.per}</Badge>
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1">
                <StickyNote className="h-3.5 w-3.5" /> {t('uniReview.drawer.tabs.notes')}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-2">
              <div className="px-5 pb-6">
                <TabsContent value="requirements" className="mt-2 space-y-4">
                  {data && data.cycles.length ? (
                    data.cycles.map((c, i) => (
                      <div key={c.id}>
                        {i > 0 ? <Separator className="mb-4" /> : null}
                        <CycleCard cycle={c} />
                      </div>
                    ))
                  ) : (
                    <EmptySection text={t('uniReview.drawer.emptyTracks')} />
                  )}
                </TabsContent>

                <TabsContent value="documents" className="mt-2 space-y-1.5">
                  {counts.doc ? (
                    data!.cycles.flatMap((c) =>
                      (c.documents_required ?? []).map((d) => <DocumentRow key={d.id} d={d} />),
                    )
                  ) : (
                    <EmptySection text={t('uniReview.drawer.emptyDocs')} />
                  )}
                </TabsContent>

                <TabsContent value="scholarships" className="mt-2 space-y-1.5">
                  {data && data.scholarships.length ? (
                    data.scholarships.map((s) => <ScholarshipRow key={s.id} s={s} />)
                  ) : (
                    <EmptySection text={t('uniReview.drawer.emptyAid')} />
                  )}
                </TabsContent>

                <TabsContent value="tuition" className="mt-2 space-y-1.5">
                  {data && data.tuition.length ? (
                    data.tuition.map((row) => <TuitionRowView key={row.id} t={row} />)
                  ) : (
                    <EmptySection text={t('uniReview.drawer.emptyTuition')} />
                  )}
                </TabsContent>

                <TabsContent value="calendar" className="mt-2 space-y-1.5">
                  {data && data.periods.length ? (
                    data.periods.map((p) => <PeriodRow key={p.id} p={p} />)
                  ) : (
                    <EmptySection text={t('uniReview.drawer.emptyCalendar')} />
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-2">
                  <InstitutionNotesPanel institutionId={institution?.id ?? null} />
                </TabsContent>

                {data && data.flaggedCount === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-6 justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {t('uniReview.drawer.nothingFlagged')}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
