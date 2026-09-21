import { isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Award,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Languages,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  UploadCloud,
  Users,
} from 'lucide-react';
import {
  useGuidelineDetail,
  type CatalogEntry,
  type GuidelineDoc,
  type GuidelineFaculty,
  type GuidelineFull,
  type GuidelineRound,
} from '@/hooks/useUniversityCatalog';
import {
  admissionLabel,
  cityLabel,
  contractRange,
  displayName,
  formatMoney,
  periodLabel,
} from './format';

interface Props {
  entry: CatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpload: boolean;
  onUpload: (entry: CatalogEntry) => void;
  uploading: boolean;
}

// ---------------------------------------------------------------------------
// Qayta ishlatiladigan bo'laklar
// ---------------------------------------------------------------------------

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

/** Bir qarashda o'qiladigan raqam: sarlavha ustida kichik, qiymat yirik. */
function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-semibold', value ? 'text-base' : 'text-base text-muted-foreground')}>
        {value ?? '—'}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </header>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

/**
 * Yorliq chapda, qiymat o'ngda — ko'z bitta ustun bo'ylab yuguradi.
 *
 * `value` — `unknown`, chunki GuidelineFull universitet varag'ining barcha
 * ustunlarini `Record<string, unknown>` sifatida olib keladi. Havola kabi
 * tayyor element bo'lsa o'zi chiziladi, qolgani matnga o'giriladi.
 */
function Row({ label, value }: { label: string; value: unknown }) {
  if (isEmpty(value)) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-1 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm">
        {isValidElement(value) ? value : String(value)}
      </span>
    </div>
  );
}

/**
 * Uzun izoh. Guideline izohlari ba'zan bir necha abzats bo'ladi va yig'ilmasa
 * butun bo'limni bosib ketadi — shuning uchun 3 qatordan keyin yig'iladi.
 */
function Note({ label, text }: { label?: string; text: unknown }) {
  const [open, setOpen] = useState(false);
  if (isEmpty(text)) return null;

  const body = String(text);
  const long = body.length > 180;

  return (
    <div className="space-y-1 pt-1">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', !open && long && 'line-clamp-3')}>
        {body}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {open ? 'Yig‘ish' : 'To‘liq o‘qish'}
        </button>
      )}
    </div>
  );
}

function yesNoBadge(value: unknown, label: string) {
  if (value === true) return <Badge variant="successSoft">{label}</Badge>;
  if (value === false) return <Badge variant="neutral">{label} — yo‘q</Badge>;
  return null;
}

/** "2026-09-21 09:00 — 2026-10-02 17:00" yoki bo'sh bo'lsa null. */
function rangeLabel(r: GuidelineRound): string | null {
  const start = [r.boshlanish_sana, r.boshlanish_vaqt].filter(Boolean).join(' ');
  const end = [r.tugash_sana, r.tugash_vaqt].filter(Boolean).join(' ');
  if (start && end) return start === end ? start : `${start} — ${end}`;
  return start || end || null;
}

const HOLAT_VARIANT: Record<string, 'successSoft' | 'warning' | 'info' | 'neutral'> = {
  tasdiqlangan: 'successSoft',
  taxminiy: 'warning',
  nisbiy: 'info',
  keyin_elon: 'neutral',
  etap_yoq: 'neutral',
};

// ---------------------------------------------------------------------------
// Umumiy
// ---------------------------------------------------------------------------

