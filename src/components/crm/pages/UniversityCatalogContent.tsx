/**
 * Universitetlar — xodim uchun katalog.
 *
 * Ro'yxat `institutions` jadvalidan keladi (Janubiy Koreyadagi 400+ oliygoh),
 * har bir universitetning batafsil ma'lumoti esa shablon bo'yicha to'ldirilgan
 * guideline Excel'idan. Excel yuklangan universitetda kartada kontrakt narxi,
 * TOPIK/IELTS talabi va shahri ko'rinadi; ustiga bosilganda muddatlar,
 * fakultetlar (EN + 한국어) va hujjatlar ochiladi.
 */

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
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
import { matchesFilter, matchesSearch, type CatalogFilter } from './university-catalog/format';

const PAGE_SIZE = 48;

const FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: 'hammasi', label: 'Hammasi' },
  { key: 'malumotli', label: "Ma'lumotli" },
  { key: 'topik', label: 'TOPIK' },
  { key: 'ielts', label: 'IELTS' },
  { key: 'hamkor', label: 'Hamkor' },
];

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
  const { isAdmin } = useUserRole();
  const { entries, loading, error, refetch } = useUniversityCatalog();
  const importGuideline = useGuidelineImport();
  const addInstitution = useAddInstitution();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('hammasi');
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Tanlangan universitet id bo'yicha saqlanadi: Excel yuklangandan keyin
  // ro'yxat yangilanadi va panel o'sha zahoti yangi ma'lumotni ko'rsatadi.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newFields, setNewFields] = useState(emptyNewInstitution);

  // Yuklash bitta universitet kartasidan ham, yuqoridagi umumiy tugmadan ham
  // boshlanishi mumkin — maqsad shu ref'da turadi.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const filtered = useMemo(
    () => entries.filter((e) => matchesFilter(e, filter) && matchesSearch(e, search)),
    [entries, filter, search],
  );

  const withData = useMemo(() => entries.filter((e) => e.guidelines.length > 0).length, [entries]);

  const selected = useMemo(
    () => entries.find((e) => e.institution.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const resetPaging = () => setVisible(PAGE_SIZE);

  const startUpload = (institutionId: string | null) => {
    uploadTarget.current = institutionId;
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // bir xil faylni qayta tanlash mumkin bo'lsin
    const institutionId = uploadTarget.current;
    uploadTarget.current = null;
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast({ title: '.xlsx fayl tanlang', variant: 'destructive' });
      return;
    }

    const parsed = await parseGuidelineWorkbook(await file.arrayBuffer(), file.name);
    if (!parsed.ok || !parsed.payload) {
      setReport({ fileName: file.name, errors: parsed.errors, warnings: parsed.warnings, imported: null });
      return;
    }

    try {
      const outcome = await importGuideline.mutateAsync({ payload: parsed.payload, institutionId });
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
          <span>
            {entries.length} universitet
            {withData > 0 && ` · ${withData} tasida ma'lumot bor`}
          </span>
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

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={TEMPLATE_URL} download>
                  <Download className="mr-2 h-4 w-4" />
                  Shablon
                </a>
              </Button>
              <Button
                size="sm"
                onClick={() => startUpload(null)}
                disabled={importGuideline.isPending}
              >
                {importGuideline.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                Excel yuklash
              </Button>
            </div>
          )}
        </div>
      </div>

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

      {isAdmin && (
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
        canUpload={isAdmin}
        onUpload={(entry) => startUpload(entry.institution.id)}
        uploading={importGuideline.isPending}
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
