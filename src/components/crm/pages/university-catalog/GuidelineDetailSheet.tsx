import { useEffect, useMemo, useState } from 'react';
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
import {
  CalendarClock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  Search,
  UploadCloud,
} from 'lucide-react';
import {
  useGuidelineDetail,
  type CatalogEntry,
  type GuidelineFaculty,
  type GuidelineFull,
  type GuidelineRound,
} from '@/hooks/useUniversityCatalog';
import { admissionLabel, cityLabel, displayName, formatMoney, periodLabel } from './format';

interface Props {
  entry: CatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpload: boolean;
  onUpload: (entry: CatalogEntry) => void;
  uploading: boolean;
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{String(value)}</p>
    </div>
  );
}

function yesNo(value: unknown): string | null {
  if (value === true) return 'ha';
  if (value === false) return "yo'q";
  return (value as string) ?? null;
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

function UmumiyTab({ g }: { g: GuidelineFull }) {
  const money = (key: string) => formatMoney(g[key] as number | null, g.narx_valyuta);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Ariza</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ariza sayti" value={g.ariza_sayti} />
          <Field
            label="Ariza to'lovi"
            value={
              g.ariza_tolovi
                ? formatMoney(g.ariza_tolovi as number, g.ariza_tolovi_valyuta as string)
                : null
            }
          />
          <Field label="To'lash usuli" value={g.ariza_tolovi_usuli} />
          <Field label="Kirish to'lovi (입학금)" value={g.kirish_tolovi ? money('kirish_tolovi') : null} />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Til talablari</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Korean track" value={yesNo(g.korean_track)} />
          <Field label="English track" value={yesNo(g.english_track)} />
          <Field label="TOPIK (eng kami)" value={g.topik_min} />
          <Field label="IELTS (eng kami)" value={g.ielts_min} />
          <Field label="TOEFL iBT (eng kami)" value={g.toefl_ibt_min} />
        </div>
        <Field label="Izoh" value={g.til_izoh} />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Bank statement</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Summa"
            value={g.bank_summa ? formatMoney(g.bank_summa as number, g.bank_valyuta as string) : null}
          />
          <Field label="Bank turi" value={g.bank_turi} />
          <Field label="Qachon" value={g.bank_vaqti} />
          <Field label="Saqlash muddati" value={g.bank_saqlash_muddati} />
        </div>
        <Field label="Izoh" value={g.bank_izoh} />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Tavsiyanoma</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Talab qilinadimi" value={g.tavsiyanoma} />
        </div>
        <Field label="Izoh" value={g.tavsiyanoma_izoh} />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">International office</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon" value={g.io_telefon} />
          <Field label="Email" value={g.io_email} />
          <Field label="Pochta indeksi" value={g.io_zip} />
        </div>
        <Field label="Manzil (EN)" value={g.io_manzil_en} />
        <Field label="Manzil (KR)" value={g.io_manzil_kr} />
        <Field label="Hujjat yuborish manzili" value={g.hujjat_yuborish_manzili} />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Umumiy shartlar</h4>
        <Field label="Izoh" value={g.izoh} />
      </section>

      <section className="space-y-3 border-t pt-4">
        <h4 className="text-sm font-semibold text-muted-foreground">Manba</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guideline sarlavhasi" value={g.guideline_sarlavha} />
          <Field label="PDF fayli" value={g.guideline_fayl} />
          <Field label="Excel fayli" value={g.fayl_nomi} />
          <Field label="Tahlil sanasi" value={g.tahlil_sanasi} />
          <Field label="Format versiyasi" value={g.format_versiya} />
          <Field label="guideline_id" value={g.guideline_id} />
        </div>
        <Field label="Sahifalar" value={g.sahifalar} />
      </section>
    </div>
  );
}

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
    <div className="space-y-5">
      {stages.map(([bosqich, steps]) => (
        <section key={bosqich} className="space-y-2">
          <h4 className="text-sm font-semibold">{bosqich}-bosqich</h4>
          <div className="space-y-2">
            {steps.map((r) => {
              const range = rangeLabel(r);
              return (
                <div key={r.id} className="rounded-md border border-border/60 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {r.etap_raqam}. {r.etap_nomi}
                    </span>
                    {r.holat && (
                      <Badge variant={HOLAT_VARIANT[r.holat] ?? 'neutral'}>{r.holat}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {range ?? 'Sana ko‘rsatilmagan'}
                  </p>
                  {r.izoh && (
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{r.izoh}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

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
    return <EmptyState icon={FileText} title="Fakultetlar kiritilmagan" />;
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

      <div className="rounded-md border">
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
                  {f.izoh && <p className="mt-1 text-xs text-muted-foreground">{f.izoh}</p>}
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
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="pr-8">{name?.primary ?? ''}</SheetTitle>
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
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => onUpload(entry)}
            >
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="umumiy">Umumiy</TabsTrigger>
                <TabsTrigger value="muddatlar">Muddatlar</TabsTrigger>
                <TabsTrigger value="fakultetlar">
                  Fakultetlar ({detail.data.faculties.length})
                </TabsTrigger>
                <TabsTrigger value="hujjatlar">
                  Hujjatlar ({detail.data.docs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="umumiy" className="mt-4">
                <UmumiyTab g={detail.data.guideline} />
              </TabsContent>
              <TabsContent value="muddatlar" className="mt-4">
                <MuddatlarTab rounds={detail.data.rounds} />
              </TabsContent>
              <TabsContent value="fakultetlar" className="mt-4">
                <FakultetlarTab
                  faculties={detail.data.faculties}
                  currency={detail.data.guideline.narx_valyuta}
                />
              </TabsContent>
              <TabsContent value="hujjatlar" className="mt-4">
                {detail.data.docs.length === 0 ? (
                  <EmptyState icon={FileText} title="Hujjatlar kiritilmagan" />
                ) : (
                  <div className="space-y-2">
                    {detail.data.docs.map((d) => (
                      <div key={d.id} className="rounded-md border border-border/60 p-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {d.tartib}. {d.hujjat_nomi ?? d.hujjat_nomi_asl ?? '—'}
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
                            {d.notarial_tarjima === 'ha' && (
                              <Badge variant="warning">notarial tarjima</Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[d.shakli, d.kimlar_uchun, d.muddat, d.muddat_turi]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {d.izoh && (
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                            {d.izoh}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
