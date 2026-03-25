import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmissionSync } from '@/hooks/useAdmissionSync';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useUniversities } from '@/hooks/useUniversities';
import { 
  applicationFormsApi, 
  type ApplicationFormSearchRequest,
  type ApplicationFormSearchResult,
  type AnalyzedApplicationData,
  type ProgramInfo,
  type DocumentRequirement,
  type FacultyTuition,
  type TrackAvailabilitySummary,
  type FacultySearchRequest,
  type FacultySearchResponse,
  type FacultyUniversityResult,
  type FacultyQualitySummary,
  type FacultyExpandedTerms,
} from '@/lib/api/applicationForms';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Sparkles,
  GraduationCap,
  Calendar,
  Languages,
  Loader2,
  Check,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  AlertTriangle,
  BookOpen,
  DollarSign,
  Clock,
  FileCheck,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  Globe,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  Building2,
  Users,
  Wand2,
  CalendarX,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateFacultyResultsPdf } from '@/lib/facultyResultsPdf';

type SearchStep = 'idle' | 'searching' | 'scraping' | 'analyzing' | 'complete' | 'error';

const stepMessages: Record<SearchStep, Record<string, string>> = {
  idle: { uz: "Qidirishga tayyor", en: "Ready to search", ru: "Готов к поиску" },
  searching: { uz: "Study in Korea va universitet saytlaridan qidirilmoqda...", en: "Searching Study in Korea and university websites...", ru: "Поиск на Study in Korea и сайтах университетов..." },
  scraping: { uz: "Ariza shakli yuklanmoqda...", en: "Loading application form...", ru: "Загрузка формы заявки..." },
  analyzing: { uz: "AI tahlil qilmoqda...", en: "AI analyzing content...", ru: "AI анализирует содержимое..." },
  complete: { uz: "Tahlil yakunlandi!", en: "Analysis complete!", ru: "Анализ завершён!" },
  error: { uz: "Xatolik yuz berdi", en: "An error occurred", ru: "Произошла ошибка" },
};

const stepProgress: Record<SearchStep, number> = {
  idle: 0,
  searching: 25,
  scraping: 50,
  analyzing: 75,
  complete: 100,
  error: 0,
};

