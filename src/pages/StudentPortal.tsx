import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useStudentData } from '@/hooks/useStudentData';
import { useStudentPlan } from '@/hooks/useStudentPlan';
import { usePlatform } from '@/hooks/usePlatform';
import { ApplicationTracker } from '@/components/student/ApplicationTracker';
import { UniversityMapKakao } from '@/components/student/UniversityMapKakao';
import { DocumentUpload } from '@/components/student/DocumentUpload';
import { ProgramFinder } from '@/components/student/ProgramFinder';
import { StudentInsightsPanel } from '@/components/student/StudentInsightsPanel';
import { SuggestedUniversities } from '@/components/student/SuggestedUniversities';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { HangukAIChat } from '@/components/ai/HangukAIChat';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from '@/lib/utils';
import {
  GraduationCap,
  MapPin,
  FileText,
  LogOut,
  Video,
  Bot,
  PenTool,
  Download,
  Lock,
  Crown,
  Search,
  Loader2
} from 'lucide-react';

export default function StudentPortal() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isStaff, loading: roleLoading } = useUserRole();
  const { applications, documents, universities, suggestions, loading, refetchDocuments, refetchSuggestions } = useStudentData();
  const { isVIP, planLabel, isPremium, isNoRisk, isStandart, isFree, loading: planLoading } = useStudentPlan();

  const { isDespia, isWeb } = usePlatform();
  const [searchParams] = useSearchParams();
  const urlFocusId = searchParams.get('universityId');
  const currentLang = i18n.language;
  const [activeTab, setActiveTab] = useState(urlFocusId ? 'map' : 'applications');
  const [stateFocusId, setStateFocusId] = useState<string | null>(null);
  const focusUniversityId = stateFocusId || urlFocusId;

  const handleShowOnMap = (universityId: string) => {
    setStateFocusId(universityId);
    setActiveTab('map');
  };
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Auto-switch to map tab when deep-linking to a university
  useEffect(() => {
    if (urlFocusId) setActiveTab('map');
  }, [urlFocusId]);
  const chatRef = useRef<{ open: () => void }>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // STRICT ACCESS CONTROL: Redirect staff to CRM immediately
  useEffect(() => {
    if (!authLoading && !roleLoading && user && isStaff) {
      navigate('/crm');
    }
  }, [user, isStaff, authLoading, roleLoading, navigate]);

  // Redirect non-authenticated users (MUST be before conditional returns)
  useEffect(() => {
    if (!authLoading && !roleLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading || planLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <img src="/logo.jpg" alt="Hanguk" className="h-16 w-16 rounded-xl object-cover" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Block staff access or unauthenticated users - handled by useEffect
  if (!user || isStaff) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t('common.redirecting', 'Redirecting...')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top)]">
        <div className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Hanguk" className="h-10 w-10 rounded-lg object-cover" />
            <div className="hidden sm:block">
              <span className="text-xl font-bold text-primary">Hanguk</span>
              <p className="text-xs text-muted-foreground">{t('student.portal')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Show Get App button only for web users, not for Despia native users */}
            {isWeb && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/install')}
                className="hidden sm:flex"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('install.getApp', 'Get App')}
              </Button>
            )}
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('auth.logout')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
        <main className="flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-4">
          <div className="max-w-6xl mx-auto">
            {/* Welcome Section */}
            <div className="mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-primary">
                  {t('common.welcome')}, {user.user_metadata?.full_name || user.email}
                </h1>
                {planLabel && (
                  <Badge
                    variant={isVIP ? "default" : "secondary"}
                    className={cn(
                      "gap-1",
                      isNoRisk && "bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0",
                      isPremium && "bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0",
                      isStandart && "bg-primary text-primary-foreground border-0",
                      isFree && "bg-muted text-muted-foreground border-0"
                    )}
                  >
                    {isVIP && <Crown className="h-3 w-3" />}
                    {planLabel}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{t('student.applicationStatus')}</p>
            </div>

            {/* Student Insights Panel */}
            <div className="mb-6">
              <StudentInsightsPanel onOpenChat={() => setIsChatOpen(true)} />
            </div>

            {/* Desktop Tabs */}
            <div className="hidden md:block">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start mb-6">
                  <TabsTrigger value="applications" className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {t('student.myUniversities', 'Mening universitetlarim')}
                  </TabsTrigger>
                  <TabsTrigger value="map" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t('student.exploreMap')}
                  </TabsTrigger>
                  <TabsTrigger value="finder" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    {t('finder.findPrograms', 'Find Programs')}
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('navigation.documents')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="interview"
                    className={cn(
                      "flex items-center gap-2",
                      !isVIP && "opacity-70"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/interview-practice');
                    }}
                  >
                    <Video className="h-4 w-4" />
                    {t('interview.practice', 'Interview Practice')}
                    {!isVIP && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
                  </TabsTrigger>
                  <TabsTrigger
                    value="studyplan"
                    className={cn(
                      "flex items-center gap-2",
                      !isVIP && "opacity-70"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/study-plan-trainer');
                    }}
                  >
                    <PenTool className="h-4 w-4" />
                    {t('study.planTrainer', 'Study Plan Trainer')}
                    {!isVIP && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="applications">
                  <SuggestedUniversities suggestions={suggestions} onRefresh={refetchSuggestions} onShowOnMap={handleShowOnMap} />
                  <ApplicationTracker applications={applications} loading={loading} onShowOnMap={handleShowOnMap} />
                </TabsContent>
                <TabsContent value="map">
                  <UniversityMapKakao universities={universities} focusUniversityId={focusUniversityId} />
                </TabsContent>
                <TabsContent value="finder">
                  <ProgramFinder />
                </TabsContent>
                <TabsContent value="documents">
                  <DocumentUpload
                    documents={documents}
                    onUploadComplete={refetchDocuments}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Mobile Content */}
            <div className="md:hidden">
              {activeTab === 'applications' && (
                <>
                  <SuggestedUniversities suggestions={suggestions} onRefresh={refetchSuggestions} onShowOnMap={handleShowOnMap} />
                  <ApplicationTracker applications={applications} loading={loading} onShowOnMap={handleShowOnMap} />
                </>
              )}
              {activeTab === 'map' && (
                <UniversityMapKakao universities={universities} focusUniversityId={focusUniversityId} />
              )}
              {activeTab === 'documents' && (
                <DocumentUpload
                  documents={documents}
                  onUploadComplete={refetchDocuments}
                />
              )}
            </div>
          </div>
        </main>

      {/* Bottom Navigation for Mobile - Native iOS/Android Tab Bar Style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden z-40 pb-[env(safe-area-inset-bottom)]">
        {/* Safe area spacer for iOS home indicator */}
        <div className="flex justify-around items-end h-[52px]">
          {/* Home / Applications */}
          <button
            className={cn(
              "flex-1 flex flex-col items-center justify-center pt-2 pb-1 relative transition-colors active:opacity-70",
              activeTab === 'applications' ? 'text-primary' : 'text-muted-foreground'
            )}
            onClick={() => setActiveTab('applications')}
          >
            {activeTab === 'applications' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
            <GraduationCap className="h-6 w-6" strokeWidth={activeTab === 'applications' ? 2.5 : 1.5} />
            <span className="text-[10px] mt-0.5 font-medium">{t('navigation.home')}</span>
          </button>

          {/* Map */}
          <button
            className={cn(
              "flex-1 flex flex-col items-center justify-center pt-2 pb-1 relative transition-colors active:opacity-70",
              activeTab === 'map' ? 'text-primary' : 'text-muted-foreground'
            )}
            onClick={() => setActiveTab('map')}
          >
            {activeTab === 'map' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
            <MapPin className="h-6 w-6" strokeWidth={activeTab === 'map' ? 2.5 : 1.5} />
            <span className="text-[10px] mt-0.5 font-medium">{t('student.map', 'Map')}</span>
          </button>

          {/* Center AI Button - Floating style */}
          <div className="flex-1 flex items-center justify-center relative">
            <button
              className={cn(
                "absolute -top-4 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                isChatOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary text-primary-foreground"
              )}
              onClick={() => setIsChatOpen(true)}
            >
              <Bot className="h-7 w-7" />
            </button>
            <span className="text-[10px] mt-8 font-medium text-primary">{t('ai.assistant', 'AI')}</span>
          </div>

          {/* Documents */}
          <button
            className={cn(
              "flex-1 flex flex-col items-center justify-center pt-2 pb-1 relative transition-colors active:opacity-70",
              activeTab === 'documents' ? 'text-primary' : 'text-muted-foreground'
            )}
            onClick={() => setActiveTab('documents')}
          >
            {activeTab === 'documents' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
            <FileText className="h-6 w-6" strokeWidth={activeTab === 'documents' ? 2.5 : 1.5} />
            <span className="text-[10px] mt-0.5 font-medium">{t('navigation.docs', 'Docs')}</span>
          </button>

          {/* More - Opens submenu for Interview & Study Plan */}
          <Drawer>
            <DrawerTrigger asChild>
              <button
                className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 relative text-muted-foreground transition-colors active:opacity-70 group"
              >
                <div className="relative">
                  <PenTool className="h-6 w-6" strokeWidth={1.5} />
                  {!isVIP && <Lock className="absolute -top-1 -right-1 h-3 w-3 text-muted-foreground" />}
                </div>
                <span className="text-[10px] mt-0.5 font-medium">{t('navigation.more', 'More')}</span>
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{t('navigation.trainingTools', 'Training Tools')}</DrawerTitle>
                <DrawerDescription>
                  {t('navigation.trainingDesc', 'Access AI-powered tools to prepare your application')}
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4 flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="w-full justify-start h-14"
                  onClick={() => navigate('/study-plan-trainer')}
                >
                  <PenTool className="h-5 w-5 mr-3" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium">{t('study.planTrainer', 'Study Plan Trainer')}</span>
                    <span className="text-xs text-muted-foreground">{t('study.writeAndImprove', 'Write & Improve')}</span>
                  </div>
                  {!isVIP && <Lock className="h-4 w-4 ml-auto text-muted-foreground" />}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-14"
                  onClick={() => navigate('/interview-practice')}
                >
                  <Video className="h-5 w-5 mr-3" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium">{t('interview.practice', 'Interview Practice')}</span>
                    <span className="text-xs text-muted-foreground">{t('interview.audioDesc', 'Audio mock interviews')}</span>
                  </div>
                  {!isVIP && <Lock className="h-4 w-4 ml-auto text-muted-foreground" />}
                </Button>
              </div>
              <DrawerFooter className="pt-2">
                <DrawerClose asChild>
                  <Button variant="ghost">{t('common.cancel', 'Cancel')}</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </nav>

      {/* Hanguk AI Chat - Pass open state for mobile */}
      <HangukAIChat
        userType="student"
        language={currentLang}
        isOpenExternal={isChatOpen}
        onOpenChange={setIsChatOpen}
      />
    </div>
  );
}
