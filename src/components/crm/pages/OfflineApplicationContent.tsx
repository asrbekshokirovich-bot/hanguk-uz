import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, FileText, Search, Send, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { paymentTint, TINT_CLASS } from '@/lib/paymentTint';
import { getInitials, useChosenUniversityGroups, type StudentLite } from '@/hooks/useChosenUniversityGroups';
import { submissionKey, useUniversitySubmissions, type UniversitySubmission } from '@/hooks/useUniversitySubmissions';

interface OfflineApplicationContentProps {
  students: StudentLite[];
  loading: boolean;
}

interface Target {
  studentId: string;
  institutionId: string;
  universityName: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz', { day: 'numeric', month: 'short' });
}

/**
 * Oflayn ariza — the paper documents posted to each chosen university, laid
 * out like Onlayn ariza. A student whose online application for that
 * university isn't marked "Onlayn topshirildi" yet is shown dimmed: staff can
 * see them and fill in copies/notes, but can't mark their documents as sent.
 */
export default function OfflineApplicationContent({ students, loading }: OfflineApplicationContentProps) {
  const [search, setSearch] = useState('');
  const [details, setDetails] = useState<Target | null>(null);
  const [confirmSend, setConfirmSend] = useState<Target | null>(null);
  const groups = useChosenUniversityGroups(students, search);
  const submissions = useUniversitySubmissions();
  const { universities, studentById } = groups;

  if (loading || groups.loading || submissions.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }
  if (groups.error || submissions.error) {
    const err = groups.error ?? submissions.error;
    return <EmptyState icon={FileText} title="Ma'lumotni yuklab bo'lmadi" description={err?.message} />;
  }

  const sub = (studentId: string, institutionId: string): UniversitySubmission | undefined =>
    submissions.byKey.get(submissionKey(studentId, institutionId));

  const send = () => {
    const t = confirmSend;
    setConfirmSend(null);
    if (!t) return;
    submissions.save.mutate(
      { studentId: t.studentId, institutionId: t.institutionId, patch: { offline_sent_at: new Date().toISOString() } },
      {
        onSuccess: () => toast.success('Oflayn hujjat yuborildi deb belgilandi'),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi'),
      },
    );
  };

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
        universities.map((u) => {
          const sent = u.choices.filter((c) => sub(c.student_id, u.institutionId)?.offline_sent_at).length;
          return (
            <Card key={u.institutionId} className="p-5" data-testid="university-block">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-foreground">{u.name.primary}</h3>
                  <div className="truncate text-xs text-muted-foreground">
                    {[u.name.secondary, u.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="info" className="gap-1">
                    <Users className="h-3 w-3" />
                    {u.choices.length} ta talaba
                  </Badge>
                  <Badge variant={sent ? 'successSoft' : 'neutral'} className="gap-1">
                    <Send className="h-3 w-3" />
                    {sent} ta yuborildi
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {u.choices.map((c) => {
                  const s = studentById.get(c.student_id);
                  const row = sub(c.student_id, u.institutionId);
                  const online = !!row?.online_submitted_at;
                  const sentAt = row?.offline_sent_at ?? null;
                  const tint = s ? paymentTint(s) : null;
                  const target = { studentId: c.student_id, institutionId: u.institutionId, universityName: u.name.primary };
                  return (
                    <div
                      key={c.id}
                      data-testid="offline-card"
                      data-ready={online ? 'yes' : 'no'}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all',
                        tint && TINT_CLASS[tint],
                        !online && 'opacity-50',
                      )}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={!!sentAt}
                        aria-label="Oflayn hujjat yuborildi"
                        disabled={!online || !!sentAt || submissions.save.isPending}
                        title={!online ? 'Onlayn ariza hali topshirilmagan' : undefined}
                        onClick={() => setConfirmSend(target)}
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                          sentAt ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground/40 bg-background',
                          online && !sentAt && 'hover:border-primary',
                          !online && 'cursor-not-allowed',
                        )}
                      >
                        {sentAt && <Check className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetails(target)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
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
                            <div className="truncate text-[10px] text-muted-foreground">
                              {sentAt
                                ? `Yuborildi · ${fmtDate(sentAt)}`
                                : online
                                  ? 'Yuborishga tayyor'
                                  : 'Onlayn ariza tayyorlanmoqda'}
                              {row?.copies != null ? ` · ${row.copies} nusxa` : ''}
                            </div>
                          </div>
                        </div>
                        <Badge variant={c.rank === 1 ? 'default' : 'neutral'} className="shrink-0 text-[10px]">
                          {c.rank}-tanlov
                        </Badge>
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}

      <AlertDialog open={!!confirmSend} onOpenChange={(open) => !open && setConfirmSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Oflayn hujjat yuborilsinmi?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">
                {confirmSend ? studentById.get(confirmSend.studentId)?.full_name || '—' : ''}
              </span>{' '}
              ning hujjatlari {confirmSend?.universityName} ga yuborildi deb belgilanadi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Yo'q</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Ha, yuborilsin</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!details} onOpenChange={(open) => !open && setDetails(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {details && (
            <DetailsForm
              key={`${details.studentId}:${details.institutionId}`}
              target={details}
              studentName={studentById.get(details.studentId)?.full_name || '—'}
              row={sub(details.studentId, details.institutionId)}
              saving={submissions.save.isPending}
              onSave={(copies, note) =>
                submissions.save.mutate(
                  { studentId: details.studentId, institutionId: details.institutionId, patch: { copies, note } },
                  {
                    onSuccess: () => {
                      toast.success('Saqlandi');
                      setDetails(null);
                    },
                    onError: (e) => toast.error(e instanceof Error ? e.message : 'Nimadir xato ketdi'),
                  },
                )
              }
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface DetailsFormProps {
  target: Target;
  studentName: string;
  row: UniversitySubmission | undefined;
  saving: boolean;
  onSave: (copies: number | null, note: string | null) => void;
}

function DetailsForm({ target, studentName, row, saving, onSave }: DetailsFormProps) {
  const [copies, setCopies] = useState(row?.copies != null ? String(row.copies) : '');
  const [note, setNote] = useState(row?.note ?? '');
  useEffect(() => {
    setCopies(row?.copies != null ? String(row.copies) : '');
    setNote(row?.note ?? '');
  }, [row?.copies, row?.note]);

  const parsed = copies.trim() === '' ? null : Number(copies);
  const invalid = parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 50);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{studentName}</SheetTitle>
        <SheetDescription>{target.universityName}</SheetDescription>
      </SheetHeader>
      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="copies">Universitetga nechta nusxa yuboriladi</Label>
          <Input
            id="copies"
            type="number"
            min={0}
            max={50}
            inputMode="numeric"
            value={copies}
            onChange={(e) => setCopies(e.target.value)}
            placeholder="Masalan, 2"
          />
          {invalid && <p className="text-xs text-destructive">0 dan 50 gacha butun son kiriting</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Izoh</Label>
          <Textarea id="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh yozing" />
        </div>
        <Button className="w-full" disabled={invalid || saving} onClick={() => onSave(parsed, note.trim() || null)}>
          Saqlash
        </Button>
      </div>
    </>
  );
}
