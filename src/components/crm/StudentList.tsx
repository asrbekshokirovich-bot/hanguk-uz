import { useState, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeads } from '@/hooks/useLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Users,
  Plus,
  FileSpreadsheet,
  LayoutGrid,
  List,
  MapPin,
  FileText,
  GraduationCap,
  ScrollText,
  Trash2,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { normalizePlanName } from '@/hooks/useStudentPlan';
import { cn } from '@/lib/utils';
import { AddStudentDialog } from './AddStudentDialog';
import { DeleteStudentDialog } from './DeleteStudentDialog';

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
  /** Computed upstream by useCRMData (not columns on profiles). */
  paymentStatus?: string;
  initialPaymentOverdue?: boolean;
};

type Tone = 'lime' | 'info' | 'neutral' | 'successSoft' | 'warning' | 'destructive';

interface StudentListProps {
  students: StudentProfile[];
  universities: Tables<'universities'>[];
  loading: boolean;
  onSelectStudent: (student: StudentProfile) => void;
  onRefresh: () => void;
}

// 6-stage application process (the 7th status, "completed", reads as 6/6).
const PROCESS_STEPS = [
  'documents_collection',
  'documents_translation',
  'apostille',
  'application_submitted',
  'university_response',
  'visa_documents',
];

const PLAN_META: Record<string, { label: string; tone: Tone }> = {
  premium: { label: 'Premium', tone: 'lime' },
  standart: { label: 'Standard', tone: 'info' },
  no_risk: { label: 'No-Risk', tone: 'neutral' },
  free: { label: 'Free', tone: 'neutral' },
};

const STAGE_META: Record<string, { label: string; tone: Tone }> = {
  pending_approval: { label: 'Pending', tone: 'neutral' },
  documents_collection: { label: 'Documents', tone: 'neutral' },
  documents_translation: { label: 'Translation', tone: 'info' },
  apostille: { label: 'Apostille', tone: 'info' },
  application_submitted: { label: 'Submitted', tone: 'info' },
  university_response: { label: 'Response', tone: 'warning' },
  visa_documents: { label: 'Visa', tone: 'successSoft' },
  completed: { label: 'Accepted', tone: 'successSoft' },
};

const PAYMENT_META: Record<string, { label: string; tone: Tone }> = {
  completed: { label: 'Paid', tone: 'successSoft' },
  partial: { label: 'Partial', tone: 'warning' },
  pending: { label: 'Pending', tone: 'neutral' },
  overdue: { label: 'Overdue', tone: 'destructive' },
};

