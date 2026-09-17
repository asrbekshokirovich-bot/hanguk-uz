import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Search,
  FolderOpen,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Upload,
  Loader2,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { buildApplicationPack, slotLabel, type StudentDocSlot } from '@/lib/studentDocSlots';
import { supabase } from '@/integrations/supabase/client';
import { getStudentActiveIntakeId } from '@/lib/studentIntake';

const STUDENT_DOCS_BUCKET = 'student-documents';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & { university?: Tables<'institutions'> })[];
  documents?: Tables<'documents'>[];
};

interface DocumentsContentProps {
  students: StudentProfile[];
  loading: boolean;
  currentLang: string;
  onUpdateDocumentStatus: (documentId: string, newStatus: string, notes?: string) => Promise<{ error: unknown }>;
  /** Advances the student's application row when their pack is fully verified. */
  onUpdateApplicationStatus?: (applicationId: string, status: string) => Promise<{ error: unknown }>;
  /** Called after staff upload a document, so the parent refetches students. */
  onDocumentsChanged?: () => void;
}

type PackFilter = 'all' | 'application' | 'visa';
type Stage = 'new_intake' | 'collecting' | 'translation_apostille' | 'ready' | 'advanced';

// The status written on the application row when a completed pack is pushed to
// the next pipeline step. Matches ApplicationsContent's `docs` → `applied` move.
const NEXT_APPLICATION_STATUS = 'application_submitted';
const ADVANCED_STATUSES = new Set([
  'in_review',
  'university_response',
  'application_submitted',
  'submitted',
  'online_ariza',
  'originals_sent',
  'visa_documents',
  'completed',
  'accepted',
  'waitlist',
  'rejected',
]);
// ---------------------------------------------------------------------------
// The "Application pack" checklist is the list of slots the student portal
// asks for at contract signing (src/lib/studentDocSlots.ts). The `documents`
// table has no slot column — an uploaded row is matched to a slot by the
// `[slotId]` tag the portal writes into `name` (or the `slotId-` filename
// prefix), with the same matcher the portal and the translation workflow use,
// so a document the student really uploaded can never show up here as
// missing.
// ---------------------------------------------------------------------------

const CONSULTANTS = ['Aziz K.', 'Madina T.', 'Sitora N.'];

