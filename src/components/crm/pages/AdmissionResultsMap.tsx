import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, ChevronDown, GraduationCap, Hourglass, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getInitials, type StudentLite } from '@/hooks/useChosenUniversityGroups';
import { PARTNER_RANK, type UniversityChoice } from '@/hooks/useUniversityChoices';
import {
  submissionKey,
  type AdmissionResult,
  type SubmissionPatch,
  type UniversitySubmission,
} from '@/hooks/useUniversitySubmissions';

interface AdmissionResultsMapProps {
  /** Confirmed choices per student. */
  choicesByStudent: Map<string, UniversityChoice[]>;
  studentById: Map<string, StudentLite>;
  universityName: (institutionId: string) => string;
  submissions: Map<string, UniversitySubmission>;
  saving: boolean;
  onSave: (studentId: string, institutionId: string, patch: SubmissionPatch) => Promise<void>;
}

type RowState = 'final' | 'choose' | 'risk' | 'waiting';

const RESULT_STYLE: Record<'accepted' | 'rejected' | 'waiting', string> = {
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  waiting: 'bg-warning/10 text-warning',
};

/**
 * "Natijalar" — the results map on Onlayn ariza: every student's choices
 * coloured by the university's answer. Staff set each result once it is
 * announced; when a student gets in somewhere, staff pick the final university
 * and the student confirms it in the app. A student turned down everywhere is
 * flagged so they can be moved to another university quickly.
 */
