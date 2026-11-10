import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { loadFacultyOptions, type FacultyOption } from '@/hooks/useUniversityChoices';

const DEGREE_LABEL: Record<string, string> = { bakalavr: 'Bakalavr', magistratura: 'Magistratura', kasbiy: 'Kasbiy' };

/**
 * Pick the faculty a student applies to at one university — from the
 * university's guideline (the same list the app shows), or typed by hand.
 */
export function FacultyDialog({
  open,
  onOpenChange,
  institutionId,
  universityName,
  studentName,
  current,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  universityName: string;
  studentName: string;
  current: { faculty: string | null; college: string | null };
  saving: boolean;
  onSave: (faculty: string | null, college: string | null) => void;
}) {
  const [options, setOptions] = useState<FacultyOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const [picked, setPicked] = useState<{ faculty: string; college: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setManual('');
    setPicked(current.faculty ? { faculty: current.faculty, college: current.college } : null);
    setOptions(null);
    setError(null);
    loadFacultyOptions(institutionId)
      .then(setOptions)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [open, institutionId, current.faculty, current.college]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options ?? [];
    if (!q) return list;
    return list.filter((o) => [o.faculty, o.faculty_kr, o.college].some((v) => v?.toLowerCase().includes(q)));
  }, [options, query]);

  const season = options?.[0] ? `${options[0].intake_year ?? ''} ${options[0].semester ?? ''}`.trim() : '';
  const chosen = manual.trim() ? { faculty: manual.trim(), college: null } : picked;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fakultet tanlash</DialogTitle>
          <DialogDescription>
            {studentName} · {universityName}
            {season && <span className="block text-xs">Yo'riqnoma: {season}</span>}
          </DialogDescription>
        </DialogHeader>

        <Input placeholder="Fakultet nomi bo'yicha qidirish" value={query} onChange={(e) => setQuery(e.target.value)} />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1" data-testid="faculty-options">
          {error && <p className="p-2 text-sm text-destructive">{error}</p>}
          {!error && options === null && <p className="p-2 text-sm text-muted-foreground">Yuklanmoqda…</p>}
          {!error && options !== null && filtered.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">
              {options.length === 0 ? "Bu universitet yo'riqnomasida fakultetlar ro'yxati yo'q — pastda qo'lda yozing." : 'Topilmadi'}
            </p>
          )}
          {filtered.map((o, i) => {
            const active = !manual.trim() && picked?.faculty === o.faculty && (picked?.college ?? null) === (o.college ?? null);
            return (
              <button
                key={`${o.degree}-${o.college}-${o.faculty}-${i}`}
                type="button"
                onClick={() => {
                  setManual('');
                  setPicked({ faculty: o.faculty, college: o.college });
                }}
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                  active && 'bg-primary/10 ring-1 ring-primary',
                )}
              >
                <div className="font-medium text-foreground">{o.faculty}</div>
                <div className="text-xs text-muted-foreground">
                  {[o.college, o.degree ? DEGREE_LABEL[o.degree] ?? o.degree : null, o.track === 'english' ? 'Ingliz tilida' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <label htmlFor="faculty-manual" className="text-xs text-muted-foreground">
            Ro'yxatda yo'q bo'lsa, qo'lda yozing
          </label>
          <Input id="faculty-manual" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Masalan: Business Administration" />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {current.faculty ? (
            <Button variant="ghost" className="text-destructive" disabled={saving} onClick={() => onSave(null, null)}>
              Fakultetni olib tashlash
            </Button>
          ) : (
            <span />
          )}
          <Button disabled={saving || !chosen} onClick={() => chosen && onSave(chosen.faculty, chosen.college)}>
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
