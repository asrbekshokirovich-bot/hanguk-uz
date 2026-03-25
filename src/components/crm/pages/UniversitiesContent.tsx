import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUniversities } from '@/hooks/useUniversities';
import { UniversityList } from '@/components/universities/UniversityList';
import { UniversityDetailSheet } from '@/components/universities/UniversityDetailSheet';
import { UniversityForm } from '@/components/universities/UniversityForm';
import { AIUniversityForm } from '@/components/universities/AIUniversityForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  GraduationCap,
  Star,
  Plus,
  Building,
  MapPin,
  Sparkles,
  Globe,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { koreanUniversitiesApi, ImportProgress } from '@/lib/api/koreanUniversities';

const STORAGE_KEY = 'university_import_job_id';
const ENRICH_STORAGE_KEY = 'university_enrich_job_id';

export default function UniversitiesContent() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { toast } = useToast();
  const { 
    universities, 
    loading, 
    stats,
    fetchUniversities,
    createUniversity, 
    updateUniversity, 
    deleteUniversity,
    togglePartner,
    toggleMapVisibility
  } = useUniversities();

  const [websiteFilter, setWebsiteFilter] = useState<'with' | 'without' | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [aiFormOpen, setAiFormOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<Tables<'universities'> | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<Tables<'universities'> | null>(null);

  // Background import state
  const [importJobId, setImportJobId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Re-enrich missing websites state
  const [enrichJobId, setEnrichJobId] = useState<string | null>(
    () => localStorage.getItem(ENRICH_STORAGE_KEY)
  );
  const [enrichStatus, setEnrichStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [enrichProgress, setEnrichProgress] = useState<ImportProgress | null>(null);
  const [enrichResult, setEnrichResult] = useState<any>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isStartingEnrich, setIsStartingEnrich] = useState(false);

  // Poll for import progress
  const pollProgress = useCallback(async () => {
    if (!importJobId) return;

    try {
      const status = await koreanUniversitiesApi.checkImportProgress(importJobId);
      
      if (status.progress) {
        setImportProgress(status.progress);
      }
      
      if (status.status === 'completed') {
        setImportStatus('completed');
        setImportResult(status.result);
        localStorage.removeItem(STORAGE_KEY);
        fetchUniversities();
      } else if (status.status === 'failed') {
        setImportStatus('failed');
        setImportError(status.error || 'Import failed');
        localStorage.removeItem(STORAGE_KEY);
      } else {
        setImportStatus('processing');
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [importJobId, fetchUniversities]);

  useEffect(() => {
    if (!importJobId) return;
    
    // Initial poll
    pollProgress();
    
    // Poll every 5 seconds
    const interval = setInterval(pollProgress, 5000);
    return () => clearInterval(interval);
  }, [importJobId, pollProgress]);

  // Restore active job on mount
  useEffect(() => {
    if (importJobId) {
      setImportStatus('processing');
    }
  }, []);

  // Poll for enrich progress
  const pollEnrichProgress = useCallback(async () => {
    if (!enrichJobId) return;
    try {
      const status = await koreanUniversitiesApi.checkImportProgress(enrichJobId);
      if (status.progress) setEnrichProgress(status.progress);
      if (status.status === 'completed') {
        setEnrichStatus('completed');
        setEnrichResult(status.result);
        localStorage.removeItem(ENRICH_STORAGE_KEY);
        fetchUniversities();
      } else if (status.status === 'failed') {
        setEnrichStatus('failed');
        // If error indicates job is gone/not found, clear state silently
        const errMsg = status.error || 'Enrichment failed';
        if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('404')) {
          setEnrichStatus('idle');
          setEnrichJobId(null);
          localStorage.removeItem(ENRICH_STORAGE_KEY);
        } else {
          setEnrichError(errMsg);
          localStorage.removeItem(ENRICH_STORAGE_KEY);
        }
      } else {
        setEnrichStatus('processing');
      }
    } catch (err: any) {
      // If job is gone (404/not found), clear state cleanly so user can start fresh
      const errMsg = err?.message || '';
      if (errMsg.includes('not found') || errMsg.includes('404') || errMsg.includes('Job not found')) {
        setEnrichStatus('idle');
        setEnrichJobId(null);
        localStorage.removeItem(ENRICH_STORAGE_KEY);
      }
      console.error('Enrich poll error:', err);
    }
  }, [enrichJobId, fetchUniversities]);

  useEffect(() => {
    if (!enrichJobId) return;
    pollEnrichProgress();
    const interval = setInterval(pollEnrichProgress, 5000);
    return () => clearInterval(interval);
  }, [enrichJobId, pollEnrichProgress]);

  // On mount: auto-detect stuck/dead chains and resume them automatically
  useEffect(() => {
    const autoResume = async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      // 1. If we have a stored enrichJobId, verify it immediately
      if (enrichJobId) {
        setEnrichStatus('processing');
        try {
          const status = await koreanUniversitiesApi.checkImportProgress(enrichJobId);
          if (status.status === 'completed') {
            setEnrichStatus('completed');
            localStorage.removeItem(ENRICH_STORAGE_KEY);
            fetchUniversities();
            return;
          } else if (status.status === 'failed') {
            // Silently clear — we'll check for any other active job below
            setEnrichStatus('idle');
            setEnrichJobId(null);
            localStorage.removeItem(ENRICH_STORAGE_KEY);
          } else if (status.status === 'processing') {
            // Still alive — keep tracking
            return;
          }
        } catch {
          setEnrichStatus('idle');
          setEnrichJobId(null);
          localStorage.removeItem(ENRICH_STORAGE_KEY);
        }
      }

      // 2. Check DB for any active university_import job (even if localStorage was cleared)
      const { data: activeJobs } = await supabase
        .from('search_jobs')
        .select('id, status, progress, updated_at')
        .eq('type', 'university_import' as any)
        .in('status', ['pending', 'processing'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!activeJobs || activeJobs.length === 0) return;

      const activeJob = activeJobs[0];
      const updatedAt = new Date(activeJob.updated_at as string);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isStale = updatedAt < fiveMinutesAgo;

      if (isStale) {
        // Chain is dead — auto-restart it
        console.log(`Auto-resuming dead enrichment chain for job ${activeJob.id} (last updated ${Math.round((Date.now() - updatedAt.getTime()) / 60000)}m ago)`);
        localStorage.setItem(ENRICH_STORAGE_KEY, activeJob.id);
        setEnrichJobId(activeJob.id);
        setEnrichStatus('processing');
        if (activeJob.progress) setEnrichProgress(activeJob.progress as any);

        // Re-invoke the edge function to restart the chain from where it left off
        supabase.functions.invoke('discover-university-websites', {
          body: { jobId: activeJob.id, batchIndex: 1, enrichOnly: true },
        }).catch(err => console.error('Auto-resume failed to invoke edge function:', err));

        toast({
          title: 'Enrichment Auto-Resumed',
          description: 'The background job was paused and has been automatically restarted.',
        });
      } else {
        // Chain is alive — resume tracking it in the UI
        console.log(`Resuming tracking for active enrichment job ${activeJob.id}`);
        localStorage.setItem(ENRICH_STORAGE_KEY, activeJob.id);
        setEnrichJobId(activeJob.id);
        setEnrichStatus('processing');
        if (activeJob.progress) setEnrichProgress(activeJob.progress as any);
      }
    };

    autoResume().catch(err => console.error('Auto-resume check failed:', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartEnrich = async () => {
    setIsStartingEnrich(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
        return;
      }

      // ── Duplicate check: Resume an existing recent job instead of creating a new one ──
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: existingJobs } = await supabase
        .from('search_jobs')
        .select('id, status, progress, updated_at')
        .eq('type', 'university_import')
        .in('status', ['pending', 'processing'])
        .gte('updated_at', fifteenMinsAgo)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        // Resume the existing active job
        const existing = existingJobs[0];
        console.log(`Resuming existing enrich job ${existing.id}`);
        localStorage.setItem(ENRICH_STORAGE_KEY, existing.id);
        setEnrichJobId(existing.id);
        setEnrichStatus('processing');
        setEnrichError(null);
        if (existing.progress) setEnrichProgress(existing.progress as any);
        toast({ title: 'Resuming Enrichment', description: 'An enrichment job is already running. Resuming tracking.' });
        return;
      }

      // ── Kill any zombie processing jobs before creating a fresh one ──
      await supabase
        .from('search_jobs')
        .update({ status: 'failed', error: 'Superseded by new enrichment job started by user' })
        .eq('type', 'university_import')
        .eq('status', 'processing');

      // ── Create a fresh enrichment job ──
      const { data: job, error: jobError } = await supabase
        .from('search_jobs')
        .insert([{
          type: 'university_import',
          status: 'pending',
          user_id: userId,
          progress: { phase: 'websites', imported: 0, total: 0, websiteProcessed: 0, websiteTotal: 0, websitesFound: 0 },
        } as any])
        .select('id')
        .single();

      if (jobError || !job) {
        toast({ title: 'Error', description: jobError?.message || 'Failed to create enrichment job', variant: 'destructive' });
        return;
      }

      // Trigger the edge function targeting only universities missing websites
      supabase.functions.invoke('discover-university-websites', {
        body: { jobId: job.id, batchIndex: 0, enrichOnly: true },
      }).catch(err => console.error('Failed to invoke discover-university-websites:', err));

      localStorage.setItem(ENRICH_STORAGE_KEY, job.id);
      setEnrichJobId(job.id);
      setEnrichStatus('processing');
      setEnrichError(null);
      setEnrichProgress({ phase: 'websites', imported: 0, total: 0, websiteProcessed: 0, websiteTotal: 0, websitesFound: 0 });
      toast({ title: 'Website Enrichment Started', description: 'Finding official websites for all universities missing one. This runs in the background.' });
    } finally {
      setIsStartingEnrich(false);
    }
  };

  const handleDismissEnrich = () => {
    setEnrichStatus('idle');
    setEnrichJobId(null);
    setEnrichError(null);
    setEnrichProgress(null);
    setEnrichResult(null);
  };

  const handleStartImport = async () => {
    setIsStarting(true);
    try {
      const { jobId, error } = await koreanUniversitiesApi.startBackgroundImport();
      if (error || !jobId) {
        toast({
          title: t('common.error'),
          description: error || 'Failed to start import',
          variant: 'destructive',
        });
        return;
      }
      
      // C1: Check localStorage BEFORE setting it for correct resume detection
      const previousJobId = localStorage.getItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, jobId);
      setImportJobId(jobId);
      setImportStatus('processing');
      setImportResult(null);
      setImportError(null);
      const wasResumed = previousJobId === jobId;
      if (!wasResumed) {
        setImportProgress({ phase: 'discovery', imported: 0, total: 0, websiteProcessed: 0, websiteTotal: 0, websitesFound: 0 });
      }
      // Immediately poll using jobId directly (avoids stale closure on pollProgress)
      setTimeout(async () => {
        try {
          const status = await koreanUniversitiesApi.checkImportProgress(jobId);
          if (status.progress) setImportProgress(status.progress);
          if (status.status === 'completed') {
            setImportStatus('completed');
            setImportResult(status.result);
            localStorage.removeItem(STORAGE_KEY);
            fetchUniversities();
          } else if (status.status === 'failed') {
            setImportStatus('failed');
            setImportError(status.error || 'Import failed');
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (err) {
          console.error('Initial poll error:', err);
        }
      }, 100);
      
      toast({
        title: 'Discovery Started',
        description: 'Background university import has started. You can continue working while it runs.',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelImport = async () => {
    if (!importJobId) return;
    await koreanUniversitiesApi.cancelImport(importJobId);
    setImportStatus('failed');
    setImportError('Cancelled by user');
    setImportJobId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleDismiss = () => {
    setImportStatus('idle');
    setImportJobId(null);
    setImportResult(null);
    setImportError(null);
    setImportProgress(null);
  };

  const handleEdit = (university: Tables<'universities'>) => {
    setEditingUniversity(university);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteUniversity(id);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'University deleted' });
    }
  };

  const handleTogglePartner = async (id: string, isPartner: boolean) => {
    await togglePartner(id, isPartner);
  };

  const handleToggleMapVisibility = async (id: string, isVisible: boolean) => {
    await toggleMapVisibility(id, isVisible);
  };

  const handleSave = async (data: Partial<Tables<'universities'>>) => {
    if (editingUniversity) {
      const { error } = await updateUniversity(editingUniversity.id, data);
      if (!error) {
        toast({ title: t('common.success'), description: 'University updated' });
      }
      return { error };
    } else {
      const { error } = await createUniversity(data as any);
      if (!error) {
        toast({ title: t('common.success'), description: 'University created' });
      }
      return { error };
    }
  };

  // Progress display helpers
  const getProgressPercent = () => {
    if (!importProgress) return 0;
    if (importProgress.phase === 'discovery') return 10; // show some activity
    if (importProgress.phase === 'done') return 100;
    if (importProgress.websiteTotal > 0) {
      // Phase 2 is 90% of the total (10% for discovery)
      return 10 + (importProgress.websiteProcessed / importProgress.websiteTotal) * 90;
    }
    return 15;
  };

  const getProgressLabel = () => {
    if (!importProgress) return 'Starting...';
    if (importProgress.phase === 'discovery') {
      return `Importing universities... ${importProgress.imported > 0 ? `Found ${importProgress.imported} new` : 'Searching Wikipedia & databases...'}`;
    }
    if (importProgress.phase === 'websites') {
      return `Discovering websites... ${importProgress.websiteProcessed}/${importProgress.websiteTotal} researched, ${importProgress.websitesFound} found`;
    }
    if (importProgress.phase === 'done') {
      return `Complete!`;
    }
    return 'Processing...';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('navigation.universities')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.partners}</p>
              <p className="text-xs text-muted-foreground">{t('universities.partnerUniversity')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.visibleOnMap}</p>
              <p className="text-xs text-muted-foreground">Visible on Map</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withPrograms}</p>
              <p className="text-xs text-muted-foreground">With {t('universities.programs')}</p>
            </div>
          </CardContent>
        </Card>
        {/* Has Website — clickable filter */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${websiteFilter === 'with' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setWebsiteFilter(f => f === 'with' ? null : 'with')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withWebsite}</p>
              <p className="text-xs text-muted-foreground">Has Website</p>
            </div>
          </CardContent>
        </Card>
        {/* No Website — clickable filter */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${websiteFilter === 'without' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setWebsiteFilter(f => f === 'without' ? null : 'without')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Globe className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.noWebsite}</p>
              <p className="text-xs text-muted-foreground">No Website</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Progress Card */}
      {importStatus === 'processing' && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="font-medium text-sm">Background University Discovery</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancelImport}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={getProgressPercent()} className="h-2" />
            <p className="text-xs text-muted-foreground">{getProgressLabel()}</p>
            {importProgress && importProgress.imported > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>📚 {importProgress.total} total universities</span>
                <span>🌐 {importProgress.websitesFound} websites found</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {importStatus === 'completed' && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">
                  Discovery Complete! {importResult?.totalUniversities} universities, {importResult?.withWebsite} with official websites
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {importStatus === 'failed' && importError && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-sm">{importError}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrich Progress Card */}
      {enrichStatus === 'processing' && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span className="font-medium text-sm">Re-enriching Missing Websites</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismissEnrich}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={enrichProgress?.websiteTotal ? Math.min((enrichProgress.websiteProcessed / enrichProgress.websiteTotal) * 100, 100) : 5} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {enrichProgress?.websiteTotal
                ? `${Math.min(enrichProgress.websiteProcessed, enrichProgress.websiteTotal)}/${enrichProgress.websiteTotal} universities researched — ${enrichProgress.websitesFound} websites found`
                : 'Starting website research...'}
            </p>
          </CardContent>
        </Card>
      )}

      {enrichStatus === 'completed' && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-sm">Website Enrichment Complete</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismissEnrich}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-background rounded-lg p-3 border">
                <p className="text-2xl font-bold text-foreground">{enrichResult?.totalUniversities ?? enrichProgress?.websiteProcessed ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Universities processed</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="text-2xl font-bold text-green-600">{enrichResult?.withWebsite ?? enrichProgress?.websitesFound ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Websites found</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="text-2xl font-bold text-amber-600">{enrichResult?.missingWebsite ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Still missing</p>
              </div>
            </div>
            {enrichResult?.missingWebsite > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {enrichResult.missingWebsite} universities couldn't be found — click "Re-enrich" again to retry them.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {enrichStatus === 'failed' && enrichError && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-sm">{enrichError}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismissEnrich}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 flex-wrap">
        {enrichStatus !== 'processing' && (
          <Button 
            variant="outline" 
            onClick={handleStartEnrich} 
            disabled={isStartingEnrich}
            title="Find official websites for all universities that are currently missing one"
          >
            {isStartingEnrich ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Re-enrich Missing Websites
          </Button>
        )}
        {importStatus !== 'processing' && (
          <Button 
            variant="outline" 
            onClick={handleStartImport} 
            disabled={isStarting}
          >
            {isStarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            Discover All Universities
          </Button>
        )}
        <Button onClick={() => setAiFormOpen(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          {t('common.add')} {t('navigation.universities')}
        </Button>
      </div>

      {/* University List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {t('navigation.universities')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UniversityList 
            universities={universities}
            loading={loading}
            currentLang={currentLang}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTogglePartner={handleTogglePartner}
            onToggleMapVisibility={handleToggleMapVisibility}
            onSelect={setSelectedUniversity}
            websiteFilter={websiteFilter}
          />
        </CardContent>
      </Card>

      {/* AI Add Dialog */}
      <AIUniversityForm
        open={aiFormOpen}
        onOpenChange={setAiFormOpen}
        onSave={handleSave}
      />

      {/* Edit Form Dialog */}
      <UniversityForm
        university={editingUniversity}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingUniversity(null);
        }}
        onSave={handleSave}
      />

      {/* University Detail Sheet */}
      <UniversityDetailSheet
        university={selectedUniversity}
        open={!!selectedUniversity}
        onOpenChange={(open) => { if (!open) setSelectedUniversity(null); }}
        currentLang={currentLang}
      />
    </div>
  );
}
