import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeads } from '@/hooks/useLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from "@/components/ui/accordion";
import { Toggle } from '@/components/ui/toggle';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Users,
  Plus,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Phone,
  MapPin,
  FileText,
  User,
  GraduationCap,
  ScrollText,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { normalizePlanName } from '@/hooks/useStudentPlan';
import { AddStudentDialog } from './AddStudentDialog';
import { DeleteStudentDialog } from './DeleteStudentDialog';

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
};

interface StudentListProps {
  students: StudentProfile[];
  universities: Tables<'universities'>[];
  loading: boolean;
  onSelectStudent: (student: StudentProfile) => void;
  onRefresh: () => void;
}

export function StudentList({
  students,
  universities,
  loading,
  onSelectStudent,
  onRefresh
}: StudentListProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { leads, convertToStudent } = useLeads();

  const readyToContractLeads = useMemo(() => leads.filter(lead =>
    lead.contract_number && lead.status !== 'lost' && lead.status !== 'converted' && !lead.converted_to_student_id
  ), [leads]);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  const filteredStudents = students.filter(student => {
    // Search filter
    const matchesSearch = !searchQuery ||
      student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone?.includes(searchQuery) ||
      student.username?.toLowerCase().includes(searchQuery.toLowerCase());

    // University filter
    const matchesUniversity = universityFilter === 'all' ||
      student.applications?.some(app => app.university_id === universityFilter);

    // Status filter
    const matchesStatus = statusFilter === 'all' ||
      student.applications?.some(app => app.status === statusFilter);

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
      matchesGks = (student as any).is_gks_applicant === true;
    } else if (gksFilter === 'non_gks') {
      matchesGks = (student as any).is_gks_applicant !== true;
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
      const paymentStatus = (student as any).paymentStatus;
      if (paymentsFilter === 'paid') {
        matchesPayments = paymentStatus === 'completed';
      } else if (paymentsFilter === 'pending') {
        matchesPayments = paymentStatus === 'pending' || paymentStatus === 'partial';
      } else if (paymentsFilter === 'overdue') {
        matchesPayments = paymentStatus === 'overdue';
      } else if (paymentsFilter === 'initial_overdue') {
        matchesPayments = (student as any).initialPaymentOverdue === true;
      }
    }

    return matchesSearch && matchesUniversity && matchesStatus && matchesDocuments && matchesPlan && matchesGks && matchesContract && matchesPayments;
  });

  const statusOptions = [
    { value: 'all', label: t('common.all') + ' Status' },
    { value: 'documents_collection', label: t('crm.documentsCollected') },
    { value: 'documents_translation', label: t('crm.documentsTranslated') },
    { value: 'apostille', label: t('crm.apostilleReady') },
    { value: 'application_submitted', label: t('crm.applicationSubmitted') },
    { value: 'university_response', label: t('crm.universityResponse') },
  ];


  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 max-w-xs" />
          <Skeleton className="h-10 w-20" />
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-36" />
          ))}
        </div>

        {/* Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('navigation.students')}</h1>
          <p className="text-muted-foreground">{t('crm.manageStudents')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {t('crm.bulkUpload')}
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('crm.addStudent')}
          </Button>
        </div>
      </div>

      {/* Yangi shartnomalar - Ready to Contract Leads */}
      {readyToContractLeads.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-600">
              Yangi shartnomalar ({readyToContractLeads.length})
            </h3>
          </div>
          <div className="space-y-2">
            {readyToContractLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium uppercase">{lead.full_name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
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
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Talabaga aylantirish
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('crm.searchStudents')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* View Toggle */}
        <div className="flex border rounded-md">
          <Toggle
            pressed={viewMode === 'grid'}
            onPressedChange={() => setViewMode('grid')}
            className="rounded-r-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <LayoutGrid className="h-4 w-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
            className="rounded-l-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Advanced Filters for Mobile - Accordion */}
        <div className="w-full mt-2">
          <Accordion type="single" collapsible className="w-full sm:hidden">
            <AccordionItem value="filters" className="border-b-0 rounded-lg bg-muted/30 px-3">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  {t('common.filters', 'Advanced Filters')}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2 pt-2">
                  {/* University Filter */}
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

                  {/* Status Filter */}
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

                  {/* Documents Filter */}
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

                  {/* Plan Filter */}
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Plans" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      <SelectItem value="all">{t('common.all')} Plans</SelectItem>
                      <SelectItem value="free">FREE</SelectItem>
                      <SelectItem value="standart">STANDART</SelectItem>
                      <SelectItem value="premium">PREMIUM</SelectItem>
                      <SelectItem value="no_risk">NO RISK</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* GKS Filter */}
                  <Select value={gksFilter} onValueChange={setGksFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <GraduationCap className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All GKS" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      <SelectItem value="all">{t('common.all')} Students</SelectItem>
                      <SelectItem value="gks">GKS Applicants</SelectItem>
                      <SelectItem value="non_gks">Non-GKS</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Payments Filter */}
                  <Select value={paymentsFilter} onValueChange={setPaymentsFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Payments" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      <SelectItem value="all">{t('common.all')} Payments</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="initial_overdue">Initial Overdue</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Contract Filter */}
                  <Select value={contractFilter} onValueChange={setContractFilter}>
                    <SelectTrigger className="w-full bg-background">
                      <ScrollText className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Shartnoma" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="has_contract">Shartnomali</SelectItem>
                      <SelectItem value="no_contract">Shartnoma yo'q</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Desktop Filters Row (Hidden on Mobile) */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {/* University Filter */}
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

          {/* Status Filter */}
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

          {/* Documents Filter */}
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

          {/* Plan Filter */}
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">{t('common.all')} Plans</SelectItem>
              <SelectItem value="free">FREE</SelectItem>
              <SelectItem value="standart">STANDART</SelectItem>
              <SelectItem value="premium">PREMIUM</SelectItem>
              <SelectItem value="no_risk">NO RISK</SelectItem>
            </SelectContent>
          </Select>

          {/* GKS Filter */}
          <Select value={gksFilter} onValueChange={setGksFilter}>
            <SelectTrigger className="w-[160px]">
              <GraduationCap className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All GKS" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">{t('common.all')} Students</SelectItem>
              <SelectItem value="gks">GKS Applicants</SelectItem>
              <SelectItem value="non_gks">Non-GKS</SelectItem>
            </SelectContent>
          </Select>

          {/* Payments Filter */}
          <Select value={paymentsFilter} onValueChange={setPaymentsFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Payments" />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              <SelectItem value="all">{t('common.all')} Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="initial_overdue">Initial Overdue</SelectItem>
            </SelectContent>
          </Select>

        </div>

        {/* Student Count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{filteredStudents.length} {t('navigation.students').toLowerCase()}</span>
        </div>

        {/* Student Cards */}
        {
          filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('common.none')} {t('navigation.students').toLowerCase()}</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.map((student) => (
                <Card
                  key={student.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer border-border/50 bg-card/50"
                  onClick={() => onSelectStudent(student)}
                >
                  <div className="space-y-3">
                    {/* Name and Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <h3 className="font-semibold text-primary uppercase leading-tight">
                          {student.full_name || 'Unknown Student'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {student.contract_date && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1">
                            <ScrollText className="h-3 w-3" />
                            Shartnomali
                          </Badge>
                        )}
                        {(student as any).is_gks_applicant && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 gap-1">
                            <GraduationCap className="h-3 w-3" />
                            GKS
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
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


                    {/* Phone */}
                    {student.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{student.phone}</span>
                      </div>
                    )}

                    {/* Location */}
                    {(student as any).office_location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{(student as any).office_location}</span>
                      </div>
                    )}

                    {/* Documents count */}
                    {(student.documents?.length || 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{student.documents?.length} docs</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <Card
                  key={student.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer border-border/50 bg-card/50"
                  onClick={() => onSelectStudent(student)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-primary uppercase break-words">
                            {student.full_name || 'Unknown Student'}
                          </h3>
                          {student.contract_date && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1">
                              <ScrollText className="h-3 w-3" />
                              Shartnomali
                            </Badge>
                          )}
                          {(student as any).is_gks_applicant && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 gap-1">
                              <GraduationCap className="h-3 w-3" />
                              GKS
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground mt-2 sm:mt-0">
                          {student.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {student.phone}
                            </span>
                          )}
                          {(student as any).office_location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {(student as any).office_location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                      <div className="flex items-center gap-2">
                        {(student.documents?.length || 0) > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span>{student.documents?.length} docs</span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>

      {/* Add Student Dialog */}
      < AddStudentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={onRefresh}
      />

      {/* Delete Student Dialog */}
      < DeleteStudentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        student={studentToDelete}
        onSuccess={onRefresh}
      />
    </div >
  );
}
