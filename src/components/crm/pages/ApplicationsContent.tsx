import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tables } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GraduationCap,
  Clock,
  Send,
  Bell,
  Download,
  Plus,
  ArrowRight,
  Upload,
  CheckCircle2,
  Circle,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  Copy,
} from 'lucide-react';

/* ============================================================================
   Applications workspace (Hanguk Design System — apps-module reference).

   An "application" is its own record: ONE student → ONE university + program +
   intake, with its own stage, documents, deadline, timeline and outcome. A
   student may have several. This view is shaped purely from the data already
   loaded by useCRMData (students[].applications[] joined with university +
   documents) — no new queries, no DB migration. Fields the schema doesn't carry
   (program / intake / deadline / priority) are derived in this UI layer only.
   ============================================================================ */

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
};

type ApplicationRow = Tables<'applications'> & {
  university?: Tables<'universities'>;
};

interface ApplicationsContentProps {
  students: StudentProfile[];
  loading: boolean;
  onUpdateApplicationStatus: (id: string, status: string) => Promise<{ error: unknown }>;
}

type StageId = 'new' | 'documents' | 'review' | 'submitted' | 'decision';

// Real application statuses (see StudentList PROCESS_STEPS) mapped onto the five
// board columns. Anything with a recorded decision lands in "Decision".
const STAGE_COLUMNS: { id: StageId; statuses: string[]; dot: string }[] = [
  { id: 'new', statuses: ['pending_approval'], dot: 'bg-muted-foreground' },
  { id: 'documents', statuses: ['documents_collection', 'documents_translation', 'apostille'], dot: 'bg-info' },
  { id: 'review', statuses: ['university_response'], dot: 'bg-warning' },
  { id: 'submitted', statuses: ['application_submitted'], dot: 'bg-primary' },
  { id: 'decision', statuses: ['visa_documents', 'completed'], dot: 'bg-success' },
];

// Canonical pipeline order for the "Advance stage" action.
const STATUS_ORDER = [
  'pending_approval',
  'documents_collection',
  'documents_translation',
  'apostille',
  'application_submitted',
  'university_response',
  'visa_documents',
  'completed',
];

const REQUIRED_DOCS = 7;

function columnOf(app: ApplicationRow): StageId {
  if (app.decision) return 'decision';
  const col = STAGE_COLUMNS.find((c) => c.statuses.includes(app.status));
  return col ? col.id : 'new';
}