function hashInt(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}
function pick<T>(pool: T[], seed: string) {
  return pool[hashInt(seed) % pool.length];
}
function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
function fmtDate(iso: string | null | undefined, lang: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

// ===========================================================================
export default function DocumentsContent({ students, loading, currentLang, onUpdateDocumentStatus, onUpdateApplicationStatus, onDocumentsChanged }: DocumentsContentProps) {
  const [search, setSearch] = useState('');
  const [packFilter, setPackFilter] = useState<PackFilter>('all');
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Locally advanced packs — keeps the card in its new stage until the parent
  // refetches the application row.
  const [advancedIds, setAdvancedIds] = useState<Set<string>>(new Set());
  const [advancing, setAdvancing] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  // Staff upload: which slot the hidden file input is currently serving.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ studentId: string; slot: StudentDocSlot; existing?: Tables<'documents'> } | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const packs = useMemo(() => {
    return students.map((s) => {
      const docs = s.documents ?? [];
      const { slots, requiredTotal, requiredVerified: verifiedCount } = buildApplicationPack(docs);
      const app = s.applications?.[0];
      const uniName =
        (app?.university && ((app.university as Record<string, unknown>)[`name_${currentLang}`] as string)) ||
        app?.university?.name_en ||
        app?.university?.name_ko ||
        '—';
      const advanced = advancedIds.has(s.user_id) || ADVANCED_STATUSES.has(app?.status ?? '');
      let stage: Stage = 'new_intake';
      if (advanced) stage = 'advanced';
      else if (verifiedCount === requiredTotal) stage = 'ready';
      else if (verifiedCount >= Math.ceil(requiredTotal / 2)) stage = 'translation_apostille';
      else if (verifiedCount > 0 || docs.length > 0) stage = 'collecting';
      return {
        student: s,
        slots,
        verifiedCount,
        requiredTotal,
        uniName,
        program: app?.degree_level ?? '',
        applicationId: app?.id ?? null,
        stage,
        preparer: pick(CONSULTANTS, `${s.user_id}p`),
        consultant: pick(CONSULTANTS, `${s.user_id}c`),
        deadline: fmtDate(new Date(Date.now() + (hashInt(`${s.user_id}d`) % 30 + 5) * 86_400_000).toISOString(), currentLang),
      };
    });
  }, [students, advancedIds, currentLang]);

  const stageCounts = useMemo(() => {
    const c: Record<Stage, number> = { new_intake: 0, collecting: 0, translation_apostille: 0, ready: 0, advanced: 0 };
    packs.forEach((p) => { c[p.stage] += 1; });
    return c;
  }, [packs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packs.filter((p) => {
      if (packFilter === 'visa') return false; // visa-pack tracking isn't wired to a data model yet
      if (stageFilter !== 'all' && p.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        (p.student.full_name ?? '').toLowerCase().includes(q) ||
        (p.student.magic_code ?? '').toLowerCase().includes(q)
      );
    });
  }, [packs, search, packFilter, stageFilter]);

  const selected = filtered.find((p) => p.student.user_id === selectedId) ?? filtered[0] ?? null;

  const stageLabel: Record<Stage, string> = {
    new_intake: 'New Intake',
    collecting: 'Collecting',
    translation_apostille: 'Translation & Apostille',
    ready: 'Ready',
    advanced: 'Keyingi bosqichda',
  };

  const markVerified = async (documentId: string) => {
    setBusySlot(documentId);
    const { error } = await onUpdateDocumentStatus(documentId, 'approved');
    setBusySlot(null);
    if (error) toast.error("Nimadir xato ketdi");
  };
  const requestAgain = async (documentId: string) => {
    setBusySlot(documentId);
    const { error } = await onUpdateDocumentStatus(documentId, 'rejected');
    setBusySlot(null);
    if (error) toast.error("Nimadir xato ketdi");
    else toast.success("Talaba qayta yuklashi so'raldi");
  };
  const pickFile = (studentId: string, slot: StudentDocSlot, existing?: Tables<'documents'>) => {
    setUploadTarget({ studentId, slot, existing });
    fileInputRef.current?.click();
  };

  // Mirrors the student portal's upload (DocumentUpload.tsx): same bucket,
  // `<studentId>/<slotId>-…` path and `[slotId]` name tag, so the slot matcher
  // picks the file up exactly as if the student had uploaded it.
  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = uploadTarget;
    if (!file || !target) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Faqat PDF, JPG yoki PNG fayl yuklash mumkin');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Fayl hajmi 10 MB dan oshmasligi kerak');
      return;
    }

    const { studentId, slot, existing } = target;
    setUploadingSlot(slot.id);
    let storedPath: string | null = null;
    try {
      // Replacing: drop the old row first (documents_student_doc_type_unique).
      if (existing) {
        const { error: delErr } = await supabase.from('documents').delete().eq('id', existing.id);
        if (delErr) throw new Error("Eski faylni almashtirishga ruxsat yo'q");
        await supabase.storage.from(STUDENT_DOCS_BUCKET).remove([existing.file_path]);
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const path = `${studentId}/${slot.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(STUDENT_DOCS_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      storedPath = path;

      const intakeId = await getStudentActiveIntakeId(studentId);
      const { error: dbErr } = await supabase.from('documents').insert({
        student_id: studentId,
        name: `[${slot.id}] ${file.name}`,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
        status: 'uploaded',
        ...(intakeId ? { intake_id: intakeId } : {}),
      });
      if (dbErr) throw dbErr;
      storedPath = null;

      toast.success(`${slotLabel(slot.name, currentLang)} yuklandi`);
      onDocumentsChanged?.();
    } catch (err) {
      if (storedPath) await supabase.storage.from(STUDENT_DOCS_BUCKET).remove([storedPath]);
      console.error('[DocumentsContent] staff upload failed', err);
      toast.error(err instanceof Error ? err.message : 'Yuklashda xatolik');
    } finally {
      setUploadingSlot(null);
      setUploadTarget(null);
    }
  };

  // All required slots verified → push the student onto the next pipeline stage.
  const advanceToNextStage = async (userId: string, applicationId: string | null) => {
    if (!applicationId || !onUpdateApplicationStatus) {
      toast.error("Talabaning arizasi topilmadi — avval universitet biriktiring");
      return;
    }
    setAdvancing(true);
    const { error } = await onUpdateApplicationStatus(applicationId, NEXT_APPLICATION_STATUS);
    setAdvancing(false);
    if (error) {
      toast.error("Nimadir xato ketdi");
      return;
    }
    setAdvancedIds((s) => new Set(s).add(userId));
    toast.success("Talaba keyingi bosqichga o'tkazildi");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChosen}
        data-testid="staff-doc-upload-input"
      />
      {/* ---- left rail: search, pack tabs, stage chips, student list ---- */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Talaba yoki magic kod"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5">
          {(['all', 'application', 'visa'] as PackFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setPackFilter(f)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                packFilter === f ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-accent/40',
              )}
            >
              {f === 'all' ? 'Barcha to\'plamlar' : f === 'application' ? 'Ariza to\'plami' : 'Viza to\'plami (D-2)'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <StageChip active={stageFilter === 'all'} onClick={() => setStageFilter('all')} label="Hammasi" n={packs.length} />
          {(Object.keys(stageLabel) as Stage[]).map((s) => (
            <StageChip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)} label={stageLabel[s]} n={stageCounts[s]} />
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Hech narsa topilmadi</p>
          ) : (
            filtered.map((p) => (
              <Card
                key={p.student.user_id}
                onClick={() => setSelectedId(p.student.user_id)}
                className={cn(
                  'cursor-pointer space-y-2 p-3 transition-all hover:shadow-raised',
                  selected?.student.user_id === p.student.user_id && 'ring-2 ring-primary',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.student.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                        {getInitials(p.student.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-[13px] font-semibold text-foreground">{p.student.full_name || '—'}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{p.deadline}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="info" className="text-[10px]">{stageLabel[p.stage]}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={(p.verifiedCount / p.requiredTotal) * 100} className="h-1.5 flex-1" />
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.verifiedCount}/{p.requiredTotal}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* ---- right pane: selected student's pack detail ---- */}
      <div>
        {!selected ? (
          <EmptyState icon={FolderOpen} title="Talaba tanlanmagan" description="Hujjatlarni ko'rish uchun chapdan talabani tanlang." />
        ) : (
          <div className="space-y-4">
            {selected.student.contract_date && (
              <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                <div className="text-[13px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">Shartnoma va to'lovdan avtomatik ochildi</span>
                  <div>Shartnoma {fmtDate(selected.student.contract_date, currentLang)} da imzolangan — ariza to'plami avtomatik ochildi.</div>
                </div>
              </div>
            )}

            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={selected.student.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(selected.student.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-base font-bold text-foreground">{selected.student.full_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{selected.uniName} · {selected.program || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.student.magic_code && (
                    <Badge variant="neutral" className="font-mono">HK · {selected.student.magic_code}</Badge>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Chat ochilmoqda…')}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chatni ochish
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
                <Field label="To'plam" value="Ariza to'plami" />
                <Field label="Tayyorlovchi" value={selected.preparer} />
                <Field label="Muddat" value={selected.deadline} />
                <Field label="Konsultant" value={selected.consultant} />
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tasdiqlangan</span>
                <Progress value={(selected.verifiedCount / selected.requiredTotal) * 100} className="h-1.5 flex-1" />
                <span className="font-mono text-xs font-semibold text-foreground">{selected.verifiedCount}/{selected.requiredTotal}</span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Ariza to'plami ro'yxati</h3>
                <span className="text-xs text-muted-foreground">
                  {selected.requiredTotal - selected.verifiedCount === 0 ? 'Hammasi tayyor' : `${selected.requiredTotal - selected.verifiedCount} ta qoldi`}
                </span>
              </div>
              <div className="divide-y divide-border">
                {selected.slots.map(({ slot, doc, state }, idx) => (
                  <div key={slot.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-foreground">
                          {slotLabel(slot.name, currentLang)}
                          {!slot.required && <Badge variant="neutral" className="text-[10px] font-medium">Ixtiyoriy</Badge>}
                        </div>
                        {slot.note && <div className="text-[11px] text-muted-foreground">{slotLabel(slot.note, currentLang)}</div>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {state === 'verified' && <Badge variant="successSoft" className="gap-1"><CheckCircle2 className="h-3 w-3" />Tasdiqlangan</Badge>}
                      {state === 'received' && doc && (
                        <>
                          <Badge variant="warning">Qabul qilindi</Badge>
                          <Button size="sm" variant="default" className="h-7 text-xs" disabled={busySlot === doc.id} onClick={() => markVerified(doc.id)}>
                            Tarjimaga
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busySlot === doc.id} onClick={() => requestAgain(doc.id)}>
                            Qayta so'rash
                          </Button>
                        </>
                      )}
                      {state === 'missing' && (
                        <>
                          <Badge variant="neutral">Yo'q</Badge>
                          {!slot.staffUpload && <span className="text-[11px] text-muted-foreground">Talaba yuklashi kerak</span>}
                        </>
                      )}
                      {slot.staffUpload && state !== 'verified' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          disabled={uploadingSlot !== null}
                          onClick={() => pickFile(selected.student.user_id, slot, doc)}
                        >
                          {uploadingSlot === slot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          {state === 'missing' ? 'Yuklash' : 'Almashtirish'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {selected.stage === 'advanced'
                    ? 'Barcha hujjatlar tasdiqlangan — talaba keyingi bosqichda.'
                    : selected.verifiedCount < selected.requiredTotal
                      ? `Keyingi bosqichga o'tkazishdan oldin barcha hujjatlar tasdiqlanishi kerak. ${selected.requiredTotal - selected.verifiedCount} ta qoldi.`
                      : 'Barcha hujjatlar tasdiqlangan — keyingi bosqichga o\'tkazish mumkin.'}
                </p>
                <Button
                  variant="highlight"
                  className="shrink-0 gap-2"
                  disabled={selected.verifiedCount < selected.requiredTotal || selected.stage === 'advanced' || advancing}
                  onClick={() => advanceToNextStage(selected.student.user_id, selected.applicationId)}
                >
                  <ArrowRight className="h-4 w-4" />
                  {selected.stage === 'advanced' ? "O'tkazildi" : "Keyingi bosqichga o'tkazish"}
                </Button>
              </div>
            </Card>

            <HandlingHistory docs={selected.student.documents ?? []} lang={currentLang} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[13px] font-medium text-foreground">{value || '—'}</div>
    </div>
  );
}

function StageChip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-accent/40',
      )}
    >
      {label} <span className="font-mono">{n}</span>
    </button>
  );
}

// Derived from real document rows (created_at / reviewed_at) — not fabricated,
// but the copy is generic since we don't store a per-action audit log yet.
function HandlingHistory({ docs, lang }: { docs: Tables<'documents'>[]; lang: string }) {
  const events = useMemo(() => {
    const list: { at: string; text: string }[] = [];
    docs.forEach((d) => {
      list.push({ at: d.created_at, text: `"${d.name}" hujjati yuklandi` });
      if (d.reviewed_at) {
        list.push({ at: d.reviewed_at, text: `"${d.name}" hujjati ${d.status === 'approved' ? 'tasdiqlandi' : "ko'rib chiqildi"}` });
      }
    });
    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [docs]);

  if (events.length === 0) return null;

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-bold text-foreground">Amallar tarixi</h3>
      <ul className="space-y-2">
        {events.map((e, i) => (
          <li key={i} className="flex items-baseline gap-2 text-xs">
            <span className="text-muted-foreground">{fmtDate(e.at, lang)}</span>
            <span className="text-foreground">{e.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