export default function AdmissionResultsMap({
  choicesByStudent,
  studentById,
  universityName,
  submissions,
  saving,
  onSave,
}: AdmissionResultsMapProps) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [choosingFor, setChoosingFor] = useState<string | null>(null);

  const rows = useMemo(() => {
    return [...choicesByStudent.entries()]
      .map(([studentId, choices]) => {
        const sorted = [...choices].sort((a, b) => a.rank - b.rank);
        const subs = sorted.map((c) => submissions.get(submissionKey(studentId, c.institution_id)));
        const accepted = sorted.filter((_, i) => subs[i]?.result === 'accepted');
        const final = sorted.find((_, i) => !!subs[i]?.final_at) ?? null;
        const finalSub = final ? submissions.get(submissionKey(studentId, final.institution_id)) : undefined;
        const allRejected = sorted.length > 0 && subs.every((s) => s?.result === 'rejected');
        const state: RowState = final ? 'final' : accepted.length > 0 ? 'choose' : allRejected ? 'risk' : 'waiting';
        return { studentId, choices: sorted, accepted, final, finalSub, state };
      })
      .sort((a, b) =>
        (studentById.get(a.studentId)?.full_name ?? '').localeCompare(studentById.get(b.studentId)?.full_name ?? ''),
      );
  }, [choicesByStudent, submissions, studentById]);

  const counts = useMemo(() => {
    const c = { final: 0, choose: 0, risk: 0, waiting: 0 };
    for (const r of rows) c[r.state] += 1;
    return c;
  }, [rows]);

  const save = async (studentId: string, institutionId: string, patch: SubmissionPatch, done: string) => {
    try {
      await onSave(studentId, institutionId, patch);
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi');
    }
  };

  const setResult = (studentId: string, institutionId: string, result: AdmissionResult | null) => {
    setOpenCell(null);
    const label = result === 'accepted' ? 'Kirdi deb belgilandi' : result === 'rejected' ? 'Kirmadi deb belgilandi' : 'Kutilmoqda';
    void save(studentId, institutionId, { result }, label);
  };

  const setFinal = (studentId: string, institutionId: string | null, current: string | null) => {
    setChoosingFor(null);
    if (institutionId) void save(studentId, institutionId, { final_at: new Date().toISOString() }, 'Yakuniy universitet belgilandi');
    else if (current) void save(studentId, current, { final_at: null }, 'Yakuniy tanlov bekor qilindi');
  };

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Hali yakuniy tasdiqlangan universitet yo'q — natijalar shu yerda ko'rinadi.
      </Card>
    );
  }

  return (
    <Card className="p-5" data-testid="results-map">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">Talabalar natijasi</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="successSoft" className="gap-1"><GraduationCap className="h-3 w-3" />Kirdi</Badge>
          <Badge variant="warning" className="gap-1"><Hourglass className="h-3 w-3" />Kutilmoqda</Badge>
          <Badge variant="destructive" className="gap-1 bg-destructive/10 text-destructive"><X className="h-3 w-3" />Kirmadi</Badge>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span><b className="text-success">{counts.final}</b> yakuniy tanlangan</span>
        <span><b className="text-success">{counts.choose}</b> tanlash kerak</span>
        <span><b className="text-warning">{counts.waiting}</b> kutilmoqda</span>
        <span><b className="text-destructive">{counts.risk}</b> xavf</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[220px_1fr_1fr_1fr_190px] gap-2 border-b border-border pb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Talaba</span>
            <span>1-tanlov</span>
            <span>2-tanlov</span>
            <span>3-tanlov (hamkor)</span>
            <span>Yakuniy</span>
          </div>
          {rows.map((row) => {
            const s = studentById.get(row.studentId);
            const byRank = new Map(row.choices.map((c) => [c.rank, c]));
            return (
              <div
                key={row.studentId}
                data-testid="result-row"
                data-state={row.state}
                className="grid grid-cols-[220px_1fr_1fr_1fr_190px] items-start gap-2 border-b border-border py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={s?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {getInitials(s?.full_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[13px] font-semibold text-foreground">{s?.full_name || '—'}</span>
                </div>
                {[1, 2, PARTNER_RANK].map((rank) => {
                  const c = byRank.get(rank);
                  if (!c) return <span key={rank} className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">—</span>;
                  const sub = submissions.get(submissionKey(row.studentId, c.institution_id));
                  const submitted = !!(sub?.online_submitted_at || sub?.offline_sent_at);
                  const result = sub?.result ?? null;
                  const cellKey = `${row.studentId}:${c.institution_id}`;
                  const name = universityName(c.institution_id);
                  return (
                    <div key={rank} className="relative min-w-0">
                      <button
                        type="button"
                        disabled={!submitted || saving}
                        title={submitted ? 'Natijani belgilash' : 'Hali topshirilmagan'}
                        onClick={() => setOpenCell(openCell === cellKey ? null : cellKey)}
                        className={cn(
                          'flex w-full items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold transition-opacity',
                          submitted ? RESULT_STYLE[result ?? 'waiting'] : 'bg-muted text-muted-foreground',
                          submitted && 'hover:opacity-80',
                        )}
                      >
                        {result === 'accepted' ? (
                          <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                        ) : result === 'rejected' ? (
                          <X className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Hourglass className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{name}</span>
                      </button>
                      {!submitted && <div className="mt-0.5 text-[10px] text-muted-foreground">Hali topshirilmagan</div>}
                      {openCell === cellKey && (
                        <div className="absolute left-0 top-full z-20 mt-1 flex w-40 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                          <MenuItem onClick={() => setResult(row.studentId, c.institution_id, 'accepted')} className="text-success">
                            <GraduationCap className="h-3.5 w-3.5" /> Kirdi
                          </MenuItem>
                          <MenuItem onClick={() => setResult(row.studentId, c.institution_id, null)} className="text-warning">
                            <Hourglass className="h-3.5 w-3.5" /> Kutilmoqda
                          </MenuItem>
                          <MenuItem onClick={() => setResult(row.studentId, c.institution_id, 'rejected')} className="text-destructive">
                            <X className="h-3.5 w-3.5" /> Kirmadi
                          </MenuItem>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="relative min-w-0">
                  {row.state === 'final' && row.final && (
                    <div>
                      <Badge variant="successSoft" className="max-w-full gap-1 truncate">
                        <Check className="h-3 w-3 shrink-0" />
                        <span className="truncate">{universityName(row.final.institution_id)}</span>
                      </Badge>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {row.finalSub?.student_confirmed_at ? 'Talaba tasdiqladi' : "Talaba tasdig'i kutilmoqda"}
                        {!row.finalSub?.student_confirmed_at && (
                          <button
                            type="button"
                            className="ml-1 underline hover:text-foreground"
                            disabled={saving}
                            onClick={() => setFinal(row.studentId, null, row.final!.institution_id)}
                          >
                            bekor qilish
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {row.state === 'choose' && (
                    <>
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={saving}
                        onClick={() => setChoosingFor(choosingFor === row.studentId ? null : row.studentId)}
                      >
                        Tanlash <ChevronDown className="h-3 w-3" />
                      </Button>
                      {choosingFor === row.studentId && (
                        <div className="absolute right-0 top-full z-20 mt-1 flex w-56 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">Qaysi biriga boradi?</div>
                          {row.accepted.map((c) => (
                            <MenuItem key={c.institution_id} onClick={() => setFinal(row.studentId, c.institution_id, null)}>
                              <GraduationCap className="h-3.5 w-3.5 text-success" /> {universityName(c.institution_id)}
                            </MenuItem>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {row.state === 'risk' && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Xavf
                    </Badge>
                  )}
                  {row.state === 'waiting' && <span className="text-xs text-muted-foreground">kutilmoqda</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Natijani belgilash uchun universitet ustiga bosing. Talaba kirgan universitetlardan birini yakuniy deb tanlang — talaba
        ilovada tasdiqlaydi. Kirdi va yakuniy tanlov haqida talabaga bildirishnoma boradi.
      </p>
    </Card>
  );
}

function MenuItem({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted', className)}
    >
      {children}
    </button>
  );
}
