import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Download,
  Search,
  GraduationCap,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type TFunc = ReturnType<typeof useTranslation>['t'];

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & { university?: Tables<'universities'> })[];
  documents?: Tables<'documents'>[];
  paymentStatus?: string | null;
  initialPaymentOverdue?: boolean;
};

type ApplicationRow = Tables<'applications'> & {
  university?: Tables<'universities'> | null;
};

type Stage = 'new' | 'documents' | 'review' | 'submitted' | 'decision';
type Outcome = 'accepted' | 'waitlist' | 'rejected' | 'pending';
type Intake = 'spring2026' | 'fall2026';
type BadgeTone = 'neutral' | 'info' | 'warning' | 'successSoft' | 'destructive';

interface ApplicationsContentProps {
  /** Read from the `applications` table (joined with university) — NOT students. */
  applications: ApplicationRow[];
  /** Enriches each application with its applicant's profile + documents. */
  students: StudentProfile[];
  loading: boolean;
  currentLang: string;
  onOpenStudent: (student: StudentProfile) => void;
  onUpdateApplicationStatus: (id: string, status: string) => Promise<{ error: unknown }>;
}

const STAGE_ORDER: Stage[] = ['new', 'documents', 'review', 'submitted', 'decision'];

// Every real application status mapped onto one of the five pipeline stages.
const STATUS_TO_STAGE: Record<string, Stage> = {
  pending: 'new',
  pending_approval: 'new',
  new: 'new',
  draft: 'new',
  documents_collection: 'documents',
  documents_translation: 'documents',
  apostille: 'documents',
  documents: 'documents',
  in_review: 'review',
  university_response: 'review',
  application_submitted: 'submitted',
  submitted: 'submitted',
  online_ariza: 'submitted',
  visa_documents: 'submitted',
  completed: 'decision',
  accepted: 'decision',
  waitlist: 'decision',
  rejected: 'decision',
};

// Representative status written when a student is moved into a stage.
const STAGE_STATUS: Record<Stage, string> = {
  new: 'pending',
  documents: 'documents_collection',
  review: 'in_review',
  submitted: 'application_submitted',
  decision: 'completed',
};

const STAGE_DOT: Record<Stage, string> = {
  new: 'bg-muted-foreground/60',
  documents: 'bg-info',
  review: 'bg-warning',
  submitted: 'bg-primary',
  decision: 'bg-success',
};

const STAGE_BADGE: Record<Stage, BadgeTone> = {
  new: 'neutral',
  documents: 'info',
  review: 'warning',
  submitted: 'info',
  decision: 'successSoft',
};

const OUTCOME_TONE: Record<Outcome, BadgeTone> = {
  accepted: 'successSoft',
  waitlist: 'warning',
  rejected: 'destructive',
  pending: 'warning',
};

// Deterministic tonal avatar palette — semantic tokens only.
const AVATAR_TONES = [
  'bg-primary/10 text-primary',
  'bg-info/10 text-info',
  'bg-success/10 text-success',
  'bg-accent/20 text-accent-foreground',
  'bg-warning/10 text-warning',
];