function UmumiyTab({ g }: { g: GuidelineFull }) {
  // GuidelineFull — GuidelineSummary'ning kengaytmasi, shuning uchun katalog
  // kartasi bilan bir xil formatlash ishlatiladi.
  const kontrakt = contractRange(g);

  const til = [
    g.topik_min !== null ? { label: 'TOPIK', value: g.topik_min } : null,
    g.ielts_min !== null ? { label: 'IELTS', value: g.ielts_min } : null,
    g.toefl_ibt_min !== null ? { label: 'TOEFL iBT', value: g.toefl_ibt_min } : null,
  ].filter(Boolean) as { label: string; value: number }[];

  const manba = [
    ['Guideline sarlavhasi', g.guideline_sarlavha],
    ['PDF fayli', g.guideline_fayl],
    ['Excel fayli', g.fayl_nomi],
    ['Tahlil sanasi', g.tahlil_sanasi],
    ['Format versiyasi', g.format_versiya],
    ['guideline_id', g.guideline_id],
    ['Sahifalar', g.sahifalar],
  ] as const;

  return (
    <div className="space-y-3">
      {/* 1. Pul — eng ko'p so'raladigan raqamlar birinchi qatorda */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          label="Ariza to'lovi"
          value={
            isEmpty(g.ariza_tolovi)
              ? null
              : formatMoney(g.ariza_tolovi as number, g.ariza_tolovi_valyuta as string)
          }
        />
        <StatTile
          label="Kontrakt"
          value={kontrakt}
          hint={kontrakt ? `/ ${periodLabel(g.kontrakt_davri) ?? 'semestr'}` : null}
        />
        <StatTile
          label="Kirish to'lovi"
          value={isEmpty(g.kirish_tolovi) ? null : formatMoney(g.kirish_tolovi as number, g.narx_valyuta)}
        />
        <StatTile
          label="Bank statement"
          value={
            isEmpty(g.bank_summa)
              ? null
              : formatMoney(g.bank_summa as number, g.bank_valyuta as string)
          }
        />
      </div>

      {/* 2. Til — qaysi talaba mos kelishini shu hal qiladi */}
      <InfoCard icon={Languages} title="Til talablari">
        <div className="flex flex-wrap items-center gap-1.5">
          {yesNoBadge(g.korean_track, 'Korean track')}
          {yesNoBadge(g.english_track, 'English track')}
        </div>
        {til.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {til.map((t) => (
              <div key={t.label} className="rounded-md border bg-muted/20 px-2 py-1.5 text-center">
                <p className="text-[11px] text-muted-foreground">{t.label}</p>
                <p className="text-sm font-semibold">{t.value}</p>
              </div>
            ))}
          </div>
        )}
        <Note text={g.til_izoh} />
      </InfoCard>

      {/* 3. Ariza va bank — yonma-yon, chunki ikkalasi ham qisqa */}
      <div className="grid gap-3 xl:grid-cols-2">
        <InfoCard icon={FileText} title="Ariza">
          <Row
            label="Sayt"
            value={
              g.ariza_sayti ? (
                <a
                  href={String(g.ariza_sayti)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {String(g.ariza_sayti).replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null
            }
          />
          <Note label="To'lash usuli" text={g.ariza_tolovi_usuli} />
        </InfoCard>

        <InfoCard icon={Landmark} title="Bank statement">
          <Row label="Bank turi" value={g.bank_turi} />
          <Row label="Qachon" value={g.bank_vaqti} />
          <Row label="Saqlash muddati" value={g.bank_saqlash_muddati} />
          <Note text={g.bank_izoh} />
        </InfoCard>
      </div>

      {/* 4. Tavsiyanoma va kontakt */}
      <div className="grid gap-3 xl:grid-cols-2">
        <InfoCard icon={Award} title="Tavsiyanoma">
          <Row label="Talab qilinadimi" value={g.tavsiyanoma} />
          <Note text={g.tavsiyanoma_izoh} />
        </InfoCard>

        <InfoCard icon={Phone} title="International office">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {g.io_telefon && (
              <a
                href={`tel:${String(g.io_telefon).replace(/\s/g, '')}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {String(g.io_telefon)}
              </a>
            )}
            {g.io_email && (
              <a
                href={`mailto:${String(g.io_email)}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {String(g.io_email)}
              </a>
            )}
          </div>
          <Row label="Pochta indeksi" value={g.io_zip} />
          <Note label="Manzil (EN)" text={g.io_manzil_en} />
          <Note label="Manzil (KR)" text={g.io_manzil_kr} />
          <Note label="Hujjat yuborish manzili" text={g.hujjat_yuborish_manzili} />
        </InfoCard>
      </div>

      {/* 5. Umumiy shartlar — uzun, o'zining kartasida */}
      {!isEmpty(g.izoh) && (
        <InfoCard icon={Info} title="Umumiy shartlar">
          <Note text={g.izoh} />
        </InfoCard>
      )}

      {/* 6. Manba — kundalik ish uchun emas, yopiq turadi */}
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30">
          <Database className="h-4 w-4" aria-hidden="true" />
          Manba
          <ChevronDown
            className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 rounded-b-lg border border-t-0 px-3 py-2">
            {manba.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Muddatlar
// ---------------------------------------------------------------------------

function MuddatlarTab({ rounds }: { rounds: GuidelineRound[] }) {
  const stages = useMemo(() => {
    const map = new Map<number, GuidelineRound[]>();
    for (const r of rounds) {
      const list = map.get(r.bosqich);
      if (list) list.push(r);
      else map.set(r.bosqich, [r]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rounds]);

  if (rounds.length === 0) {
    return <EmptyState icon={CalendarClock} title="Muddatlar kiritilmagan" />;
  }

  return (
    <div className="space-y-4">
      {stages.map(([bosqich, steps]) => (
        <section key={bosqich} className="rounded-lg border">
          <header className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-sm font-semibold">{bosqich}-bosqich</h4>
            <span className="ml-auto text-xs text-muted-foreground">{steps.length} etap</span>
          </header>
          <ol className="divide-y">
            {steps.map((r) => {
              const range = rangeLabel(r);
              return (
                <li key={r.id} className="flex gap-3 px-3 py-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {r.etap_raqam}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-medium">{r.etap_nomi}</span>
                      <span className="text-sm text-muted-foreground">
                        {range ?? 'Sana ko‘rsatilmagan'}
                      </span>
                    </div>
                    {r.holat && (
                      <Badge
                        variant={HOLAT_VARIANT[r.holat] ?? 'neutral'}
                        className="mt-1 text-[11px]"
                      >
                        {r.holat}
                      </Badge>
                    )}
                    <Note text={r.izoh} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fakultetlar
// ---------------------------------------------------------------------------

function FakultetlarTab({
  faculties,
  currency,
}: {
  faculties: GuidelineFaculty[];
  currency: string | null;
}) {
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState<'hammasi' | 'english' | 'korean'>('hammasi');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faculties.filter((f) => {
      if (track !== 'hammasi' && f.track !== track) return false;
      if (q === '') return true;
      return [f.fakultet_en, f.fakultet_kr, f.kollej_en, f.kollej_kr].some((v) =>
        v?.toLowerCase().includes(q),
      );
    });
  }, [faculties, query, track]);

  if (faculties.length === 0) {
    return <EmptyState icon={Users} title="Fakultetlar kiritilmagan" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fakultet qidirish (EN yoki 한국어)"
            className="pl-8"
          />
        </div>
        <Select value={track} onValueChange={(v) => setTrack(v as typeof track)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hammasi">Barcha track</SelectItem>
            <SelectItem value="korean">Korean track</SelectItem>
            <SelectItem value="english">English track</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} / {faculties.length} fakultet
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fakultet</TableHead>
              <TableHead className="w-24">Track</TableHead>
              <TableHead className="w-28">Til</TableHead>
              <TableHead className="w-40 text-right">Kontrakt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="align-top">
                  <p className="font-medium leading-snug">{f.fakultet_en ?? f.fakultet_kr ?? '—'}</p>
                  {f.fakultet_kr && f.fakultet_en && (
                    <p className="text-xs text-muted-foreground">{f.fakultet_kr}</p>
                  )}
                  {(f.kollej_en || f.kollej_kr) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[f.kollej_en, f.kollej_kr].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <Note text={f.izoh} />
                </TableCell>
                <TableCell className="align-top">
                  {f.track && (
                    <Badge variant={f.track === 'korean' ? 'info' : 'successSoft'}>{f.track}</Badge>
                  )}
                </TableCell>
                <TableCell className="align-top text-sm">
                  {f.topik_min !== null && <div>TOPIK {f.topik_min}</div>}
                  {f.ielts_min !== null && <div>IELTS {f.ielts_min}</div>}
                  {f.toefl_ibt_min !== null && <div>TOEFL {f.toefl_ibt_min}</div>}
                </TableCell>
                <TableCell className="align-top text-right text-sm">
                  {f.kontrakt_summa !== null ? (
                    <>
                      <div className="font-medium">{formatMoney(f.kontrakt_summa, currency)}</div>
                      {f.kontrakt_davri && (
                        <div className="text-xs text-muted-foreground">
                          / {periodLabel(f.kontrakt_davri)}
                        </div>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hujjatlar
// ---------------------------------------------------------------------------

function HujjatlarTab({ docs }: { docs: GuidelineDoc[] }) {
  if (docs.length === 0) {
    return <EmptyState icon={ClipboardList} title="Hujjatlar kiritilmagan" />;
  }

  return (
    <div className="rounded-lg border">
      <ol className="divide-y">
        {docs.map((d) => (
          <li key={d.id} className="flex gap-3 px-3 py-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
              {d.tartib}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {d.hujjat_nomi ?? d.hujjat_nomi_asl ?? '—'}
                  </p>
                  {d.hujjat_nomi_asl && d.hujjat_nomi && (
                    <p className="text-xs text-muted-foreground">{d.hujjat_nomi_asl}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.majburiy && (
                    <Badge variant={d.majburiy === 'ha' ? 'info' : 'neutral'}>
                      {d.majburiy === 'ha' ? 'majburiy' : d.majburiy}
                    </Badge>
                  )}
                  {d.apostil === 'ha' && <Badge variant="warning">apostil</Badge>}
                  {d.notarial_tarjima === 'ha' && <Badge variant="warning">notarial tarjima</Badge>}
                </div>
              </div>
              {[d.shakli, d.kimlar_uchun, d.muddat, d.muddat_turi].some(Boolean) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[d.shakli, d.kimlar_uchun, d.muddat, d.muddat_turi].filter(Boolean).join(' · ')}
                </p>
              )}
              <Note text={d.izoh} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Yorliq: belgi + nom + soni. Soni 0 bo'lsa ko'rsatilmaydi. */
function TabLabel({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Info;
  label: string;
  count?: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] font-medium tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}

export function GuidelineDetailSheet({
  entry,
  open,
  onOpenChange,
  canUpload,
  onUpload,
  uploading,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Universitet almashganda (yoki yangi Excel yuklanganda) eng yangi qabulga
  // qaytamiz. Effekt bo'yalgandan keyin ishlagani uchun tanlovni shu yerda
  // ham fallback bilan hisoblaymiz — aks holda panel bir kadr bo'sh turardi.
  useEffect(() => {
    setSelectedId(entry?.latest?.id ?? null);
  }, [entry?.institution.id, entry?.latest?.id]);

  const known = entry?.guidelines.some((g) => g.id === selectedId) ?? false;
  const activeId = known ? selectedId : (entry?.latest?.id ?? null);

  const detail = useGuidelineDetail(open ? activeId : null);
  const name = entry ? displayName(entry) : null;
  const city = entry ? cityLabel(entry) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="pr-8 leading-tight">{name?.primary ?? ''}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {name?.secondary && <span>{name.secondary}</span>}
              {city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {city}
                </span>
              )}
              {entry?.institution.primary_admissions_url_ko && (
                <a
                  href={entry.institution.primary_admissions_url_ko}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Qabul sayti
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {entry && entry.guidelines.length > 0 && (
            <Select value={activeId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger className="w-auto min-w-52">
                <SelectValue placeholder="Qabulni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {entry.guidelines.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {admissionLabel(g) ?? g.guideline_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canUpload && entry && (
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => onUpload(entry)}>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Excel yuklash
            </Button>
          )}
        </div>

        <div className="mt-4">
          {!entry || entry.guidelines.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Bu universitet uchun Excel yuklanmagan"
              description={
                canUpload
                  ? "Shablon bo'yicha to'ldirilgan .xlsx faylni yuklang — muddatlar, fakultetlar va hujjatlar shu yerda ko'rinadi."
                  : "Ma'lumot yuklangach shu yerda ko'rinadi."
              }
            />
          ) : detail.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail.error ? (
            <EmptyState
              icon={FileText}
              title="Ma'lumotni o'qib bo'lmadi"
              description={detail.error.message}
              action={{ label: 'Qayta urinish', onClick: () => detail.refetch() }}
            />
          ) : detail.data ? (
            <Tabs defaultValue="umumiy">
              {/* Yorliqlar uzun ro'yxatlar ustida ham ko'rinib tursin */}
              <TabsList className="sticky top-0 z-10 grid h-auto w-full grid-cols-4 gap-1 p-1">
                <TabsTrigger value="umumiy" className="py-1.5">
                  <TabLabel icon={Info} label="Umumiy" />
                </TabsTrigger>
                <TabsTrigger value="muddatlar" className="py-1.5">
                  <TabLabel
                    icon={CalendarClock}
                    label="Muddatlar"
                    count={detail.data.rounds.length}
                  />
                </TabsTrigger>
                <TabsTrigger value="fakultetlar" className="py-1.5">
                  <TabLabel icon={Users} label="Fakultetlar" count={detail.data.faculties.length} />
                </TabsTrigger>
                <TabsTrigger value="hujjatlar" className="py-1.5">
                  <TabLabel
                    icon={ClipboardList}
                    label="Hujjatlar"
                    count={detail.data.docs.length}
                  />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="umumiy" className="mt-3">
                <UmumiyTab g={detail.data.guideline} />
              </TabsContent>
              <TabsContent value="muddatlar" className="mt-3">
                <MuddatlarTab rounds={detail.data.rounds} />
              </TabsContent>
              <TabsContent value="fakultetlar" className="mt-3">
                <FakultetlarTab
                  faculties={detail.data.faculties}
                  currency={detail.data.guideline.narx_valyuta}
                />
              </TabsContent>
              <TabsContent value="hujjatlar" className="mt-3">
                <HujjatlarTab docs={detail.data.docs} />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
