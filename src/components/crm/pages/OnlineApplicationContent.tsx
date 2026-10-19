import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, Circle, FileText, Search, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { paymentTint, TINT_CLASS } from '@/lib/paymentTint';
import { useStudentSurveyAnswers } from '@/hooks/useStudentSurveyAnswers';
import { getInitials, useChosenUniversityGroups, type StudentLite } from '@/hooks/useChosenUniversityGroups';
import { submissionKey, useUniversitySubmissions } from '@/hooks/useUniversitySubmissions';
import { formatInterview, toLocalInput } from '@/lib/interviewTime';
import AdmissionResultsMap from './AdmissionResultsMap';

interface OnlineApplicationContentProps {
  /** The CRM's loaded students; anyone chosen for a university but not in it is fetched. */
  students: StudentLite[];
  loading: boolean;
}

/**
 * Onlayn ariza — organised by university. Only universities that were chosen
 * for at least one student (on the Universitet tanlash page) appear, each with
 * a card for every student who chose it, labelled with that student's rank
 * for it. A student with three choices appears under all three.
 */
export default function OnlineApplicationContent({ students, loading }: OnlineApplicationContentProps) {
  const [search, setSearch] = useState('');
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [view, setView] = useState<'universities' | 'results'>('universities');
  const groups = useChosenUniversityGroups(students, search);
  const submissions = useUniversitySubmissions();
  const { universities, studentById, confirmedByStudent, universityName } = groups;

  if (loading || groups.loading || submissions.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (groups.error) {
    return <EmptyState icon={FileText} title="Ma'lumotni yuklab bo'lmadi" description={groups.error.message} />;
  }

  // "Onlayn topshirildi" is what lets the Oflayn ariza page send this
  // student's paper documents to this university.
  const toggleOnline = (studentId: string, institutionId: string, done: boolean) => {
    submissions.save.mutate(
      { studentId, institutionId, patch: { online_submitted_at: done ? null : new Date().toISOString() } },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi') },
    );
  };

  const saveInterview = (studentId: string, institutionId: string, interviewAt: string | null) => {
    submissions.save.mutate(
      { studentId, institutionId, patch: { interview_at: interviewAt } },
      {
        onSuccess: () => toast.success(interviewAt ? 'Suhbat vaqti saqlandi' : "Suhbat vaqti o'chirildi"),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi'),
      },
    );
  };

  const openStudent = openStudentId ? studentById.get(openStudentId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="tablist">
          {(
            [
              ['universities', "Universitetlar bo'yicha"],
              ['results', 'Natijalar'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'universities' && (
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Universitet yoki talaba"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {view === 'results' ? (
        <AdmissionResultsMap
          choicesByStudent={confirmedByStudent}
          studentById={studentById}
          universityName={universityName}
          submissions={submissions.byKey}
          saving={submissions.save.isPending}
          onSave={(studentId, institutionId, patch) => submissions.save.mutateAsync({ studentId, institutionId, patch })}
        />
      ) : universities.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Hali universitet tanlanmagan"
          description="Universitet tanlash bo'limida talabaga universitet tanlansa, u shu yerda paydo bo'ladi."
        />
      ) : (
        universities.map((u) => (
          <Card key={u.institutionId} className="p-5" data-testid="university-block">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">{u.name.primary}</h3>
                <div className="truncate text-xs text-muted-foreground">
                  {[u.name.secondary, u.city].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Badge variant="info" className="gap-1">
                <Users className="h-3 w-3" />
                {u.choices.length} ta talaba
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {u.choices.map((c) => {
                const s = studentById.get(c.student_id);
                const tint = s ? paymentTint(s) : null;
                const sub = submissions.byKey.get(submissionKey(c.student_id, u.institutionId));
                const online = !!sub?.online_submitted_at;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-raised',
                      tint && TINT_CLASS[tint],
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenStudentId(c.student_id)}
                      className="flex items-center justify-between gap-2 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={s?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {getInitials(s?.full_name ?? null)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-foreground">{s?.full_name || '—'}</div>
                          {s?.magic_code && <div className="font-mono text-[10px] text-muted-foreground">HK · {s.magic_code}</div>}
                        </div>
                      </div>
                      <Badge variant={c.rank === 1 ? 'default' : 'neutral'} className="shrink-0 text-[10px]">
                        {c.rank}-tanlov
                      </Badge>
                    </button>
                    <button
                      type="button"
                      aria-pressed={online}
                      disabled={submissions.save.isPending}
                      onClick={() => toggleOnline(c.student_id, u.institutionId, online)}
                      className={cn(
                        'flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                        online ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {online ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      Onlayn topshirildi
                    </button>
                    <InterviewField
                      value={sub?.interview_at ?? null}
                      disabled={submissions.save.isPending}
                      onSave={(at) => saveInterview(c.student_id, u.institutionId, at)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      <Sheet open={!!openStudentId} onOpenChange={(open) => !open && setOpenStudentId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{openStudent?.full_name || '—'}</SheetTitle>
            <SheetDescription>So'rovnoma javoblari</SheetDescription>
          </SheetHeader>
          {openStudentId && <SurveyAnswers studentId={openStudentId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Suhbat (university interview) date and time for one student at one
 * university. Saved when the field loses focus, so typing a date part by part
 * does not save half-entered values.
 */
function InterviewField({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled: boolean;
  onSave: (interviewAt: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <div className="flex items-center gap-1 self-start">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraft(value ? toLocalInput(value) : '');
            setEditing(true);
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
            value ? 'bg-info/15 text-info' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {value ? `Suhbat: ${formatInterview(value)}` : "Suhbat vaqtini qo'shish"}
        </button>
        {value && (
          <button
            type="button"
            aria-label="Suhbat vaqtini o'chirish"
            disabled={disabled}
            onClick={() => onSave(null)}
            className="rounded-md p-1 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  const commit = () => {
    setEditing(false);
    if (!draft) return;
    const at = new Date(draft);
    if (Number.isNaN(at.getTime())) return;
    const iso = at.toISOString();
    if (value && new Date(value).getTime() === at.getTime()) return;
    onSave(iso);
  };

  return (
    <Input
      type="datetime-local"
      aria-label="Suhbat sanasi va vaqti"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-8 self-start text-xs"
    />
  );
}

function SurveyAnswers({ studentId }: { studentId: string }) {
  const { data, isLoading, error } = useStudentSurveyAnswers(studentId);
  if (isLoading) return <Skeleton className="mt-4 h-64 rounded-xl" />;
  if (error) return <p className="mt-4 text-sm text-destructive">Javoblarni yuklab bo'lmadi: {error.message}</p>;
  if (!data || data.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Talaba hali so'rovnoma to'ldirmagan.</p>;
  }
  return (
    <div className="mt-4 space-y-6">
      {data.map((block) => (
        <section key={block.surveyId}>
          <h4 className="mb-2 text-sm font-bold text-foreground">{block.title}</h4>
          <ol className="space-y-3">
            {block.items.map((item, i) => (
              <li key={item.questionId} className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {i + 1}. {item.question}
                </div>
                <div className={cn('mt-1 whitespace-pre-wrap text-sm', item.answer ? 'text-foreground' : 'italic text-muted-foreground')}>
                  {item.answer ?? 'Javob berilmagan'}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
