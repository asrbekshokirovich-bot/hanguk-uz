import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  GraduationCap,
  MapPin,
  Inbox,
  Loader2,
  Users,
  Flag,
  CheckCircle2,
  FileCheck,
  Send,
  Plane,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { outcomeOf } from './applicationOutcome';

type TFunc = ReturnType<typeof useTranslation>['t'];

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & { university?: Tables<'institutions'> })[];
  documents?: Tables<'documents'>[];
  paymentStatus?: string | null;
  initialPaymentOverdue?: boolean;
};

type ApplicationRow = Tables<'applications'> & {
  university?: Tables<'institutions'> | null;
};

// The five pipeline columns shown in the redesigned board.
type Stage = 'new' | 'docs' | 'applied' | 'sent' | 'visa';
type BadgeTone = 'neutral' | 'info' | 'warning' | 'successSoft' | 'destructive';

// Decision-gate sub-states inside the "Original Docs Sent" column.
type DecisionSub = 'awaiting' | 'accepted_unpaid' | 'not_accepted';
// Visa journey sub-states inside the "Visa Status" column.
type VisaSub = 'docs_prep' | 'not_applied' | 'applied' | 'accepted' | 'rejected';

interface ApplicationsContentProps {
  /** Read from the `applications` table (joined with university) — NOT students. */
  applications: ApplicationRow[];
  /** Enriches each application with its applicant's profile + documents. */
  students: StudentProfile[];
  /** Full uni-db roster (public.institutions) — powers the "New application" picker. */
  universities: Tables<'institutions'>[];
  loading: boolean;
  currentLang: string;
  onOpenStudent: (student: StudentProfile) => void;
  onUpdateApplicationStatus: (id: string, status: string) => Promise<{ error: unknown }>;
  /** Attach a student to a university → creates their application row. */
  onCreateApplication: (studentId: string, institutionId: string, degreeLevel: string) => Promise<{ error: unknown }>;
}

const STAGE_ORDER: Stage[] = ['new', 'docs', 'applied', 'sent', 'visa'];

// Every real application status mapped onto one of the five pipeline columns.
const STATUS_TO_STAGE: Record<string, Stage> = {
  pending: 'new',
  pending_approval: 'new',
  new: 'new',
  draft: 'new',
  documents_collection: 'docs',
  documents_translation: 'docs',
  apostille: 'docs',
  documents: 'docs',
  in_review: 'applied',
  university_response: 'applied',
  application_submitted: 'applied',
  submitted: 'applied',
  online_ariza: 'applied',
  visa_documents: 'visa',
  completed: 'visa',
  accepted: 'visa',
  waitlist: 'sent',
  rejected: 'sent',
};

// Representative status written when a card is advanced to a stage.
const STAGE_STATUS: Record<Stage, string> = {
  new: 'pending',
  docs: 'documents_collection',
  applied: 'application_submitted',
  sent: 'visa_documents',
  visa: 'completed',
};

const STAGE_DOT: Record<Stage, string> = {
  new: 'bg-muted-foreground/60',
  docs: 'bg-info',
  applied: 'bg-primary',
  sent: 'bg-warning',
  visa: 'bg-success',
};

// Deterministic tonal avatar palette — semantic tokens only.
const AVATAR_TONES = [
  'bg-primary/10 text-primary',
  'bg-info/10 text-info',
  'bg-success/10 text-success',
  'bg-accent/20 text-accent-foreground',
  'bg-warning/10 text-warning',
];

// ---------------------------------------------------------------------------
// UI-ONLY PLACEHOLDERS.  The current schema has no column for a student code,
// the assigned consultant, the chosen program/major, the tuition amount, the
// visa-document checklist, the application reference number, or a "blocked"
// flag.  Until those land in the backend we derive each deterministically from
// the row id (same approach the old board used for intake/deadline), so the
// board stays stable across renders and still demonstrates every state.
// ---------------------------------------------------------------------------
const CONSULTANTS = ['Aziz K.', 'Madina T.', 'Sitora N.'];
const PROGRAMS = [
  'Business Administration', 'Korean Language', 'Hotel Management',
  'Media Communication', 'Computer Engineering', 'Global Business',
  'Design', 'Logistics', 'Economics', 'Nutrition', 'Tourism',
  'Automotive Eng.', 'Mechanical Eng.', 'Pharmacy',
];

