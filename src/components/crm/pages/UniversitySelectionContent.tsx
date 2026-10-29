import { useMemo, useState } from 'react';
import type { StudentPipeline } from '@/lib/studentPipeline';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, CheckCircle2, GraduationCap, Handshake, Lock, Plus, RefreshCw, Search, X } from 'lucide-react';
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
import {
  canConfirm,
  CHANGE_REASON_LABELS,
  MAX_CHOICES,
  MAX_REGULAR,
  PARTNER_RANK,
  useUniversityChoices,
  type UniversityChoice,
} from '@/hooks/useUniversityChoices';
import {
  cityLabel,
  contractRange,
  displayName,
  matchesSearch,
  operatorCities,
} from '@/components/crm/pages/university-catalog/format';
import { StudentFeePanel } from '@/components/crm/pages/application-fees/StudentFeePanel';

type StudentProfile = Tables<'profiles'> & {
  /** From useCRMData (src/lib/studentPipeline.ts). */
  pipeline?: Pick<StudentPipeline, 'submissions'>;
  hasPaid?: boolean;
};

interface UniversitySelectionContentProps {
  students: StudentProfile[];
  loading: boolean;
  /**
   * Shows the "Application fee" block of the selected student (payments per
   * university). useUserRole().canSeeApplicationFees: owner, admin, document
   * handler, plus whoever application_fee_access names.
   */
  canSeeApplicationFees?: boolean;
}

const PAGE = 40;

