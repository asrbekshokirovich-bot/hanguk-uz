/**
 * Admissions detail for one institution, shown in a side sheet from the
 * CRM Universities list. Restores the per-university view that was dropped in the
 * 2026-05-10 uni_db cutover, re-pointed at the normalized tables via
 * useUniversityAdmissions.
 *
 * Calendar tab now supports CRUD for admission periods via staff data entry.
 */
import { useMemo, useState } from 'react';
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
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdmissionPeriodFormDialog } from './AdmissionPeriodFormDialog';
import { AdmissionCycleFormDialog } from './AdmissionCycleFormDialog';
import { RequirementFormDialog } from './RequirementFormDialog';
import { useDeleteAdmissionPeriod } from '@/hooks/useAdmissionPeriodMutations';
import { useDeleteAdmissionCycle, useDeleteRequirement } from '@/hooks/useAdmissionCycleMutations';

interface Props {
  institution: Institution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FlagBadge({ reason }: { reason: string | null }) {
  return (
    <Badge variant="outline" className="border-warning/50 text-warning gap-1">
      <AlertTriangle className="h-3 w-3" />
      {reason ? 'flagged' : 'needs attention'}
    </Badge>
  );
}

function fmtKrw(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `₩${n.toLocaleString('en-US')}`;
}

function fmtDate(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : '—';
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="text-sm text-muted-foreground py-8 text-center">
      No {label} published for this university yet.
    </div>
  );
}

function SourceText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={text}>
      {text}
    </p>
  );
}

function RequirementRow({ r, onEdit, onDelete }: { r: AdmissionRequirement; onEdit?: () => void; onDelete?: () => void }) {
  const bits: string[] = [];
  if (r.topik_min_level != null) bits.push(`TOPIK ≥ ${r.topik_min_level}${r.topik_deferred ? ' (deferred)' : ''}`);
  if (r.gpa_floor_pct != null) bits.push(`GPA ≥ ${r.gpa_floor_pct}%`);
  if (r.interview_required) bits.push('interview');
  if (r.practical_exam_required) bits.push('practical exam');
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{r.applicant_category || '외국인전형'}</span>
        <div className="flex items-center gap-1">
          {r.needs_attention ? <FlagBadge reason={r.attention_reason} /> : null}
          {onEdit && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>}
          {onDelete && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </div>
      <div className="text-sm text-muted-foreground mt-0.5">
        {bits.length ? bits.join(' · ') : (r.prose_ko || 'No structured criteria')}
      </div>
      <SourceText text={r.source_text_ko} />
    </div>
  );
}

function DocumentRow({ d }: { d: RequiredDocument }) {
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{d.document_type}</span>
        <div className="flex items-center gap-1">
          {d.is_required === false ? <Badge variant="secondary">optional</Badge> : null}
          {d.is_apostille_required ? <Badge variant="outline">apostille</Badge> : null}
          {d.needs_attention ? <FlagBadge reason={d.attention_reason} /> : null}
        </div>
      </div>
      {d.applicant_category ? (
        <div className="text-xs text-muted-foreground mt-0.5">{d.applicant_category}</div>
      ) : null}
      {d.notes_ko ? <p className="text-xs text-muted-foreground mt-0.5">{d.notes_ko}</p> : null}
      <SourceText text={d.source_text_ko} />
    </div>
  );
}

