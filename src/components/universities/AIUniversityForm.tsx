import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Globe, 
  MapPin, 
  GraduationCap,
  AlertTriangle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { applicationFormsApi } from '@/lib/api/applicationForms';
import { Tables } from '@/integrations/supabase/types';

type University = Tables<'universities'>;

interface UniversitySearchResult {
  name_en: string;
  name_ko: string | null;
  name_uz: string | null;
  name_ru: string | null;
  city_en: string | null;
  city_ko: string | null;
  city_uz: string | null;
  city_ru: string | null;
  website: string | null;
  description_en: string | null;
  description_ko: string | null;
  latitude: number | null;
  longitude: number | null;
  ranking: number | null;
  programs: string[];
  confidence: number;
  foundViaWebsite: boolean;
}

interface AIUniversityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<University>) => Promise<{ error: any }>;
}

type Step = 'search' | 'preview' | 'website' | 'saving';

export function AIUniversityForm({ open, onOpenChange, onSave }: AIUniversityFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('search');
  const [universityName, setUniversityName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<UniversitySearchResult | null>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [isVisibleOnMap, setIsVisibleOnMap] = useState(true);

  const resetForm = () => {
    setStep('search');
    setUniversityName('');
    setWebsiteUrl('');
    setLoading(false);
    setError(null);
    setSearchResult(null);
    setIsPartner(false);
    setIsVisibleOnMap(true);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Background job polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    localStorage.setItem('activeUniversitySearchJobId', jobId);

    pollingRef.current = setInterval(async () => {
      try {
        const jobData = await applicationFormsApi.checkSearchJob(jobId);
        if (jobData.status === 'completed' && jobData.result) {
          stopPolling();
          localStorage.removeItem('activeUniversitySearchJobId');
          setLoading(false);

          const data = jobData.result;
          if (!data.success) {
            if (data.needsWebsite) {
              setError(data.error);
              setStep('website');
            } else {
              setError(data.error || 'Failed to find university');
            }
            return;
          }

          // Normalize types defensively
          const u = data.university as Partial<UniversitySearchResult> | undefined;
          const normalizeNumber = (v: unknown): number | null => {
            if (typeof v === 'number' && Number.isFinite(v)) return v;
            if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
            return null;
          };

          const normalized: UniversitySearchResult = {
            name_en: (u?.name_en as string) || universityName.trim(),
            name_ko: (u?.name_ko as string) || null,
            name_uz: (u?.name_uz as string) || (u?.name_en as string) || universityName.trim(),
            name_ru: (u?.name_ru as string) || null,
            city_en: (u?.city_en as string) || null,
            city_ko: (u?.city_ko as string) || null,
            city_uz: (u?.city_uz as string) || null,
            city_ru: (u?.city_ru as string) || null,
            website: (u?.website as string) || null,
            description_en: (u?.description_en as string) || null,
            description_ko: (u?.description_ko as string) || null,
            latitude: normalizeNumber(u?.latitude),
            longitude: normalizeNumber(u?.longitude),
            ranking: normalizeNumber(u?.ranking),
            programs: Array.isArray(u?.programs) ? (u?.programs as string[]) : [],
            confidence: normalizeNumber(u?.confidence) ?? 0,
            foundViaWebsite: !!u?.foundViaWebsite,
          };

          setSearchResult(normalized);
          setStep('preview');
        } else if (jobData.status === 'failed') {
          stopPolling();
          localStorage.removeItem('activeUniversitySearchJobId');
          setLoading(false);
          setError(jobData.error || 'Search failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }, [stopPolling, universityName]);

  // Resume polling on mount
  useEffect(() => {
    const savedJobId = localStorage.getItem('activeUniversitySearchJobId');
    if (savedJobId && open) {
      setLoading(true);
      setStep('search');
      startPolling(savedJobId);
    }
  }, [open, startPolling]);

  const handleSearch = async (withWebsite = false) => {
    if (!universityName.trim() && !websiteUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await applicationFormsApi.startUniversitySearch(
        universityName.trim(),
        withWebsite ? websiteUrl.trim() : undefined,
      );

      if ('error' in result) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Start polling
      startPolling(result.jobId);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search for university. Please try again.');
      setLoading(false);
    }
  };

  const handleReject = () => {
    setStep('website');
    setError('Please provide the official website URL for a more accurate search.');
  };

  const handleApprove = async () => {
    if (!searchResult) return;

    setStep('saving');
    setLoading(true);

    const universityData: Partial<University> = {
      name_uz: searchResult.name_uz || searchResult.name_en,
      name_en: searchResult.name_en,
      name_ko: searchResult.name_ko,
      name_ru: searchResult.name_ru,
      city_uz: searchResult.city_uz,
      city_en: searchResult.city_en,
      city_ko: searchResult.city_ko,
      city_ru: searchResult.city_ru,
      website: searchResult.website,
      description_en: searchResult.description_en,
      description_ko: searchResult.description_ko,
      latitude: searchResult.latitude,
      longitude: searchResult.longitude,
      ranking: searchResult.ranking,
      programs: searchResult.programs.length > 0 ? searchResult.programs : null,
      is_partner: isPartner,
      is_visible_on_map: isVisibleOnMap,
    };

    const { error: saveError } = await onSave(universityData);
    
    setLoading(false);
    
    if (!saveError) {
      handleClose();
    } else {
      setError('Failed to save university. Please try again.');
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? onOpenChange(true) : handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI University Finder
          </DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Enter the university name and AI will find all the details automatically.'}
            {step === 'preview' && 'Review the information found by AI before adding.'}
            {step === 'website' && 'Provide the official website for a more accurate search.'}
            {step === 'saving' && 'Saving university information...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Search */}
          {step === 'search' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="universityName">University Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="universityName"
                    placeholder="e.g., Seoul National University, 서울대학교"
                    value={universityName}
                    onChange={(e) => setUniversityName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    disabled={loading}
                  />
                  <Button onClick={() => handleSearch()} disabled={loading || !universityName.trim()}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can enter the name in English or Korean
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Website URL (fallback) */}
          {step === 'website' && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="text-sm">{error || 'Could not find the university. Please provide the official website URL.'}</span>
              </div>

              <div className="space-y-2">
                <Label>University Name</Label>
                <Input
                  value={universityName}
                  onChange={(e) => setUniversityName(e.target.value)}
                  placeholder="University name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Official Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://www.university.ac.kr"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(true)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Usually ends with .ac.kr for Korean universities
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setStep('search'); setError(null); }}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => handleSearch(true)} 
                  disabled={loading || !websiteUrl.trim()}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search with Website
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview Results */}
          {step === 'preview' && searchResult && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                {/* Confidence indicator */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    {searchResult.confidence >= 70 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : searchResult.confidence >= 40 ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-medium">AI Confidence: {searchResult.confidence}%</span>
                  </div>
                  {searchResult.foundViaWebsite && (
                    <Badge variant="secondary">Found via Website</Badge>
                  )}
                </div>

                {/* University Info */}
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    {/* Names */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">University Names</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">English:</span>
                          <p className="font-medium">{searchResult.name_en}</p>
                        </div>
                        {searchResult.name_ko && (
                          <div className="p-2 bg-muted/50 rounded">
                            <span className="text-xs text-muted-foreground">Korean:</span>
                            <p className="font-medium">{searchResult.name_ko}</p>
                          </div>
                        )}
                        {searchResult.name_uz && (
                          <div className="p-2 bg-muted/50 rounded">
                            <span className="text-xs text-muted-foreground">Uzbek:</span>
                            <p className="font-medium">{searchResult.name_uz}</p>
                          </div>
                        )}
                        {searchResult.name_ru && (
                          <div className="p-2 bg-muted/50 rounded">
                            <span className="text-xs text-muted-foreground">Russian:</span>
                            <p className="font-medium">{searchResult.name_ru}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    {(searchResult.city_en || searchResult.city_ko) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{searchResult.city_en || searchResult.city_ko}</span>
                        {searchResult.city_ko && searchResult.city_en && (
                          <span className="text-muted-foreground">({searchResult.city_ko})</span>
                        )}
                        {searchResult.latitude && searchResult.longitude && (
                          <Badge variant="outline" className="text-xs">
                            GPS: {searchResult.latitude.toFixed(4)}, {searchResult.longitude.toFixed(4)}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Website */}
                    {searchResult.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={searchResult.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {searchResult.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {/* Ranking */}
                    {searchResult.ranking && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Ranking:</span>
                        <Badge>#{searchResult.ranking}</Badge>
                      </div>
                    )}

                    {/* Description */}
                    {searchResult.description_en && (
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Description</Label>
                        <p className="text-sm">{searchResult.description_en}</p>
                      </div>
                    )}

                    {/* Programs */}
                    {searchResult.programs.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-muted-foreground text-xs">Programs/Faculties</Label>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {searchResult.programs.slice(0, 10).map((program, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {program}
                            </Badge>
                          ))}
                          {searchResult.programs.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{searchResult.programs.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Options */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isPartner">Partner University</Label>
                    <Switch
                      id="isPartner"
                      checked={isPartner}
                      onCheckedChange={setIsPartner}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isVisibleOnMap">Visible on Student Map</Label>
                    <Switch
                      id="isVisibleOnMap"
                      checked={isVisibleOnMap}
                      onCheckedChange={setIsVisibleOnMap}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={handleReject}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Not Correct
                  </Button>
                  <Button 
                    onClick={handleApprove}
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve & Add
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Step 4: Saving */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Saving university...</p>
              <p className="text-sm text-muted-foreground">Please wait while we add this university to the system.</p>
            </div>
          )}

          {/* Loading state for search */}
          {loading && step === 'search' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center space-y-1">
                <p className="font-medium">Searching for university...</p>
                <p className="text-sm text-muted-foreground">Search runs in background — you can switch tabs safely</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
