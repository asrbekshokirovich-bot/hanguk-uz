import { useMemo, useState } from 'react';
import { GraduationCap, Info, Search, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { paymentTint, TINT_CLASS } from '@/lib/paymentTint';
import { buildStudentPipeline } from '@/lib/studentPipeline';
import { formatInterview } from '@/lib/interviewTime';
import {
  PIPELINE_LABELS,
  PIPELINE_STAGES,
  type PipelineStage,
} from '@/lib/applicationPipeline';
import { getInitials } from '@/hooks/useChosenUniversityGroups';
import { useUniversityCatalog } from '@/hooks/useUniversityCatalog';
import { useUniversitySubmissions, type UniversitySubmission } from '@/hooks/useUniversitySubmissions';
import { displayName } from '@/components/crm/pages/university-catalog/format';

export interface PipelineStudent {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  magic_code: string | null;
  contract_date?: string | null;
  hasPaid?: boolean;
  docsReady?: boolean;
  documents?: Tables<'documents'>[];
}

interface ApplicationsPipelineProps<S extends PipelineStudent> {
  students: S[];
  loading: boolean;
  onOpenStudent: (student: S) => void;
}

const STAGE_DOT: Record<PipelineStage, string> = {
  new: 'bg-muted-foreground/60',
  docs_ready: 'bg-info',
  online: 'bg-primary',
  offline: 'bg-primary',
  interview: 'bg-warning',
  result: 'bg-success',
  visa_process: 'bg-warning',
  visa_waiting: 'bg-warning',
  visa_received: 'bg-success',
};

/**
 * Arizalar — a read-only board of where every student is. Nothing is changed
 * here: a student moves on by itself when Hujjatlar, Onlayn / Oflayn ariza or
 * the results map record the next step (src/lib/applicationPipeline.ts).
 * Clicking a card opens the student.
 */
export default function ApplicationsPipeline<S extends PipelineStudent>({
  students,
  loading,
  onOpenStudent,
}: ApplicationsPipelineProps<S>) {
  const [search, setSearch] = useState('');
  const submissions = useUniversitySubmissions();
  const catalog = useUniversityCatalog();

  const uniName = useMemo(() => {
    const m = new Map(catalog.entries.map((e) => [e.institution.id, displayName(e).primary]));
    return (id: string) => m.get(id) ?? '—';
  }, [catalog.entries]);

  const subsByStudent = useMemo(() => {
    const m = new Map<string, UniversitySubmission[]>();
    for (const s of submissions.byKey.values()) m.set(s.student_id, [...(m.get(s.student_id) ?? []), s]);
    return m;
  }, [submissions.byKey]);

  const columns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStage = new Map<PipelineStage, { student: S; detail: string | null; accepted: boolean | null }[]>(
      PIPELINE_STAGES.map((s) => [s, []]),
    );
    for (const student of students) {
      if (q && !`${student.full_name ?? ''} ${student.magic_code ?? ''}`.toLowerCase().includes(q)) continue;
      const subs = subsByStudent.get(student.user_id) ?? [];
      // The one rule every CRM screen uses (src/lib/studentPipeline.ts).
      const pipeline = buildStudentPipeline({ docsReady: student.docsReady, documents: student.documents, submissions: subs });
      const { stage } = pipeline;
      const pack = { requiredVerified: pipeline.docsVerified, requiredTotal: pipeline.docsRequired };
      let detail: string | null = null;
      let accepted: boolean | null = null;
      if (stage === 'docs_ready' || stage === 'new') {
        detail = `Hujjatlar ${pack.requiredVerified}/${pack.requiredTotal}`;
      } else if (stage === 'online' || stage === 'offline') {
        const ids = subs.filter((s) => (stage === 'online' ? s.online_submitted_at : s.offline_sent_at)).map((s) => s.institution_id);
        // Every university on its own line, never "Ajou +1" (Asrbek, 2026-10-29).
        detail = ids.map(uniName).join('\n');
      } else if (stage === 'visa_process' || stage === 'visa_waiting' || stage === 'visa_received') {
        const final = subs.find((s) => s.final_at);
        detail = final ? uniName(final.institution_id) : null;
      } else if (stage === 'interview') {
        const next = subs
          .filter((s) => s.interview_at)
          .sort((a, b) => a.interview_at!.localeCompare(b.interview_at!));
        detail = next.map((s) => `${uniName(s.institution_id)} · ${formatInterview(s.interview_at!)}`).join('\n');
      } else if (stage === 'result') {
        const final = subs.find((s) => s.final_at);
        const admitted = subs.filter((s) => s.result === 'accepted');
        const waiting = subs.some((s) => (s.online_submitted_at || s.offline_sent_at) && !s.result);
        if (final) {
          accepted = true;
          detail = `Yakuniy: ${uniName(final.institution_id)}`;
        } else if (admitted.length > 0) {
          accepted = true;
          detail = admitted.map((s) => `Kirdi: ${uniName(s.institution_id)}`).join('\n');
        } else if (waiting) {
          detail = 'Kirmadi · boshqalari kutilmoqda';
        } else {
          accepted = false;
          detail = 'Hammasidan kirmadi';
        }
      }
      byStage.get(stage)!.push({ student, detail, accepted });
    }
    return byStage;
  }, [students, subsByStudent, search, uniName]);

  if (loading || submissions.loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96 w-64 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Talaba ismi yoki kodi" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Bu bo'lim avtomatik: talaba Hujjatlar, Onlayn va Oflayn ariza bo'limlaridagi ish (suhbat vaqti, natija, viza holati) bo'yicha o'zi keyingi ustunga o'tadi.
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => {
          const items = columns.get(stage) ?? [];
          return (
            <div key={stage} data-testid={`column-${stage}`} className="flex w-64 shrink-0 flex-col rounded-xl bg-muted/40 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', STAGE_DOT[stage])} />
                  <span className="text-[13px] font-bold text-foreground">{PIPELINE_LABELS[stage]}</span>
                </div>
                <Badge variant="neutral" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2">
                {items.map(({ student, detail, accepted }) => {
                  const tint = paymentTint(student);
                  return (
                    <button
                      key={student.user_id}
                      type="button"
                      data-testid="pipeline-card"
                      onClick={() => onOpenStudent(student)}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 text-left transition-shadow hover:shadow-raised',
                        tint && TINT_CLASS[tint],
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {getInitials(student.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-semibold text-foreground">{student.full_name || '—'}</div>
                          {student.magic_code && <div className="font-mono text-[10px] text-muted-foreground">HK · {student.magic_code}</div>}
                        </div>
                      </div>
                      {detail && (
                        <div
                          className={cn(
                            'flex items-start gap-1 text-[11px]',
                            accepted === true ? 'font-semibold text-success' : accepted === false ? 'font-semibold text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {accepted === true && <GraduationCap className="mt-0.5 h-3 w-3 shrink-0" />}
                          {accepted === false && <X className="mt-0.5 h-3 w-3 shrink-0" />}
                          <span className="min-w-0">
                            {detail.split('\n').map((line, i) => (
                              <span key={i} className="block truncate">
                                {line}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