export default function ApplicationFormsContent() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'uz' | 'en' | 'ru';
  const { toast } = useToast();
  const { universities } = useUniversities();

  // Search mode
  const [searchMode, setSearchMode] = useState<'university' | 'faculty' | 'autosync'>('university');

  // Auto-sync hook
  const admissionSync = useAdmissionSync();

  // Search form state
  const [universitySearch, setUniversitySearch] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<{ id: string; name: string } | null>(null);
  const [universityOpen, setUniversityOpen] = useState(false);
  const [programLevel, setProgramLevel] = useState<'undergraduate' | 'graduate' | 'phd'>('undergraduate');
  const [semester, setSemester] = useState<'spring' | 'fall'>('fall');
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [languageTrack, setLanguageTrack] = useState<'english' | 'korean' | 'both'>('both');

  // Faculty search state
  const [facultySearch, setFacultySearch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [facultyOpen, setFacultyOpen] = useState(false);
  const [facultyResults, setFacultyResults] = useState<FacultyUniversityResult[]>([]);
  const [facultySearching, setFacultySearching] = useState(false);
  const [facultyError, setFacultyError] = useState<string | null>(null);
  const [facultyQualitySummary, setFacultyQualitySummary] = useState<FacultyQualitySummary | null>(null);
  const [facultyExpandedTerms, setFacultyExpandedTerms] = useState<FacultyExpandedTerms | null>(null);

  // Comprehensive search state
  const [comprehensiveProgress, setComprehensiveProgress] = useState<{ processed: number; total: number } | null>(null);
  const [isComprehensiveSearch, setIsComprehensiveSearch] = useState(false);

  // Count of universities with website (for prerequisite warning)
  const universitiesWithWebsite = universities.filter(u => (u as any).website && (u as any).website.trim() !== '').length;

  // Saved faculty searches
  const [savedFacultySearches, setSavedFacultySearches] = useState<Array<{ id: string; request: any; result: any; created_at: string }>>([]);
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [deletingSearchId, setDeletingSearchId] = useState<string | null>(null);

  const loadSavedSearches = useCallback(async () => {
    const results = await applicationFormsApi.getSavedFacultySearches();
    setSavedFacultySearches(results);
  }, []);

  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  const loadSavedResult = (saved: { request: any; result: any }) => {
    const req = saved.request;
    const res = saved.result;
    setSelectedFaculty(req.faculty || '');
    setFacultySearch(req.faculty || '');
    setProgramLevel(req.programLevel || 'undergraduate');
    setSemester(req.semester || 'fall');
    setYear(req.year || new Date().getFullYear() + 1);
    setLanguageTrack(req.languageTrack || 'both');
    setFacultyResults(res.universities || []);
    setFacultyQualitySummary(res.qualitySummary || null);
    setFacultyExpandedTerms(res.expandedTerms || null);
    setFacultyError(null);
    toast({ title: lang === 'uz' ? "Saqlangan natija yuklandi" : "Loaded saved result" });
  };

  const handleDeleteSavedSearch = async (jobId: string) => {
    setDeletingSearchId(jobId);
    const { error } = await applicationFormsApi.deleteFacultySearch(jobId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSavedFacultySearches(prev => prev.filter(s => s.id !== jobId));
      toast({ title: lang === 'uz' ? "O'chirildi" : "Deleted" });
    }
    setDeletingSearchId(null);
  };
  const [step, setStep] = useState<SearchStep>('idle');
  const [searchResults, setSearchResults] = useState<ApplicationFormSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ApplicationFormSearchResult | null>(null);
  const [analyzedData, setAnalyzedData] = useState<AnalyzedApplicationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cache state
  const [cachedData, setCachedData] = useState<{
    hasRecent: boolean;
    data: any;
    isStale: boolean;
    daysSinceScraped?: number;
  } | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<AnalyzedApplicationData | null>(null);
  const [manualNotes, setManualNotes] = useState('');

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: {
      programs: number;
      admissionPeriods: number;
      requirements: number;
      universityUpdated: boolean;
    };
  } | null>(null);

  // Faculty preset list
  const presetFaculties = [
    'Computer Science', 'Computer Engineering', 'Business Administration',
    'Korean Language and Culture', 'Electrical Engineering', 'Mechanical Engineering',
    'International Studies', 'Economics', 'Medicine', 'Architecture',
    'Chemical Engineering', 'Civil Engineering', 'Biology', 'Physics',
    'Mathematics', 'Psychology', 'Sociology', 'Political Science',
    'Law', 'Pharmacy', 'Nursing', 'Art and Design', 'Music',
    'Film and Media', 'Data Science', 'Artificial Intelligence',
    'Environmental Science', 'Food Science', 'Tourism',
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  // Check for cached data when university changes
  const checkCachedData = async () => {
    if (!selectedUniversity?.id) {
      setCachedData(null);
      return;
    }

    setCheckingCache(true);
    try {
      const result = await applicationFormsApi.checkRecentCache(
        selectedUniversity.id,
        semester,
        year,
        programLevel,
        7, // 7 days threshold
        languageTrack // ISSUE 1 fix: pass language track for cache validation
      );
      setCachedData(result);
    } catch (err) {
      console.error('Error checking cache:', err);
      setCachedData(null);
    } finally {
      setCheckingCache(false);
    }
  };

  useEffect(() => {
    checkCachedData();
  }, [selectedUniversity?.id, semester, year, programLevel, languageTrack]);

  const loadFromCache = () => {
    if (cachedData?.data?.analyzed_data) {
      const data = cachedData.data.analyzed_data as AnalyzedApplicationData;
      setAnalyzedData(data);
      setEditedData(data);
      setStep('complete');
      toast({
        title: lang === 'uz' ? "Keshdan yuklandi" : "Loaded from cache",
        description: lang === 'uz' 
          ? `${cachedData.daysSinceScraped} kun oldin saqlangandata`
          : `Data cached ${cachedData.daysSinceScraped} days ago`,
      });
    }
  };

  const handleSearch = async (forceRefresh: boolean = false) => {
    if (!selectedUniversity && !universitySearch.trim()) {
      toast({ title: t('common.error'), description: "Please enter or select a university", variant: "destructive" });
      return;
    }

    // Check cache first if not forcing refresh
    if (!forceRefresh && cachedData?.hasRecent && !cachedData.isStale) {
      loadFromCache();
      return;
    }

    const universityName = selectedUniversity?.name || universitySearch.trim();
    
    setStep('searching');
    setError(null);
    setSearchResults([]);
    setAnalyzedData(null);
    setSelectedResult(null);
    setImportResult(null);

    try {
      // Step 1: Search for application forms
      const searchRequest: ApplicationFormSearchRequest = {
        universityName,
        programLevel,
        semester,
        year,
        languageTrack,
      };

      const searchResponse = await applicationFormsApi.findApplicationForm(searchRequest);

      if (!searchResponse.success) {
        throw new Error(searchResponse.error || 'Search failed');
      }

      if (!searchResponse.results?.length) {
        setStep('complete');
        toast({ 
          title: "No results found", 
          description: `Could not find application forms for ${universityName}. Try a different search.`,
          variant: "destructive" 
        });
        return;
      }

      setSearchResults(searchResponse.results);

      // ISSUE 1 fix: Multi-source analysis - combine top 3 results instead of just 1
      const topMarkdownResults = searchResponse.results.filter(r => r.markdown).slice(0, 3);
      const bestResult = topMarkdownResults[0] || searchResponse.results[0];
      setSelectedResult(bestResult);

      if (!bestResult?.markdown) {
        setStep('complete');
        toast({ 
          title: "Limited content", 
          description: "Found links but could not scrape content. Please visit the URLs manually." 
        });
        return;
      }

      // Concatenate markdown from top 3 results with source markers
      const combinedMarkdown = topMarkdownResults.length > 1
        ? topMarkdownResults.map((r, i) => 
            `--- Source ${i + 1}: ${r.url} ---\n${r.markdown}`
          ).join('\n\n')
        : bestResult.markdown;

      // Step 3: Analyze with AI
      setStep('analyzing');
      
      const analyzeResponse = await applicationFormsApi.analyzeApplicationForm(
        combinedMarkdown,
        universityName,
        programLevel,
        semester,
        year,
        languageTrack,
        bestResult.url
      );

      if (!analyzeResponse.success) {
        throw new Error(analyzeResponse.error || 'Analysis failed');
      }

      if (analyzeResponse.analyzed && analyzeResponse.data) {
        setAnalyzedData(analyzeResponse.data);
        setEditedData(analyzeResponse.data);
        setStep('complete');
        toast({ 
          title: "Analysis complete!", 
          description: `Found ${analyzeResponse.data.programs?.length || 0} programs and ${analyzeResponse.data.requiredDocuments?.length || 0} documents.` 
        });
      } else {
        setStep('complete');
        toast({ 
          title: "Partial results", 
          description: "AI could not extract structured data. Review the raw content." 
        });
      }
    } catch (err) {
      setStep('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({ title: "Search failed", description: errorMessage, variant: "destructive" });
    }
  };

  const handleAnalyzeResult = async (result: ApplicationFormSearchResult) => {
    if (!result.markdown) {
      toast({ title: "No content", description: "This result has no content to analyze.", variant: "destructive" });
      return;
    }

    setSelectedResult(result);
    setStep('analyzing');

    try {
      const universityName = selectedUniversity?.name || universitySearch.trim();
      
      // Multi-source context: include other results as secondary sources
      const otherResults = searchResults
        .filter(r => r.url !== result.url && r.markdown)
        .slice(0, 2);

      const contextMarkdown = otherResults.length > 0
        ? `--- Primary Source: ${result.url} ---\n${result.markdown}\n\n` +
          otherResults.map((r, i) => 
            `--- Secondary Source ${i + 1}: ${r.url} ---\n${r.markdown?.substring(0, 3000)}`
          ).join('\n\n')
        : result.markdown;

      const analyzeResponse = await applicationFormsApi.analyzeApplicationForm(
        contextMarkdown,
        universityName,
        programLevel,
        semester,
        year,
        languageTrack,
        result.url
      );

      if (!analyzeResponse.success) {
        throw new Error(analyzeResponse.error || 'Analysis failed');
      }

      if (analyzeResponse.analyzed && analyzeResponse.data) {
        setAnalyzedData(analyzeResponse.data);
        setEditedData(analyzeResponse.data);
        setStep('complete');
        toast({ title: "Analysis complete!" });
      } else {
        setStep('complete');
        toast({ title: "Partial results", variant: "destructive" });
      }
    } catch (err) {
      setStep('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  };

  const handleImportToDatabase = async () => {
    if (!editedData || !selectedUniversity?.id) {
      toast({ 
        title: "Cannot import", 
        description: "Please select a university from the list to import data.",
        variant: "destructive" 
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Cache the form first
      if (selectedResult) {
        const source = selectedResult.source === 'search' ? 'manual' : selectedResult.source;
        await applicationFormsApi.cacheApplicationForm(
          selectedUniversity.id,
          semester,
          year,
          programLevel,
          selectedResult.url,
          selectedResult.markdown || '',
          editedData,
          source,
          languageTrack
        );
      }

      // Save to database tables (including universities table update)
      const result = await applicationFormsApi.saveAnalyzedDataToDatabase(
        selectedUniversity.id,
        editedData
      );

      setImportResult(result);

      if (result.success) {
        // Refresh cache check
        await checkCachedData();
        
        toast({ 
          title: lang === 'uz' ? "Import muvaffaqiyatli!" : "Import successful!", 
          description: lang === 'uz' 
            ? `${result.imported.programs} dastur, ${result.imported.admissionPeriods} qabul muddati, ${result.imported.requirements} talablar saqlandi.`
            : `Saved ${result.imported.programs} programs, ${result.imported.admissionPeriods} admission periods, ${result.imported.requirements} requirements.${result.imported.universityUpdated ? ' University tuition updated.' : ''}`
        });
      } else {
        toast({ 
          title: "Partial import", 
          description: `Some items failed: ${result.errors?.join(', ')}`,
          variant: "destructive" 
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      toast({ title: "Import failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  // Background job polling
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Refs to avoid stale closures in long-running polling (ISSUE 4 fix)
  const toastRef = useRef(toast);
  const langRef = useRef(lang);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ISSUE 9 FIX: Cancel comprehensive search handler
  const handleCancelSearch = useCallback(async () => {
    if (activeJobId) {
      try {
        await supabase.from('search_jobs')
          .update({ status: 'failed', error: 'Cancelled by user' } as any)
          .eq('id', activeJobId);
      } catch (err) {
        console.error('Failed to cancel search:', err);
      }
      stopPolling();
      setFacultySearching(false);
      setActiveJobId(null);
      setIsComprehensiveSearch(false);
      setComprehensiveProgress(null);
      localStorage.removeItem('activeFacultySearchJobId');
      localStorage.removeItem('isComprehensiveFacultySearch');
      toast({ title: lang === 'uz' ? "Qidiruv bekor qilindi" : "Search cancelled", description: lang === 'uz' ? "Qisman natijalar mavjud bo'lishi mumkin" : "Partial results may be available" });
    }
  }, [activeJobId, stopPolling, lang, toast]);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    setActiveJobId(jobId);
    localStorage.setItem('activeFacultySearchJobId', jobId);

    // ISSUE 10 fix: Exponential backoff for polling (3s → 5s → 8s)
    let pollCount = 0;
    const getInterval = () => {
      if (pollCount < 5) return 3000;
      if (pollCount < 10) return 5000;
      return 8000;
    };

    const poll = async () => {
      try {
        const jobData = await applicationFormsApi.checkSearchJob(jobId);
        if (jobData.status === 'completed' && jobData.result) {
          stopPolling();
          setActiveJobId(null);
          localStorage.removeItem('activeFacultySearchJobId');
          localStorage.removeItem('isComprehensiveFacultySearch');
          
          const response = jobData.result;
          setFacultyResults(response.universities || []);
          if (response.qualitySummary) setFacultyQualitySummary(response.qualitySummary);
          if (response.expandedTerms) setFacultyExpandedTerms(response.expandedTerms);
          setFacultySearching(false);
          setComprehensiveProgress(null);
          setIsComprehensiveSearch(false);
          
          const currentLang = langRef.current;
          if (!response.universities?.length) {
            toastRef.current({ title: currentLang === 'uz' ? "Natija topilmadi" : "No results found", description: response.message || 'No universities found.' });
          } else {
            toastRef.current({ title: currentLang === 'uz' ? "Qidiruv yakunlandi!" : "Search complete!", description: `Found ${response.totalFound} universities` });
            loadSavedSearches();
          }
        } else if (jobData.status === 'failed') {
          stopPolling();
          setActiveJobId(null);
          localStorage.removeItem('activeFacultySearchJobId');
          localStorage.removeItem('isComprehensiveFacultySearch');
          setFacultySearching(false);
          setComprehensiveProgress(null);
          setIsComprehensiveSearch(false);
          // Silently clear stale/expired jobs — don't show an error toast for those
          const isStaleJob = jobData.error?.includes('no longer exists') || jobData.error?.includes('expired');
          if (!isStaleJob) {
            setFacultyError(jobData.error || 'Search failed');
            toastRef.current({ title: "Search failed", description: jobData.error || 'Unknown error', variant: "destructive" });
          }
        } else {
          // Still processing - update progress if available
          if (jobData.progress?.processed !== undefined) {
            setComprehensiveProgress({ processed: jobData.progress.processed, total: jobData.progress.total });
            // Show partial results
            if (jobData.result?.universities?.length) {
              setFacultyResults(jobData.result.universities);
              if (jobData.result.expandedTerms) setFacultyExpandedTerms(jobData.result.expandedTerms);
            }
          }
          // Still processing - schedule next poll with backoff
          pollCount++;
          pollingRef.current = setTimeout(poll, getInterval());
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // If the job no longer exists, stop polling and clean up silently
        if (errMsg.includes('Job not found') || errMsg.includes('no longer exists')) {
          stopPolling();
          setActiveJobId(null);
          setFacultySearching(false);
          setComprehensiveProgress(null);
          setIsComprehensiveSearch(false);
          localStorage.removeItem('activeFacultySearchJobId');
          localStorage.removeItem('isComprehensiveFacultySearch');
          return;
        }
        console.error('Polling error:', err);
        pollCount++;
        pollingRef.current = setTimeout(poll, getInterval());
      }
    };

    pollingRef.current = setTimeout(poll, 3000);
  }, [stopPolling]);

  // Resume polling on mount if there's an active job; also auto-clear stale enrich jobs
  useEffect(() => {
    const savedJobId = localStorage.getItem('activeFacultySearchJobId');
    const savedComprehensive = localStorage.getItem('isComprehensiveFacultySearch');
    if (savedJobId) {
      setFacultySearching(true);
      setActiveJobId(savedJobId);
      if (savedComprehensive === 'true') setIsComprehensiveSearch(true);
      startPolling(savedJobId);
    }

    // Priority 2 fix: Auto-clear stale enrich localStorage keys on mount
    // The enrich job key is checked against the DB; if the job is gone/failed, clear it.
    const enrichJobId = localStorage.getItem('enrichJobId') || localStorage.getItem('ENRICH_STORAGE_KEY');
    if (enrichJobId) {
      supabase.from('search_jobs' as any).select('status').eq('id', enrichJobId).single().then(({ data }: any) => {
        if (!data || data.status === 'failed' || data.status === 'completed') {
          localStorage.removeItem('enrichJobId');
          localStorage.removeItem('ENRICH_STORAGE_KEY');
          localStorage.removeItem('enrichProgress');
        }
      });
    }

    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handleFacultySearch = async (comprehensive: boolean = false) => {
    const faculty = selectedFaculty || facultySearch.trim();
    if (!faculty) {
      toast({ title: t('common.error'), description: "Please select or enter a faculty name", variant: "destructive" });
      return;
    }

    setFacultySearching(true);
    setFacultyError(null);
    setFacultyResults([]);
    setFacultyQualitySummary(null);
    setFacultyExpandedTerms(null);
    setComprehensiveProgress(null);
    setIsComprehensiveSearch(comprehensive);

    try {
      const searchRequest = { faculty, programLevel, semester, year, languageTrack };
      const result = comprehensive
        ? await applicationFormsApi.startComprehensiveFacultySearch(searchRequest)
        : await applicationFormsApi.startFacultySearch(searchRequest);

      if ('error' in result) {
        throw new Error(result.error);
      }

      // Start polling for results
      if (comprehensive) {
        localStorage.setItem('isComprehensiveFacultySearch', 'true');
      }
      startPolling(result.jobId);
      toast({
        title: lang === 'uz' ? "Qidiruv boshlandi" : "Search started",
        description: comprehensive
          ? (lang === 'uz' ? "Barcha universitetlar bo'ylab qidirilmoqda. Bu 10-30 daqiqa davom etishi mumkin." : "Searching ALL universities in database. This may take 10-30 minutes.")
          : (lang === 'uz' ? "Tabni o'zgartirishingiz mumkin -- qidiruv davom etadi" : "You can switch tabs safely -- search continues in background"),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setFacultyError(errorMessage);
      setFacultySearching(false);
      setActiveJobId(null);
      setIsComprehensiveSearch(false);
      localStorage.removeItem('activeFacultySearchJobId');
      localStorage.removeItem('isComprehensiveFacultySearch');
      toast({ title: "Search failed", description: errorMessage, variant: "destructive" });
    }
  };

  const filteredFaculties = presetFaculties.filter(f =>
    f.toLowerCase().includes(facultySearch.toLowerCase())
  );

  const filteredUniversities = universities.filter(u => 
    u.name_en?.toLowerCase().includes(universitySearch.toLowerCase()) ||
    u.name_uz?.toLowerCase().includes(universitySearch.toLowerCase()) ||
    u.name_ko?.includes(universitySearch)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {lang === 'uz' ? "Ariza Shakli Topish" : lang === 'ru' ? "Поиск Формы Заявки" : "Application Form Finder"}
          </h1>
          <p className="text-muted-foreground">
            {lang === 'uz' 
              ? "AI yordamida Koreya universitetlarining ariza shakllarini toping va tahlil qiling"
              : lang === 'ru'
              ? "Найдите и проанализируйте формы заявок корейских университетов с помощью ИИ"
              : "Find and analyze Korean university application forms with AI"
            }
          </p>
        </div>
      </div>

      {/* Search Mode Tabs */}
      <Tabs value={searchMode} onValueChange={(v) => {
        setSearchMode(v as 'university' | 'faculty');
        // Clear error states when switching tabs
        setFacultyError(null);
        setError(null);
      }}>
      <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="university" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {lang === 'uz' ? "Universitet bo'yicha" : "By University"}
          </TabsTrigger>
          <TabsTrigger value="faculty" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {lang === 'uz' ? "Fakultet bo'yicha" : "By Faculty"}
          </TabsTrigger>
          <TabsTrigger value="autosync" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {lang === 'uz' ? "Auto-Sinxronlash" : "Auto-Sync"}
            {admissionSync.changes.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {admissionSync.changes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* By University Tab - existing content */}
        <TabsContent value="university" className="space-y-6">

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {lang === 'uz' ? "Qidiruv" : lang === 'ru' ? "Поиск" : "Search"}
          </CardTitle>
          <CardDescription>
            {lang === 'uz' 
              ? "Universitet nomini kiriting va parametrlarni tanlang"
              : lang === 'ru'
              ? "Введите название университета и выберите параметры"
              : "Enter university name and select parameters"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* University Search */}
          <div className="space-y-2">
            <Label>{lang === 'uz' ? "Universitet" : lang === 'ru' ? "Университет" : "University"}</Label>
            <Popover open={universityOpen} onOpenChange={setUniversityOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={universityOpen}
                  className="w-full justify-between"
                >
                  {selectedUniversity?.name || universitySearch || (lang === 'uz' ? "Universitet tanlang yoki kiriting..." : "Select or enter university...")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder={lang === 'uz' ? "Qidirish..." : "Search..."} 
                    value={universitySearch}
                    onValueChange={setUniversitySearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-2 text-sm">
                        <p className="text-muted-foreground mb-2">
                          {lang === 'uz' ? "Topilmadi. Yangi universitet qidirish:" : "Not found. Search for new university:"}
                        </p>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            setSelectedUniversity(null);
                            setUniversityOpen(false);
                          }}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          {lang === 'uz' ? `"${universitySearch}" qidirish` : `Search "${universitySearch}"`}
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredUniversities.slice(0, 10).map((university) => (
                        <CommandItem
                          key={university.id}
                          value={university.name_en || university.name_uz || ''}
                          onSelect={() => {
                            const displayName = university.name_en || university.name_uz || '';
                            setSelectedUniversity({ id: university.id, name: displayName });
                            setUniversitySearch(displayName);
                            setUniversityOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUniversity?.id === university.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{university.name_en || university.name_uz}</span>
                            {university.name_ko && (
                              <span className="text-xs text-muted-foreground">{university.name_ko}</span>
                            )}
                          </div>
                          {university.is_partner && (
                            <Badge variant="secondary" className="ml-auto">Partner</Badge>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Parameters Grid - ISSUE 8 fix: Shared Filters indicator */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                {lang === 'uz' ? "Umumiy filtrlar" : "Shared Filters"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {lang === 'uz' ? "Filtrlar ikkala tab uchun amal qiladi" : "Filters apply to both University and Faculty tabs"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Program Level */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <GraduationCap className="h-4 w-4" />
                {lang === 'uz' ? "Daraja" : lang === 'ru' ? "Уровень" : "Level"}
              </Label>
              <Select value={programLevel} onValueChange={(v) => setProgramLevel(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="undergraduate">
                    {lang === 'uz' ? "Bakalavr" : lang === 'ru' ? "Бакалавриат" : "Undergraduate"}
                  </SelectItem>
                  <SelectItem value="graduate">
                    {lang === 'uz' ? "Magistratura" : lang === 'ru' ? "Магистратура" : "Graduate"}
                  </SelectItem>
                  <SelectItem value="phd">
                    {lang === 'uz' ? "Doktorantura" : lang === 'ru' ? "Докторантура" : "PhD"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Semester */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {lang === 'uz' ? "Semestr" : lang === 'ru' ? "Семестр" : "Semester"}
              </Label>
              <Select value={semester} onValueChange={(v) => setSemester(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spring">
                    {lang === 'uz' ? "Bahor (Mart)" : lang === 'ru' ? "Весна (Март)" : "Spring (March)"}
                  </SelectItem>
                  <SelectItem value="fall">
                    {lang === 'uz' ? "Kuz (Sentyabr)" : lang === 'ru' ? "Осень (Сентябрь)" : "Fall (September)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {lang === 'uz' ? "Yil" : lang === 'ru' ? "Год" : "Year"}
              </Label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language Track */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Languages className="h-4 w-4" />
                {lang === 'uz' ? "Track" : lang === 'ru' ? "Трек" : "Track"}
              </Label>
              <Select value={languageTrack} onValueChange={(v) => setLanguageTrack(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="korean">
                    {lang === 'uz' ? "Koreys (TOPIK)" : lang === 'ru' ? "Корейский (TOPIK)" : "Korean (TOPIK)"}
                  </SelectItem>
                  <SelectItem value="english">
                    {lang === 'uz' ? "Ingliz (IELTS)" : lang === 'ru' ? "Английский (IELTS)" : "English (IELTS)"}
                  </SelectItem>
                  <SelectItem value="both">
                    {lang === 'uz' ? "Hammasi" : lang === 'ru' ? "Все" : "Both"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cache Indicator */}
          {selectedUniversity?.id && (
            <div className="flex items-center gap-2">
              {checkingCache ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {lang === 'uz' ? "Kesh tekshirilmoqda..." : "Checking cache..."}
                </div>
              ) : cachedData?.hasRecent ? (
                <Alert className={cn(
                  "py-2",
                  cachedData.isStale ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950" : "border-green-500 bg-green-50 dark:bg-green-950"
                )}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {cachedData.isStale ? (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm">
                        {cachedData.isStale 
                          ? (lang === 'uz' ? `Eskirgan kesh (${cachedData.daysSinceScraped} kun)` : `Stale cache (${cachedData.daysSinceScraped} days old)`)
                          : (lang === 'uz' ? `Keshda mavjud (${cachedData.daysSinceScraped} kun oldin)` : `Cached (${cachedData.daysSinceScraped} days ago)`)
                        }
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={loadFromCache}>
                        <Download className="h-4 w-4 mr-1" />
                        {lang === 'uz' ? "Yuklash" : "Load"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleSearch(true)}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {lang === 'uz' ? "Yangilash" : "Refresh"}
                      </Button>
                    </div>
                  </div>
                </Alert>
              ) : null}
            </div>
          )}

          {/* Search Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={() => handleSearch(false)} 
              disabled={step === 'searching' || step === 'analyzing' || step === 'scraping'}
              className="flex-1"
              size="lg"
            >
              {step === 'idle' || step === 'complete' || step === 'error' ? (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {lang === 'uz' ? "Qidirish va Tahlil" : lang === 'ru' ? "Поиск и Анализ" : "Search & Analyze"}
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {stepMessages[step][lang] || stepMessages[step]['en']}
                </>
              )}
            </Button>
            {(step === 'complete' || step === 'error') && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleSearch(true)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress */}
          {step !== 'idle' && step !== 'complete' && step !== 'error' && (
            <div className="space-y-2">
              <Progress value={stepProgress[step]} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {stepMessages[step][lang] || stepMessages[step]['en']}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{lang === 'uz' ? "Xatolik" : lang === 'ru' ? "Ошибка" : "Error"}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {(searchResults.length > 0 || analyzedData) && (
        <Tabs defaultValue={analyzedData ? "analysis" : "sources"} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {lang === 'uz' ? "Manbalar" : lang === 'ru' ? "Источники" : "Sources"}
              {searchResults.length > 0 && <Badge variant="secondary">{searchResults.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2" disabled={!analyzedData}>
              <Sparkles className="h-4 w-4" />
              {lang === 'uz' ? "AI Tahlil" : lang === 'ru' ? "AI Анализ" : "AI Analysis"}
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2" disabled={!analyzedData}>
              <Download className="h-4 w-4" />
              {lang === 'uz' ? "Import" : lang === 'ru' ? "Импорт" : "Import"}
            </TabsTrigger>
          </TabsList>

          {/* Sources Tab */}
          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle>
                  {lang === 'uz' ? "Topilgan Manbalar" : lang === 'ru' ? "Найденные Источники" : "Found Sources"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {searchResults.map((result, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "p-4 border rounded-lg",
                          selectedResult?.url === result.url && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={
                                result.source === 'studyinkorea' ? 'default' :
                                result.source === 'official_website' ? 'secondary' : 'outline'
                              }>
                                {result.source === 'studyinkorea' ? 'Study in Korea' :
                                 result.source === 'official_website' ? 'Official' : 'Web'}
                              </Badge>
                              {result.markdown && (
                                <Badge variant="outline" className="text-green-600">
                                  <FileCheck className="h-3 w-3 mr-1" />
                                  Content
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium truncate">{result.title}</h4>
                            {result.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {result.description}
                              </p>
                            )}
                            <a 
                              href={result.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {result.url}
                            </a>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant={selectedResult?.url === result.url ? "default" : "outline"}
                              onClick={() => handleAnalyzeResult(result)}
                              disabled={!result.markdown || step === 'analyzing'}
                            >
                              {step === 'analyzing' && selectedResult?.url === result.url ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis">
            {analyzedData && (
              <div className="space-y-4">
                {/* Confidence Score + Source URL */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold",
                          analyzedData.confidence >= 80 ? "bg-green-100 text-green-700" :
                          analyzedData.confidence >= 50 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {analyzedData.confidence}%
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {lang === 'uz' ? "Ishonch darajasi" : lang === 'ru' ? "Уровень доверия" : "Confidence Score"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {analyzedData.confidence >= 80 
                              ? (lang === 'uz' ? "Yuqori sifatli ma'lumot" : "High quality data")
                              : analyzedData.confidence >= 50 
                              ? (lang === 'uz' ? "O'rtacha sifat - tekshiring" : "Medium quality - please verify")
                              : (lang === 'uz' ? "Past sifat - qo'lda tekshiring" : "Low quality - manual verification needed")}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                        {isEditing ? (lang === 'uz' ? "Saqlash" : "Save") : (lang === 'uz' ? "Tahrirlash" : "Edit")}
                      </Button>
                    </div>
                    
                    {/* Source Form URL - For Manual Verification */}
                    {(analyzedData.sourceFormUrl || selectedResult?.url) && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <FileCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              {lang === 'uz' ? "Manba hujjat - Qo'lda tekshiring" : "Source Form - Verify Manually"}
                            </p>
                            <a 
                              href={analyzedData.sourceFormUrl || selectedResult?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1 mt-1"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              {analyzedData.sourceFormUrl || selectedResult?.url}
                            </a>
                            <p className="text-xs text-blue-600/70 mt-1">
                              {lang === 'uz' 
                                ? "⚠️ Importdan oldin barcha ma'lumotlarni ushbu manbadan tekshiring"
                                : "⚠️ Please verify all extracted information against this source before importing"
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Warnings */}
                {analyzedData.importantWarnings?.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {lang === 'uz' ? "Muhim ogohlantirishlar" : lang === 'ru' ? "Важные предупреждения" : "Important Warnings"}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {analyzedData.importantWarnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Semester Match Warning */}
                {analyzedData.semesterMatch && !analyzedData.semesterMatch.isMatch && (
                  <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                    <CalendarX className="h-4 w-4" />
                    <AlertTitle>
                      {analyzedData.semesterMatch.notYetAnnounced 
                        ? (lang === 'uz' ? "Hali e'lon qilinmagan" : "Not Yet Announced")
                        : (lang === 'uz' ? "Semestr mos kelmaydi" : "Semester Mismatch")
                      }
                    </AlertTitle>
                    <AlertDescription>
                      {analyzedData.semesterMatch.notYetAnnounced ? (
                        <p>
                          {lang === 'uz' 
                            ? `${analyzedData.semester} ${analyzedData.year} uchun ariza shakli hali e'lon qilinmagan. Ko'rsatilgan ma'lumotlar oldingi semestrdan bo'lishi mumkin.`
                            : `Application form for ${analyzedData.semester} ${analyzedData.year} is not yet announced. The data shown may be from a previous semester.`
                          }
                        </p>
                      ) : (
                        <p>
                          {lang === 'uz'
                            ? `So'ralgan semestr: ${analyzedData.semester} ${analyzedData.year}. ${analyzedData.semesterMatch.reason || ''}`
                            : `Requested: ${analyzedData.semester} ${analyzedData.year}. ${analyzedData.semesterMatch.reason || ''}`
                          }
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Faculty Tuition Breakdown */}
                {analyzedData.facultyTuitionBreakdown && analyzedData.facultyTuitionBreakdown.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {lang === 'uz' ? "Fakultetlar bo'yicha to'lovlar" : lang === 'ru' ? "Оплата по факультетам" : "Tuition by Faculty"}
                        <Badge variant="secondary">{analyzedData.facultyTuitionBreakdown.length}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {lang === 'uz' 
                          ? "Koreya universitetlarida to'lov miqdori fakultetga qarab farq qiladi"
                          : "Korean universities typically have different tuition fees per faculty/college"
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[250px]">
                        <div className="space-y-3">
                          {analyzedData.facultyTuitionBreakdown.map((faculty, index) => (
                            <div key={index} className="p-3 border rounded-lg bg-muted/30">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">{faculty.facultyName}</h4>
                                  {faculty.facultyNameKo && (
                                    <p className="text-sm text-muted-foreground">{faculty.facultyNameKo}</p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  {faculty.availableTracks.includes('korean') && (
                                    <Badge variant="default" className="text-xs">Korean</Badge>
                                  )}
                                  {faculty.availableTracks.includes('english') && (
                                    <Badge variant="secondary" className="text-xs">English</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                                {faculty.tuitionPerSemester && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">₩{Number(faculty.tuitionPerSemester).toLocaleString()}</span>
                                    <span className="text-muted-foreground">/semester</span>
                                  </div>
                                )}
                                {faculty.tuitionPerYear && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">or</span>
                                    <span className="font-medium">₩{Number(faculty.tuitionPerYear).toLocaleString()}</span>
                                    <span className="text-muted-foreground">/year</span>
                                  </div>
                                )}
                                {faculty.admissionFee && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Admission:</span>
                                    <span>₩{faculty.admissionFee.toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                              {faculty.notes && (
                                <p className="text-xs text-muted-foreground mt-2">{faculty.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {/* Track Availability Summary */}
                {analyzedData.trackAvailabilitySummary && (
                  (analyzedData.trackAvailabilitySummary.englishTrackFaculties?.length > 0 || 
                   analyzedData.trackAvailabilitySummary.koreanTrackFaculties?.length > 0) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Languages className="h-5 w-5" />
                          {lang === 'uz' ? "Track bo'yicha fakultetlar" : lang === 'ru' ? "Факультеты по трекам" : "Faculties by Track"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* English Track */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">English Track</Badge>
                              <span className="text-sm text-muted-foreground">
                                ({(analyzedData.trackAvailabilitySummary.englishTrackFaculties?.length || 0) + 
                                  (analyzedData.trackAvailabilitySummary.bothTracksFaculties?.length || 0)} faculties)
                              </span>
                            </div>
                            <ul className="text-sm space-y-1">
                              {analyzedData.trackAvailabilitySummary.englishTrackFaculties?.map((f, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {f}
                                  <Badge variant="outline" className="text-xs">English only</Badge>
                                </li>
                              ))}
                              {analyzedData.trackAvailabilitySummary.bothTracksFaculties?.map((f, i) => (
                                <li key={`both-${i}`} className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Korean Track */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Korean Track</Badge>
                              <span className="text-sm text-muted-foreground">
                                ({(analyzedData.trackAvailabilitySummary.koreanTrackFaculties?.length || 0) + 
                                  (analyzedData.trackAvailabilitySummary.bothTracksFaculties?.length || 0)} faculties)
                              </span>
                            </div>
                            <ul className="text-sm space-y-1">
                              {analyzedData.trackAvailabilitySummary.koreanTrackFaculties?.map((f, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                  {f}
                                  <Badge variant="outline" className="text-xs">Korean only</Badge>
                                </li>
                              ))}
                              {analyzedData.trackAvailabilitySummary.bothTracksFaculties?.map((f, i) => (
                                <li key={`both-k-${i}`} className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}

                {/* Programs - Grouped by Faculty */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {lang === 'uz' ? "Dasturlar" : lang === 'ru' ? "Программы" : "Programs"}
                      <Badge>{analyzedData.programs?.length || 0}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyzedData.programs?.length > 0 ? (
                      <ScrollArea className="h-[350px]">
                        <div className="space-y-4">
                          {/* Group programs by faculty */}
                          {Object.entries(
                            analyzedData.programs.reduce((acc, program) => {
                              const faculty = program.facultyName || 'Other';
                              if (!acc[faculty]) acc[faculty] = [];
                              acc[faculty].push(program);
                              return acc;
                            }, {} as Record<string, ProgramInfo[]>)
                          ).map(([facultyName, programs]) => (
                            <div key={facultyName} className="space-y-2">
                              <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{facultyName}</h4>
                                <Badge variant="outline" className="text-xs">{programs.length}</Badge>
                              </div>
                              <div className="pl-6 space-y-2">
                                {programs.map((program, index) => (
                                  <div key={index} className="p-3 border rounded-lg">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <h5 className="font-medium">{program.programName}</h5>
                                        {program.departmentName && (
                                          <p className="text-xs text-muted-foreground">{program.departmentName}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={program.languageTrack === 'korean' ? 'default' : program.languageTrack === 'english' ? 'secondary' : 'outline'}>
                                          {program.languageTrack === 'korean' ? 'Korean' : program.languageTrack === 'english' ? 'English' : 'Both'}
                                        </Badge>
                                        {program.isAvailableForInternational ? (
                                          <span title="Available for international students">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          </span>
                                        ) : (
                                          <span title="Not available for international students">
                                            <XCircle className="h-4 w-4 text-red-500" />
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Language Requirements */}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {program.topikRequirement && (
                                        <Badge variant="default" className="text-xs">TOPIK {program.topikRequirement}</Badge>
                                      )}
                                      {program.ieltsRequirement && (
                                        <Badge variant="secondary" className="text-xs">IELTS {program.ieltsRequirement}</Badge>
                                      )}
                                      {program.toeflRequirement && (
                                        <Badge variant="outline" className="text-xs">TOEFL {program.toeflRequirement}</Badge>
                                      )}
                                      {program.minimumGPA && (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                          Min GPA: {program.minimumGPA}
                                        </Badge>
                                      )}
                                      {program.tuitionPerSemester && (
                                        <span className="text-xs text-muted-foreground">
                                          ₩{Number(program.tuitionPerSemester).toLocaleString()}/sem
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Alternative Language Certifications */}
                                    {program.languageAlternatives && program.languageAlternatives.length > 0 && (
                                      <div className="mt-2">
                                        <span className="text-xs text-muted-foreground">
                                          {lang === 'uz' ? "Muqobil sertifikatlar: " : "Alternative certs: "}
                                        </span>
                                        <span className="text-xs text-green-600">
                                          {program.languageAlternatives.join(', ')}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Unique Requirements */}
                                    {((program.uniqueRequirements && program.uniqueRequirements.length > 0) || 
                                      program.interviewRequired || 
                                      program.portfolioRequired || 
                                      program.practicalTestRequired) && (
                                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                                          {lang === 'uz' ? "Maxsus talablar:" : "Special Requirements:"}
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                          {program.interviewRequired && (
                                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                              {lang === 'uz' ? "Suhbat talab" : "Interview Required"}
                                            </Badge>
                                          )}
                                          {program.portfolioRequired && (
                                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                              {lang === 'uz' ? "Portfolio talab" : "Portfolio Required"}
                                            </Badge>
                                          )}
                                          {program.practicalTestRequired && (
                                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                              {lang === 'uz' ? "Amaliy imtihon" : "Practical Test"}
                                            </Badge>
                                          )}
                                        </div>
                                        {program.uniqueRequirements && program.uniqueRequirements.length > 0 && (
                                          <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside">
                                            {program.uniqueRequirements.map((req, i) => (
                                              <li key={i}>{req}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                    
                                    {program.notes && (
                                      <p className="text-xs text-muted-foreground mt-2 italic">{program.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        {lang === 'uz' ? "Dasturlar topilmadi" : "No programs found"}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Deadlines & Fees */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {lang === 'uz' ? "Muddatlar" : lang === 'ru' ? "Сроки" : "Deadlines"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analyzedData.deadlines?.applicationStart && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Application Start</span>
                          <span className="font-medium">{analyzedData.deadlines.applicationStart}</span>
                        </div>
                      )}
                      {analyzedData.deadlines?.applicationEnd && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Application End</span>
                          <span className="font-medium">{analyzedData.deadlines.applicationEnd}</span>
                        </div>
                      )}
                      {analyzedData.deadlines?.documentDeadline && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Document Deadline</span>
                          <span className="font-medium">{analyzedData.deadlines.documentDeadline}</span>
                        </div>
                      )}
                      {analyzedData.deadlines?.resultAnnouncement && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Results</span>
                          <span className="font-medium">{analyzedData.deadlines.resultAnnouncement}</span>
                        </div>
                      )}
                      {!analyzedData.deadlines?.applicationStart && !analyzedData.deadlines?.applicationEnd && (
                        <p className="text-muted-foreground text-center py-2">No deadline information found</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        {lang === 'uz' ? "To'lovlar" : lang === 'ru' ? "Оплата" : "Fees"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analyzedData.fees?.applicationFeeKRW && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Application Fee</span>
                          <span className="font-medium">₩{analyzedData.fees.applicationFeeKRW.toLocaleString()}</span>
                        </div>
                      )}
                      {analyzedData.fees?.tuitionPerSemester && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tuition/Semester</span>
                          <span className="font-medium">₩{analyzedData.fees.tuitionPerSemester.toLocaleString()}</span>
                        </div>
                      )}
                      {analyzedData.fees?.tuitionPerYear && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tuition/Year</span>
                          <span className="font-medium">₩{analyzedData.fees.tuitionPerYear.toLocaleString()}</span>
                        </div>
                      )}
                      {!analyzedData.fees?.applicationFeeKRW && !analyzedData.fees?.tuitionPerSemester && (
                        <p className="text-muted-foreground text-center py-2">No fee information found</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Required Documents */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {lang === 'uz' ? "Talab qilinadigan hujjatlar" : lang === 'ru' ? "Требуемые документы" : "Required Documents"}
                      <Badge>{analyzedData.requiredDocuments?.length || 0}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyzedData.requiredDocuments?.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-2">
                        {analyzedData.requiredDocuments.map((doc, index) => (
                          <div 
                            key={index} 
                            className={cn(
                              "p-2 rounded border flex items-start gap-2",
                              doc.isRequired ? "bg-muted/50" : "bg-background"
                            )}
                          >
                            {doc.isRequired ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{doc.documentName}</p>
                              {doc.notes && (
                                <p className="text-xs text-muted-foreground">{doc.notes}</p>
                              )}
                              {doc.trackSpecific && doc.trackSpecific !== 'both' && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {doc.trackSpecific === 'korean' ? 'Korean Track' : 'English Track'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        {lang === 'uz' ? "Hujjatlar topilmadi" : "No documents found"}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Special Notes */}
                {analyzedData.specialNotes?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        {lang === 'uz' ? "Maxsus eslatmalar" : lang === 'ru' ? "Особые примечания" : "Special Notes"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {analyzedData.specialNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  {lang === 'uz' ? "Ma'lumotlar bazasiga import" : lang === 'ru' ? "Импорт в базу данных" : "Import to Database"}
                </CardTitle>
                <CardDescription>
                  {lang === 'uz' 
                    ? "AI tahlil natijalarini universitet ma'lumotlar bazasiga saqlang"
                    : "Save AI analysis results to the university database"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedUniversity?.id && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {lang === 'uz' ? "Universitet tanlanmagan" : "No university selected"}
                    </AlertTitle>
                    <AlertDescription>
                      {lang === 'uz' 
                        ? "Import qilish uchun ro'yxatdan universitet tanlang"
                        : "Please select a university from the list to enable import"
                      }
                    </AlertDescription>
                  </Alert>
                )}

                {/* Import Success Result */}
                {importResult && (
                  <Alert className={cn(
                    importResult.success ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                  )}>
                    {importResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    <AlertTitle>
                      {importResult.success 
                        ? (lang === 'uz' ? "Import muvaffaqiyatli!" : "Import Successful!")
                        : (lang === 'uz' ? "Qisman import" : "Partial Import")
                      }
                    </AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          <span>{importResult.imported.programs} {lang === 'uz' ? "dastur" : "programs"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{importResult.imported.admissionPeriods} {lang === 'uz' ? "muddat" : "periods"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{importResult.imported.requirements} {lang === 'uz' ? "talablar" : "requirements"}</span>
                        </div>
                        {importResult.imported.universityUpdated && (
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-green-600" />
                            <span>{lang === 'uz' ? "To'lov yangilandi" : "Tuition updated"}</span>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {analyzedData && (
                  <div className="space-y-4">
                    {/* What will be imported */}
                    <div>
                      <h4 className="font-medium mb-3">
                        {lang === 'uz' ? "Import qilinadigan ma'lumotlar:" : "Data to be imported:"}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-4 border rounded-lg">
                          <p className="text-2xl font-bold text-primary">{analyzedData.programs?.length || 0}</p>
                          <p className="text-sm text-muted-foreground">
                            {lang === 'uz' ? "Dasturlar" : "Programs"}
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-2xl font-bold text-primary">{analyzedData.requiredDocuments?.length || 0}</p>
                          <p className="text-sm text-muted-foreground">
                            {lang === 'uz' ? "Hujjatlar" : "Documents"}
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-2xl font-bold text-primary">
                            {Object.values(analyzedData.deadlines || {}).filter(Boolean).length}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {lang === 'uz' ? "Muddatlar" : "Deadlines"}
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-2xl font-bold text-primary">{analyzedData.confidence}%</p>
                          <p className="text-sm text-muted-foreground">
                            {lang === 'uz' ? "Ishonch" : "Confidence"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tables that will be updated */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">
                        {lang === 'uz' ? "Yangilanadigan jadvallar:" : "Tables to be updated:"}
                      </h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          universities ({lang === 'uz' ? "to'lov diapazoni" : "tuition range"})
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          university_programs ({analyzedData.programs?.length || 0} {lang === 'uz' ? "ta" : "entries"})
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          university_admission_periods ({lang === 'uz' ? "muddatlar va to'lovlar" : "deadlines & fees"})
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          university_requirements ({lang === 'uz' ? "hujjatlar ro'yxati" : "document checklist"})
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          application_form_cache ({lang === 'uz' ? "qayta qidiruvni oldini olish" : "avoid re-scraping"})
                        </li>
                      </ul>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>
                        {lang === 'uz' ? "Qo'shimcha eslatmalar" : lang === 'ru' ? "Дополнительные заметки" : "Additional Notes"}
                      </Label>
                      <Textarea
                        placeholder={lang === 'uz' ? "Xodim eslatmalari..." : "Staff notes..."}
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Button 
                      onClick={handleImportToDatabase}
                      disabled={!selectedUniversity?.id || isImporting}
                      className="w-full"
                      size="lg"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {lang === 'uz' ? "Import qilinmoqda..." : "Importing..."}
                        </>
                      ) : importResult?.success ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {lang === 'uz' ? "Qayta import" : "Re-import"}
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          {lang === 'uz' ? "Ma'lumotlar bazasiga saqlash" : "Save to Database"}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

        </TabsContent>

        {/* By Faculty Tab */}
        <TabsContent value="faculty" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {lang === 'uz' ? "Fakultet bo'yicha qidirish" : "Search by Faculty"}
              </CardTitle>
              <CardDescription>
                {lang === 'uz' 
                  ? "Fakultet nomini tanlang — barcha universitetlar bo'ylab qidiriladi"
                  : "Select a faculty — searches across all Korean universities"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Faculty Combobox */}
              <div className="space-y-2">
                <Label>{lang === 'uz' ? "Fakultet" : "Faculty"}</Label>
                <Popover open={facultyOpen} onOpenChange={setFacultyOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={facultyOpen}
                      className="w-full justify-between"
                    >
                      {selectedFaculty || facultySearch || (lang === 'uz' ? "Fakultet tanlang yoki yozing..." : "Select or type faculty...")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder={lang === 'uz' ? "Qidirish..." : "Search..."} 
                        value={facultySearch}
                        onValueChange={setFacultySearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2 text-sm">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="w-full"
                              onClick={() => {
                                setSelectedFaculty(facultySearch);
                                setFacultyOpen(false);
                              }}
                            >
                              <Search className="h-4 w-4 mr-2" />
                              {lang === 'uz' ? `"${facultySearch}" qidirish` : `Use "${facultySearch}"`}
                            </Button>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredFaculties.map((faculty) => (
                            <CommandItem
                              key={faculty}
                              value={faculty}
                              onSelect={() => {
                                setSelectedFaculty(faculty);
                                setFacultySearch(faculty);
                                setFacultyOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedFaculty === faculty ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {faculty}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Shared Parameters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {lang === 'uz' ? "Daraja" : "Level"}
                  </Label>
                  <Select value={programLevel} onValueChange={(v) => setProgramLevel(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="undergraduate">{lang === 'uz' ? "Bakalavr" : "Undergraduate"}</SelectItem>
                      <SelectItem value="graduate">{lang === 'uz' ? "Magistratura" : "Graduate"}</SelectItem>
                      <SelectItem value="phd">{lang === 'uz' ? "Doktorantura" : "PhD"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {lang === 'uz' ? "Semestr" : "Semester"}
                  </Label>
                  <Select value={semester} onValueChange={(v) => setSemester(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spring">{lang === 'uz' ? "Bahor" : "Spring"}</SelectItem>
                      <SelectItem value="fall">{lang === 'uz' ? "Kuz" : "Fall"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {lang === 'uz' ? "Yil" : "Year"}
                  </Label>
                  <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Languages className="h-4 w-4" />
                    {lang === 'uz' ? "Track" : "Track"}
                  </Label>
                  <Select value={languageTrack} onValueChange={(v) => setLanguageTrack(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="korean">{lang === 'uz' ? "Koreys" : "Korean"}</SelectItem>
                      <SelectItem value="english">{lang === 'uz' ? "Ingliz" : "English"}</SelectItem>
                      <SelectItem value="both">{lang === 'uz' ? "Hammasi" : "Both"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Future year warning */}
              {year >= currentYear + 2 && (
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle>
                    {lang === 'uz' ? "Kelajakdagi yil ogohlantirishi" : "Future Year Warning"}
                  </AlertTitle>
                  <AlertDescription>
                    {lang === 'uz'
                      ? `${year}-yil uchun ma'lumotlar hali e'lon qilinmagan bo'lishi mumkin. Natijalar oldingi yillardan bo'lishi ehtimoli bor.`
                      : `Data for ${year} may not yet be published. Results might be based on previous years' information.`
                    }
                  </AlertDescription>
                </Alert>
              )}


              {/* Priority 5: Prerequisite Warning for Comprehensive Search */}
              {!facultySearching && universities.length > 0 && universitiesWithWebsite < universities.length * 0.5 && (
                <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 dark:text-amber-300">
                    {lang === 'uz' ? "Keng qidiruv uchun tavsiya" : "Prerequisite for Best Results"}
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    {lang === 'uz'
                      ? `Faqat ${universitiesWithWebsite} ta universitetda veb-sayt ma'lumoti bor (${universities.length} tadan). "Barcha universitetlarni qidirish" veb-saytlari mavjud universitetlarni ko'rib chiqadi. Natijalar sifatini yaxshilash uchun avval Universitetlar sahifasida "Veb-saytlarni boyitish"ni ishga tushiring.`
                      : `Only ${universitiesWithWebsite} of ${universities.length} universities have website data. "Search All Universities" will only scan those with websites. For best results, run "Re-enrich Websites" on the Universities page first.`
                    }
                  </AlertDescription>
                </Alert>
              )}

              {/* Search Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleFacultySearch(false)} 
                  disabled={facultySearching}
                  className="flex-1"
                  size="lg"
                >
                  {facultySearching && !isComprehensiveSearch ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {lang === 'uz' ? "Qidirilmoqda..." : "Searching..."}
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      {lang === 'uz' ? "Tez qidirish" : "Quick Search"}
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => handleFacultySearch(true)} 
                  disabled={facultySearching}
                  variant="secondary"
                  className="flex-1"
                  size="lg"
                >
                  {facultySearching && isComprehensiveSearch ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {lang === 'uz' ? "Barcha universitetlar..." : "Searching all..."}
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      {lang === 'uz'
                        ? `Barcha universitetlarni qidirish (${universitiesWithWebsite}/${universities.length})`
                        : `Search All Universities (${universitiesWithWebsite}/${universities.length} with websites)`
                      }
                    </>
                  )}
                </Button>
              </div>

              {/* Comprehensive search progress */}
              {isComprehensiveSearch && comprehensiveProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {lang === 'uz' 
                        ? `${comprehensiveProgress.processed} / ${comprehensiveProgress.total} ta universitetlar tekshirildi`
                        : `Searched ${comprehensiveProgress.processed} of ${comprehensiveProgress.total} universities`
                      }
                    </span>
                    <span className="font-medium">
                      {facultyResults.length > 0 
                        ? (lang === 'uz' ? `${facultyResults.length} ta natija topildi` : `${facultyResults.length} results found`)
                        : (lang === 'uz' ? "Hali natija yo'q" : "No results yet")
                      }
                    </span>
                  </div>
                  <Progress value={comprehensiveProgress.total > 0 ? (comprehensiveProgress.processed / comprehensiveProgress.total) * 100 : 0} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {lang === 'uz' 
                        ? "💡 Bu sahifani yopishingiz mumkin — qidiruv davom etadi va natijalar saqlanadi."
                        : "💡 You can close this page — search continues and results are saved."
                      }
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelSearch}
                    >
                      {lang === 'uz' ? "Bekor qilish" : "Cancel"}
                    </Button>
                  </div>
                </div>
              )}

              {facultyError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{lang === 'uz' ? "Xatolik" : "Error"}</AlertTitle>
                  <AlertDescription>{facultyError}</AlertDescription>
                </Alert>
              )}
              {/* Saved Searches */}
              {savedFacultySearches.length > 0 && (
                <Collapsible open={savedSearchesOpen} onOpenChange={setSavedSearchesOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        {lang === 'uz' ? `Saqlangan qidiruvlar (${savedFacultySearches.length})` : `Saved Searches (${savedFacultySearches.length})`}
                      </span>
                      {savedSearchesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {savedFacultySearches.map((saved) => {
                      const req = saved.request || {};
                      const res = saved.result || {};
                      const resultCount = res.universities?.length || res.totalFound || 0;
                      const date = new Date(saved.created_at).toLocaleDateString();
                      return (
                        <div key={saved.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="font-medium">{req.faculty || '—'}</Badge>
                              <span className="text-xs text-muted-foreground capitalize">{req.programLevel}</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground capitalize">{req.semester} {req.year}</span>
                              {req.languageTrack && req.languageTrack !== 'both' && (
                                <>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground capitalize">{req.languageTrack}</span>
                                </>
                              )}
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs font-medium">{resultCount} {lang === 'uz' ? 'natija' : 'results'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{date}</p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button variant="outline" size="sm" onClick={() => loadSavedResult(saved)}>
                              {lang === 'uz' ? "Yuklash" : "Load"}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteSavedSearch(saved.id)}
                              disabled={deletingSearchId === saved.id}
                            >
                              {deletingSearchId === saved.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>


          {facultyExpandedTerms && (
            <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30">
              <Wand2 className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-sm font-medium">
                {lang === 'uz' ? "Aqlli qidiruv" : "Smart Search"}
              </AlertTitle>
              <AlertDescription>
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-muted/50 font-normal">
                      {facultyExpandedTerms.originalQuery}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    {facultyExpandedTerms.englishTerms.map((term, i) => (
                      <Badge key={i} variant="secondary" className="font-medium">{term}</Badge>
                    ))}
                  </div>
                  {facultyExpandedTerms.koreanTerms.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">🇰🇷</span>
                      {facultyExpandedTerms.koreanTerms.map((term, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{term}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                {facultyResults.length === 0 && !facultySearching && facultyExpandedTerms.englishTerms.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {lang === 'uz' 
                      ? "💡 Maslahat: Aniqroq natija uchun rasmiy fakultet nomini yozing, masalan: " 
                      : "💡 Tip: For better results, try the official faculty name: "}
                    <span className="font-medium">{facultyExpandedTerms.primaryTerm}</span>
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Quality Summary */}
          {facultyQualitySummary && facultyResults.length > 0 && (
            <div className="space-y-3">
              {/* Low quality warning */}
              {facultyQualitySummary.averageConfidence < 0.5 && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>
                    {lang === 'uz' ? "Past sifatli natijalar" : "Low Quality Results"}
                  </AlertTitle>
                  <AlertDescription>
                    {lang === 'uz' 
                      ? `O'rtacha ishonchlilik: ${Math.round(facultyQualitySummary.averageConfidence * 100)}%. Natijalarni qo'lda tekshiring.`
                      : `Average confidence: ${Math.round(facultyQualitySummary.averageConfidence * 100)}%. Please verify results manually.`
                    }
                  </AlertDescription>
                </Alert>
              )}

              {/* Quality metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-lg font-bold text-primary">{facultyQualitySummary.verifiedCount}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-green-600" />
                    {lang === 'uz' ? "Tasdiqlangan" : "Verified"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-lg font-bold text-yellow-600">{facultyQualitySummary.reviewCount}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Info className="h-3 w-3 text-yellow-600" />
                    {lang === 'uz' ? "Tekshiring" : "Review"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-lg font-bold text-destructive">{facultyQualitySummary.unverifiedCount}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" />
                    {lang === 'uz' ? "Tasdiqlanmagan" : "Unverified"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-lg font-bold">{Math.round(facultyQualitySummary.averageConfidence * 100)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'uz' ? "O'rtacha" : "Avg Confidence"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-lg font-bold">{facultyQualitySummary.officialSourceCount}/{facultyQualitySummary.sourcesUsed}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Globe className="h-3 w-3" />
                    {lang === 'uz' ? "Rasmiy manbalar" : "Official Sources"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Faculty Results Table */}
          {facultyResults.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {lang === 'uz' 
                      ? `Natijalar: ${facultyResults.length} ta universitet` 
                      : `Results: ${facultyResults.length} universities`
                    }
                  </CardTitle>
                  <CardDescription>
                    {lang === 'uz' 
                      ? `"${selectedFaculty || facultySearch}" fakulteti uchun taqqoslash jadvali`
                      : `Comparison table for "${selectedFaculty || facultySearch}" faculty`
                    }
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    generateFacultyResultsPdf(
                      facultyResults,
                      {
                        faculty: selectedFaculty || facultySearch,
                        programLevel,
                        semester,
                        year,
                        languageTrack,
                      },
                      facultyQualitySummary
                    );
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {lang === 'uz' ? 'PDF yuklash' : 'Download PDF'}
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === 'uz' ? "Universitet" : "University"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Tuition (KRW)" : "Tuition (KRW)"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Deadline" : "Deadline"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Til treklari" : "Tracks"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Talablar" : "Requirements"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Maxsus" : "Special"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Ishonchlilik" : "Confidence"}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facultyResults.map((uni, idx) => (
                        <TableRow key={idx} className={uni.yearMismatch ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium">
                            <div>
                              <span>{uni.universityName}</span>
                              {uni.universityNameKo && (
                                <span className="block text-xs text-muted-foreground">{uni.universityNameKo}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                   <span className={uni.validationFlags?.some(f => f.includes('tuition')) ? 'text-destructive font-medium' : ''}>
                                    {uni.tuitionPerSemester 
                                      ? `₩${Number(uni.tuitionPerSemester).toLocaleString()}/sem` 
                                      : uni.tuitionPerYear 
                                        ? `₩${Number(uni.tuitionPerYear).toLocaleString()}/yr` 
                                        : uni.notes?.match(/tuition|등록금|수업료|fee.{0,10}schedule|학비/i)
                                          ? <span className="text-xs text-muted-foreground italic">See notes</span>
                                          : '-'
                                    }
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {uni.sourceUrl 
                                    ? <span className="text-xs">Source: {(() => { try { return new URL(uni.sourceUrl).hostname; } catch { return 'Unknown source'; } })()}</span>
                                    : <span className="text-xs">No source URL</span>
                                  }
                                  {uni.validationFlags?.some(f => f.includes('tuition')) && (
                                    <span className="block text-xs text-destructive">⚠ Value outside normal KRW range</span>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{uni.applicationDeadline || '-'}</span>
                              {uni.yearMismatch && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <CalendarX className="h-3.5 w-3.5 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <span className="text-xs">Year may not match requested period</span>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {uni.validationFlags?.includes('expired_deadline') && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Clock className="h-3.5 w-3.5 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <span className="text-xs">{lang === 'uz' ? "Muddati o'tgan deadline" : "Expired deadline"}</span>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {uni.validationFlags?.includes('vague_deadline') && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <span className="text-xs">{lang === 'uz' ? "Noaniq deadline formati" : "Vague deadline format"}</span>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {uni.languageTracks?.map((track, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {track === 'english' ? '🇬🇧 EN' : track === 'korean' ? '🇰🇷 KO' : track}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap text-xs">
                              {uni.topikRequirement && <Badge variant="secondary">TOPIK {uni.topikRequirement}</Badge>}
                              {uni.ieltsRequirement && <Badge variant="secondary">IELTS {uni.ieltsRequirement}</Badge>}
                              {uni.toeflRequirement && <Badge variant="secondary">TOEFL {uni.toeflRequirement}</Badge>}
                              {!uni.topikRequirement && !uni.ieltsRequirement && !uni.toeflRequirement && '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap text-xs">
                              {uni.interviewRequired && <Badge variant="destructive">Interview</Badge>}
                              {uni.portfolioRequired && <Badge variant="destructive">Portfolio</Badge>}
                              {uni.uniqueRequirements?.map((req, i) => (
                                <Badge key={i} variant="outline">{req}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    {uni.confidence >= 0.8 ? (
                                      <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                                    ) : uni.confidence >= 0.6 ? (
                                      <Info className="h-3.5 w-3.5 text-yellow-600" />
                                    ) : (
                                      <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                                    )}
                                    <Badge 
                                      variant={uni.confidence >= 0.8 ? 'success' : uni.confidence >= 0.6 ? 'secondary' : 'destructive'}
                                      className="text-xs"
                                    >
                                      {uni.confidence >= 0.8 
                                        ? (lang === 'uz' ? 'Tasdiqlangan' : 'Verified')
                                        : uni.confidence >= 0.6 
                                          ? (lang === 'uz' ? 'Tekshiring' : 'Review')
                                          : (lang === 'uz' ? 'Tasdiqlanmagan' : 'Unverified')
                                      }
                                      {' '}{Math.round(uni.confidence * 100)}%
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    {uni.validationFlags?.length ? (
                                      <>
                                        <span className="font-medium">Validation issues:</span>
                                        {uni.validationFlags.map((f, i) => (
                                          <span key={i} className="block">• {f.replace(/_/g, ' ')}</span>
                                        ))}
                                      </>
                                    ) : (
                                      <span>All data within expected ranges</span>
                                    )}
                                    {uni.dataSource === 'unverified' && (
                                      <span className="block text-destructive">Data not verified against database</span>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            {uni.sourceUrl && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={uni.sourceUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">{uni.sourceUrl}</span>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Auto-Sync Tab */}
        <TabsContent value="autosync" className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className={`h-5 w-5 ${admissionSync.activeJob ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                    {lang === 'uz' ? "Avtomatik Sinxronlash" : "Automatic Daily Sync"}
                  </CardTitle>
                  <CardDescription>
                    {lang === 'uz'
                      ? "Tizimidagi barcha universitetlar (448 ta) uchun har kuni 02:00 UTC da avtomatik tekshiriladi"
                      : "All universities in system (~448) are automatically scanned daily at 02:00 UTC"}
                  </CardDescription>
                </div>
                <Button
                  onClick={() => admissionSync.startSync()}
                  disabled={admissionSync.starting || !!admissionSync.activeJob}
                  className="shrink-0"
                >
                  {admissionSync.starting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />{lang === 'uz' ? "Boshlanmoqda..." : "Starting..."}</>
                  ) : admissionSync.activeJob ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />{lang === 'uz' ? "Ishlamoqda..." : "Running..."}</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />{lang === 'uz' ? "Hozir boshlash" : "Run Sync Now"}</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active progress */}
              {admissionSync.activeJob && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {lang === 'uz' ? "Jarayon:" : "Progress:"}
                    </span>
                    <span className="font-medium">
                      {admissionSync.activeJob.processed} / {admissionSync.activeJob.total} {lang === 'uz' ? "universitet" : "universities"}
                    </span>
                  </div>
                  <Progress value={admissionSync.progressPct} className="h-2" />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400">✓ {admissionSync.activeJob.found} {lang === 'uz' ? "topildi" : "found"}</span>
                    <span className="text-destructive">✗ {admissionSync.activeJob.failed} {lang === 'uz' ? "topilmadi" : "not found"}</span>
                  </div>
                </div>
              )}

              {/* Last completed job stats */}
              {!admissionSync.activeJob && admissionSync.lastJob && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-foreground">{admissionSync.lastJob.processed}</div>
                    <div className="text-xs text-muted-foreground mt-1">{lang === 'uz' ? "Tekshirildi" : "Scanned"}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{admissionSync.lastJob.found}</div>
                    <div className="text-xs text-muted-foreground mt-1">{lang === 'uz' ? "Topildi" : "Found"}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-destructive">{admissionSync.lastJob.failed}</div>
                    <div className="text-xs text-muted-foreground mt-1">{lang === 'uz' ? "Topilmadi" : "Not Found"}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1">
                      {admissionSync.lastJob.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : admissionSync.lastJob.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{admissionSync.lastJob.status}</div>
                  </div>
                </div>
              )}

              {!admissionSync.activeJob && admissionSync.lastJob && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lang === 'uz' ? "Oxirgi sinxronlash:" : "Last sync:"}
                    {' '}{new Date(admissionSync.lastJob.started_at).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {lang === 'uz' ? "Keyingi: har kuni 02:00 UTC" : "Next: daily at 02:00 UTC"}
                  </div>
                </div>
              )}

              {!admissionSync.loading && !admissionSync.lastJob && (
                <div className="text-center py-6 text-muted-foreground">
                  <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{lang === 'uz' ? "Hali sinxronlash amalga oshirilmagan. Hozir boshlash uchun tugmani bosing." : "No sync has been run yet. Click 'Run Sync Now' to start scanning all universities."}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Changes Inbox */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {lang === 'uz' ? "O'zgarishlar Xabarnomasi" : "Changes Inbox"}
                    {admissionSync.changes.length > 0 && (
                      <Badge variant="destructive" className="ml-2">{admissionSync.changes.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {lang === 'uz'
                      ? "Univeristetlar ariza talablarida aniqlangan o'zgarishlar"
                      : "Detected changes in university admission requirements since last scan"}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={admissionSync.reloadChanges}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {admissionSync.changes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-green-500" />
                  <p className="text-sm">{lang === 'uz' ? "Yangi o'zgarishlar yo'q" : "No unacknowledged changes"}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === 'uz' ? "Universitet" : "University"}</TableHead>
                        <TableHead>{lang === 'uz' ? "O'zgarish turi" : "Change"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Eski qiymat" : "Old Value"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Yangi qiymat" : "New Value"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Aniqlandi" : "Detected"}</TableHead>
                        <TableHead>{lang === 'uz' ? "Muhimlik" : "Severity"}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admissionSync.changes.map((change) => (
                        <TableRow key={change.id}>
                          <TableCell className="font-medium text-xs">{change.university_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {change.change_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-32 truncate" title={change.old_value ?? ''}>
                            {change.old_value ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs max-w-32 truncate" title={change.new_value ?? ''}>
                            {change.new_value ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(change.detected_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={change.severity === 'high' ? 'destructive' : change.severity === 'medium' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {change.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => admissionSync.acknowledgeChange(change.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