function CycleCard({ cycle, onEditCycle, onDeleteCycle, onEditReq, onDeleteReq, onAddReq }: {
  cycle: AdmissionCycle;
  onEditCycle?: () => void;
  onDeleteCycle?: () => void;
  onEditReq?: (r: AdmissionRequirement) => void;
  onDeleteReq?: (id: string) => void;
  onAddReq?: () => void;
}) {
  const title = [cycle.intake_year, cycle.intake_term, cycle.cycle_track]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title || 'Cycle'}</span>
          {cycle.applicant_category ? (
            <Badge variant="secondary">{cycle.applicant_category}</Badge>
          ) : null}
          {cycle.status && cycle.status !== 'unverified' ? (
            <Badge variant="outline">{cycle.status}</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {cycle.needs_attention ? <FlagBadge reason={cycle.attention_reason} /> : null}
          {onEditCycle && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEditCycle}><Pencil className="h-3 w-3" /></Button>}
          {onDeleteCycle && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={onDeleteCycle}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </div>

      {cycle.requirements?.length ? (
        <div className="space-y-1.5">
          {cycle.requirements.map((r) => (
            <RequirementRow
              key={r.id}
              r={r}
              onEdit={onEditReq ? () => onEditReq(r) : undefined}
              onDelete={onDeleteReq ? () => onDeleteReq(r.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No admission tracks for this cycle.</div>
      )}

      {onAddReq && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onAddReq}>
          <Plus className="h-3 w-3" /> Talab qo'shish
        </Button>
      )}

      {cycle.documents_required?.length ? (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> Required documents
          </div>
          {cycle.documents_required.map((d) => <DocumentRow key={d.id} d={d} />)}
        </div>
      ) : null}
    </div>
  );
}

function ScholarshipRow({ s }: { s: Scholarship }) {
  const award =
    s.award_type === 'tuition_waiver_pct' && s.award_value != null
      ? `${s.award_value}% tuition`
      : s.award_value != null
        ? `${s.award_value}`
        : s.award_type || '';
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{s.name_ko || s.name_en || 'Scholarship'}</span>
        <div className="flex items-center gap-1">
          {award ? <Badge variant="secondary">{award}</Badge> : null}
          {s.needs_attention ? <FlagBadge reason={s.attention_reason} /> : null}
        </div>
      </div>
      {s.scope ? <div className="text-xs text-muted-foreground mt-0.5">scope: {s.scope}</div> : null}
      {s.prose_ko ? <p className="text-xs text-muted-foreground mt-0.5">{s.prose_ko}</p> : null}
      <SourceText text={s.source_text_ko} />
    </div>
  );
}

function TuitionRowView({ t }: { t: TuitionRow }) {
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t.faculty_group || '전체'}</span>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{fmtKrw(t.amount_krw)}/sem</Badge>
          {t.needs_attention ? <FlagBadge reason={t.attention_reason} /> : null}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {[t.academic_year, t.semester_number ? `semester ${t.semester_number}` : null]
          .filter(Boolean)
          .join(' · ')}
        {t.admission_fee_krw != null ? ` · admission fee ${fmtKrw(t.admission_fee_krw)}` : ''}
      </div>
      <SourceText text={t.source_text_ko} />
    </div>
  );
}

