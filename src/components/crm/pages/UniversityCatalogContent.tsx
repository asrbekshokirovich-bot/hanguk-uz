/**
 * Universitetlar — xodim uchun katalog.
 *
 * Ro'yxat `institutions` jadvalidan keladi (Janubiy Koreyadagi 400+ oliygoh),
 * har bir universitetning batafsil ma'lumoti esa shablon bo'yicha to'ldirilgan
 * guideline Excel'idan. Excel yuklangan universitetda kartada kontrakt narxi,
 * TOPIK/IELTS talabi va shahri ko'rinadi; ustiga bosilganda muddatlar,
 * fakultetlar (EN + 한국어) va hujjatlar ochiladi.
 */

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useAddInstitution,
  useGuidelineImport,
  useUniversityCatalog,
  type CatalogEntry,
} from '@/hooks/useUniversityCatalog';
import { parseGuidelineWorkbook } from '@/lib/universityGuidelineExcel';
import {
  AlertTriangle,
  Download,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  UploadCloud,
} from 'lucide-react';
import { UniversityCard } from './university-catalog/UniversityCard';
import { GuidelineDetailSheet } from './university-catalog/GuidelineDetailSheet';
import {
  DEGREE_LEVELS,
  matchesFilter,
  matchesLevel,
  matchesOperatorFilter,
  matchesSearch,
  operatorCities,
  resolveUploadInstitution,
  type CatalogFilter,
  type DegreeLevel,
  type LevelFilter,
} from './university-catalog/format';

const PAGE_SIZE = 48;

const FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: 'hammasi', label: 'Hammasi' },
  { key: 'malumotli', label: "Ma'lumotli" },
  { key: 'topik', label: 'TOPIK' },
  { key: 'ielts', label: 'IELTS' },
  { key: 'hamkor', label: 'Hamkor' },
];

/** Shahar tanlanmagan holat (Radix Select bo'sh qiymatni qabul qilmaydi). */
const ALL_CITIES = '__all__';

const INSTITUTION_TYPES = [
  { value: 'private', label: 'Xususiy' },
  { value: 'national', label: 'Davlat (national)' },
  { value: 'public', label: 'Davlat (public)' },
  { value: 'junior_college', label: 'Kollej' },
  { value: 'specialized', label: 'Ixtisoslashgan' },
  { value: 'cyber', label: 'Onlayn (cyber)' },
  { value: 'education_university', label: 'Pedagogika' },
];

const TEMPLATE_URL = '/templates/universitet-guideline-shablon.xlsx';

/** Excel yuklash tugmalari faqat shu uch daraja uchun — qolgani ("transfer" va h.k.) hozircha alohida tugma olmaydi. */
const UPLOAD_BUTTONS: { daraja: DegreeLevel; label: string }[] = [
  { daraja: 'bakalavr', label: 'Excel bakalavr' },
  { daraja: 'magistratura', label: 'Excel magistr' },
  { daraja: 'kasbiy', label: 'Excel kasbiy' },
];

/** Daraja filtri: barcha darajalar + har bir daraja alohida. */
const LEVEL_OPTIONS: { key: LevelFilter; label: string }[] = [
  { key: 'hammasi', label: 'Barcha darajalar' },
  ...DEGREE_LEVELS,
];

interface UploadReport {
  fileName: string;
  errors: string[];
  warnings: string[];
  imported: { muddatlar: number; fakultetlar: number; hujjatlar: number } | null;
}

const emptyNewInstitution = {
  name_ko: '',
  name_en: '',
  city_ko: '',
  primary_domain: '',
  institution_type: 'private',
};

