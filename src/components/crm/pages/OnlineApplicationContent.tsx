import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { paymentTint, TINT_CLASS } from '@/lib/paymentTint';
import { useUniversityCatalog } from '@/hooks/useUniversityCatalog';
import { useUniversityChoices } from '@/hooks/useUniversityChoices';
import { useStudentSurveyAnswers } from '@/hooks/useStudentSurveyAnswers';
import { cityLabel, displayName } from '@/components/crm/pages/university-catalog/format';

interface StudentLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  magic_code: string | null;
  contract_date?: string | null;
  hasPaid?: boolean;
}

interface OnlineApplicationContentProps {
  /** The CRM's loaded students; anyone chosen for a university but not in it is fetched. */
  students: StudentLite[];
  loading: boolean;
}

function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Onlayn ariza — organised by university. Only universities that were chosen
 * for at least one student (on the Universitet tanlash page) appear, each with
 * a card for every student who chose it, labelled with that student's rank
 * for it. A student with three choices appears under all three.
 */
export default function OnlineApplicationContent({ students, loading }: OnlineApplicationContentProps) {
  const catalog = useUniversityCatalog();
  const choices = useUniversityChoices();
  const [search, setSearch] = useState('');
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const allChoices = useMemo(() => [...choices.byStudent.values()].flat(), [choices.byStudent]);

  const known = useMemo(() => new Map(students.map((s) => [s.user_id, s])), [students]);
  const missingIds = useMemo(
    () => [...new Set(allChoices.map((c) => c.student_id))].filter((id) => !known.has(id)).sort(),
    [allChoices, known],
  );
  const extraProfiles = useQuery<StudentLite[], Error>({
    queryKey: ['online-application-profiles', missingIds],
    enabled: missingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, magic_code, contract_date')
        .in('user_id', missingIds);
      if (error) throw new Error(error.message);
      return (data ?? []) as StudentLite[];
    },
  });
  const studentById = useMemo(() => {
    const m = new Map(known);
    for (const p of extraProfiles.data ?? []) m.set(p.user_id, p);
    return m;
  }, [known, extraProfiles.data]);

  const entryById = useMemo(() => new Map(catalog.entries.map((e) => [e.institution.id, e])), [catalog.entries]);

  const universities = useMemo(() => {
    const groups = new Map<string, typeof allChoices>();
    for (const c of allChoices) groups.set(c.institution_id, [...(groups.get(c.institution_id) ?? []), c]);
    const q = search.trim().toLowerCase();
    return [...groups.entries()]
      .map(([institutionId, list]) => {
        const entry = entryById.get(institutionId);
        const name = entry ? displayName(entry) : { primary: '—', secondary: null };
        const sorted = [...list].sort(
          (a, b) =>
            a.rank - b.rank ||
            (studentById.get(a.student_id)?.full_name ?? '').localeCompare(studentById.get(b.student_id)?.full_name ?? ''),
        );
        return { institutionId, name, city: entry ? cityLabel(entry) : null, choices: sorted };
      })
      .filter((u) => {
        if (!q) return true;
        if (`${u.name.primary} ${u.name.secondary ?? ''}`.toLowerCase().includes(q)) return true;
        return u.choices.some((c) => (studentById.get(c.student_id)?.full_name ?? '').toLowerCase().includes(q));
      })
      .sort((a, b) => b.choices.length - a.choices.length || a.name.primary.localeCompare(b.name.primary));
  }, [allChoices, entryById, studentById, search]);

  if (loading || catalog.loading || choices.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (choices.error) {
    return <EmptyState icon={FileText} title="Ma'lumotni yuklab bo'lmadi" description={choices.error.message} />;
  }

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
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setOpenStudentId(c.student_id)}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left transition-all hover:shadow-raised',
                      tint && TINT_CLASS[tint],
                    )}
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
