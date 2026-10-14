import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, FileText, Search, Users } from 'lucide-react';
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
  const groups = useChosenUniversityGroups(students, search);
  const submissions = useUniversitySubmissions();
  const { universities, studentById } = groups;

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

  const openStudent = openStudentId ? studentById.get(openStudentId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Universitet yoki talaba"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {universities.length === 0 ? (
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
                const online = !!submissions.byKey.get(submissionKey(c.student_id, u.institutionId))?.online_submitted_at;
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
