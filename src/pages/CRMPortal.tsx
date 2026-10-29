import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useCRMData, type CRMStudent } from '@/hooks/useCRMData';
import { usePayments } from '@/hooks/usePayments';
import { CRMSidebar, useSidebarGroups } from '@/components/crm/CRMSidebar';
import { CRMCommandMenu } from '@/components/crm/CRMCommandMenu';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Logo } from '@/components/Logo';
import { CRMDashboard } from '@/components/crm/CRMDashboard';
import { StudentList } from '@/components/crm/StudentList';
import { StudentDetail } from '@/components/crm/StudentDetail';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SeasonSwitcher } from '@/components/crm/SeasonSwitcher';
import { IntakeBanner } from '@/components/crm/IntakeBanner';
import { NotificationBell } from '@/components/crm/NotificationBell';
import { HangukAIChat } from '@/components/ai/HangukAIChat';
import { IntercomProvider } from '@/components/intercom/IntercomProvider';
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
import { cn } from '@/lib/utils';

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
const UniversityCatalogContent = lazy(() => import('@/components/crm/pages/UniversityCatalogContent'));
const UniversitySelectionContent = lazy(() => import('@/components/crm/pages/UniversitySelectionContent'));
const OnlineApplicationContent = lazy(() => import('@/components/crm/pages/OnlineApplicationContent'));
const OfflineApplicationContent = lazy(() => import('@/components/crm/pages/OfflineApplicationContent'));
const AppAnalyticsContent = lazy(() => import('@/components/crm/pages/AppAnalyticsContent'));
const TodayInAppContent = lazy(() => import('@/components/crm/pages/TodayInAppContent'));
const UniversitiesContent = lazy(() => import('@/components/crm/pages/UniversitiesContent'));
const TasksContent = lazy(() => import('@/components/crm/pages/TasksContent'));
const MessagesContent = lazy(() => import('@/components/crm/pages/MessagesContent'));
const CallsContent = lazy(() => import('@/components/crm/pages/CallsContent'));
const StaffContent = lazy(() => import('@/components/crm/pages/StaffContent'));
const ReportsContent = lazy(() => import('@/components/crm/pages/ReportsContent'));
const AIAssistantContent = lazy(() => import('@/components/crm/pages/AIAssistantContent'));
const ApplicationsPipeline = lazy(() => import('@/components/crm/pages/ApplicationsPipeline'));
const DocumentsContent = lazy(() => import('@/components/crm/pages/DocumentsContent'));
const AITranslationPage = lazy(() => import('@/components/crm/pages/AITranslationPage'));
const LeadsContent = lazy(() => import('@/components/crm/pages/LeadsContent'));

/** Views given a wider content column — see the main content wrapper. */
const WIDE_VIEWS = new Set(['leads', 'new-leads', 'today-leads']);
const LeadProfileContent = lazy(() => import('@/components/crm/pages/LeadProfileContent'));
const CalendarContent = lazy(() => import('@/components/crm/pages/CalendarContent'));
const SettingsContent = lazy(() => import('@/components/crm/pages/SettingsContent'));
const KakaoMapContent = lazy(() => import('@/components/crm/pages/KakaoMapContent'));
const ManageIntakesContent = lazy(() => import('@/components/crm/pages/ManageIntakesContent'));
const SurveysContent = lazy(() => import('@/components/crm/pages/SurveysContent'));
const InvestorDeskContent = lazy(() => import('@/components/crm/pages/InvestorDeskContent'));
const LearningCentersContent = lazy(() => import('@/components/crm/pages/LearningCentersContent'));
const ApplicationFeeContent = lazy(() => import('@/components/crm/pages/ApplicationFeeContent'));

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

type StudentProfile = CRMStudent;

