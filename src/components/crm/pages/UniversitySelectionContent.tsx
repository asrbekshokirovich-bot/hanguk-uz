import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, CheckCircle2, GraduationCap, Plus, Search, Send, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { paymentTint, TINT_CLASS } from '@/lib/paymentTint';
import { languageFit } from '@/lib/universityFit';
import { useUniversityCatalog, type CatalogEntry } from '@/hooks/useUniversityCatalog';
import { MAX_CHOICES, useUniversityChoices, type UniversityChoice } from '@/hooks/useUniversityChoices';
import {
  cityLabel,
  contractRange,
  displayName,
  matchesSearch,
  operatorCities,
} from '@/components/crm/pages/university-catalog/format';

type StudentProfile = Tables<'profiles'> & {
  applications?: Pick<Tables<'applications'>, 'institution_id'>[];
  hasPaid?: boolean;
};

interface UniversitySelectionContentProps {
  students: StudentProfile[];
  loading: boolean;
  /** Turns a choice into a real application row (status 'pending'). */
  onCreateApplication?: (studentId: string, institutionId: string) => Promise<{ error: unknown }>;
}

const PAGE = 40;

function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UniversitySelectionContent({ students, loading, onCreateApplication }: UniversitySelectionContentProps) {
  const catalog = useUniversityCatalog();
  const choices = useUniversityChoices();

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uniSearch, setUniSearch] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [onlyFit, setOnlyFit] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [sending, setSending] = useState(false);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => (s.full_name ?? '').toLowerCase().includes(q) || (s.magic_code ?? '').toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const student = filteredStudents.find((s) => s.user_id === selectedId) ?? filteredStudents[0] ?? null;
  const studentChoices = student ? choices.byStudent.get(student.user_id) ?? [] : [];
  const wishes = student ? choices.wishesByStudent.get(student.user_id) ?? [] : [];
  const appliedIds = new Set((student?.applications ?? []).map((a) => a.institution_id));

  const entryById = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    for (const e of catalog.entries) m.set(e.institution.id, e);
    return m;
  }, [catalog.entries]);

  const cities = useMemo(() => operatorCities(catalog.entries), [catalog.entries]);

  // Universities with an uploaded guideline first — those carry the
  // requirements, fees and deadlines a choice is made on.
  const universities = useMemo(() => {
    const list = catalog.entries.filter((e) => {
      if (!matchesSearch(e, uniSearch)) return false;
      if (city && cityLabel(e) !== city) return false;
      if (onlyFit && student && languageFit(student, e.latest).state !== 'ok') return false;
      return true;
    });
    return list.sort((a, b) => Number(!!b.latest) - Number(!!a.latest));
  }, [catalog.entries, uniSearch, city, onlyFit, student]);

  const choose = (entry: CatalogEntry) => {
    if (!student) return;
    choices.add.mutate(
      { studentId: student.user_id, institutionId: entry.institution.id },
      {
        onSuccess: () => toast.success(`${displayName(entry).primary} tanlandi`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi'),
      },
    );
  };

  const sendToApplications = async () => {
    if (!student || !onCreateApplication) return;
    const pending = studentChoices.filter((c) => !appliedIds.has(c.institution_id));
    setSending(true);
    let failed = 0;
    for (const c of pending) {
      const { error } = await onCreateApplication(student.user_id, c.institution_id);
      if (error) failed += 1;
    }
    setSending(false);
    if (failed) toast.error(`${failed} ta universitetni arizaga o'tkazib bo'lmadi`);
    else toast.success("Tanlovlar Arizalar bo'limiga o'tkazildi");
  };

  if (loading || catalog.loading || choices.loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (choices.error) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Tanlovlarni yuklab bo'lmadi"
        description={choices.error.message}
      />
    );
  }

  const notApplied = studentChoices.filter((c) => !appliedIds.has(c.institution_id)).length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
      {/* ---- students ---- */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Talaba yoki magic kod"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {filteredStudents.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Hech narsa topilmadi</p>
        ) : (
          filteredStudents.map((s) => {
            const tint = paymentTint(s);
            const n = choices.byStudent.get(s.user_id)?.length ?? 0;
            return (
              <Card
                key={s.user_id}
                data-tint={tint ?? 'none'}
                onClick={() => setSelectedId(s.user_id)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 p-3 transition-all hover:shadow-raised',
                  tint && TINT_CLASS[tint],
                  student?.user_id === s.user_id && 'ring-2 ring-primary',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={s.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {getInitials(s.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[13px] font-semibold text-foreground">{s.full_name || '—'}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {n}/{MAX_CHOICES}
                </span>
              </Card>
            );
          })
        )}
      </div>

      {/* ---- selected student ---- */}
      {!student ? (
        <EmptyState icon={GraduationCap} title="Talaba tanlanmagan" description="Chapdan talabani tanlang." />
      ) : (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={student.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {getInitials(student.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-base font-bold text-foreground">{student.full_name || '—'}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="neutral">IELTS {student.ielts_score ?? '—'}</Badge>
                    <Badge variant="neutral">TOPIK {student.topik_level ?? '—'}</Badge>
                  </div>
                </div>
              </div>
              {onCreateApplication && (
                <Button
                  variant="highlight"
                  className="gap-2"
                  disabled={notApplied === 0 || sending}
                  onClick={sendToApplications}
                >
                  <Send className="h-4 w-4" />
                  Arizaga o'tkazish{notApplied > 0 ? ` (${notApplied})` : ''}
                </Button>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Tanlangan universitetlar</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  {studentChoices.length}/{MAX_CHOICES}
                </span>
              </div>
              {studentChoices.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Hali tanlanmagan — quyidagi ro'yxatdan {MAX_CHOICES} tagacha universitet tanlang.
                </p>
              ) : (
                <div className="space-y-2">
                  {studentChoices.map((c, i) => (
                    <ChoiceRow
                      key={c.id}
                      choice={c}
                      entry={entryById.get(c.institution_id)}
                      first={i === 0}
                      last={i === studentChoices.length - 1}
                      applied={appliedIds.has(c.institution_id)}
                      busy={choices.move.isPending || choices.remove.isPending}
                      onMove={(direction) => choices.move.mutate({ choice: c, direction })}
                      onRemove={() => choices.remove.mutate(c)}
                    />
                  ))}
                </div>
              )}
              {wishes.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Talabaning avvalgi istaklari: </span>
                  {wishes
                    .map((w) => w.custom_university_name || (w.institution_id && entryById.get(w.institution_id) ? displayName(entryById.get(w.institution_id)!).primary : null))
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          </Card>

          {/* ---- catalog ---- */}
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Universitet nomi"
                  value={uniSearch}
                  onChange={(e) => {
                    setUniSearch(e.target.value);
                    setVisible(PAGE);
                  }}
                  className="pl-9"
                />
              </div>
              <select
                aria-label="Shahar"
                value={city ?? ''}
                onChange={(e) => {
                  setCity(e.target.value || null);
                  setVisible(PAGE);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Barcha shaharlar</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button
                variant={onlyFit ? 'default' : 'outline'}
                size="sm"
                className="h-10 gap-1.5"
                onClick={() => {
                  setOnlyFit((v) => !v);
                  setVisible(PAGE);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Faqat mos keladigan
              </Button>
            </div>

            {universities.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Mos universitet topilmadi</p>
            ) : (
              <div className="divide-y divide-border">
                {universities.slice(0, visible).map((e) => {
                  const name = displayName(e);
                  const fit = languageFit(student, e.latest);
                  const chosen = studentChoices.some((c) => c.institution_id === e.institution.id);
                  const full = studentChoices.length >= MAX_CHOICES;
                  return (
                    <div key={e.institution.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-foreground">{name.primary}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {[name.secondary, cityLabel(e), contractRange(e.latest)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={fit.state === 'ok' ? 'successSoft' : fit.state === 'gap' ? 'warning' : 'neutral'}
                          className="text-[10px]"
                        >
                          {fit.label}
                        </Badge>
                        {chosen ? (
                          <Badge variant="info" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Tanlangan
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={full || choices.add.isPending}
                            title={full ? `Ko'pi bilan ${MAX_CHOICES} ta` : undefined}
                            onClick={() => choose(e)}
                          >
                            <Plus className="h-3 w-3" />
                            Tanlash
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {universities.length > visible && (
              <Button variant="outline" className="mt-3 w-full" onClick={() => setVisible((v) => v + PAGE)}>
                Yana ko'rsatish ({universities.length - visible} ta qoldi)
              </Button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

interface ChoiceRowProps {
  choice: UniversityChoice;
  entry: CatalogEntry | undefined;
  first: boolean;
  last: boolean;
  applied: boolean;
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function ChoiceRow({ choice, entry, first, last, applied, busy, onMove, onRemove }: ChoiceRowProps) {
  const name = entry ? displayName(entry) : { primary: '—', secondary: null };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        {choice.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-foreground">{name.primary}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {[entry ? cityLabel(entry) : null, entry ? contractRange(entry.latest) : null].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      {applied && <Badge variant="successSoft" className="text-[10px]">Arizada</Badge>}
      <div className="flex shrink-0 items-center">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Yuqoriga" disabled={first || busy} onClick={() => onMove(-1)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Pastga" disabled={last || busy} onClick={() => onMove(1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          aria-label="Olib tashlash"
          disabled={busy}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