function getInitials(name: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getProcess(student: StudentProfile) {
  const app = student.applications?.[0];
  if (!app) return { step: 0, pct: 0 };
  if (app.status === 'completed') return { step: 6, pct: 100 };
  const idx = PROCESS_STEPS.indexOf(app.status);
  const step = idx >= 0 ? idx + 1 : 0;
  return { step, pct: (step / 6) * 100 };
}

// Soft "dot" badge used for payment status chips.
function ToneBadge({ tone, dot, children }: { tone: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <Badge variant={tone}>
      {dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  );
}

export function StudentList({
  students,
  universities,
  loading,
  onSelectStudent,
  onRefresh,
}: StudentListProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { leads, convertToStudent } = useLeads();

  const readyToContractLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          lead.contract_number &&
          lead.status !== 'lost' &&
          lead.status !== 'converted' &&
          !lead.converted_to_student_id,
      ),
    [leads],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [universityFilter, setUniversityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [documentsFilter, setDocumentsFilter] = useState<string>('all');
  const [paymentsFilter, setPaymentsFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [gksFilter, setGksFilter] = useState<string>('all');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentProfile | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  const getUniversityName = (university?: Tables<'universities'>) => {
    if (!university) return '';
    const nameKey = `name_${currentLang}` as keyof Tables<'universities'>;
    return (university[nameKey] as string) || university.name_uz || '';
  };

  const filteredStudents = students.filter((student) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone?.includes(searchQuery) ||
      student.username?.toLowerCase().includes(searchQuery.toLowerCase());

    // University filter
    const matchesUniversity =
      universityFilter === 'all' ||
      student.applications?.some((app) => app.institution_id === universityFilter);

    // Status filter
    const matchesStatus =
      statusFilter === 'all' || student.applications?.some((app) => app.status === statusFilter);

    // Documents filter
    let matchesDocuments = true;
    if (documentsFilter === 'has_docs') {
      matchesDocuments = (student.documents?.length || 0) > 0;
    } else if (documentsFilter === 'no_docs') {
      matchesDocuments = (student.documents?.length || 0) === 0;
    }

    // Plan filter - use centralized normalizePlanName
    let matchesPlan = true;
    if (planFilter !== 'all') {
      const normalizedPlan = normalizePlanName(student.payment_plan);
      matchesPlan = normalizedPlan === planFilter;
    }

    // GKS filter
    let matchesGks = true;
    if (gksFilter === 'gks') {
      matchesGks = student.is_gks_applicant === true;
    } else if (gksFilter === 'non_gks') {
      matchesGks = student.is_gks_applicant !== true;
    }

    // Contract filter
    let matchesContract = true;
    if (contractFilter === 'has_contract') {
      matchesContract = !!student.contract_date;
    } else if (contractFilter === 'no_contract') {
      matchesContract = !student.contract_date;
    }

    // Payments filter
    let matchesPayments = true;
    if (paymentsFilter !== 'all') {
      const paymentStatus = student.paymentStatus;
      if (paymentsFilter === 'paid') {
        matchesPayments = paymentStatus === 'completed';
      } else if (paymentsFilter === 'pending') {
        matchesPayments = paymentStatus === 'pending' || paymentStatus === 'partial';
      } else if (paymentsFilter === 'overdue') {
        matchesPayments = paymentStatus === 'overdue';
      } else if (paymentsFilter === 'initial_overdue') {
        matchesPayments = student.initialPaymentOverdue === true;
      }
    }

    return (
      matchesSearch &&
      matchesUniversity &&
      matchesStatus &&
      matchesDocuments &&
      matchesPlan &&
      matchesGks &&
      matchesContract &&
      matchesPayments
    );
  });

  // Plan counts power the quick-filter chips (All / Premium / Standard / No-Risk).
  const planCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length, premium: 0, standart: 0, no_risk: 0 };
    students.forEach((s) => {
      const p = normalizePlanName(s.payment_plan);
      if (p in counts) counts[p] += 1;
    });
    return counts;
  }, [students]);

  const planChips = [
    { key: 'all', label: t('common.all'), count: planCounts.all },
    { key: 'premium', label: 'Premium', count: planCounts.premium },
    { key: 'standart', label: 'Standard', count: planCounts.standart },
    { key: 'no_risk', label: 'No-Risk', count: planCounts.no_risk },
  ];

  const statusOptions = [
    { value: 'all', label: t('common.all') + ' Status' },
    { value: 'documents_collection', label: t('crm.documentsCollected') },
    { value: 'documents_translation', label: t('crm.documentsTranslated') },
    { value: 'apostille', label: t('crm.apostilleReady') },
    { value: 'application_submitted', label: t('crm.applicationSubmitted') },
    { value: 'university_response', label: t('crm.universityResponse') },
  ];

  const planOf = (student: StudentProfile) => {
    const key = normalizePlanName(student.payment_plan);
    return PLAN_META[key] || PLAN_META.free;
  };
  const stageOf = (student: StudentProfile) => {
    const status = student.applications?.[0]?.status;
    return status ? STAGE_META[status] : undefined;
  };
  const paymentOf = (student: StudentProfile) => {
    const status = student.paymentStatus;
    return status ? PAYMENT_META[status] : undefined;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="mb-2 h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 max-w-xs flex-1" />
          <Skeleton className="h-10 w-20" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-36" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('navigation.students')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {students.length} {t('navigation.students').toLowerCase()} · {t('crm.manageStudents')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {}} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {t('crm.bulkUpload')}
          </Button>
          <Button variant="highlight" onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('crm.addStudent')}
          </Button>
        </div>
      </div>

      {/* Ready-to-contract leads */}
      {readyToContractLeads.length > 0 && (
        <Card className="border-warning/30 bg-warning/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-warning" />
            <h3 className="font-semibold text-warning">
              {t('student.newContracts')} ({readyToContractLeads.length})
            </h3>
          </div>
          <div className="space-y-2">
            {readyToContractLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium uppercase">{lead.full_name}</span>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>📄 {lead.contract_number}</span>
                      {lead.payment_plan && (
                        <Badge variant="outline" className="text-xs">
                          {lead.payment_plan}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={convertingLeadId === lead.id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setConvertingLeadId(lead.id);
                    try {
                      await convertToStudent(lead.id);
                    } finally {
                      setConvertingLeadId(null);
                    }
                  }}
                >
                  <ArrowRight className="mr-1 h-4 w-4" />
                  Talabaga aylantirish
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Toolbar: search + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('crm.searchStudents')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="ml-auto inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="h-4 w-4" />
            {t('common.table', { defaultValue: 'Table' })}
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            {t('common.cards', { defaultValue: 'Cards' })}
          </button>
        </div>
      </div>

      {/* Plan filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {planChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setPlanFilter(chip.key)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
              planFilter === chip.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {chip.label}
            <span className={cn(planFilter === chip.key ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mobile accordion */}
        <div className="w-full sm:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="filters" className="rounded-lg border-b-0 bg-muted/30 px-3">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  {t('common.filters', 'Advanced Filters')}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2 pt-2">
                  <Select value={universityFilter} onValueChange={setUniversityFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Universities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')} Universities</SelectItem>
                      {universities.map((uni) => (
                        <SelectItem key={uni.id} value={uni.id}>
                          {getUniversityName(uni)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={documentsFilter} onValueChange={setDocumentsFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Documents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')} Documents</SelectItem>
                      <SelectItem value="has_docs">Has Documents</SelectItem>
                      <SelectItem value="no_docs">No Documents</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={gksFilter} onValueChange={setGksFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <GraduationCap className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="All GKS" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-background">
                      <SelectItem value="all">{t('common.all')} Students</SelectItem>
                      <SelectItem value="gks">GKS Applicants</SelectItem>
                      <SelectItem value="non_gks">Non-GKS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={paymentsFilter} onValueChange={setPaymentsFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Payments" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-background">
                      <SelectItem value="all">{t('common.all')} Payments</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="initial_overdue">Initial Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={contractFilter} onValueChange={setContractFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <ScrollText className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Shartnoma" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-background">
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="has_contract">{t('student.contracted')}</SelectItem>
                      <SelectItem value="no_contract">{t('student.noContract')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Desktop filter row */}
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Select value={universityFilter} onValueChange={setUniversityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Universities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')} Universities</SelectItem>
              {universities.map((uni) => (
                <SelectItem key={uni.id} value={uni.id}>
                  {getUniversityName(uni)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={documentsFilter} onValueChange={setDocumentsFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')} Documents</SelectItem>
              <SelectItem value="has_docs">Has Documents</SelectItem>
              <SelectItem value="no_docs">No Documents</SelectItem>
            </SelectContent>
          </Select>
          <Select value={gksFilter} onValueChange={setGksFilter}>
            <SelectTrigger className="w-[160px]">
              <GraduationCap className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All GKS" />
            </SelectTrigger>
            <SelectContent className="z-[100] bg-background">
              <SelectItem value="all">{t('common.all')} Students</SelectItem>
              <SelectItem value="gks">GKS Applicants</SelectItem>
              <SelectItem value="non_gks">Non-GKS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentsFilter} onValueChange={setPaymentsFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Payments" />
            </SelectTrigger>
            <SelectContent className="z-[100] bg-background">
              <SelectItem value="all">{t('common.all')} Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="initial_overdue">Initial Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
          <Users className="h-4 w-4" />
          <span>
            {filteredStudents.length} {t('navigation.students').toLowerCase()}
          </span>
        </div>
      </div>

      {/* Results */}
      {filteredStudents.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>
            {t('common.none')} {t('navigation.students').toLowerCase()}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">{t('navigation.students')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('navigation.universities')}</TableHead>
                <TableHead>{t('crm.selectPlan', { defaultValue: 'Plan' })}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('student.progress', { defaultValue: 'Process' })}</TableHead>
                <TableHead>{t('navigation.payments')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => {
                const plan = planOf(student);
                const payment = paymentOf(student);
                const process = getProcess(student);
                const uni = getUniversityName(student.applications?.[0]?.university);
                return (
                  <TableRow
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    className="cursor-pointer"
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(student.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">
                            {student.full_name || 'Unknown Student'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[student.office_location, student.phone].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      <span className="line-clamp-1">{uni || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.tone}>{plan.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Progress value={process.pct} className="h-1.5 w-20" />
                        <span className="font-mono text-[11px] text-muted-foreground">{process.step}/6</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment ? <ToneBadge tone={payment.tone} dot>{payment.label}</ToneBadge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const plan = planOf(student);
            const stage = stageOf(student);
            const payment = paymentOf(student);
            const process = getProcess(student);
            const uni = getUniversityName(student.applications?.[0]?.university);
            return (
              <Card
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="group cursor-pointer p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={student.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                      {getInitials(student.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {student.full_name || 'Unknown Student'}
                    </div>
                    {student.office_location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {student.office_location}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={plan.tone}>{plan.label}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStudentToDelete(student);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-1">{uni || t('crm.noApplications', { defaultValue: 'No application yet' })}</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Progress value={process.pct} className="h-1.5 flex-1" />
                  <span className="font-mono text-[11px] text-muted-foreground">{process.step}/6</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  {stage ? <Badge variant={stage.tone}>{stage.label}</Badge> : <span />}
                  {payment && <ToneBadge tone={payment.tone} dot>{payment.label}</ToneBadge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Student Dialog */}
      <AddStudentDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={onRefresh} />

      {/* Delete Student Dialog */}
      <DeleteStudentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        student={studentToDelete}
        onSuccess={onRefresh}
      />
    </div>
  );
}