function hashInt(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}
function toneFor(seed: string) {
  return AVATAR_TONES[hashInt(seed) % AVATAR_TONES.length];
}
function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
function pick<T>(pool: T[], seed: string) {
  return pool[hashInt(seed) % pool.length];
}

function studentCode(profile: StudentProfile | undefined, appId: string) {
  if (profile?.magic_code) return `HK · ${profile.magic_code}`;
  return `HK · ${hashInt(appId).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}
function programOf(appId: string) {
  return pick(PROGRAMS, `${appId}p`);
}
function consultantOf(studentId: string) {
  return pick(CONSULTANTS, studentId);
}
function isBlocked(appId: string) {
  return hashInt(`${appId}b`) % 11 === 0; // ~9% of cards carry a block flag
}
function tuitionAmount(appId: string) {
  return 3000 + (hashInt(`${appId}t`) % 25) * 50; // $3,000 – $4,200
}
function visaDocsReady(appId: string) {
  return hashInt(`${appId}v`) % 8; // 0..7 of 7
}

function daysInStage(app: ApplicationRow) {
  const base = app.updated_at || app.created_at;
  if (base) {
    const d = Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000);
    if (d >= 0 && d < 400) return d;
  }
  return (hashInt(`${app.id}s`) % 12) + 1;
}
function fmtDate(iso: string | null, lang: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

// Decision-gate sub-state for a card sitting in the "Original Docs Sent" column.
function decisionSubOf(app: ApplicationRow): DecisionSub {
  const outcome = outcomeOf(app);
  if (outcome === 'rejected') return 'not_accepted';
  if (outcome === 'accepted') return 'accepted_unpaid';
  return 'awaiting';
}
// Visa-journey sub-state for a card sitting in the "Visa Status" column.
function visaSubOf(app: ApplicationRow): VisaSub {
  if (outcomeOf(app) === 'rejected') return 'rejected';
  const pools: VisaSub[] = ['docs_prep', 'not_applied', 'applied', 'accepted'];
  return pools[hashInt(`${app.id}vs`) % pools.length];
}

const VISA_GROUPS: { sub: VisaSub; dot: string }[] = [
  { sub: 'docs_prep', dot: 'bg-info' },
  { sub: 'not_applied', dot: 'bg-warning' },
  { sub: 'applied', dot: 'bg-primary' },
  { sub: 'accepted', dot: 'bg-success' },
  { sub: 'rejected', dot: 'bg-destructive' },
];

// ===========================================================================
export default function ApplicationsContent({
  applications,
  students,
  universities,
  loading,
  currentLang,
  onOpenStudent,
  onUpdateApplicationStatus,
  onCreateApplication,
}: ApplicationsContentProps) {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Stage>>({});
  const [movingId, setMovingId] = useState<string | null>(null);
  // "New application": pick a university, then pick a student for it.
  const [pickUniOpen, setPickUniOpen] = useState(false);
  const [pickStudentOpen, setPickStudentOpen] = useState(false);
  const [chosenUni, setChosenUni] = useState<Tables<'institutions'> | null>(null);

  const uniName = (uni?: Tables<'institutions'> | null) => {
    if (!uni) return '';
    const localized = (uni as Record<string, unknown>)[`name_${currentLang}`];
    return (typeof localized === 'string' && localized) || uni.name_en || uni.name_ko || '';
  };

  const stageLabel: Record<Stage, string> = {
    new: t('applications.colNew2', { defaultValue: 'New' }),
    docs: t('applications.colDocsReady', { defaultValue: 'Documents Ready' }),
    applied: t('applications.colOnlineApplied', { defaultValue: 'Online Application Applied' }),
    sent: t('applications.colDocsSent', { defaultValue: 'Original Docs Sent' }),
    visa: t('applications.colVisa', { defaultValue: 'Visa Status' }),
  };

  const visaGroupLabel: Record<VisaSub, string> = {
    docs_prep: t('applications.visaDocsPrep', { defaultValue: 'Docs being prepared' }),
    not_applied: t('applications.visaNotApplied', { defaultValue: 'Not applied yet' }),
    applied: t('applications.visaAwaiting', { defaultValue: 'Applied — awaiting result' }),
    accepted: t('applications.visaAccepted', { defaultValue: 'Visa accepted' }),
    rejected: t('applications.visaRejected', { defaultValue: 'Visa rejected' }),
  };

  const studentByUserId = useMemo(() => {
    const map = new Map<string, StudentProfile>();
    for (const s of students) map.set(s.user_id, s);
    return map;
  }, [students]);

  // One enriched record per APPLICATION (= one student at one university).
  const rows = useMemo(() => {
    return applications.map((app) => {
      const student = studentByUserId.get(app.student_id);
      const docs = student?.documents ?? [];
      const docsTotal = docs.length;
      const docsDone = docs.filter((d) => d.status === 'approved').length;
      const stage = overrides[app.id] ?? STATUS_TO_STAGE[app.status] ?? 'new';
      return {
        app,
        student,
        university: app.university ?? null,
        stage,
        stageIdx: STAGE_ORDER.indexOf(stage),
        name: student?.full_name ?? '—',
        code: studentCode(student, app.id),
        uni: uniName(app.university) || t('applications.undecided', { defaultValue: 'Undecided' }),
        program: programOf(app.id),
        consultant: consultantOf(app.student_id),
        blocked: isBlocked(app.id),
        days: daysInStage(app),
        docsDone,
        docsTotal,
        outcome: outcomeOf(app),
        decisionSub: decisionSubOf(app),
        visaSub: visaSubOf(app),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, studentByUserId, overrides, currentLang]);

  type Row = (typeof rows)[number];

  const consultants = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.consultant));
    return Array.from(set).sort();
  }, [rows]);

  const blockedCount = useMemo(() => rows.filter((r) => r.blocked).length, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (consultantFilter !== 'all' && r.consultant !== consultantFilter) return false;
      if (blockedOnly && !r.blocked) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.uni.toLowerCase().includes(q) ||
        r.program.toLowerCase().includes(q)
      );
    });
  }, [rows, search, consultantFilter, blockedOnly]);

  const byStage = (s: Stage) => filtered.filter((r) => r.stage === s);

  // ---- header stat chips ----------------------------------------------------
  const stats = useMemo(() => {
    const sent = filtered.filter((r) => r.stage === 'sent');
    return {
      total: filtered.length,
      awaiting: sent.filter((r) => r.decisionSub === 'awaiting').length,
      unpaid: sent.filter((r) => r.decisionSub === 'accepted_unpaid').length,
      notAccepted: sent.filter((r) => r.decisionSub === 'not_accepted').length,
      atVisa: filtered.filter((r) => r.stage === 'visa').length,
    };
  }, [filtered]);

  const appCountByUni = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of applications) {
      if (a.institution_id) m.set(a.institution_id, (m.get(a.institution_id) ?? 0) + 1);
    }
    return m;
  }, [applications]);

  const appliedStudentIds = useMemo(() => {
    const set = new Set<string>();
    if (!chosenUni) return set;
    for (const a of applications) {
      if (a.institution_id === chosenUni.id) set.add(a.student_id);
    }
    return set;
  }, [applications, chosenUni]);

  // ---- move a card between columns (or set its status via an action) --------
  const setStage = async (row: Row, stage: Stage, statusOverride?: string) => {
    if (row.stage === stage && !statusOverride) return;
    setOverrides((o) => ({ ...o, [row.app.id]: stage }));
    setMovingId(row.app.id);
    const { error } = await onUpdateApplicationStatus(row.app.id, statusOverride ?? STAGE_STATUS[stage]);
    setMovingId(null);
    setOverrides((o) => {
      const next = { ...o };
      delete next[row.app.id];
      return next;
    });
    if (error) toast.error(t('common.error', { defaultValue: 'Something went wrong' }));
  };

  // ---- new-application flow --------------------------------------------------
  const handlePickUniversity = (uni: Tables<'institutions'>) => {
    setChosenUni(uni);
    setPickUniOpen(false);
    setPickStudentOpen(true);
  };
  const handleCreateApplication = async (studentId: string, degreeLevel: string) => {
    if (!chosenUni) return;
    const { error } = await onCreateApplication(studentId, chosenUni.id, degreeLevel);
    if (error) {
      const code = (error as { code?: string })?.code;
      toast.error(
        code === '23505'
          ? t('applications.duplicateApplication', { defaultValue: 'This student already has an application to this university.' })
          : t('common.error', { defaultValue: 'Something went wrong' }),
      );
      return;
    }
    toast.success(t('applications.applicationCreated', { defaultValue: 'Application created' }));
    setPickStudentOpen(false);
    setChosenUni(null);
  };

  // ----------------------------------------------------------------- loading -
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="mb-2 h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAGE_ORDER.map((s) => <Skeleton key={s} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const openStudent = (r: Row) => r.student && onOpenStudent(r.student);

  return (
    <div className="space-y-4">
      {/* ---- header ---- */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('navigation.applications')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('applications.pipelineSubtitle', {
              n: stats.total,
              intake: t('applications.intakeLabel', { defaultValue: 'Sep 2026 intake' }),
              defaultValue: `${stats.total} active applications · 5-stage pipeline · ${t('applications.intakeLabel', { defaultValue: 'Sep 2026 intake' })}`,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatChip tone="warning" n={stats.awaiting} label={t('applications.statAwaiting', { defaultValue: 'awaiting decision' })} />
          <StatChip tone="warning" n={stats.unpaid} label={t('applications.statUnpaid', { defaultValue: 'tuition unpaid' })} />
          <StatChip tone="destructive" n={stats.notAccepted} label={t('applications.statNotAccepted', { defaultValue: 'not accepted' })} />
          <StatChip tone="successSoft" n={stats.atVisa} label={t('applications.statAtVisa', { defaultValue: 'at visa stage' })} />
          <Button variant="highlight" className="gap-2" onClick={() => setPickUniOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('applications.newApplication')}
          </Button>
        </div>
      </div>

      {/* ---- toolbar: search + consultant chips + blocked filter ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('applications.searchStudentCodeUni', { defaultValue: 'Student, code, university' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={consultantFilter === 'all'} onClick={() => setConsultantFilter('all')}>
            {t('applications.allConsultants', { defaultValue: 'All consultants' })}
          </FilterChip>
          {consultants.map((c) => (
            <FilterChip key={c} active={consultantFilter === c} onClick={() => setConsultantFilter(c)}>
              {c}
            </FilterChip>
          ))}
          <FilterChip active={blockedOnly} tone="destructive" onClick={() => setBlockedOnly((b) => !b)}>
            <Flag className="h-3 w-3" />
            {t('applications.blockedOnly', { defaultValue: 'Blocked only' })} · {blockedCount}
          </FilterChip>
        </div>
      </div>

      {/* ---- board ---- */}
      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title={t('applications.emptyTitle')} description={t('applications.emptyDesc')} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:items-start lg:overflow-x-visible">
          {STAGE_ORDER.map((stage, i) => {
            const items = byStage(stage);
            return (
              <div
                key={stage}
                className={cn(
                  'flex w-[85vw] shrink-0 flex-col rounded-xl border p-3 sm:w-[320px] lg:w-auto',
                  stage === 'sent' ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/40',
                )}
              >
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-sm', STAGE_DOT[stage])} />
                  <span className="text-[13px] font-bold text-foreground">{stageLabel[stage]}</span>
                  <span className="ml-auto rounded-full bg-background px-2 text-xs font-semibold text-muted-foreground">{items.length}</span>
                </div>

                {stage === 'sent' && (
                  <p className="mb-2 px-1 text-[11px] leading-snug text-muted-foreground">
                    {t('applications.decisionGateNote', { defaultValue: 'Decision gate — cards stay here until accepted and tuition paid.' })}
                  </p>
                )}

                <div className="flex flex-col gap-2.5">
                  {items.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground/60">—</p>}

                  {stage === 'new' && items.map((r) => (
                    <BaseCard key={r.app.id} r={r} onClick={() => openStudent(r)} t={t}
                      footerRight={<span className="text-[11px] text-muted-foreground">{t('applications.dInStage', { n: r.days, defaultValue: `${r.days}d in stage` })}</span>} />
                  ))}

                  {stage === 'docs' && items.map((r) => (
                    <BaseCard key={r.app.id} r={r} onClick={() => openStudent(r)} t={t}
                      footerRight={
                        <Badge variant={r.docsTotal && r.docsDone >= r.docsTotal ? 'successSoft' : 'info'} className="gap-1">
                          <FileCheck className="h-3 w-3" />
                          {r.docsDone}/{r.docsTotal || 6} {t('applications.ready', { defaultValue: 'ready' })}
                        </Badge>
                      } />
                  ))}

                  {stage === 'applied' && items.map((r) => (
                    <BaseCard key={r.app.id} r={r} onClick={() => openStudent(r)} t={t}
                      extra={<div className="font-mono text-[10px] text-muted-foreground">Ref {refOf(r)}</div>}
                      footerRight={<span className="text-[11px] text-muted-foreground">{t('applications.dInStage', { n: r.days, defaultValue: `${r.days}d in stage` })}</span>} />
                  ))}

                  {stage === 'sent' && items.map((r) => (
                    <DecisionCard key={r.app.id} r={r} t={t} lang={currentLang} moving={movingId === r.app.id}
                      onOpen={() => openStudent(r)}
                      onAccept={() => setStage(r, 'sent', 'accepted')}
                      onReject={() => setStage(r, 'sent', 'rejected')}
                      onMarkPaid={() => setStage(r, 'visa', 'visa_documents')}
                      onRemind={() => toast.success(t('applications.reminderSent', { defaultValue: 'Reminder sent' }))}
                      onReapply={() => { setChosenUni(null); setPickUniOpen(true); }}
                      onUndo={() => setStage(r, 'sent', 'application_submitted')} />
                  ))}

                  {stage === 'visa' && VISA_GROUPS.map(({ sub, dot }) => {
                    const group = items.filter((r) => r.visaSub === sub);
                    if (group.length === 0) return null;
                    return (
                      <div key={sub} className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1 pt-1">
                          <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{visaGroupLabel[sub]}</span>
                          <span className="ml-auto text-[10px] font-semibold text-muted-foreground">{group.length}</span>
                        </div>
                        {group.map((r) => (
                          <VisaCard key={r.app.id} r={r} sub={sub} t={t} lang={currentLang} moving={movingId === r.app.id}
                            onOpen={() => openStudent(r)}
                            onPackReady={() => toast.success(t('applications.visaPackMarked', { defaultValue: 'Visa pack marked ready' }))}
                            onMarkApplied={() => toast.success(t('applications.visaMarkedApplied', { defaultValue: 'Marked as applied' }))}
                            onApproved={() => setStage(r, 'visa', 'completed')}
                            onRefused={() => setStage(r, 'visa', 'rejected')} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UniversityPickerDialog
        open={pickUniOpen}
        onOpenChange={setPickUniOpen}
        universities={universities}
        uniName={uniName}
        appCountByUni={appCountByUni}
        onPick={handlePickUniversity}
        t={t}
      />
      <StudentPickerDialog
        open={pickStudentOpen}
        onOpenChange={(o) => { setPickStudentOpen(o); if (!o) setChosenUni(null); }}
        students={students}
        appliedStudentIds={appliedStudentIds}
        universityName={chosenUni ? uniName(chosenUni) : ''}
        onCreate={handleCreateApplication}
        t={t}
      />
    </div>
  );
}

// Deterministic application reference number, e.g. "KU-2026-4471".
function refOf(r: { app: ApplicationRow; uni: string }) {
  const initials = r.uni.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'UN';
  return `${initials}-2026-${(hashInt(r.app.id) % 9000 + 1000)}`;
}

// ===========================================================================
// Small presentational pieces
// ===========================================================================
function StatChip({ tone, n, label }: { tone: BadgeTone; n: number; label: string }) {
  const toneCls: Record<BadgeTone, string> = {
    neutral: 'text-muted-foreground',
    info: 'text-info',
    warning: 'text-warning',
    successSoft: 'text-success',
    destructive: 'text-destructive',
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn('font-bold', toneCls[tone])}>{n}</span>
      {label}
    </span>
  );
}

function FilterChip({
  active, tone, onClick, children,
}: { active: boolean; tone?: 'destructive'; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? tone === 'destructive'
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-accent/40',
      )}
    >
      {children}
    </button>
  );
}

type CardRow = {
  app: ApplicationRow;
  student?: StudentProfile;
  name: string;
  code: string;
  uni: string;
  program: string;
  consultant: string;
  blocked: boolean;
  days: number;
  docsDone: number;
  docsTotal: number;
  outcome: ReturnType<typeof outcomeOf>;
  decisionSub: DecisionSub;
  visaSub: VisaSub;
};

// Header shared by every card: avatar, name, code, university · program.
function CardHead({ r }: { r: CardRow }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar className="h-8 w-8">
        <AvatarImage src={r.student?.avatar_url || undefined} />
        <AvatarFallback className={cn('text-[10px] font-semibold', toneFor(r.app.student_id))}>
          {getInitials(r.name === '—' ? null : r.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-foreground">{r.name}</span>
          {r.blocked && <Flag className="h-3 w-3 shrink-0 text-destructive" />}
        </div>
        <div className="font-mono text-[10px] uppercase text-muted-foreground">{r.code}</div>
      </div>
    </div>
  );
}

function BaseCard({
  r, onClick, t, extra, footerRight,
}: {
  r: CardRow;
  onClick: () => void;
  t: TFunc;
  extra?: React.ReactNode;
  footerRight?: React.ReactNode;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer space-y-2 p-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
    >
      <CardHead r={r} />
      <div className="truncate text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{r.uni}</span> · {r.program}
      </div>
      {extra}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Badge variant="neutral" className="text-[10px]">{r.consultant}</Badge>
        {footerRight}
      </div>
    </Card>
  );
}

function DecisionCard({
  r, t, lang, moving, onOpen, onAccept, onReject, onMarkPaid, onRemind, onReapply, onUndo,
}: {
  r: CardRow; t: TFunc; lang: string; moving: boolean;
  onOpen: () => void;
  onAccept: () => void; onReject: () => void;
  onMarkPaid: () => void; onRemind: () => void;
  onReapply: () => void; onUndo: () => void;
}) {
  const sentDate = fmtDate(r.app.submitted_at || r.app.updated_at, lang);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Card
      onClick={onOpen}
      className={cn(
        'cursor-pointer space-y-2 p-3 shadow-card transition-all hover:shadow-raised',
        r.decisionSub === 'accepted_unpaid' && 'border-warning/40 bg-warning/5',
        r.decisionSub === 'not_accepted' && 'border-destructive/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <CardHead r={r} />
        {r.decisionSub === 'awaiting' && <Badge variant="warning" className="shrink-0">{t('applications.awaitingDecision', { defaultValue: 'Awaiting decision' })}</Badge>}
        {r.decisionSub === 'accepted_unpaid' && <Badge variant="warning" className="shrink-0">{t('applications.acceptedUnpaid', { defaultValue: 'Accepted · unpaid' })}</Badge>}
        {r.decisionSub === 'not_accepted' && <Badge variant="destructive" className="shrink-0">{t('applications.notAccepted', { defaultValue: 'Not accepted' })}</Badge>}
      </div>

      <div className="truncate text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{r.uni}</span> · {r.program}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {t('applications.sentOn', { date: sentDate, defaultValue: `Sent ${sentDate}` })} · {r.consultant}
      </div>

      {r.decisionSub === 'awaiting' && (
        <div className="space-y-1.5 border-t border-border pt-2" onClick={stop}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('applications.universityDecision', { defaultValue: 'University decision' })}</div>
          <div className="flex gap-1.5">
            <Button variant="highlight" size="sm" className="h-7 flex-1 text-xs" disabled={moving} onClick={onAccept}>
              <CheckCircle2 className="h-3.5 w-3.5" />{t('applications.accepted', { defaultValue: 'Accepted' })}
            </Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" disabled={moving} onClick={onReject}>
              {t('applications.notAcceptedShort', { defaultValue: 'Not Accepted' })}
            </Button>
          </div>
        </div>
      )}

      {r.decisionSub === 'accepted_unpaid' && (
        <div className="space-y-1.5 border-t border-warning/30 pt-2" onClick={stop}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-warning">{t('applications.tuitionUnpaid', { defaultValue: 'Tuition fee unpaid' })}</span>
            <span className="font-mono text-xs font-bold text-foreground">${tuitionAmount(r.app.id).toLocaleString()}</span>
          </div>
          <div className="flex gap-1.5">
            <Button variant="default" size="sm" className="h-7 flex-1 text-xs" disabled={moving} onClick={onMarkPaid}>
              {t('applications.markTuitionPaid', { defaultValue: 'Mark Tuition Paid' })}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRemind}>
              {t('applications.remind', { defaultValue: 'Remind' })}
            </Button>
          </div>
        </div>
      )}

      {r.decisionSub === 'not_accepted' && (
        <div className="space-y-1.5 border-t border-border pt-2" onClick={stop}>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {t('applications.rejectionNote', { defaultValue: 'Not accepted — suggest another university for this intake.' })}
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={onReapply}>
              {t('applications.reapplyElsewhere', { defaultValue: 'Re-apply Elsewhere' })}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={moving} onClick={onUndo}>
              {t('applications.undo', { defaultValue: 'Undo' })}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function VisaCard({
  r, sub, t, lang, moving, onOpen, onPackReady, onMarkApplied, onApproved, onRefused,
}: {
  r: CardRow; sub: VisaSub; t: TFunc; lang: string; moving: boolean;
  onOpen: () => void;
  onPackReady: () => void; onMarkApplied: () => void;
  onApproved: () => void; onRefused: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const docs = visaDocsReady(r.app.id);
  const date = fmtDate(r.app.decision_at || r.app.updated_at, lang);

  return (
    <Card
      onClick={onOpen}
      className={cn(
        'cursor-pointer space-y-2 p-3 shadow-card transition-all hover:shadow-raised',
        sub === 'accepted' && 'border-success/40 bg-success/5',
        sub === 'rejected' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <CardHead r={r} />
      <div className="truncate text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{r.uni}</span> · {r.program}
      </div>

      <div className="flex items-center gap-1.5 text-[10px]">
        <Badge variant="successSoft" className="text-[10px]">{t('applications.tuitionPaid', { defaultValue: 'Tuition paid' })}</Badge>
        {sub === 'docs_prep' && <span className="text-muted-foreground">{t('applications.visaDocsCount', { done: docs, total: 7, defaultValue: `${docs} of 7 visa docs ready` })}</span>}
        {sub === 'not_applied' && <span className="text-muted-foreground">{t('applications.visaBookSlot', { defaultValue: 'Pack complete · book embassy slot' })}</span>}
        {sub === 'applied' && <span className="text-muted-foreground">{t('applications.visaAppliedOn', { date, defaultValue: `Applied ${date} · result in ~10d` })}</span>}
        {sub === 'accepted' && <span className="text-success">{t('applications.visaIssued', { date, defaultValue: `D-2 issued ${date} · departs soon` })}</span>}
        {sub === 'rejected' && <span className="text-destructive">{t('applications.visaRefusedOn', { date, defaultValue: `Refused ${date} · financial proof` })}</span>}
      </div>

      {sub === 'docs_prep' && (
        <Button variant="highlight" size="sm" className="h-7 w-full text-xs" onClick={(e) => { stop(e); onPackReady(); }}>
          <FileCheck className="h-3.5 w-3.5" />{t('applications.visaPackReady', { defaultValue: 'Visa Pack Ready' })}
        </Button>
      )}
      {sub === 'not_applied' && (
        <Button variant="highlight" size="sm" className="h-7 w-full text-xs" onClick={(e) => { stop(e); onMarkApplied(); }}>
          <Send className="h-3.5 w-3.5" />{t('applications.markApplied', { defaultValue: 'Mark Applied' })}
        </Button>
      )}
      {sub === 'applied' && (
        <div className="flex gap-1.5" onClick={stop}>
          <Button variant="highlight" size="sm" className="h-7 flex-1 text-xs" disabled={moving} onClick={onApproved}>
            <Plane className="h-3.5 w-3.5" />{t('applications.visaApproved', { defaultValue: 'Visa Approved' })}
          </Button>
          <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" disabled={moving} onClick={onRefused}>
            {t('applications.visaRefused', { defaultValue: 'Refused' })}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// University picker — "New application" chooses from the uni-db.
// ===========================================================================
function UniversityPickerDialog({
  open, onOpenChange, universities, uniName, appCountByUni, onPick, t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  universities: Tables<'institutions'>[];
  uniName: (uni?: Tables<'institutions'> | null) => string;
  appCountByUni: Map<string, number>;
  onPick: (uni: Tables<'institutions'>) => void;
  t: TFunc;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const named = universities.map((u) => ({ u, name: uniName(u) })).sort((a, b) => a.name.localeCompare(b.name));
    const q = search.trim().toLowerCase();
    if (!q) return named;
    return named.filter(({ u, name }) =>
      name.toLowerCase().includes(q) ||
      (u.name_ko ?? '').toLowerCase().includes(q) ||
      (u.name_en ?? '').toLowerCase().includes(q) ||
      (u.city_ko ?? '').toLowerCase().includes(q));
  }, [universities, uniName, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-info" />
            {t('applications.pickUniversityTitle', { defaultValue: 'Select a university' })}
          </DialogTitle>
          <DialogDescription>
            {t('applications.pickUniversityDesc', { defaultValue: 'Choose a university from the uni-db to start an application.' })}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder={t('applications.searchUniversities')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="max-h-[52vh] overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('applications.noUniversities', { defaultValue: 'No universities found' })}</div>
          ) : (
            filtered.map(({ u, name }) => {
              const count = appCountByUni.get(u.id) ?? 0;
              return (
                <button key={u.id} type="button" onClick={() => onPick(u)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent/50">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10">
                      <GraduationCap className="h-4 w-4 text-info" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{name}</div>
                      {u.city_ko ? (
                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{u.city_ko}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {u.is_partner ? <Badge variant="successSoft">{t('applications.partner', { defaultValue: 'Partner' })}</Badge> : null}
                    {count > 0 ? <Badge variant="info">{t('applications.studentsCount', { n: count })}</Badge> : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Student picker — attach a student to the chosen university (creates the app).
// ===========================================================================
function StudentPickerDialog({
  open, onOpenChange, students, appliedStudentIds, universityName, onCreate, t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  students: StudentProfile[];
  appliedStudentIds: Set<string>;
  universityName: string;
  onCreate: (studentId: string, degreeLevel: string) => Promise<void>;
  t: TFunc;
}) {
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [degree, setDegree] = useState('bachelor');

  const DEGREE_OPTIONS = [
    { value: 'bachelor', label: t('applications.degreeBachelor', { defaultValue: 'Bakalavr' }) },
    { value: 'master', label: t('applications.degreeMaster', { defaultValue: 'Magistratura' }) },
    { value: 'vocational', label: t('applications.degreeVocational', { defaultValue: "Kasbiy ta'lim" }) },
  ];

  const filtered = useMemo(() => {
    const sorted = [...students].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) =>
      (s.full_name ?? '').toLowerCase().includes(q) ||
      (s.office_location ?? '').toLowerCase().includes(q));
  }, [students, search]);

  const pick = async (s: StudentProfile) => {
    if (appliedStudentIds.has(s.user_id) || savingId) return;
    setSavingId(s.user_id);
    await onCreate(s.user_id, degree);
    setSavingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !savingId && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-info" />
            {t('applications.pickStudentTitle', { defaultValue: 'Select a student' })}
          </DialogTitle>
          <DialogDescription>
            {t('applications.pickStudentDesc', { university: universityName, defaultValue: `Attach a student to ${universityName}. This creates their application.` })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t('applications.selectDegree', { defaultValue: 'Daraja' })}</Label>
          <div className="grid grid-cols-3 gap-2">
            {DEGREE_OPTIONS.map((opt) => (
              <Button key={opt.value} type="button" size="sm" variant={degree === opt.value ? 'default' : 'outline'} onClick={() => setDegree(opt.value)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder={t('applications.searchStudents', { defaultValue: 'Search students…' })} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="max-h-[52vh] overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('applications.noStudents', { defaultValue: 'No students found' })}</div>
          ) : (
            filtered.map((s) => {
              const applied = appliedStudentIds.has(s.user_id);
              const saving = savingId === s.user_id;
              return (
                <button key={s.user_id} type="button" disabled={applied || !!savingId} onClick={() => pick(s)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-0',
                    applied ? 'cursor-not-allowed opacity-60' : 'hover:bg-accent/50',
                  )}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={s.avatar_url || undefined} />
                      <AvatarFallback className={cn('text-[10px] font-semibold', toneFor(s.user_id))}>{getInitials(s.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{s.full_name || '—'}</div>
                      {s.office_location ? <div className="truncate text-xs text-muted-foreground">{s.office_location}</div> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {applied ? <Badge variant="outline">{t('applications.alreadyApplied', { defaultValue: 'Applied' })}</Badge>
                      : saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : <Plus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
