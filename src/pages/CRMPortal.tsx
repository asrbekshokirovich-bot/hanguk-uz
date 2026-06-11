import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import { useCRMData } from '@/hooks/useCRMData';
import { usePayments } from '@/hooks/usePayments';
import { CRMSidebar, useSidebarGroups } from '@/components/crm/CRMSidebar';
import { CRMCommandMenu } from '@/components/crm/CRMCommandMenu';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Logo } from '@/components/Logo';
import { CRMDashboard } from '@/components/crm/CRMDashboard';
import { StudentList } from '@/components/crm/StudentList';
import { StudentDetail } from '@/components/crm/StudentDetail';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/crm/NotificationBell';
import { HangukAIChat } from '@/components/ai/HangukAIChat';
import { IntercomProvider } from '@/components/intercom/IntercomProvider';
import { VoiceChannelProvider } from '@/components/intercom/VoiceChannelProvider';
import { VoiceChannelHeader } from '@/components/intercom/VoiceChannelHeader';
import { LeadsProvider } from '@/contexts/LeadsContext';
import { CallsProvider } from '@/contexts/CallsContext';
import { MessagesProvider } from '@/contexts/MessagesContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Lock,
  Loader2
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

// Lazy load page contents for better performance
const FinanceOverviewContent = lazy(() => import('@/components/finance/FinanceOverview').then(m => ({ default: m.FinanceOverview })));
// Direct imports for components that need props passed to them
import { StudentFinanceList as FinanceStudentsContent } from '@/components/finance/StudentFinanceList';
import { TransactionList as TransactionsContent } from '@/components/finance/TransactionList';
import { FinanceReports as FinanceReportsContent } from '@/components/finance/FinanceReports';

// Lazy load components that don't need external props
const BudgetsContent = lazy(() => import('@/components/finance/BudgetOverviewPanel').then(m => ({ default: m.BudgetOverviewPanel })));
const MonthlyContent = lazy(() => import('@/components/finance/MonthlyPaymentsPanel').then(m => ({ default: m.MonthlyPaymentsPanel })));
const ScheduledPaymentsContent = lazy(() => import('@/components/finance/ScheduledPaymentsPanel').then(m => ({ default: m.ScheduledPaymentsPanel })));
const DistributionContent = lazy(() => import('@/components/finance/IncomeDistributionPanel').then(m => ({ default: m.IncomeDistributionPanel })));
const BonusesContent = lazy(() => import('@/components/finance/StaffBonusesPanel').then(m => ({ default: m.StaffBonusesPanel })));
const UniversitiesContent = lazy(() => import('@/components/crm/pages/UniversitiesContent'));
const TasksContent = lazy(() => import('@/components/crm/pages/TasksContent'));
const MessagesContent = lazy(() => import('@/components/crm/pages/MessagesContent'));
const CallsContent = lazy(() => import('@/components/crm/pages/CallsContent'));
const StaffContent = lazy(() => import('@/components/crm/pages/StaffContent'));
const ReportsContent = lazy(() => import('@/components/crm/pages/ReportsContent'));
const AIAssistantContent = lazy(() => import('@/components/crm/pages/AIAssistantContent'));
const ApplicationsContent = lazy(() => import('@/components/crm/pages/ApplicationsContent'));
const AITranslationPage = lazy(() => import('@/components/crm/pages/AITranslationPage'));
const LeadsContent = lazy(() => import('@/components/crm/pages/LeadsContent'));
const CommunicationContent = lazy(() => import('@/components/crm/pages/CommunicationContent'));
const CalendarContent = lazy(() => import('@/components/crm/pages/CalendarContent'));
const SettingsContent = lazy(() => import('@/components/crm/pages/SettingsContent'));
const KakaoMapContent = lazy(() => import('@/components/crm/pages/KakaoMapContent'));
const UniDbReviewContent = lazy(() => import('@/components/crm/pages/UniDbReviewContent'));