export default function CRMPortal() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, loading: authLoading } = useAuth();
  const {
    isStaff,
    isOwner,
    isAdmin,
    isCallOperator,
    isDocumentHandler,
    canSeeFinance,
    canApproveDocuments,
    canSeeApplicationFees,
    loading: roleLoading,
  } = useUserRole();
  const {
    students,
    universities,
    loading: studentsLoading,
    updateDocumentStatus,
    setDocsReady,
    refetchStudents
  } = useCRMData();

  const { payments, loading: paymentsLoading, fetchPayments } = usePayments();
  const loading = studentsLoading || paymentsLoading;

  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  // /crm/students?student=<user id> opens that student (links from the app
  // analytics: «Bugun ilovada», «Mijozlar faolligi»).
  const [searchParams, setSearchParams] = useSearchParams();
  const studentParam = searchParams.get('student');
  useEffect(() => {
    if (!studentParam || !location.pathname.startsWith('/crm/students') || !students.length) return;
    const found = students.find((s) => s.user_id === studentParam);
    if (found) setSelectedStudent(found as StudentProfile);
    const next = new URLSearchParams(searchParams);
    next.delete('student');
    setSearchParams(next, { replace: true });
  }, [studentParam, students, location.pathname, searchParams, setSearchParams]);

  // Sidebar groups (role-filtered) power the ⌘K command menu in the header.
  const sidebarGroups = useSidebarGroups(
    canSeeFinance,
    isAdmin,
    isCallOperator,
    isDocumentHandler,
    t,
    currentLang,
    canSeeApplicationFees,
  );

  // Determine current view from URL
  const currentPath = location.pathname;
  // A lead id in the URL turns the leads section into one customer's profile.
  const leadProfileId = currentPath.match(
    /^\/crm\/leads\/([0-9a-fA-F-]{36})/,
  )?.[1] ?? null;
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
    if (currentPath.startsWith('/crm/university-selection')) return 'university-selection';
    if (currentPath.startsWith('/crm/online-application')) return 'online-application';
    if (currentPath.startsWith('/crm/offline-application')) return 'offline-application';
    // "Ilova faolligi" became a tab of "Ilova analitikasi"; old links still open it.
    if (currentPath.startsWith('/crm/app-activity')) return 'app-analytics';
    if (currentPath.startsWith('/crm/app-analytics')) return 'app-analytics';
    if (currentPath.startsWith('/crm/application-fees')) return 'application-fees';
    if (currentPath.startsWith('/crm/tasks')) return 'tasks';
    if (currentPath.startsWith('/crm/messages')) return 'messages';
    if (currentPath.startsWith('/crm/calls')) return 'calls';
    if (currentPath.startsWith('/crm/new-leads')) return 'new-leads';
    if (currentPath.startsWith('/crm/today-leads')) return 'today-leads';
    if (currentPath.startsWith('/crm/today-in-app')) return 'today-in-app';
    // The profile check must come first: '/crm/leads/<id>' also starts with
    // '/crm/leads', and the list would otherwise swallow every detail URL.
    if (leadProfileId) return 'lead-profile';
    if (currentPath.startsWith('/crm/leads')) return 'leads';
    if (currentPath.startsWith('/crm/staff')) return 'staff';
    if (currentPath.startsWith('/crm/reports')) return 'reports';
    if (currentPath.startsWith('/crm/calendar')) return 'calendar';
    if (currentPath.startsWith('/crm/settings')) return 'settings';
    if (currentPath.startsWith('/crm/intakes')) return 'intakes';
    if (currentPath.startsWith('/crm/translation')) return 'translation';
    if (currentPath.startsWith('/crm/kakao-map')) return 'kakao-map';
    if (currentPath.startsWith('/crm/admin/institutions')) return 'institutions';
    if (currentPath.startsWith('/crm/surveys')) return 'surveys';
    if (currentPath.startsWith('/crm/investor-desk')) return 'investor-desk';
    if (currentPath.startsWith('/crm/learning-centers')) return 'learning-centers';
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
        navigate('/');
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
      onUpdateDocumentStatus={updateDocumentStatus}
      currentLang={currentLang}
      isDocumentHandler={isDocumentHandler}
      canApproveDocuments={canApproveDocuments}
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
            <div style={{ display: selectedStudent ? 'none' : undefined }} className="space-y-4">
              <IntakeBanner onManage={() => navigate('/crm/intakes')} />
              <SafeSuspense>
                <ApplicationsPipeline
                  students={students}
                  loading={loading}
                  onOpenStudent={(s) => setSelectedStudent(s as unknown as StudentProfile)}
                />
              </SafeSuspense>
            </div>
            {studentDetailElement}
          </>
        );
      case 'documents':
        return (
          <SafeSuspense>
            <DocumentsContent
              students={students}
              loading={loading}
              currentLang={currentLang}
              onUpdateDocumentStatus={updateDocumentStatus}
              onSetDocsReady={setDocsReady}
              canApproveDocuments={canApproveDocuments}
              onDocumentsChanged={refetchStudents}
            />
          </SafeSuspense>
        );
      case 'finance':
        if (!canSeeFinance) return <AccessDenied />;
        return (
          <SafeSuspense>
            <FinanceOverviewContent />
          </SafeSuspense>
        );
      case 'finance-students':
        if (!canSeeFinance) return <AccessDenied />;
        return <FinanceStudentsWrapper />;
      case 'finance-budgets':
        if (!canSeeFinance) return <AccessDenied />;
        return (
          <SafeSuspense>
            <BudgetsContent />
          </SafeSuspense>
        );
      case 'finance-monthly':
        if (!canSeeFinance) return <AccessDenied />;
        return (
          <SafeSuspense>
            <MonthlyContent />
          </SafeSuspense>
        );
      case 'finance-scheduled':
        if (!canSeeFinance) return <AccessDenied />;
        return (
          <SafeSuspense>
            <ScheduledPaymentsContent />
          </SafeSuspense>
        );
      case 'finance-transactions':
        if (!canSeeFinance) return <AccessDenied />;
        return <TransactionsWrapper />;
      case 'finance-distribution':
        if (!canSeeFinance) return <AccessDenied />;
        return (
          <SafeSuspense>
            <DistributionContent />
          </SafeSuspense>
        );
      case 'finance-bonuses':
        if (!canSeeFinance) return <AccessDenied />;
        return (
          <SafeSuspense>
            <BonusesContent />
          </SafeSuspense>
        );
      case 'finance-reports':
        if (!canSeeFinance) return <AccessDenied />;
        return <FinanceReportsWrapper />;
      case 'universities':
        return <SafeSuspense><UniversityCatalogContent /></SafeSuspense>;
      case 'university-selection':
        if (!(isAdmin || isDocumentHandler || isCallOperator)) return <AccessDenied />;
        return (
          <SafeSuspense>
            <UniversitySelectionContent
              students={students}
              loading={loading}
            />
          </SafeSuspense>
        );
      case 'app-analytics':
        // Every staff role (S6); investors never reach the CRM.
        if (!(isAdmin || isDocumentHandler || isCallOperator)) return <AccessDenied />;
        return <SafeSuspense><AppAnalyticsContent /></SafeSuspense>;
      case 'online-application':
        if (!(isAdmin || isDocumentHandler || isCallOperator)) return <AccessDenied />;
        return (
          <SafeSuspense>
            <OnlineApplicationContent students={students} loading={loading} />
          </SafeSuspense>
        );
      case 'offline-application':
        if (!(isAdmin || isDocumentHandler || isCallOperator)) return <AccessDenied />;
        return (
          <SafeSuspense>
            <OfflineApplicationContent students={students} loading={loading} />
          </SafeSuspense>
        );
      case 'application-fees':
        if (!canSeeApplicationFees) return <AccessDenied />;
        return <SafeSuspense><ApplicationFeeContent /></SafeSuspense>;
      case 'institutions':
        return <SafeSuspense><UniversitiesContent /></SafeSuspense>;
      case 'tasks':
        return <SafeSuspense><TasksContent /></SafeSuspense>;
      case 'messages':
        return <SafeSuspense><MessagesContent /></SafeSuspense>;
      case 'calls':
        return <SafeSuspense><CallsContent /></SafeSuspense>;
      case 'leads':
        return <SafeSuspense><LeadsContent /></SafeSuspense>;
      case 'new-leads':
        return <SafeSuspense><LeadsContent key="new-leads" view="new" /></SafeSuspense>;
      case 'today-leads':
        return <SafeSuspense><LeadsContent key="today-leads" view="today" /></SafeSuspense>;
      case 'today-in-app':
        // The operators' list from the app's signals; every staff role (S6).
        if (!(isAdmin || isDocumentHandler || isCallOperator)) return <AccessDenied />;
        return <SafeSuspense><TodayInAppContent /></SafeSuspense>;
      case 'lead-profile':
        return (
          <SafeSuspense>
            <LeadProfileContent leadId={leadProfileId as string} />
          </SafeSuspense>
        );
      case 'staff':
        return <SafeSuspense><StaffContent /></SafeSuspense>;
      case 'translation':
        return <SafeSuspense><AITranslationPage /></SafeSuspense>;
      case 'reports':
        return <SafeSuspense><ReportsContent /></SafeSuspense>;
      case 'calendar':
        return <SafeSuspense><CalendarContent /></SafeSuspense>;
      case 'settings':
        return <SafeSuspense><SettingsContent /></SafeSuspense>;
      case 'intakes':
        return <SafeSuspense><ManageIntakesContent /></SafeSuspense>;
      case 'kakao-map':
        return <SafeSuspense><KakaoMapContent /></SafeSuspense>;
      case 'surveys':
        return <SafeSuspense><SurveysContent /></SafeSuspense>;
      case 'investor-desk':
        return <SafeSuspense><InvestorDeskContent /></SafeSuspense>;
      case 'learning-centers':
        if (!isCallOperator) return <AccessDenied />;
        return <SafeSuspense><LearningCentersContent /></SafeSuspense>;
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
      <SidebarProvider
        defaultOpen={true}
        style={{ '--sidebar-width': '248px', '--sidebar-width-icon': '72px' } as React.CSSProperties}
      >
        <div className="flex min-h-screen w-full">
          <CRMSidebar
            isOwner={isOwner}
            canSeeFinance={canSeeFinance}
            isAdmin={isAdmin}
            isCallOperator={isCallOperator}
            isDocumentHandler={isDocumentHandler}
            canSeeApplicationFees={canSeeApplicationFees}
            user={user}
            onSignOut={handleSignOut}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 pt-[env(safe-area-inset-top)]">
              <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                <SidebarTrigger className="h-9 w-9 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <h1 className="min-w-0 truncate text-[17px] font-bold tracking-tight text-foreground">
                    {pageTitle}
                  </h1>
                  <SeasonSwitcher className="shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CRMCommandMenu groups={sidebarGroups} />
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
                    {/* The lead lists are twelve-column tables; on a wide monitor
                        they get the room to show every column at once instead of
                        scrolling sideways inside a 1240px box. */}
                    <div
                      key={activeView}
                      className={cn(
                        'mx-auto animate-fade-up space-y-6',
                        WIDE_VIEWS.has(activeView) ? 'max-w-[1440px]' : 'max-w-[1240px]',
                      )}
                    >
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
    </IntercomProvider>
  );
}