function nextStatus(status: string): string | null {
  const i = STATUS_ORDER.indexOf(status);
  if (i < 0 || i >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[i + 1];
}

function statusIndex(status: string): number {
  const i = STATUS_ORDER.indexOf(status);
  return i < 0 ? 0 : i;
}

// Deterministic intake derived from when the application was created. Korean
// intakes are Spring (March) and Fall (September); applications opened in the
// second half of a year target the next Spring, otherwise that Fall.
function deriveIntake(createdAt: string): { key: string; season: 'spring' | 'fall'; year: number } {
  const d = new Date(createdAt);
  const month = d.getMonth();
  const year = d.getFullYear();
  return month >= 6
    ? { key: `spring-${year + 1}`, season: 'spring', year: year + 1 }
    : { key: `fall-${year}`, season: 'fall', year };
}

// A plausible submission deadline derived from the intake (Spring → prior 30 Nov,
// Fall → 31 May). Used for the deadline chip / "≤ 14 days" stat only.
function deriveDeadline(intake: { season: 'spring' | 'fall'; year: number }): string {
  return intake.season === 'spring' ? `${intake.year - 1}-11-30` : `${intake.year}-05-31`;
}

function daysTo(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function docCounts(app: ApplicationRow, studentDocs: Tables<'documents'>[]): [number, number] {
  const linked = studentDocs.filter((d) => d.application_id === app.id);
  const pool = linked.length ? linked : studentDocs.filter((d) => !d.application_id);
  const approved = pool.filter((d) => d.status === 'approved').length;
  const total = Math.max(REQUIRED_DOCS, pool.length);
  return [Math.min(approved, total), total];
}

function getInitials(name: string | null): string {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function shortId(id: string): string {
  return `APP-${id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`;
}

interface AppVM {
  app: ApplicationRow;
  student: StudentProfile;
  studentDocs: Tables<'documents'>[];
  studentName: string;
  uniName: string;
  program: string;
  intake: { key: string; season: 'spring' | 'fall'; year: number };
  deadline: string;
  stage: StageId;
  docs: [number, number];
  highPriority: boolean;
}

// ---------- small presentational pieces ----------

function StudentAvatar({ name, src, className }: { name: string | null; src?: string | null; className?: string }) {
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function DocBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-all', complete ? 'bg-success' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function useIntakeLabel() {
  const { t } = useTranslation();
  return (intake: { season: 'spring' | 'fall'; year: number }) =>
    t(`applications.intake.${intake.season}`, { year: intake.year });
}

function DeadlineChip({ deadline }: { deadline: string }) {
  const { t } = useTranslation();
  const n = daysTo(deadline);
  if (n < 0) {
    return (
      <Badge variant="neutral" className="gap-1">
        <Clock className="h-3 w-3" />
        {t('applications.deadline.closed')}
      </Badge>
    );
  }
  if (n <= 14) {
    return (
      <Badge variant="destructiveSoft" className="gap-1">
        <Clock className="h-3 w-3" />
        {t('applications.deadline.daysLeft', { count: n })}
      </Badge>
    );
  }
  const label = new Date(deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <Badge variant={n <= 45 ? 'warning' : 'neutral'} className="gap-1">
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function OutcomeBadge({ decision }: { decision: string | null }) {
  const { t } = useTranslation();
  const d = (decision || '').toLowerCase();
  const dot = <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />;
  if (d.includes('accept')) return <Badge variant="successSoft">{dot}{t('applications.outcome.accepted')}</Badge>;
  if (d.includes('waitlist')) return <Badge variant="warning">{dot}{t('applications.outcome.waitlist')}</Badge>;
  if (d.includes('reject') || d.includes('declin')) return <Badge variant="destructiveSoft">{dot}{t('applications.outcome.rejected')}</Badge>;
  return <Badge variant="neutral">{dot}{t('applications.outcome.pending')}</Badge>;
}

function StageBadge({ stage }: { stage: StageId }) {
  const { t } = useTranslation();
  const variant = (
    { new: 'neutral', documents: 'info', review: 'warning', submitted: 'info', decision: 'successSoft' } as const
  )[stage];
  return (
    <Badge variant={variant}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {t(`applications.stage.${stage}`)}
    </Badge>
  );
}

function StageDecisionCell({ vm }: { vm: AppVM }) {
  return vm.stage === 'decision' && vm.app.decision ? (
    <OutcomeBadge decision={vm.app.decision} />
  ) : (
    <DeadlineChip deadline={vm.deadline} />
  );
}

// ---------- board card ----------

function AppCard({ vm, multi, onClick }: { vm: AppVM; multi: number; onClick: () => void }) {
  const intakeLabel = useIntakeLabel();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-card transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <StudentAvatar name={vm.studentName} src={vm.student.avatar_url} className="h-7 w-7" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{vm.studentName}</span>
        {multi > 1 && (
          <span
            title={t('applications.multiApps', { count: multi })}
            className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
          >
            ×{multi}
          </span>
        )}
        {vm.highPriority && (
          <span title={t('applications.highPriority')} className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
        <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{vm.uniName}</span>
      </div>
      <p className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">{vm.program}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <DocBar done={vm.docs[0]} total={vm.docs[1]} className="flex-1" />
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
          {vm.docs[0]}/{vm.docs[1]}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <StageDecisionCell vm={vm} />
        <span className="text-[11px] font-medium text-muted-foreground">{intakeLabel(vm.intake)}</span>
      </div>
    </button>
  );
}

// ---------- detail drawer ----------

function AppDrawer({
  vm,
  siblings,
  onAdvance,
  advancing,
}: {
  vm: AppVM;
  siblings: AppVM[];
  onAdvance: () => void;
  advancing: boolean;
}) {
  const { t } = useTranslation();
  const intakeLabel = useIntakeLabel();
  const app = vm.app;
  const cur = statusIndex(app.status);
  const decided = !!app.decision;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  const timeline: { label: string; date: string | null; done: boolean }[] = [
    { label: t('applications.timeline.created'), date: fmtDate(app.created_at), done: true },
    { label: t('applications.timeline.documents'), date: null, done: decided || cur >= statusIndex('apostille') },
    { label: t('applications.timeline.translated'), date: null, done: decided || cur >= statusIndex('application_submitted') },
    { label: t('applications.timeline.submitted'), date: fmtDate(app.submitted_at), done: decided || !!app.submitted_at || cur >= statusIndex('application_submitted') },
    {
      label: decided ? t('applications.timeline.decision') : t('applications.timeline.awaiting'),
      date: fmtDate(app.decision_at),
      done: decided,
    },
  ];

  const canAdvance = !decided && nextStatus(app.status) !== null;
  const docs = vm.studentDocs.filter((d) => d.application_id === app.id);
  const checklist = docs.length ? docs : vm.studentDocs.filter((d) => !d.application_id);

  const copyId = () => {
    navigator.clipboard?.writeText(shortId(app.id));
    toast.success(t('applications.idCopied'));
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-5 pb-5 pt-5">
        <span className="font-mono text-xs font-semibold text-muted-foreground">{shortId(app.id)}</span>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate text-[17px] font-bold text-foreground">{vm.uniName}</SheetTitle>
            <SheetDescription className="truncate text-[13px] text-muted-foreground">
              {vm.program} · {intakeLabel(vm.intake)}
            </SheetDescription>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5" disabled={!canAdvance || advancing} onClick={onAdvance}>
            <ArrowRight className="h-4 w-4" />
            {t('applications.advanceStage')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => toast.message(t('applications.messageHint'))}
          >
            <MessageSquare className="h-4 w-4" />
            {t('applications.message')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="w-9 px-0" aria-label={t('common.actions')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyId}>
                <Copy className="mr-2 h-4 w-4" />
                {t('applications.copyId')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {/* applicant chip */}
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3.5">
          <StudentAvatar name={vm.studentName} src={vm.student.avatar_url} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{vm.studentName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {vm.student.topik_level ? t('applications.topik', { level: vm.student.topik_level }) : t('applications.noTopik')}
              {vm.student.ielts_score ? ` · IELTS ${vm.student.ielts_score}` : ''}
              {vm.student.city ? ` · ${vm.student.city}` : ''}
            </div>
          </div>
          {vm.stage === 'decision' && app.decision ? (
            <OutcomeBadge decision={app.decision} />
          ) : (
            <StageBadge stage={vm.stage} />
          )}
        </div>

        {/* status timeline */}
        <div>
          <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t('applications.timeline.heading')}
          </div>
          <div className="flex flex-col">
            {timeline.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      step.done ? 'bg-accent text-accent-foreground' : 'border-2 border-border bg-muted',
                    )}
                  >
                    {step.done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-2 w-2 text-muted-foreground" />}
                  </span>
                  {i < timeline.length - 1 && (
                    <span className={cn('min-h-[22px] w-0.5 flex-1', step.done ? 'bg-accent' : 'bg-border')} />
                  )}
                </div>
                <div className="pb-4">
                  <div className={cn('text-[13px]', step.done ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                    {step.label}
                  </div>
                  {step.date && <div className="mt-0.5 text-xs text-muted-foreground">{step.date}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* documents */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('applications.drawerDocuments')} · {vm.docs[0]}/{vm.docs[1]}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => toast.message(t('applications.uploadHint'))}
            >
              <Upload className="h-3.5 w-3.5" />
              {t('applications.upload')}
            </Button>
          </div>
          {checklist.length === 0 ? (
            <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
              {t('applications.noDocuments')}
            </p>
          ) : (
            <div className="flex flex-col">
              {checklist.map((d, i) => {
                const verified = d.status === 'approved';
                return (
                  <div
                    key={d.id}
                    className={cn('flex items-center gap-2.5 py-2.5', i < checklist.length - 1 && 'border-b border-border/60')}
                  >
                    {verified ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-warning" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{d.name}</span>
                    <span className={cn('text-xs font-medium', verified ? 'text-success' : 'text-warning')}>
                      {verified ? t('applications.verified') : t('applications.pending')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* deadline callout */}
        <div className="flex items-center gap-3 rounded-lg bg-warning/10 p-3.5">
          <Bell className="h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-foreground">{t('applications.deadlineTitle')}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(vm.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <DeadlineChip deadline={vm.deadline} />
        </div>

        {/* sibling applications */}
        {siblings.length > 0 && (
          <div>
            <Separator className="mb-4" />
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('applications.otherApps', { name: vm.studentName, count: siblings.length })}
            </div>
            <div className="flex flex-col gap-2">
              {siblings.map((s) => (
                <div key={s.app.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{s.uniName}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {s.program} · {intakeLabel(s.intake)}
                    </div>
                  </div>
                  {s.stage === 'decision' && s.app.decision ? (
                    <OutcomeBadge decision={s.app.decision} />
                  ) : (
                    <StageBadge stage={s.stage} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- stat card ----------

function StatCard({ icon: Icon, value, label, tone }: { icon: typeof Bell; value: number; label: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', tone)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div>
          <div className="text-[22px] font-extrabold leading-none text-foreground">{value}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}

// ---------- main ----------

export function ApplicationsContent({ students, loading, onUpdateApplicationStatus }: ApplicationsContentProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const intakeLabel = useIntakeLabel();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [intakeFilter, setIntakeFilter] = useState('all');
  const [uniFilter, setUniFilter] = useState('all');
  const [selId, setSelId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const uniName = (u?: Tables<'universities'>): string => {
    if (!u) return t('applications.unknownUniversity');
    const key = `name_${i18n.language}` as keyof Tables<'universities'>;
    return (u[key] as string) || u.name_uz || u.name_en || t('applications.unknownUniversity');
  };

  // Build one view-model per application from already-loaded student data.
  const allVms = useMemo<AppVM[]>(() => {
    const rows: AppVM[] = [];
    for (const student of students) {
      const studentDocs = student.documents || [];
      for (const app of student.applications || []) {
        const intake = deriveIntake(app.created_at);
        const deadline = deriveDeadline(intake);
        const stage = columnOf(app);
        const n = daysTo(deadline);
        rows.push({
          app,
          student,
          studentDocs,
          studentName: student.full_name || t('common.name'),
          uniName: uniName(app.university),
          program: app.university?.programs?.[0] || t('applications.programTbd'),
          intake,
          deadline,
          stage,
          docs: docCounts(app, studentDocs),
          highPriority: stage !== 'decision' && n >= 0 && n <= 14,
        });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, i18n.language, t]);

  // How many applications each student has (for the ×N marker / siblings).
  const countByStudent = useMemo(() => {
    const m = new Map<string, number>();
    for (const vm of allVms) m.set(vm.app.student_id, (m.get(vm.app.student_id) || 0) + 1);
    return m;
  }, [allVms]);

  // Distinct intakes present, newest first, for the filter pills.
  const intakeOptions = useMemo(() => {
    const seen = new Map<string, { key: string; season: 'spring' | 'fall'; year: number }>();
    for (const vm of allVms) if (!seen.has(vm.intake.key)) seen.set(vm.intake.key, vm.intake);
    return [...seen.values()].sort((a, b) => (b.year - a.year) || a.season.localeCompare(b.season));
  }, [allVms]);

  // Distinct universities present, for the university filter.
  const uniOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const vm of allVms) {
      const id = vm.app.university?.id;
      if (id && !seen.has(id)) seen.set(id, vm.uniName);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allVms]);

  const filtered = useMemo(
    () =>
      allVms.filter(
        (vm) =>
          (intakeFilter === 'all' || vm.intake.key === intakeFilter) &&
          (uniFilter === 'all' || vm.app.university?.id === uniFilter),
      ),
    [allVms, intakeFilter, uniFilter],
  );

  const selVm = useMemo(() => filtered.find((vm) => vm.app.id === selId) || allVms.find((vm) => vm.app.id === selId) || null, [filtered, allVms, selId]);
  const siblings = useMemo(
    () => (selVm ? allVms.filter((vm) => vm.app.student_id === selVm.app.student_id && vm.app.id !== selVm.app.id) : []),
    [allVms, selVm],
  );

  const stats = useMemo(() => {
    const inReview = allVms.filter((vm) => vm.stage === 'review').length;
    const submitted = allVms.filter((vm) => vm.stage === 'submitted').length;
    const dueSoon = allVms.filter((vm) => vm.stage !== 'decision' && daysTo(vm.deadline) >= 0 && daysTo(vm.deadline) <= 14).length;
    return { total: allVms.length, inReview, submitted, dueSoon };
  }, [allVms]);

  const uniCount = uniOptions.length;

  const handleAdvance = async () => {
    if (!selVm) return;
    const next = nextStatus(selVm.app.status);
    if (!next) {
      toast.message(t('applications.maxStage'));
      return;
    }
    setAdvancing(true);
    const { error } = await onUpdateApplicationStatus(selVm.app.id, next);
    setAdvancing(false);
    if (error) toast.error(t('applications.advanceError'));
    else toast.success(t('applications.advanced'));
  };

  const handleExport = () => {
    const header = ['id', 'student', 'university', 'program', 'intake', 'stage', 'documents', 'deadline'];
    const lines = filtered.map((vm) =>
      [
        shortId(vm.app.id),
        vm.studentName,
        vm.uniName,
        vm.program,
        `${vm.intake.season} ${vm.intake.year}`,
        vm.stage,
        `${vm.docs[0]}/${vm.docs[1]}`,
        vm.deadline,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('applications.exported'));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="h2">{t('applications.title')}</h2>
          <p className="body-sm mt-1">
            {t('applications.subtitle', { count: stats.total, unis: uniCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={!filtered.length}>
            <Download className="h-4 w-4" />
            {t('applications.export')}
          </Button>
          <Button variant="highlight" className="gap-1.5" onClick={() => navigate('/crm/students')}>
            <Plus className="h-4 w-4" />
            {t('applications.new')}
          </Button>
        </div>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={GraduationCap} value={stats.total} label={t('applications.stat.total')} tone="bg-primary/10 text-primary" />
        <StatCard icon={Clock} value={stats.inReview} label={t('applications.stat.inReview')} tone="bg-warning/10 text-warning" />
        <StatCard icon={Send} value={stats.submitted} label={t('applications.stat.submitted')} tone="bg-info/10 text-info" />
        <StatCard icon={Bell} value={stats.dueSoon} label={t('applications.stat.deadlines')} tone="bg-destructive/10 text-destructive" />
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIntakeFilter('all')}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              intakeFilter === 'all'
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t('applications.intake.all')}
          </button>
          {intakeOptions.map((intake) => (
            <button
              key={intake.key}
              type="button"
              onClick={() => setIntakeFilter(intake.key)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                intakeFilter === intake.key
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {intakeLabel(intake)}
            </button>
          ))}
          {uniOptions.length > 0 && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <Select value={uniFilter} onValueChange={setUniFilter}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue placeholder={t('applications.filter.university')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('applications.filter.allUniversities')}</SelectItem>
                  {uniOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as 'board' | 'table')}
          className="rounded-md border border-border bg-card p-0.5"
        >
          <ToggleGroupItem value="board" className="h-7 px-3 text-xs data-[state=on]:bg-secondary">
            {t('applications.view.board')}
          </ToggleGroupItem>
          <ToggleGroupItem value="table" className="h-7 px-3 text-xs data-[state=on]:bg-secondary">
            {t('applications.view.table')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* content */}
      {filtered.length === 0 ? (
        <Card className="py-4">
          <EmptyState
            icon={GraduationCap}
            title={t('applications.empty.title')}
            description={t('applications.empty.description')}
          />
        </Card>
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STAGE_COLUMNS.map((col) => {
            const items = filtered.filter((vm) => vm.stage === col.id);
            return (
              <div key={col.id} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                  <span className="text-[13px] font-bold text-foreground">{t(`applications.stage.${col.id}`)}</span>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.map((vm) => (
                    <AppCard
                      key={vm.app.id}
                      vm={vm}
                      multi={countByStudent.get(vm.app.student_id) || 1}
                      onClick={() => setSelId(vm.app.id)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate('/crm/students')}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('applications.add')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('applications.col.student')}</TableHead>
                <TableHead>{t('applications.col.universityProgram')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('applications.col.intake')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('applications.col.documents')}</TableHead>
                <TableHead>{t('applications.col.stage')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('applications.col.deadline')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((vm) => (
                <TableRow key={vm.app.id} className="cursor-pointer" onClick={() => setSelId(vm.app.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <StudentAvatar name={vm.studentName} src={vm.student.avatar_url} className="h-8 w-8" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                          <span className="truncate">{vm.studentName}</span>
                          {(countByStudent.get(vm.app.student_id) || 1) > 1 && (
                            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                              ×{countByStudent.get(vm.app.student_id)}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">{shortId(vm.app.id)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px] font-semibold text-foreground">{vm.uniName}</div>
                    <div className="text-xs text-muted-foreground">{vm.program}</div>
                  </TableCell>
                  <TableCell className="hidden text-[13px] text-muted-foreground md:table-cell">{intakeLabel(vm.intake)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <DocBar done={vm.docs[0]} total={vm.docs[1]} className="w-20" />
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {vm.docs[0]}/{vm.docs[1]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell><StageBadge stage={vm.stage} /></TableCell>
                  <TableCell className="hidden sm:table-cell"><StageDecisionCell vm={vm} /></TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* detail drawer */}
      <Sheet open={!!selId} onOpenChange={(o) => !o && setSelId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[480px]">
          {selVm && (
            <AppDrawer
              vm={selVm}
              siblings={siblings}
              onAdvance={handleAdvance}
              advancing={advancing}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ApplicationsContent;