// --- UI-only placeholders (schema has no program/intake/deadline column) ----
const PROGRAMS = [
  'Computer Science',
  'Business Administration',
  'Korean Language & Literature',
  'Mechanical Engineering',
  'International Trade',
  'Electrical Engineering',
  'Media & Communication',
  'Global Economics',
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

function firstName(name: string | null) {
  return (name || '—').split(' ')[0];
}

function placeholderProgram(id: string) {
  return PROGRAMS[hashInt(`${id}p`) % PROGRAMS.length];
}

function placeholderIntake(id: string): Intake {
  return hashInt(`${id}i`) % 2 === 0 ? 'spring2026' : 'fall2026';
}

// Deterministic placeholder deadline spread across ~6 weeks so the deadline
// chip demonstrates all states (overdue / urgent / normal).
function placeholderDeadline(id: string) {
  const offset = (hashInt(`${id}d`) % 46) - 5; // -5 .. +40 days
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function outcomeOf(app: ApplicationRow): Outcome {
  const d = (app.decision || '').toLowerCase();
  if (d.includes('accept')) return 'accepted';
  if (d.includes('waitlist')) return 'waitlist';
  if (d.includes('reject')) return 'rejected';
  if (app.status === 'completed' || app.status === 'accepted') return 'accepted';
  if (app.status === 'rejected') return 'rejected';
  return 'pending';
}

function deadlineMeta(daysLeft: number, date: Date, lang: string, t: TFunc): { tone: BadgeTone; label: string } {
  if (daysLeft < 0) return { tone: 'neutral', label: t('applications.closed') };
  if (daysLeft <= 14) return { tone: 'destructive', label: t('applications.daysLeft', { n: daysLeft }) };
  const label = date.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  return { tone: daysLeft <= 45 ? 'warning' : 'neutral', label };
}

// ---------------------------------------------------------------------------
export default function ApplicationsContent({
  applications,
  students,
  loading,
  currentLang,
  onOpenStudent,
  onUpdateApplicationStatus,
}: ApplicationsContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [intakeFilter, setIntakeFilter] = useState<'all' | Intake>('all');
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [openUniId, setOpenUniId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Stage>>({});
  const [movingId, setMovingId] = useState<string | null>(null);

  const uniName = (uni?: Tables<'universities'> | null) => {
    if (!uni) return '';
    const key = `name_${currentLang}` as keyof Tables<'universities'>;
    return (uni[key] as string) || uni.name_uz || '';
  };

  const intakeLabel = (intake: Intake) =>
    `${t(intake === 'spring2026' ? 'applications.spring' : 'applications.fall')} 2026`;

  const stageLabel: Record<Stage, string> = {
    new: t('applications.colNew'),
    documents: t('applications.colDocuments'),
    review: t('applications.colReview'),
    submitted: t('applications.colSubmitted'),
    decision: t('applications.colDecision'),
  };

  const studentByUserId = useMemo(() => {
    const map = new Map<string, StudentProfile>();
    for (const s of students) map.set(s.user_id, s);
    return map;
  }, [students]);

  // One enriched record per APPLICATION (= one student attached to one university).
  const rows = useMemo(() => {
    return applications
      .map((app) => {
        const student = studentByUserId.get(app.student_id);
        const docs = student?.documents ?? [];
        const docsTotal = docs.length;
        const docsDone = docs.filter((d) => d.status === 'approved').length;
        const deadline = placeholderDeadline(app.id);
        const stage = overrides[app.id] ?? STATUS_TO_STAGE[app.status] ?? 'new';
        return {
          app,
          student,
          university: app.university ?? null,
          stage,
          stageIdx: STAGE_ORDER.indexOf(stage),
          program: placeholderProgram(app.id),
          intake: placeholderIntake(app.id),
          office: student?.office_location ?? null,
          deadline,
          daysLeft: daysUntil(deadline),
          docsDone,
          docsTotal,
          docsPct: docsTotal ? (docsDone / docsTotal) * 100 : 0,
          outcome: outcomeOf(app),
        };
      })
      .filter((r) => r.university?.id); // only applications with a resolvable university
  }, [applications, studentByUserId, overrides]);

  type Row = (typeof rows)[number];

  const offices = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.office && set.add(r.office));
    return Array.from(set).sort();
  }, [rows]);

  // Apply intake/office filters at the application level, then group by university.
  const uniGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, { id: string; university: Tables<'universities'>; apps: Row[] }>();
    for (const r of rows) {
      if (intakeFilter !== 'all' && r.intake !== intakeFilter) continue;
      if (officeFilter !== 'all' && r.office !== officeFilter) continue;
      const uni = r.university!;
      const entry = map.get(uni.id) ?? { id: uni.id, university: uni, apps: [] };
      entry.apps.push(r);
      map.set(uni.id, entry);
    }
    return Array.from(map.values())
      .map((g) => {
        const stageIdx = Math.min(...g.apps.map((a) => a.stageIdx));
        const total = g.apps.length;
        const advanced = g.apps.filter((a) => a.stageIdx > stageIdx).length;
        const gating = g.apps.filter((a) => a.stageIdx === stageIdx);
        const earliest = g.apps.reduce((min, a) => (a.daysLeft < min ? a.daysLeft : min), g.apps[0].daysLeft);
        const earliestDate = g.apps.reduce((min, a) => (a.deadline < min ? a.deadline : min), g.apps[0].deadline);
        return {
          ...g,
          name: uniName(g.university),
          city: g.university.city ?? '',
          stage: STAGE_ORDER[stageIdx],
          stageIdx,
          total,
          advanced,
          gating,
          earliest,
          earliestDate,
        };
      })
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.city.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, intakeFilter, officeFilter, currentLang]);

  const totalApps = useMemo(() => uniGroups.reduce((a, g) => a + g.total, 0), [uniGroups]);
  const openGroup = openUniId ? uniGroups.find((g) => g.id === openUniId) ?? null : null;

  // ---- move a single student (application) between stages -------------------
  const move = async (row: Row, dir: -1 | 1) => {
    const newIdx = Math.max(0, Math.min(4, row.stageIdx + dir));
    if (newIdx === row.stageIdx) return;
    const newStage = STAGE_ORDER[newIdx];
    setOverrides((o) => ({ ...o, [row.app.id]: newStage })); // optimistic
    setMovingId(row.app.id);
    const { error } = await onUpdateApplicationStatus(row.app.id, STAGE_STATUS[newStage]);
    setMovingId(null);
    setOverrides((o) => {
      const next = { ...o };
      delete next[row.app.id]; // updateApplicationStatus refetches → real data now reflects it
      return next;
    });
    if (error) {
      toast.error(t('common.error', { defaultValue: 'Something went wrong' }));
    } else {
      toast.success(t('applications.movedTo', { stage: stageLabel[newStage], defaultValue: `Moved to ${stageLabel[newStage]}` }));
    }
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
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAGE_ORDER.map((s) => <Skeleton key={s} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // LEVEL 2 — student kanban inside one university
  // ===========================================================================
  if (openGroup) {
    const g = openGroup;
    const isDecision = g.stageIdx === 4;
    const gatingNames = g.gating.map((r) => firstName(r.student?.full_name ?? null)).join(', ');
    return (
      <div className="space-y-4">
        <button
          onClick={() => setOpenUniId(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('applications.backToUniversities')}
        </button>

        {/* University header card */}
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-info/10">
              <GraduationCap className="h-6 w-6 text-info" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{g.name}</h1>
                <Badge variant={STAGE_BADGE[g.stage]} className="gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOT[g.stage])} />
                  {stageLabel[g.stage]}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                {g.city && (
                  <>
                    <MapPin className="h-3.5 w-3.5" />
                    {g.city} ·{' '}
                  </>
                )}
                {t('applications.studentsCount', { count: g.total })}
              </div>
            </div>
            <Button variant="highlight" className="gap-2" onClick={() => navigate('/crm/students')}>
              <Plus className="h-4 w-4" />
              {t('applications.attachStudent')}
            </Button>
          </div>

          {/* Auto-stage banner */}
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', isDecision ? 'bg-success/10' : 'bg-warning/10')}>
              {isDecision ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Sparkles className="h-5 w-5 text-warning" />}
            </div>
            <p className="flex-1 text-sm text-muted-foreground">
              {isDecision
                ? t('applications.allReachedDecision')
                : t('applications.autoStage', {
                    stage: stageLabel[g.stage],
                    next: stageLabel[STAGE_ORDER[g.stageIdx + 1]],
                    k: g.gating.length,
                    names: gatingNames,
                    defaultValue: `Auto-stage: ${stageLabel[g.stage]}. Advances to ${stageLabel[STAGE_ORDER[g.stageIdx + 1]]} when ${g.gating.length} student(s) (${gatingNames}) move up.`,
                  })}
            </p>
            <div className="flex w-32 shrink-0 items-center gap-2">
              <Progress value={(g.advanced / g.total) * 100} className="h-1.5 flex-1" />
              <span className="font-mono text-[11px] text-muted-foreground">{g.advanced}/{g.total}</span>
            </div>
          </div>
        </Card>

        {/* Student kanban for this university */}
        <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-x-visible">
          {STAGE_ORDER.map((stage, ci) => {
            const items = g.apps.filter((r) => r.stageIdx === ci);
            const gates = ci === g.stageIdx && !isDecision;
            return (
              <div
                key={stage}
                className={cn(
                  'flex w-[82vw] shrink-0 flex-col rounded-xl border p-3 sm:w-[300px] lg:w-auto',
                  gates ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/40',
                )}
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-sm', STAGE_DOT[stage])} />
                  <span className="text-[13px] font-bold text-foreground">{stageLabel[stage]}</span>
                  <span className="ml-auto rounded-full bg-background px-2 text-xs font-semibold text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground/60">—</p>}
                  {items.map((r) => {
                    const dl = deadlineMeta(r.daysLeft, r.deadline, currentLang, t);
                    return (
                      <Card
                        key={r.app.id}
                        onClick={() => r.student && onOpenStudent(r.student)}
                        className="cursor-pointer space-y-2.5 p-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={r.student?.avatar_url || undefined} />
                            <AvatarFallback className={cn('text-[10px] font-semibold', toneFor(r.app.student_id))}>
                              {getInitials(r.student?.full_name ?? null)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold text-foreground">{r.student?.full_name || '—'}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{r.program}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={r.docsPct} className="h-1.5 flex-1" />
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{r.docsDone}/{r.docsTotal}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            disabled={ci === 0 || movingId === r.app.id}
                            onClick={(e) => { e.stopPropagation(); move(r, -1); }}
                            title={t('applications.moveBack')}
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>
                          {ci === 4 ? (
                            <Badge variant={OUTCOME_TONE[r.outcome]}>{t(`applications.outcome_${r.outcome}`)}</Badge>
                          ) : (
                            <Badge variant={dl.tone} className="gap-1">
                              <Clock className="h-3 w-3" />
                              {dl.label}
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            disabled={ci === 4 || movingId === r.app.id}
                            onClick={(e) => { e.stopPropagation(); move(r, 1); }}
                            title={t('applications.advance')}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // LEVEL 1 — university board
  // ===========================================================================
  const counts = STAGE_ORDER.map((_, i) => uniGroups.filter((g) => g.stageIdx === i).length);

  return (
    <div className="space-y-4">
      {/* Page head */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('navigation.applications')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('applications.subtitleUni', {
              unis: uniGroups.length,
              apps: totalApps,
              defaultValue: `${uniGroups.length} universities · ${totalApps} applications`,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => toast.info(t('common.comingSoon', { defaultValue: 'Coming soon' }))}>
            <Download className="h-4 w-4" />
            {t('applications.export')}
          </Button>
          <Button variant="highlight" className="gap-2" onClick={() => navigate('/crm/students')}>
            <Plus className="h-4 w-4" />
            {t('applications.newApplication')}
          </Button>
        </div>
      </div>

      {/* How-it-works banner */}
      <div className="flex items-center gap-3 rounded-xl bg-info/10 px-4 py-3">
        <Sparkles className="h-5 w-5 shrink-0 text-info" />
        <p className="text-[13px] leading-snug text-muted-foreground">{t('applications.howItWorks')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[230px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('applications.searchUniversities')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={intakeFilter} onValueChange={(v) => setIntakeFilter(v as 'all' | Intake)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('applications.allIntakes')}</SelectItem>
              <SelectItem value="spring2026">{intakeLabel('spring2026')}</SelectItem>
              <SelectItem value="fall2026">{intakeLabel('fall2026')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={t('applications.allOffices')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('applications.allOffices')}</SelectItem>
              {offices.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {t('applications.uniCount', { count: uniGroups.length, defaultValue: `${uniGroups.length} universities` })}
        </span>
      </div>

      {/* Board */}
      {uniGroups.length === 0 ? (
        <EmptyState icon={Inbox} title={t('applications.emptyTitle')} description={t('applications.emptyDesc')} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-x-visible">
          {STAGE_ORDER.map((stage, i) => {
            const items = uniGroups.filter((g) => g.stageIdx === i);
            return (
              <div key={stage} className="flex w-[82vw] shrink-0 flex-col rounded-xl border border-border bg-muted/40 p-3 sm:w-[300px] lg:w-auto">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-sm', STAGE_DOT[stage])} />
                  <span className="text-[13px] font-bold text-foreground">{stageLabel[stage]}</span>
                  <span className="ml-auto rounded-full bg-background px-2 text-xs font-semibold text-muted-foreground">{counts[i]}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground/60">—</p>}
                  {items.map((g) => {
                    const isDecision = g.stageIdx === 4;
                    const dl = deadlineMeta(g.earliest, g.earliestDate, currentLang, t);
                    return (
                      <Card
                        key={g.id}
                        onClick={() => setOpenUniId(g.id)}
                        className="cursor-pointer space-y-3 p-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10">
                            <GraduationCap className="h-5 w-5 text-info" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-bold leading-tight text-foreground">{g.name}</div>
                            {g.city && (
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {g.city}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* avatar stack + count */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {g.apps.slice(0, 4).map((r, idx) => (
                              <Avatar key={r.app.id} className={cn('h-7 w-7 ring-2 ring-card', idx > 0 && '-ml-2')}>
                                <AvatarImage src={r.student?.avatar_url || undefined} />
                                <AvatarFallback className={cn('text-[10px] font-semibold', toneFor(r.app.student_id))}>
                                  {getInitials(r.student?.full_name ?? null)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {g.apps.length > 4 && (
                              <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-card">
                                +{g.apps.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t('applications.studentsCount', { count: g.total })}
                          </span>
                        </div>

                        {/* advancement progress */}
                        <div className="flex items-center gap-2">
                          <Progress value={(g.advanced / g.total) * 100} className="h-1.5 flex-1" />
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{g.advanced}/{g.total}</span>
                        </div>

                        {/* gating note + deadline */}
                        <div className="flex items-center justify-between gap-2">
                          {isDecision ? (
                            <Badge variant="successSoft" className="gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-success" />
                              {t('applications.allDecided')}
                            </Badge>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {t('applications.toAdvance', { k: g.total - g.advanced, defaultValue: `${g.total - g.advanced} to advance` })}
                            </span>
                          )}
                          <Badge variant={dl.tone} className="gap-1">
                            <Clock className="h-3 w-3" />
                            {dl.label}
                          </Badge>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
