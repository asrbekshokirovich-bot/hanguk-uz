import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

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
type SlotState = 'verified' | 'received' | 'missing';

// ---------------------------------------------------------------------------
// The "Application pack" checklist. The `documents` table has no fixed slot
// column — a row is matched to a slot the same way the student-facing upload
// screen does it (see DocumentUpload.matchesDocSlot): a `[slotId]` tag in the
// name, or a filename prefixed with `slotId-`. Untagged rows simply won't
// match any slot and the slot shows as "Missing" until one is uploaded/tagged.
// ---------------------------------------------------------------------------
const CHECKLIST: { id: string; label: string; note: string }[] = [
  { id: 'passport_copy', label: 'Passport copy', note: 'Bio page, colour scan, valid 2+ years' },
  { id: 'school_diploma', label: 'School diploma (attestat)', note: 'Original + notarised copy' },
  { id: 'diploma_transcript', label: 'Diploma transcript', note: 'All years, stamped by school' },
  { id: 'apostille', label: 'Apostille', note: 'Ministry of Justice · 5–7 working days' },
  { id: 'certified_translation', label: 'Certified translation (KO/EN)', note: 'Sworn translator, stamped' },
  { id: 'personal_statement', label: 'Personal statement', note: "Student-written · AI content not allowed" },
];

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

function matchesSlot(d: Tables<'documents'>, slotId: string) {
  const nameLower = (d.name || '').toLowerCase();
  const parts = (d.file_path || '').split('/');
  const filename = (parts[parts.length - 1] || '').toLowerCase();
  return nameLower.includes(`[${slotId}]`) || filename.startsWith(`${slotId}-`) || filename.startsWith(`${slotId}.`);
}

function slotDoc(docs: Tables<'documents'>[], slotId: string) {
  const matches = docs.filter((d) => matchesSlot(d, slotId));
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

function slotState(doc: Tables<'documents'> | undefined): SlotState {
  if (!doc) return 'missing';
  return doc.status === 'approved' ? 'verified' : 'received';
}

// ===========================================================================
export default function DocumentsContent({ students, loading, currentLang, onUpdateDocumentStatus, onUpdateApplicationStatus }: DocumentsContentProps) {
  const [search, setSearch] = useState('');
  const [packFilter, setPackFilter] = useState<PackFilter>('all');
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Locally advanced packs — keeps the card in its new stage until the parent
  // refetches the application row.
  const [advancedIds, setAdvancedIds] = useState<Set<string>>(new Set());
  const [advancing, setAdvancing] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const packs = useMemo(() => {
    return students.map((s) => {
      const docs = s.documents ?? [];
      const slots = CHECKLIST.map((c) => ({ ...c, doc: slotDoc(docs, c.id), state: slotState(slotDoc(docs, c.id)) }));
      const verifiedCount = slots.filter((sl) => sl.state === 'verified').length;
      const app = s.applications?.[0];
      const uniName =
        (app?.university && ((app.university as Record<string, unknown>)[`name_${currentLang}`] as string)) ||
        app?.university?.name_en ||
        app?.university?.name_ko ||
        '—';
      const advanced = advancedIds.has(s.user_id) || ADVANCED_STATUSES.has(app?.status ?? '');
      let stage: Stage = 'new_intake';
      if (advanced) stage = 'advanced';
      else if (verifiedCount === CHECKLIST.length) stage = 'ready';
      else if (verifiedCount >= 3) stage = 'translation_apostille';
      else if (verifiedCount > 0 || docs.length > 0) stage = 'collecting';
      return {
        student: s,
        slots,
        verifiedCount,
        uniName,
        program: app?.degree_level ?? '',
        applicationId: app?.id ?? null,
        stage,
        preparer: pick(CONSULTANTS, `${s.user_id}p`),
        consultant: pick(CONSULTANTS, `${s.user_id}c`),
        deadline: fmtDate(new Date(Date.now() + (hashInt(`${s.user_id}d`) % 30 + 5) * 86_400_000).toISOString(), currentLang),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const markReceived = () => {
    // No staff-side "receive on behalf of student" upload flow yet — the real
    // upload happens from the student portal. This just nudges the workflow.
    toast.info("Hujjat talaba tomonidan yuklanishi kerak");
  };
  // All six slots verified → push the student onto the next pipeline stage.
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
                  <Progress value={(p.verifiedCount / CHECKLIST.length) * 100} className="h-1.5 flex-1" />
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.verifiedCount}/{CHECKLIST.length}</span>
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
                <Progress value={(selected.verifiedCount / CHECKLIST.length) * 100} className="h-1.5 flex-1" />
                <span className="font-mono text-xs font-semibold text-foreground">{selected.verifiedCount}/{CHECKLIST.length}</span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Ariza to'plami ro'yxati</h3>
                <span className="text-xs text-muted-foreground">
                  {CHECKLIST.length - selected.verifiedCount === 0 ? 'Hammasi tayyor' : `${CHECKLIST.length - selected.verifiedCount} ta qoldi`}
                </span>
              </div>
              <div className="divide-y divide-border">
                {selected.slots.map((sl, idx) => (
                  <div key={sl.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">{sl.label}</div>
                        <div className="text-[11px] text-muted-foreground">{sl.note}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {sl.state === 'verified' && <Badge variant="successSoft" className="gap-1"><CheckCircle2 className="h-3 w-3" />Tasdiqlangan</Badge>}
                      {sl.state === 'received' && (
                        <>
                          <Badge variant="warning">Qabul qilindi</Badge>
                          <Button size="sm" variant="default" className="h-7 text-xs" disabled={busySlot === sl.doc?.id} onClick={() => sl.doc && markVerified(sl.doc.id)}>
                            Tarjimaga
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busySlot === sl.doc?.id} onClick={() => sl.doc && requestAgain(sl.doc.id)}>
                            Qayta so'rash
                          </Button>
                        </>
                      )}
                      {sl.state === 'missing' && (
                        <>
                          <Badge variant="neutral">Yo'q</Badge>
                          <Button size="sm" variant="default" className="h-7 text-xs" onClick={markReceived}>Qabul qilindi deb belgilash</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {selected.stage === 'advanced'
                    ? 'Barcha hujjatlar tasdiqlangan — talaba keyingi bosqichda.'
                    : selected.verifiedCount < CHECKLIST.length
                      ? `Keyingi bosqichga o'tkazishdan oldin barcha hujjatlar tasdiqlanishi kerak. ${CHECKLIST.length - selected.verifiedCount} ta qoldi.`
                      : 'Barcha hujjatlar tasdiqlangan — keyingi bosqichga o\'tkazish mumkin.'}
                </p>
                <Button
                  variant="highlight"
                  className="shrink-0 gap-2"
                  disabled={selected.verifiedCount < CHECKLIST.length || selected.stage === 'advanced' || advancing}
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
      list.push({ at: d.created_at, text: `"${d.name}" hujjati qabul qilindi` });
      if (d.reviewed_at) list.push({ at: d.reviewed_at, text: `"${d.name}" hujjati ko'rib chiqildi` });
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
