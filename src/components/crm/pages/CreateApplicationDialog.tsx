import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Search,
  GraduationCap,
  MapPin,
  Users,
  ArrowLeft,
  Check,
  Loader2,
  Globe,
} from 'lucide-react';

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & { university?: Tables<'institutions'> })[];
};

interface CreateApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentProfile[];
  universities: Tables<'institutions'>[];
  activeIntakeId: string | null;
  onCreated: () => void;
}

function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CreateApplicationDialog({
  open,
  onOpenChange,
  students,
  universities,
  activeIntakeId,
  onCreated,
}: CreateApplicationDialogProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  const [step, setStep] = useState<'university' | 'students'>('university');
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [uniSearch, setUniSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setStep('university');
    setSelectedUniId(null);
    setSelectedStudentIds(new Set());
    setUniSearch('');
    setStudentSearch('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const uniName = (uni: Tables<'institutions'>) => {
    const localized = (uni as Record<string, unknown>)[`name_${currentLang}`];
    return (typeof localized === 'string' && localized) || uni.name_en || uni.name_ko || '';
  };

  const filteredUniversities = useMemo(() => {
    const q = uniSearch.trim().toLowerCase();
    return universities
      .filter((u) => u.is_visible_on_map)
      .filter((u) => {
        if (!q) return true;
        const name = uniName(u).toLowerCase();
        const domain = (u.primary_domain || '').toLowerCase();
        const city = (u.city_ko || '').toLowerCase();
        return name.includes(q) || domain.includes(q) || city.includes(q);
      })
      .slice(0, 50);
  }, [universities, uniSearch, currentLang]);

  const selectedUni = universities.find((u) => u.id === selectedUniId) ?? null;

  const existingAppStudentIds = useMemo(() => {
    if (!selectedUniId) return new Set<string>();
    const ids = new Set<string>();
    for (const s of students) {
      if (s.applications?.some((a) => a.institution_id === selectedUniId)) {
        ids.add(s.user_id);
      }
    }
    return ids;
  }, [students, selectedUniId]);

  const availableStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students
      .filter((s) => !existingAppStudentIds.has(s.user_id))
      .filter((s) => {
        if (!q) return true;
        const name = (s.full_name || '').toLowerCase();
        const phone = (s.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
  }, [students, existingAppStudentIds, studentSearch]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStudentIds(new Set(availableStudents.map((s) => s.user_id)));
  };

  const deselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleSelectUniversity = (uniId: string) => {
    setSelectedUniId(uniId);
    setSelectedStudentIds(new Set());
    setStep('students');
  };

  const handleSubmit = async () => {
    if (!selectedUniId || selectedStudentIds.size === 0) return;

    setSubmitting(true);
    try {
      const rows = Array.from(selectedStudentIds).map((studentId) => ({
        student_id: studentId,
        institution_id: selectedUniId,
        status: 'pending' as const,
        ...(activeIntakeId ? { intake_id: activeIntakeId } : {}),
      }));

      const { error } = await supabase.from('applications').insert(rows);

      if (error) {
        console.error('Failed to create applications:', error);
        toast.error(t('applications.createError', { defaultValue: 'Failed to create applications' }));
        return;
      }

      toast.success(
        t('applications.created', {
          count: selectedStudentIds.size,
          university: uniName(selectedUni!),
          defaultValue: `${selectedStudentIds.size} application(s) created for ${uniName(selectedUni!)}`,
        }),
      );
      onCreated();
      handleOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(t('common.error', { defaultValue: 'Something went wrong' }));
    } finally {
      setSubmitting(false);
    }
  };

  const stepNumber = step === 'university' ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        {/* Header with step indicator */}
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-base">
              {step === 'students' && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setStep('university')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <GraduationCap className="h-5 w-5 text-primary" />
              {step === 'university'
                ? t('applications.selectUniversity', { defaultValue: 'Select University' })
                : t('applications.selectStudents', { defaultValue: 'Select Students' })}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                stepNumber >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>1</span>
              <div className={cn('h-0.5 w-6 rounded-full', stepNumber >= 2 ? 'bg-primary' : 'bg-muted')} />
              <span className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                stepNumber >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>2</span>
            </div>
          </div>
        </DialogHeader>

        {step === 'university' && (
          <div className="flex flex-col overflow-hidden">
            <div className="px-6 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('applications.searchUniversities', { defaultValue: 'Search universities...' })}
                  value={uniSearch}
                  onChange={(e) => setUniSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('applications.uniCount', {
                  n: filteredUniversities.length,
                  defaultValue: `${filteredUniversities.length} universities available`,
                })}
              </p>
            </div>
            <div className="overflow-y-auto px-6 pb-4" style={{ maxHeight: 'calc(85vh - 160px)' }}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {filteredUniversities.map((uni) => {
                  const appCount = students.filter((s) =>
                    s.applications?.some((a) => a.institution_id === uni.id),
                  ).length;
                  return (
                    <Card
                      key={uni.id}
                      onClick={() => handleSelectUniversity(uni.id)}
                      className="group cursor-pointer border-transparent bg-muted/40 p-3.5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/50">
                          {uni.logo_url ? (
                            <img src={uni.logo_url} alt="" className="h-7 w-7 rounded object-contain" />
                          ) : (
                            <GraduationCap className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-semibold leading-tight group-hover:text-primary">
                            {uniName(uni)}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {uni.city_ko && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {uni.city_ko}
                              </span>
                            )}
                            {uni.primary_domain && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {uni.primary_domain}
                              </span>
                            )}
                          </div>
                          {appCount > 0 && (
                            <Badge variant="neutral" className="mt-2 gap-1 text-[10px]">
                              <Users className="h-3 w-3" />
                              {t('applications.existingApps', {
                                n: appCount,
                                defaultValue: `${appCount} student(s)`,
                              })}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {filteredUniversities.length === 0 && (
                  <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                    {t('common.noResults', { defaultValue: 'No results found' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'students' && selectedUni && (
          <div className="flex flex-col overflow-hidden">
            {/* Selected university banner */}
            <div className="mx-6 mt-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-3.5 ring-1 ring-primary/15">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/50">
                  {selectedUni.logo_url ? (
                    <img src={selectedUni.logo_url} alt="" className="h-6 w-6 rounded object-contain" />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{uniName(selectedUni)}</div>
                  {selectedUni.city_ko && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {selectedUni.city_ko}
                    </div>
                  )}
                </div>
                {existingAppStudentIds.size > 0 && (
                  <Badge variant="neutral" className="shrink-0 text-[11px]">
                    {t('applications.alreadyApplied', {
                      n: existingAppStudentIds.size,
                      defaultValue: `${existingAppStudentIds.size} already applied`,
                    })}
                  </Badge>
                )}
              </div>
            </div>

            {/* Search + select all */}
            <div className="flex items-center gap-2 px-6 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('applications.searchStudents', { defaultValue: 'Search students...' })}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={selectedStudentIds.size === availableStudents.length ? deselectAll : selectAll}
              >
                {selectedStudentIds.size === availableStudents.length
                  ? t('common.deselectAll', { defaultValue: 'Deselect all' })
                  : t('common.selectAll', { defaultValue: 'Select all' })}
              </Button>
            </div>

            {/* Student list */}
            <div className="overflow-y-auto border-t px-6 py-2" style={{ maxHeight: 'calc(85vh - 300px)' }}>
              {availableStudents.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {existingAppStudentIds.size > 0
                    ? t('applications.allAlreadyApplied', { defaultValue: 'All students already have applications for this university' })
                    : t('common.noResults', { defaultValue: 'No results found' })}
                </div>
              ) : (
                <div className="space-y-1">
                  {availableStudents.map((student) => {
                    const isSelected = selectedStudentIds.has(student.user_id);
                    return (
                      <div
                        key={student.user_id}
                        onClick={() => toggleStudent(student.user_id)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                          isSelected
                            ? 'bg-primary/10 shadow-sm ring-1 ring-primary/30'
                            : 'hover:bg-muted/60',
                        )}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <Avatar className="h-9 w-9 ring-1 ring-border/40">
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-semibold">
                            {getInitials(student.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {student.full_name || '—'}
                          </div>
                          {student.phone && (
                            <div className="truncate text-xs text-muted-foreground">
                              {student.phone}
                            </div>
                          )}
                        </div>
                        {student.applications && student.applications.length > 0 && (
                          <Badge variant="neutral" className="text-[10px]">
                            {student.applications.length} app{student.applications.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('university')}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t('common.back', { defaultValue: 'Back' })}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('applications.selectedCount', {
                    n: selectedStudentIds.size,
                    defaultValue: `${selectedStudentIds.size} student(s) selected`,
                  })}
                </span>
              </div>
              <Button
                disabled={selectedStudentIds.size === 0 || submitting}
                onClick={handleSubmit}
                size="sm"
                className="gap-2 px-5"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t('applications.createApplications', {
                  count: selectedStudentIds.size,
                  defaultValue: `Create ${selectedStudentIds.size} Application(s)`,
                })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
