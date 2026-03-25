import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  useUniversityPrograms,
  useUniversityAdmissionPeriods,
  groupProgramsByTrack,
  getLanguageRequirements,
} from '@/hooks/useUniversityPrograms';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GraduationCap,
  Star,
  Globe,
  MapPin,
  ExternalLink,
  FileText,
  CalendarDays,
  BookOpen,
  Navigation,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';

interface UniversityDetailSheetProps {
  university: Tables<'universities'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLang: string;
}

export function UniversityDetailSheet({
  university,
  open,
  onOpenChange,
  currentLang,
}: UniversityDetailSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const universityId = university?.id ?? null;

  const { data: programs } = useUniversityPrograms(open ? universityId : null);
  const { data: admissionPeriods } = useUniversityAdmissionPeriods(open ? universityId : null);

  const { data: requirements } = useQuery({
    queryKey: ['university-requirements', universityId],
    queryFn: async () => {
      if (!universityId) return [];
      const { data, error } = await supabase
        .from('university_requirements')
        .select('*')
        .eq('university_id', universityId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!universityId,
  });

  const { data: gksDesignations } = useQuery({
    queryKey: ['gks-designations', universityId],
    queryFn: async () => {
      if (!universityId) return [];
      const { data, error } = await supabase
        .from('gks_designated_universities')
        .select('*, gks_program_info(*)')
        .eq('university_id', universityId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!universityId,
  });

  const getLocalizedField = (field: string) => {
    if (!university) return '';
    const key = `${field}_${currentLang}` as keyof Tables<'universities'>;
    return (university[key] as string) || (university[`${field}_uz` as keyof Tables<'universities'>] as string) || '';
  };

  const grouped = groupProgramsByTrack(programs ?? null);
  const langReqs = getLanguageRequirements(programs ?? null);

  const INSTITUTION_TYPE_LABELS: Record<string, string> = {
    university: 'University',
    junior_college: 'Junior College',
    polytechnic: 'Polytechnic',
    theological: 'Theological',
    graduate_only: 'Graduate Only',
    online_only: 'Online/Cyber',
    military_police: 'Military/Police',
    foreign_branch: 'Foreign Branch',
  };

  if (!university) return null;

  const programCount = programs?.length ?? 0;
  const admissionCount = admissionPeriods?.length ?? 0;
  const requirementCount = requirements?.length ?? 0;
  const gksCount = gksDesignations?.length ?? 0;

  const renderTrackSection = (label: string, items: { faculty: string; programs: string[] }[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{label}</h4>
        {items.map((group) => (
          <div key={group.faculty} className="pl-3 border-l-2 border-muted">
            <p className="text-xs font-medium text-muted-foreground">{group.faculty}</p>
            <ul className="list-disc list-inside text-sm">
              {group.programs.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            {university.logo_url ? (
              <img src={university.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle className="line-clamp-2 text-left">
                {getLocalizedField('name')}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {getLocalizedField('city')}
              </SheetDescription>
            </div>
            {university.is_partner && (
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <Accordion type="multiple" defaultValue={['overview']} className="py-4">
            {/* Overview */}
            <AccordionItem value="overview">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Overview
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(university as any).institution_type && (
                      <Badge variant="outline" className="capitalize">
                        {INSTITUTION_TYPE_LABELS[(university as any).institution_type] || (university as any).institution_type}
                      </Badge>
                    )}
                    {university.ranking && <Badge variant="secondary">Rank #{university.ranking}</Badge>}
                    {university.acceptance_rate && (
                      <Badge variant="outline">{university.acceptance_rate}% acceptance</Badge>
                    )}
                    {university.is_partner && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Partner</Badge>
                    )}
                  </div>

                  {university.tuition_min && university.tuition_max && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Tuition:</span> ${university.tuition_min.toLocaleString()} – ${university.tuition_max.toLocaleString()}
                    </p>
                  )}

                  {langReqs.topikRange && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">TOPIK:</span> Level {langReqs.topikRange.min}–{langReqs.topikRange.max}
                    </p>
                  )}
                  {langReqs.ieltsRange && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">IELTS:</span> {langReqs.ieltsRange.min}–{langReqs.ieltsRange.max}
                    </p>
                  )}

                  {university.website && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={university.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        Website
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}

                  {getLocalizedField('description') && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {getLocalizedField('description')}
                    </p>
                  )}

                  {getLocalizedField('requirements') && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Requirements (general)</p>
                      <p className="text-sm whitespace-pre-line">{getLocalizedField('requirements')}</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Programs */}
            <AccordionItem value="programs">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Programs
                  {programCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{programCount}</Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {programCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No program data yet</p>
                ) : (
                  <div className="space-y-4">
                    {renderTrackSection('🇬🇧 English Track', grouped.englishTrack)}
                    {renderTrackSection('🇰🇷 Korean Track', grouped.koreanTrack)}
                    {renderTrackSection('🌐 Both Tracks', grouped.bothTracks)}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Admission Periods */}
            <AccordionItem value="admission">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Admission Periods
                  {admissionCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{admissionCount}</Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {admissionCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No admission data yet</p>
                ) : (
                  <div className="space-y-4">
                    {admissionPeriods!.map((period) => (
                      <div key={period.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{period.semester} {period.year}</Badge>
                          <Badge variant="outline" className="capitalize">{period.program_level}</Badge>
                        </div>
                        {period.application_start && period.application_end && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Apply:</span>{' '}
                            {format(new Date(period.application_start), 'MMM d, yyyy')} – {format(new Date(period.application_end), 'MMM d, yyyy')}
                          </p>
                        )}
                        {period.document_deadline && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Documents due:</span>{' '}
                            {format(new Date(period.document_deadline), 'MMM d, yyyy')}
                          </p>
                        )}
                        {period.result_announcement && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Results:</span>{' '}
                            {format(new Date(period.result_announcement), 'MMM d, yyyy')}
                          </p>
                        )}
                        {period.application_fee_krw && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Fee:</span> ₩{period.application_fee_krw.toLocaleString()}
                          </p>
                        )}
                        {period.application_form_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={period.application_form_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3 w-3 mr-1" />
                              Application Form
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Requirements */}
            <AccordionItem value="requirements">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Requirements
                  {requirementCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{requirementCount}</Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {requirementCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No requirement data yet</p>
                ) : (
                  <div className="space-y-4">
                    {requirements!.map((req) => (
                      <div key={req.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{req.program_level}</Badge>
                          <Badge variant="outline">{req.semester} {req.year}</Badge>
                          {req.language_track && <Badge variant="outline">{req.language_track}</Badge>}
                        </div>
                        {req.required_documents && Array.isArray(req.required_documents) && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Required Documents</p>
                            <ul className="list-disc list-inside text-sm space-y-0.5">
                              {(req.required_documents as string[]).map((doc, i) => (
                                <li key={i}>{doc}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {req.eligibility_criteria && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Eligibility</p>
                            <p className="text-sm whitespace-pre-line">{req.eligibility_criteria}</p>
                          </div>
                        )}
                        {req.special_notes && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                            <p className="text-sm whitespace-pre-line">{req.special_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* GKS Status */}
            {gksCount > 0 && (
              <AccordionItem value="gks">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    GKS Designated
                    <Badge variant="secondary" className="ml-1 text-xs">{gksCount} tracks</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {gksDesignations!.map((d: any) => {
                      const info = d.gks_program_info;
                      if (!info) return null;
                      const trackLabel = `${info.program_level === 'undergraduate' ? '🎓 UG' : '🎓 Grad'} — ${info.track_type} / ${info.sub_track.replace(/_/g, ' ')}`;
                      return (
                        <div key={d.id} className="border rounded-lg p-3 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">{trackLabel}</Badge>
                            <Badge variant="secondary" className="text-xs">Type {d.university_type}</Badge>
                            {d.is_rd && <Badge className="bg-accent text-accent-foreground text-xs">R&D</Badge>}
                            {d.is_global_network && <Badge className="bg-accent text-accent-foreground text-xs">Global Network</Badge>}
                            {d.is_uic && <Badge className="bg-accent text-accent-foreground text-xs">UIC</Badge>}
                          </div>
                          {info.total_slots && (
                            <p className="text-sm"><span className="text-muted-foreground">Total slots:</span> {info.total_slots}</p>
                          )}
                          {info.application_start && info.application_end && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">Apply:</span>{' '}
                              {format(new Date(info.application_start), 'MMM d, yyyy')} – {format(new Date(info.application_end), 'MMM d, yyyy')}
                            </p>
                          )}
                          {info.result_date && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">Results:</span>{' '}
                              {format(new Date(info.result_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Location */}
            <AccordionItem value="location">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">City:</span> {getLocalizedField('city')}
                  </p>
                  {university.latitude && university.longitude && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {university.latitude}, {university.longitude}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/crm/kakao-map?universityId=${university.id}`);
                        }}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        View on Map
                      </Button>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