export default function UniversityCatalogContent() {
  const { toast } = useToast();
  // Excel yuklash, shablon va universitet qo'shish — hujjatchilar ham qila
  // oladi (useUserRole'da isDocumentHandler admin'ni ham qamrab oladi).
  // Bazada bu qoida can_edit_university_catalog() funksiyasida takrorlangan.
  const { isDocumentHandler: canEdit, isCallOperator } = useUserRole();
  // Operator (admin ham, hujjatchi ham emas) faqat ma'lumotli universitetlarni
  // ko'radi va TOPIK, IELTS, shahar bo'yicha ajratadi (egasi, 2026-10-01).
  const operatorView = isCallOperator && !canEdit;
  const { entries, loading, error, refetch } = useUniversityCatalog();
  const importGuideline = useGuidelineImport();
  const addInstitution = useAddInstitution();

  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelFilter>('hammasi');
  const [filter, setFilter] = useState<CatalogFilter>('hammasi');
  const [opTopik, setOpTopik] = useState(false);
  const [opIelts, setOpIelts] = useState(false);
  const [opCity, setOpCity] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Tanlangan universitet id bo'yicha saqlanadi: Excel yuklangandan keyin
  // ro'yxat yangilanadi va panel o'sha zahoti yangi ma'lumotni ko'rsatadi.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newFields, setNewFields] = useState(emptyNewInstitution);

  // Yuklash bitta universitet kartasidan ham, yuqoridagi umumiy tugmadan ham
  // boshlanishi mumkin — maqsad shu ref'da turadi. Tugma qaysi daraja uchun
  // ekani ham shu yerda saqlanadi, faylni tekshirishda solishtirish uchun.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ institutionId: string | null; daraja: DegreeLevel } | null>(null);

  // Daraja va qolgan filtrlar birga. Daraja tugmalari yonidagi sonlar ham shu
  // bilan hisoblanadi — son o'sha tugma bosilgandagi natijaga teng bo'ladi.
  const passesFilters = useCallback(
    (e: CatalogEntry, lvl: LevelFilter) =>
      matchesLevel(e, lvl) &&
      (operatorView
        ? matchesOperatorFilter(e, { topik: opTopik, ielts: opIelts, city: opCity }, lvl)
        : matchesFilter(e, filter, lvl)) &&
      matchesSearch(e, search),
    [filter, search, operatorView, opTopik, opIelts, opCity],
  );

  const filtered = useMemo(
    () => entries.filter((e) => passesFilters(e, level)),
    [entries, level, passesFilters],
  );

  const levelCounts = useMemo(() => {
    const counts = {} as Record<LevelFilter, number>;
    for (const o of LEVEL_OPTIONS) {
      counts[o.key] = entries.filter((e) => passesFilters(e, o.key)).length;
    }
    return counts;
  }, [entries, passesFilters]);

  const withData = useMemo(() => entries.filter((e) => e.guidelines.length > 0).length, [entries]);
  const cities = useMemo(() => operatorCities(entries), [entries]);

  const selected = useMemo(
    () => entries.find((e) => e.institution.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const resetPaging = () => setVisible(PAGE_SIZE);

  const startUpload = (institutionId: string | null, daraja: DegreeLevel) => {
    uploadTarget.current = { institutionId, daraja };
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // bir xil faylni qayta tanlash mumkin bo'lsin
    const target = uploadTarget.current;
    uploadTarget.current = null;
    if (!file || !target) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast({ title: '.xlsx fayl tanlang', variant: 'destructive' });
      return;
    }

    const parsed = await parseGuidelineWorkbook(await file.arrayBuffer(), file.name);
    if (!parsed.ok || !parsed.payload) {
      setReport({ fileName: file.name, errors: parsed.errors, warnings: parsed.warnings, imported: null });
      return;
    }

    // Xodim "Excel bakalavr" tugmasidan magistratura faylini yuklab qo'ymasin —
    // fayldagi daraja bosilgan tugmaga mos kelishi shart.
    const fileDaraja = parsed.payload.universitet.daraja;
    if (fileDaraja !== target.daraja) {
      const expectedLabel = UPLOAD_BUTTONS.find((b) => b.daraja === target.daraja)?.label ?? target.daraja;
      setReport({
        fileName: file.name,
        errors: [
          fileDaraja
            ? `"${expectedLabel}" tugmasi bosildi, lekin fayldagi daraja — "${fileDaraja}". To'g'ri tugmani tanlang.`
            : `"${expectedLabel}" tugmasi bosildi, lekin faylda "daraja" ustuni to'ldirilmagan.`,
        ],
        warnings: parsed.warnings,
        imported: null,
      });
      return;
    }

    // Umumiy tugmadan yuklanganda universitet shu yerda tanlanadi (format.ts'dagi izohga qarang).
    let institutionId = target.institutionId;
    if (!institutionId) {
      const u = parsed.payload.universitet;
      const resolved = resolveUploadInstitution(entries, {
        guideline_id: String(u.guideline_id),
        univ_kod: String(u.univ_kod),
        univ_nomi_kr: typeof u.univ_nomi_kr === 'string' ? u.univ_nomi_kr : null,
        univ_nomi_en: typeof u.univ_nomi_en === 'string' ? u.univ_nomi_en : null,
      });
      if (resolved.error || !resolved.institutionId) {
        setReport({
          fileName: file.name,
          errors: [resolved.error ?? 'Universitet topilmadi'],
          warnings: parsed.warnings,
          imported: null,
        });
        return;
      }
      institutionId = resolved.institutionId;
    }

    try {
      const outcome = await importGuideline.mutateAsync({
        payload: parsed.payload,
        institutionId,
      });
      setReport({
        fileName: file.name,
        errors: [],
        warnings: parsed.warnings,
        imported: {
          muddatlar: outcome.muddatlar,
          fakultetlar: outcome.fakultetlar,
          hujjatlar: outcome.hujjatlar,
        },
      });
      toast({
        title: 'Excel yuklandi',
        description: `${outcome.fakultetlar} fakultet, ${outcome.muddatlar} muddat, ${outcome.hujjatlar} hujjat.`,
      });
    } catch (err) {
      setReport({
        fileName: file.name,
        errors: [err instanceof Error ? err.message : String(err)],
        warnings: parsed.warnings,
        imported: null,
      });
    }
  };

  const submitNewInstitution = async () => {
    if (!newFields.name_ko.trim() || !newFields.primary_domain.trim()) {
      toast({ title: "Koreyscha nom va domen to'ldirilsin", variant: 'destructive' });
      return;
    }
    try {
      await addInstitution.mutateAsync(newFields);
      toast({ title: "Universitet qo'shildi" });
      setAddOpen(false);
      setNewFields(emptyNewInstitution);
    } catch (err) {
      toast({
        title: "Qo'shib bo'lmadi",
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Katalogni yuklab bo'lmadi"
        description={error.message}
        action={{ label: 'Qayta urinish', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onFileChosen}
      />

      {/* Sarlavha qatori: chapda hisob, o'ngda qidiruv va yuklash */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          {operatorView ? (
            <span>{withData} universitet</span>
          ) : (
            <span>
              {entries.length} universitet
              {withData > 0 && ` · ${withData} tasida ma'lumot bor`}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div className="relative sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPaging();
              }}
              placeholder="Universitet qidirish (EN, 한국어, shahar)"
              className="pl-8"
              aria-label="Universitet qidirish"
            />
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={TEMPLATE_URL} download>
                  <Download className="mr-2 h-4 w-4" />
                  Shablon
                </a>
              </Button>
              {UPLOAD_BUTTONS.map((b) => (
                <Button
                  key={b.daraja}
                  size="sm"
                  onClick={() => startUpload(null, b.daraja)}
                  disabled={importGuideline.isPending || loading}
                >
                  {importGuideline.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                  )}
                  {b.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daraja: bakalavr, magistr yoki kasbiy ta'lim o'qitadigan universitetlar. Sonlar — boshqa filtrlar bilan birga. */}
      <div
        role="group"
        aria-label="Daraja"
        className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-[3px] sm:flex sm:w-fit"
      >
        {LEVEL_OPTIONS.map((o) => {
          const active = level === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setLevel(o.key);
                resetPaging();
              }}
              className={cn(
                'flex h-8 items-center justify-center gap-1.5 rounded-sm px-3 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
                active
                  ? 'bg-card font-semibold text-foreground shadow-card'
                  : 'font-medium text-muted-foreground hover:text-foreground/80',
              )}
            >
              <span className="truncate">{o.label}</span>
              {!loading && (
                <span className={cn('text-xs tabular-nums', active ? 'text-primary' : 'text-muted-foreground')}>
                  {levelCounts[o.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {operatorView ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={opTopik ? 'default' : 'outline'}
            size="sm"
            aria-pressed={opTopik}
            onClick={() => {
              setOpTopik((v) => !v);
              resetPaging();
            }}
          >
            TOPIK
          </Button>
          <Button
            variant={opIelts ? 'default' : 'outline'}
            size="sm"
            aria-pressed={opIelts}
            onClick={() => {
              setOpIelts((v) => !v);
              resetPaging();
            }}
          >
            IELTS
          </Button>
          <div className="flex items-center gap-2 sm:ml-2">
            <Label htmlFor="catalog-city" className="text-sm font-normal text-muted-foreground">
              Shahar:
            </Label>
            <Select
              value={opCity ?? ALL_CITIES}
              onValueChange={(v) => {
                setOpCity(v === ALL_CITIES ? null : v);
                resetPaging();
              }}
            >
              <SelectTrigger id="catalog-city" className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CITIES}>Hammasi</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFilter(f.key);
                resetPaging();
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Universitet topilmadi"
          description="Qidiruv so'zini yoki filtrni o'zgartirib ko'ring."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.slice(0, visible).map((entry) => (
              <UniversityCard
                key={entry.institution.id}
                entry={entry}
                level={level}
                onOpen={(e) => {
                  setSelectedId(e.institution.id);
                  setDetailOpen(true);
                }}
              />
            ))}
          </div>

          {filtered.length > visible && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Yana ko'rsatish ({filtered.length - visible} ta qoldi)
              </Button>
            </div>
          )}
        </>
      )}

      {canEdit && (
        <div className="border-t pt-4">
          <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Universitet qo'shish
          </Button>
        </div>
      )}

      <GuidelineDetailSheet
        entry={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canUpload={canEdit}
        onUpload={(entry, daraja) => startUpload(entry.institution.id, daraja)}
        uploading={importGuideline.isPending}
        initialLevel={level}
      />

      {/* Yuklash natijasi: xatolar bo'lsa qaysi qatorda ekani ko'rinadi */}
      <Dialog open={report !== null} onOpenChange={(open) => !open && setReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {report?.imported ? 'Excel yuklandi' : "Faylni o'qib bo'lmadi"}
            </DialogTitle>
            <DialogDescription>{report?.fileName}</DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-3 overflow-y-auto">
            {report?.imported && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="successSoft">{report.imported.fakultetlar} fakultet</Badge>
                <Badge variant="successSoft">{report.imported.muddatlar} muddat</Badge>
                <Badge variant="successSoft">{report.imported.hujjatlar} hujjat</Badge>
              </div>
            )}

            {report && report.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Xatolar</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {report.errors.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {report && report.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-warning">Ogohlantirishlar</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {report.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setReport(null)}>Yopish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yangi universitet */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Universitet qo'shish</DialogTitle>
            <DialogDescription>
              Katalogda yo'q oliygohni qo'shing. Excel keyin yuklanadi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="uni-name-ko">Nomi (한국어) *</Label>
              <Input
                id="uni-name-ko"
                value={newFields.name_ko}
                onChange={(e) => setNewFields((f) => ({ ...f, name_ko: e.target.value }))}
                placeholder="전북대학교"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uni-name-en">Nomi (English)</Label>
              <Input
                id="uni-name-en"
                value={newFields.name_en}
                onChange={(e) => setNewFields((f) => ({ ...f, name_en: e.target.value }))}
                placeholder="Jeonbuk National University"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uni-domain">Rasmiy domen *</Label>
              <Input
                id="uni-domain"
                value={newFields.primary_domain}
                onChange={(e) => setNewFields((f) => ({ ...f, primary_domain: e.target.value }))}
                placeholder="jbnu.ac.kr"
              />
              <p className="text-xs text-muted-foreground">
                Excel'dagi univ_kod shu domenning birinchi qismi bo'ladi (jbnu.ac.kr → jbnu).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uni-city">Shahar (한국어)</Label>
              <Input
                id="uni-city"
                value={newFields.city_ko}
                onChange={(e) => setNewFields((f) => ({ ...f, city_ko: e.target.value }))}
                placeholder="전주"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uni-type">Turi</Label>
              <Select
                value={newFields.institution_type}
                onValueChange={(v) => setNewFields((f) => ({ ...f, institution_type: v }))}
              >
                <SelectTrigger id="uni-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitNewInstitution} disabled={addInstitution.isPending}>
              {addInstitution.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Qo'shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