// Access denied component
const AccessDenied = () => (
  <Card>
    <CardContent className="p-8 text-center">
      <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
      <p className="text-muted-foreground">This section is only accessible to owners.</p>
    </CardContent>
  </Card>
);

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
};

export default function CRMPortal() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isStaff, isOwner, isAdmin, isCallOperator, isDocumentHandler, loading: roleLoading } = useUserRole();
  const { canReview: canReviewUniDb } = useCanReviewUniDb();
  const {
    students,
    applications,
    universities,
    loading: studentsLoading,
    updateApplicationStatus,
    updateDocumentStatus,
    refetchStudents
  } = useCRMData();

  const { payments, loading: paymentsLoading, fetchPayments } = usePayments();
  const loading = studentsLoading || paymentsLoading;

  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  // Sidebar groups (role-filtered) power the ⌘K command menu in the header.
  const sidebarGroups = useSidebarGroups(isOwner, isAdmin, isCallOperator, isDocumentHandler, t, currentLang, canReviewUniDb);

  // Determine current view from URL
  const currentPath = location.pathname;
  const getActiveView = () => {
    if (currentPath === '/crm' || currentPath === '/crm/') return 'dashboard';
    if (currentPath.startsWith('/crm/ai')) return 'ai';
    if (currentPath.startsWith('/crm/students')) return 'students';
    if (currentPath.startsWith('/crm/applications')) return 'applications';
    if (currentPath.startsWith('/crm/documents')) return 'documents';
    if (currentPath.startsWith('/crm/finance/students')) return 'finance-students';
    if (currentPath.startsWith('/crm/finance/budgets')) return 'finance-budgets';
    if (currentPath.startsWith('/crm/finance/monthly')) return 'finance-monthly';
    if (currentPath.startsWith('/crm/finance/scheduled')) return 'finance-scheduled';
    if (currentPath.startsWith('/crm/finance/transactions')) return 'finance-transactions';
    if (currentPath.startsWith('/crm/finance/distribution')) return 'finance-distribution';
    if (currentPath.startsWith('/crm/finance/bonuses')) return 'finance-bonuses';
    if (currentPath.startsWith('/crm/finance/reports')) return 'finance-reports';
    if (currentPath.startsWith('/crm/finance')) return 'finance';
    if (currentPath.startsWith('/crm/payments')) return 'finance'; // Legacy redirect
    if (currentPath.startsWith('/crm/universities')) return 'universities';
    if (currentPath.startsWith('/crm/tasks')) return 'tasks';
    if (currentPath.startsWith('/crm/messages')) return 'messages';
    if (currentPath.startsWith('/crm/calls')) return 'calls';
    if (currentPath.startsWith('/crm/leads')) return 'leads';
    if (currentPath.startsWith('/crm/staff')) return 'staff';
    if (currentPath.startsWith('/crm/reports')) return 'reports';
    if (currentPath.startsWith('/crm/calendar')) return 'calendar';
    if (currentPath.startsWith('/crm/settings')) return 'settings';
    if (currentPath.startsWith('/crm/translation')) return 'translation';
    if (currentPath.startsWith('/crm/communication')) return 'communication';
    if (currentPath.startsWith('/crm/kakao-map')) return 'kakao-map';
    if (currentPath.startsWith('/crm/admin/uni-db-review')) return 'uni-db-review';
    return 'dashboard';
  };

  const activeView = getActiveView();

  // Top-bar title: the most specific nav item matching the current route,
  // reusing the existing i18n labels so the header stays in sync with the nav.
  const pageTitle = useMemo(() => {
    let best = '';
    let bestLen = -1;
    for (const group of sidebarGroups) {
      for (const item of group.items) {
        const match =
          currentPath === item.url || (item.url !== '/crm' && currentPath.startsWith(item.url));
        if (match && item.url.length > bestLen) {
          best = item.title;
          bestLen = item.url.length;
        }
      }
    }
    return best || t('navigation.dashboard');
  }, [sidebarGroups, currentPath, t]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };



  // Reset selected student when navigating away from students
  useEffect(() => {
    if (activeView !== 'students') {
      setSelectedStudent(null);
    }
  }, [activeView]);

  // Navigate away if not authenticated or not staff
  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isStaff) {
        navigate('/portal');
      }
    }
  }, [user, isStaff, authLoading, roleLoading, navigate]);

  const ContentLoader = () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const SafeSuspense = ({ children }: { children: React.ReactNode }) => (
    <ErrorBoundary>
      <Suspense fallback={<ContentLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );

  // Wrapper components for finance pages that need data from hooks
  const FinanceStudentsWrapper = React.memo(function FinanceStudentsWrapper() {
    return (
      <Suspense fallback={<ContentLoader />}>
        <FinanceStudentsContent students={students} payments={payments} onRefresh={fetchPayments} />
      </Suspense>
    );
  });

  const TransactionsWrapper = React.memo(function TransactionsWrapper() {
    return (
      <Suspense fallback={<ContentLoader />}>
        <TransactionsContent payments={payments} loading={loading} />
      </Suspense>
    );
  });

  const FinanceReportsWrapper = React.memo(function FinanceReportsWrapper() {
    return (
      <Suspense fallback={<ContentLoader />}>
        <FinanceReportsContent students={students} payments={payments} />
      </Suspense>
    );
  });

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Logo className="h-16 w-16" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user || !isStaff) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t('common.redirecting', 'Redirecting...')}</p>
      </div>
    );
  }

  const studentDetailElement = selectedStudent ? (
    <StudentDetail
      student={selectedStudent}
      onBack={() => setSelectedStudent(null)}
      onUpdateApplicationStatus={updateApplicationStatus}
      onUpdateDocumentStatus={updateDocumentStatus}
      currentLang={currentLang}
      isDocumentHandler={isDocumentHandler}
      onRefresh={refetchStudents}
    />
  ) : null;

  const studentListElement = (
    <StudentList
      students={students}
      universities={universities}
      loading={loading}
      onSelectStudent={setSelectedStudent}
      onRefresh={refetchStudents}
    />
  );

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <CRMDashboard
            isAdmin={isAdmin}
            isOwner={isOwner}
            isCallOperator={isCallOperator}
            isDocumentHandler={isDocumentHandler}
          />
        );
      case 'ai':
        return (
          <SafeSuspense>
            <AIAssistantContent />
          </SafeSuspense>
        );
      case 'students':
        return (
          <>
            <div style={{ display: selectedStudent ? 'none' : undefined }}>
              {studentListElement}
            </div>
            {studentDetailElement}
          </>
        );
      case 'applications':
        return (
          <>
            <div style={{ display: selectedStudent ? 'none' : undefined }}>
              <SafeSuspense>
                <ApplicationsContent
                  applications={applications}
                  students={students}
                  loading={loading}
                  currentLang={currentLang}
                  onOpenStudent={setSelectedStudent}
                  onUpdateApplicationStatus={updateApplicationStatus}
                />
              </SafeSuspense>
            </div>
            {studentDetailElement}
          </>
        );
      case 'documents':
        return (
          <>
            <div style={{ display: selectedStudent ? 'none' : undefined }}>
              <Card>
                <CardHeader>
                  <CardTitle>{t('navigation.documents')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    View documents from the student detail view by selecting a student.
                  </p>
                  {studentListElement}
                </CardContent>
              </Card>
            </div>
            {studentDetailElement}
          </>
        );
      case 'finance':
        if (!isOwner) return <AccessDenied />;
        return (
          <SafeSuspense>
            <FinanceOverviewContent />
          </SafeSuspense>
        );
      case 'finance-students':
        if (!isOwner) return <AccessDenied />;
        return <FinanceStudentsWrapper />;
      case 'finance-budgets':
        if (!isOwner) return <AccessDenied />;
        return (
          <SafeSuspense>
            <BudgetsContent />
          </SafeSuspense>
        );
      case 'finance-monthly':
        if (!isOwner) return <AccessDenied />;
        return (
          <SafeSuspense>
            <MonthlyContent />
          </SafeSuspense>
        );
      case 'finance-scheduled':
        if (!isOwner) return <AccessDenied />;
        return (
          <SafeSuspense>
            <ScheduledPaymentsContent />
          </SafeSuspense>
        );
      case 'finance-transactions':
        if (!isOwner) return <AccessDenied />;
        return <TransactionsWrapper />;
      case 'finance-distribution':
        if (!isOwner) return <AccessDenied />;
        return (
          <SafeSuspense>
            <DistributionContent />
          </SafeSuspense>
        );
      case 'finance-bonuses':
        if (!isOwner) return <AccessDenied />;
        return (
          <SafeSuspense>
            <BonusesContent />
          </SafeSuspense>
        );
      case 'finance-reports':
        if (!isOwner) return <AccessDenied />;
        return <FinanceReportsWrapper />;
      case 'universities':
        return <SafeSuspense><UniversitiesContent /></SafeSuspense>;
      case 'tasks':
        return <SafeSuspense><TasksContent /></SafeSuspense>;
      case 'messages':
        return <SafeSuspense><MessagesContent /></SafeSuspense>;
      case 'calls':
        return <SafeSuspense><CallsContent /></SafeSuspense>;
      case 'leads':
        return <SafeSuspense><LeadsContent /></SafeSuspense>;
      case 'staff':
        return <SafeSuspense><StaffContent /></SafeSuspense>;
      case 'translation':
        return <SafeSuspense><AITranslationPage /></SafeSuspense>;
      case 'communication':
        return <SafeSuspense><CommunicationContent /></SafeSuspense>;
      case 'reports':
        return <SafeSuspense><ReportsContent /></SafeSuspense>;
      case 'calendar':
        return <SafeSuspense><CalendarContent /></SafeSuspense>;
      case 'settings':
        return <SafeSuspense><SettingsContent /></SafeSuspense>;
      case 'kakao-map':
        return <SafeSuspense><KakaoMapContent /></SafeSuspense>;
      case 'uni-db-review':
        return <SafeSuspense><UniDbReviewContent /></SafeSuspense>;
      default:
        return (
          <CRMDashboard
            isAdmin={isAdmin}
            isOwner={isOwner}
            isCallOperator={isCallOperator}
            isDocumentHandler={isDocumentHandler}
          />
        );
    }
  };

  return (
    <IntercomProvider>
      <VoiceChannelProvider>
        <SidebarProvider
          defaultOpen={true}
          style={{ '--sidebar-width': '248px', '--sidebar-width-icon': '72px' } as React.CSSProperties}
        >
          <div className="flex min-h-screen w-full">
            <CRMSidebar
              isOwner={isOwner}
              isAdmin={isAdmin}
              isCallOperator={isCallOperator}
              isDocumentHandler={isDocumentHandler}
              canReviewUniDb={canReviewUniDb}
              user={user}
              onSignOut={handleSignOut}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Header */}
              <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 pt-[env(safe-area-inset-top)]">
                <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                  <SidebarTrigger className="h-9 w-9 text-muted-foreground" />
                  <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight text-foreground">
                    {pageTitle}
                  </h1>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <CRMCommandMenu groups={sidebarGroups} />
                    <VoiceChannelHeader />
                    <LanguageSwitcher />
                    <ThemeToggleButton />
                    <NotificationBell />
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <LeadsProvider>
                <CallsProvider>
                  <MessagesProvider>
                    <main className="flex-1 overflow-auto bg-background p-4 pb-safe sm:p-6">
                      <div key={activeView} className="mx-auto max-w-[1240px] animate-fade-up space-y-6">
                        {renderContent()}
                      </div>
                    </main>
                  </MessagesProvider>
                </CallsProvider>
              </LeadsProvider>
            </div>

            {/* Hanguk AI Chat */}
            <HangukAIChat userType="staff" language={currentLang} />
          </div>
        </SidebarProvider>
      </VoiceChannelProvider>
    </IntercomProvider>
  );
}