function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UniversitySelectionContent({
  students,
  loading,
  canSeeApplicationFees = false,
}: UniversitySelectionContentProps) {
  const catalog = useUniversityCatalog();
  const choices = useUniversityChoices();

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uniSearch, setUniSearch] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [onlyFit, setOnlyFit] = useState(false);
  const [visible, setVisible] = useState(PAGE);

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
  // "Arizada" = sent online or posted (student_university_submissions). A
  // confirmed choice reaches Onlayn / Oflayn ariza by itself, so there is no
  // separate "send to applications" step any more.
  const appliedIds = new Set(
    (student?.pipeline?.submissions ?? [])
      .filter((s) => s.online_submitted_at || s.offline_sent_at)
      .map((s) => s.institution_id),
  );

  const entryById = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    for (const e of catalog.entries) m.set(e.institution.id, e);
    return m;
  }, [catalog.entries]);

  const cities = useMemo(() => operatorCities(catalog.entries), [catalog.entries]);

  // The third choice is always a partner university. With exactly one partner
  // it is filled in automatically; with several, staff pick one.
  const partners = useMemo(() => catalog.entries.filter((e) => e.institution.is_partner), [catalog.entries]);
  const autoPartnerId = partners.length === 1 ? partners[0].institution.id : null;
  const regularChoices = studentChoices.filter((c) => c.rank !== PARTNER_RANK);
  const partnerChoice = studentChoices.find((c) => c.rank === PARTNER_RANK) ?? null;
  const [partnerPick, setPartnerPick] = useState('');

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

  const choose = (entry: CatalogEntry, partner = false) => {
    if (!student) return;
    choices.add.mutate(
      { studentId: student.user_id, institutionId: entry.institution.id, partner, autoPartnerId },
      {
        onSuccess: () => toast.success(`${displayName(entry).primary} tanlandi`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi'),
      },
    );
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

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi');

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
            </div>

            <div className="border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Tanlangan universitetlar</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  {studentChoices.length}/{MAX_CHOICES}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Xodim {MAX_REGULAR} ta universitet tanlaydi — talaba ilovada rozi bo'lgach, yakuniy tasdiqlang. 3-tanlov — hamkor universitet, talaba tasdig'i shart emas.
              </p>
              <div className="space-y-2">
                {regularChoices.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Hali tanlanmagan — quyidagi ro'yxatdan {MAX_REGULAR} ta universitet tanlang.
                  </p>
                )}
                {[...regularChoices, ...(partnerChoice ? [partnerChoice] : [])].map((c, i) => (
                  <ChoiceRow
                    key={c.id}
                    choice={c}
                    entry={entryById.get(c.institution_id)}
                    first={i === 0}
                    last={c.rank === PARTNER_RANK || i === regularChoices.length - 1}
                    applied={appliedIds.has(c.institution_id)}
                    busy={choices.move.isPending || choices.remove.isPending || choices.confirm.isPending}
                    onMove={(direction) => choices.move.mutate({ choice: c, direction }, { onError })}
                    onRemove={() => choices.remove.mutate(c, { onError })}
                    onConfirm={() =>
                      choices.confirm.mutate(c, { onSuccess: () => toast.success('Yakuniy tasdiqlandi'), onError })
                    }
                  />
                ))}
                {!partnerChoice && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
                    <Handshake className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">3-tanlov — hamkor universitet</span>
                    {partners.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Katalogda hamkor universitet yo'q</span>
                    ) : partners.length === 1 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7 gap-1 text-xs"
                        disabled={choices.add.isPending}
                        onClick={() => choose(partners[0], true)}
                      >
                        <Plus className="h-3 w-3" />
                        {displayName(partners[0]).primary}
                      </Button>
                    ) : (
                      <div className="ml-auto flex items-center gap-2">
                        <select
                          aria-label="Hamkor universitet"
                          value={partnerPick}
                          onChange={(e) => setPartnerPick(e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">Hamkorni tanlang</option>
                          {partners.map((pe) => (
                            <option key={pe.institution.id} value={pe.institution.id}>
                              {displayName(pe).primary}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!partnerPick || choices.add.isPending}
                          onClick={() => {
                            const pe = partners.find((x) => x.institution.id === partnerPick);
                            if (pe) choose(pe, true);
                          }}
                        >
                          Qo'shish
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

            {/* ---- application fee (was its own sidebar page) ---- */}
            {canSeeApplicationFees && <StudentFeePanel key={student.user_id} studentId={student.user_id} />}
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
                  const isPartner = e.institution.is_partner;
                  // A partner can only go into the partner slot.
                  const full = isPartner ? !!partnerChoice : regularChoices.length >= MAX_REGULAR;
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
                            title={full ? (isPartner ? 'Hamkor tanlovi band' : `Xodim ko'pi bilan ${MAX_REGULAR} ta tanlaydi`) : undefined}
                            onClick={() => choose(e, isPartner)}
                          >
                            <Plus className="h-3 w-3" />
                            {isPartner ? 'Hamkor sifatida' : 'Tanlash'}
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
  onConfirm: () => void;
}

function fmtDay(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('uz', { day: 'numeric', month: 'short' }) : '';
}

function StatusBadge({ choice }: { choice: UniversityChoice }) {
  if (choice.rank === PARTNER_RANK && choice.status !== 'confirmed') {
    return (
      <Badge variant="info" className="text-[10px]">
        Talaba tasdig'i shart emas
      </Badge>
    );
  }
  switch (choice.status) {
    case 'confirmed':
      return (
        <Badge variant="successSoft" className="gap-1 text-[10px]">
          <Lock className="h-3 w-3" />
          Biriktirildi · {fmtDay(choice.confirmed_at)}
        </Badge>
      );
    case 'accepted':
      return (
        <Badge variant="successSoft" className="gap-1 text-[10px]">
          <CheckCircle2 className="h-3 w-3" />
          Talaba rozi · {fmtDay(choice.responded_at)}
        </Badge>
      );
    case 'change_requested':
      return (
        <Badge variant="destructive" className="text-[10px]">
          Talaba o'zgartirish so'radi
        </Badge>
      );
    default:
      return (
        <Badge variant="warning" className="text-[10px]">
          Talaba javobi kutilmoqda
        </Badge>
      );
  }
}

function ChoiceRow({ choice, entry, first, last, applied, busy, onMove, onRemove, onConfirm }: ChoiceRowProps) {
  const name = entry ? displayName(entry) : { primary: '—', secondary: null };
  const isPartner = choice.rank === PARTNER_RANK;
  const confirmed = choice.status === 'confirmed';
  const changeRequested = choice.status === 'change_requested';
  return (
    <div
      data-testid="choice-row"
      data-status={choice.status}
      className={cn(
        'space-y-2 rounded-lg border bg-background px-3 py-2',
        changeRequested ? 'border-destructive/40 bg-destructive/5' : confirmed ? 'border-success/40' : 'border-border',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {choice.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
            {name.primary}
            {isPartner && <Badge variant="info" className="text-[10px]">Hamkor</Badge>}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {[entry ? cityLabel(entry) : null, entry ? contractRange(entry.latest) : null].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <StatusBadge choice={choice} />
        {applied && <Badge variant="successSoft" className="text-[10px]">Arizada</Badge>}
        {!confirmed && (
          <div className="flex shrink-0 items-center">
            {!isPartner && (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Yuqoriga" disabled={first || busy} onClick={() => onMove(-1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Pastga" disabled={last || busy} onClick={() => onMove(1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
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
        )}
      </div>
      {changeRequested && (
        <div className="flex flex-wrap items-center justify-between gap-2 pl-10">
          <div className="text-xs text-foreground">
            <span className="font-semibold">{CHANGE_REASON_LABELS[choice.change_reason ?? ''] ?? 'Sabab ko\'rsatilmagan'}</span>
            {choice.change_note && <span className="text-muted-foreground"> — “{choice.change_note}”</span>}
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busy} onClick={onRemove}>
            <RefreshCw className="h-3 w-3" />
            Almashtirish
          </Button>
        </div>
      )}
      {canConfirm(choice) && (
        <div className="pl-10">
          <Button size="sm" variant="highlight" className="h-7 gap-1 text-xs" disabled={busy} onClick={onConfirm}>
            <Lock className="h-3 w-3" />
            Yakuniy tasdiqlash
          </Button>
        </div>
      )}
    </div>
  );
}