function PeriodRow({ p, onEdit, onDelete }: { p: AdmissionPeriod; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {[p.year, p.semester, p.program_level, p.language_track].filter(Boolean).join(' · ')}
        </span>
        <div className="flex items-center gap-1">
          {p.needs_attention ? <FlagBadge reason={p.attention_reason} /> : null}
          {onEdit && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span>Apply: {fmtDate(p.application_start)} → {fmtDate(p.application_end)}</span>
        <span>Docs due: {fmtDate(p.document_deadline)}</span>
        <span>Result: {fmtDate(p.result_announcement)}</span>
        {p.application_fee_krw != null ? <span>Fee: {fmtKrw(p.application_fee_krw)}</span> : null}
      </div>
    </div>
  );
}

export function UniversityAdmissionsSheet({ institution, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useUniversityAdmissions(open ? institution?.id ?? null : null);
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AdmissionPeriod | null>(null);
  const deletePeriod = useDeleteAdmissionPeriod();

  const [cycleFormOpen, setCycleFormOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<AdmissionCycle | null>(null);
  const deleteCycle = useDeleteAdmissionCycle();

  const [reqFormOpen, setReqFormOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<AdmissionRequirement | null>(null);
  const [reqCycleId, setReqCycleId] = useState<string>('');
  const deleteReq = useDeleteRequirement();

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
            {institution?.name_ko ?? 'University'}
            {data && data.flaggedCount > 0 ? (
              <Badge variant="outline" className="border-warning/50 text-warning gap-1 ml-1">
                <AlertTriangle className="h-3 w-3" />
                {data.flaggedCount} flagged
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {institution?.name_en ? `${institution.name_en} · ` : ''}
            Auto-published admissions data (read-only). Flagged rows were published with
            low extractor confidence — spot-check against the source.
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
            <p className="text-sm text-muted-foreground">Could not load admissions data: {error.message}</p>
          </div>
        ) : (
          <Tabs defaultValue="requirements" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-5 mt-3 grid grid-cols-5">
              <TabsTrigger value="requirements" className="gap-1">
                <GraduationCap className="h-3.5 w-3.5" /> Tracks
                <Badge variant="secondary" className="ml-1 px-1">{counts.req}</Badge>
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1">
                <FileText className="h-3.5 w-3.5" /> Docs
                <Badge variant="secondary" className="ml-1 px-1">{counts.doc}</Badge>
              </TabsTrigger>
              <TabsTrigger value="scholarships" className="gap-1">
                <Award className="h-3.5 w-3.5" /> Aid
                <Badge variant="secondary" className="ml-1 px-1">{counts.sch}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tuition" className="gap-1">
                <Wallet className="h-3.5 w-3.5" /> Tuition
                <Badge variant="secondary" className="ml-1 px-1">{counts.tui}</Badge>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Calendar
                <Badge variant="secondary" className="ml-1 px-1">{counts.per}</Badge>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-2">
              <div className="px-5 pb-6">
                <TabsContent value="requirements" className="mt-2 space-y-4">
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingCycle(null); setCycleFormOpen(true); }}>
                      <Plus className="h-3 w-3" /> Sikl qo'shish
                    </Button>
                  </div>
                  {data && data.cycles.length ? (
                    data.cycles.map((c, i) => (
                      <div key={c.id}>
                        {i > 0 ? <Separator className="mb-4" /> : null}
                        <CycleCard
                          cycle={c}
                          onEditCycle={() => { setEditingCycle(c); setCycleFormOpen(true); }}
                          onDeleteCycle={() => {
                            if (confirm('Bu siklni o\'chirmoqchimisiz?')) {
                              deleteCycle.mutate({ id: c.id, institution_id: institution!.id });
                            }
                          }}
                          onEditReq={(r) => { setEditingReq(r); setReqCycleId(c.id); setReqFormOpen(true); }}
                          onDeleteReq={(id) => {
                            if (confirm('Bu talabni o\'chirmoqchimisiz?')) {
                              deleteReq.mutate({ id });
                            }
                          }}
                          onAddReq={() => { setEditingReq(null); setReqCycleId(c.id); setReqFormOpen(true); }}
                        />
                      </div>
                    ))
                  ) : (
                    <EmptySection label="admission tracks" />
                  )}
                </TabsContent>

                <TabsContent value="documents" className="mt-2 space-y-1.5">
                  {counts.doc ? (
                    data!.cycles.flatMap((c) =>
                      (c.documents_required ?? []).map((d) => <DocumentRow key={d.id} d={d} />),
                    )
                  ) : (
                    <EmptySection label="required documents" />
                  )}
                </TabsContent>

                <TabsContent value="scholarships" className="mt-2 space-y-1.5">
                  {data && data.scholarships.length ? (
                    data.scholarships.map((s) => <ScholarshipRow key={s.id} s={s} />)
                  ) : (
                    <EmptySection label="scholarships" />
                  )}
                </TabsContent>

                <TabsContent value="tuition" className="mt-2 space-y-1.5">
                  {data && data.tuition.length ? (
                    data.tuition.map((t) => <TuitionRowView key={t.id} t={t} />)
                  ) : (
                    <EmptySection label="tuition" />
                  )}
                </TabsContent>

                <TabsContent value="calendar" className="mt-2 space-y-1.5">
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingPeriod(null); setPeriodFormOpen(true); }}>
                      <Plus className="h-3 w-3" /> Qabul davri qo'shish
                    </Button>
                  </div>
                  {data && data.periods.length ? (
                    data.periods.map((p) => (
                      <PeriodRow
                        key={p.id}
                        p={p}
                        onEdit={() => { setEditingPeriod(p); setPeriodFormOpen(true); }}
                        onDelete={() => {
                          if (confirm('Bu qabul davrini o\'chirmoqchimisiz?')) {
                            deletePeriod.mutate({ id: p.id, institution_id: institution!.id });
                          }
                        }}
                      />
                    ))
                  ) : (
                    <EmptySection label="application calendar" />
                  )}
                </TabsContent>

                {data && data.flaggedCount === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-6 justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Nothing flagged — all published rows passed the confidence bar.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>

      {institution && (
        <>
          <AdmissionPeriodFormDialog
            institutionId={institution.id}
            open={periodFormOpen}
            onOpenChange={setPeriodFormOpen}
            editPeriod={editingPeriod}
          />
          <AdmissionCycleFormDialog
            institutionId={institution.id}
            open={cycleFormOpen}
            onOpenChange={setCycleFormOpen}
            editCycle={editingCycle}
          />
          {reqCycleId && (
            <RequirementFormDialog
              cycleId={reqCycleId}
              open={reqFormOpen}
              onOpenChange={setReqFormOpen}
              editReq={editingReq}
            />
          )}
        </>
      )}
    </Sheet>
  );
}
