/**
 * Phase 3R-B cutover (2026-05-10) — full replacement.
 *
 * The legacy 4-component universities feature (UniversityList,
 * UniversityForm, UniversityDetailSheet, AIUniversityForm) and the
 * koreanUniversitiesApi bulk-import flow were tied to the now-dropped
 * `public.universities` table. This page is a clean rebuild against
 * the canonical `public.institutions` (uni_db) table:
 *
 *   - Browse / search institutions (Korean + English name)
 *   - Toggle is_partner / is_visible_on_map per row
 *   - Add a new institution (minimal form: Korean + English name,
 *     primary_domain, type)
 *   - Edit name + tier + admissions URL
 *   - Delete (with confirm)
 *   - Per-row partner badge + map-visible badge
 *
 * Deferred (intentionally hidden):
 *   - LLM-powered "AI add" form  (legacy AIUniversityForm)
 *   - Bulk-import button (the legacy koreanUniversitiesApi client has since
 *     been removed; a replacement will be built against institutions)
 *
 * Both will be re-implemented later against the institutions schema +
 * recruitment_units. For now they're behind a hard-coded false flag so
 * staff don't accidentally write to a non-existent legacy path.
 */

import { useMemo, useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useUniversities, type Institution } from '@/hooks/useUniversities';
import { edgeFunctionError } from '@/lib/edgeFunctionError';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { UniversityAdmissionsSheet } from './UniversityAdmissionsSheet';
import {
  GraduationCap,
  Plus,
  Search,
  Loader2,
  Star,
  StarOff,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Building2,
  MapPin,
  ExternalLink,
  RefreshCw,
  ListChecks,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

const ENABLE_LEGACY_FEATURES = false; // AI add + bulk import — disabled per Phase 3R-B

const INSTITUTION_TYPES = ['national', 'public', 'private', 'religious', 'special'];

type EditState =
  | { mode: 'create' }
  | { mode: 'edit'; row: Institution }
  | null;

interface FormFields {
  name_ko: string;
  name_en: string;
  primary_domain: string;
  institution_type: string;
  tier: string;
  city_ko: string;
  primary_admissions_url_ko: string;
}

const emptyFields = (): FormFields => ({
  name_ko: '',
  name_en: '',
  primary_domain: '',
  institution_type: 'private',
  tier: '',
  city_ko: '',
  primary_admissions_url_ko: '',
});

function fieldsFromRow(r: Institution): FormFields {
  return {
    name_ko: r.name_ko ?? '',
    name_en: r.name_en ?? '',
    primary_domain: r.primary_domain ?? '',
    institution_type: r.institution_type ?? 'private',
    tier: r.tier?.toString() ?? '',
    city_ko: r.city_ko ?? '',
    primary_admissions_url_ko: r.primary_admissions_url_ko ?? '',
  };
}

function fieldsToPayload(f: FormFields): Partial<Institution> {
  const payload: Partial<Institution> = {
    name_ko: f.name_ko.trim(),
    name_en: f.name_en.trim() || null,
    primary_domain: f.primary_domain.trim() || 'unknown.ac.kr',
    institution_type: f.institution_type,
    city_ko: f.city_ko.trim() || null,
    primary_admissions_url_ko: f.primary_admissions_url_ko.trim() || null,
  };
  if (f.tier.trim() !== '') {
    const n = Number.parseInt(f.tier, 10);
    if (Number.isFinite(n)) payload.tier = n;
  }
  return payload;
}

const DOC_STATUS_REFRESH_MS = 30_000;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** Latest guideline-PDF status per institution, shown on each card. */
function UploadStatusBadge({ status }: { status?: string }) {
  if (!status) {
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> No PDF</Badge>;
  }
  if (status === 'succeeded') {
    return <Badge variant="lime" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Current</Badge>;
  }
  if (status === 'failed') {
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Failed</Badge>;
  }
  return <Badge variant="info" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
}

export default function UniversitiesContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    universities: institutions,
    loading,
    stats,
    fetchUniversities,
    createUniversity,
    updateUniversity,
    deleteUniversity,
    togglePartner,
    toggleMapVisibility,
  } = useUniversities();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'partners' | 'on_map'>('all');
  const [edit, setEdit] = useState<EditState>(null);
  const [fields, setFields] = useState<FormFields>(emptyFields());
  const [confirmDelete, setConfirmDelete] = useState<Institution | null>(null);
  const [detail, setDetail] = useState<Institution | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Guideline-PDF upload (the manual-upload front door, per-card) ---
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingInstitution = useRef<string | null>(null);

  const loadStatus = async () => {
    const { data } = await supabase
      .from('guideline_documents')
      .select('institution_id, parse_status, fetched_at')
      .order('fetched_at', { ascending: false });
    const map = new Map<string, string>();
    for (const r of (data ?? []) as { institution_id: string; parse_status: string }[]) {
      if (!map.has(r.institution_id)) map.set(r.institution_id, r.parse_status);
    }
    setStatusMap(map);
  };

  useEffect(() => {
    loadStatus();
    const id = setInterval(loadStatus, DOC_STATUS_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const pickUpload = (institutionId: string) => {
    pendingInstitution.current = institutionId;
    fileInputRef.current?.click();
  };

  const onUploadFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    const institutionId = pendingInstitution.current;
    pendingInstitution.current = null;
    if (!file || !institutionId) return;
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: 'Please choose a PDF file', variant: 'destructive' });
      return;
    }
    setUploadingId(institutionId);
    try {
      const file_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('upload-guideline', {
        body: { institution_id: institutionId, file_base64, filename: file.name },
      });
      if (error) throw await edgeFunctionError(error, 'Upload failed');
      if (data?.error) throw new Error(String(data.error));
      toast({ title: 'PDF uploaded', description: 'Queued for analysis.' });
      loadStatus();
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setUploadingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return institutions.filter((row) => {
      if (filter === 'partners' && !row.is_partner) return false;
      if (filter === 'on_map' && !row.is_visible_on_map) return false;
      if (!q) return true;
      const haystack = [
        row.name_ko ?? '',
        row.name_en ?? '',
        row.name_ko_short ?? '',
        row.primary_domain ?? '',
        row.city_ko ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [institutions, search, filter]);

  const openCreate = () => {
    setFields(emptyFields());
    setEdit({ mode: 'create' });
  };

  const openEdit = (row: Institution) => {
    setFields(fieldsFromRow(row));
    setEdit({ mode: 'edit', row });
  };

  const closeEdit = () => {
    if (busy) return;
    setEdit(null);
  };

  const submitEdit = async () => {
    if (!fields.name_ko.trim()) {
      toast({ title: 'Korean name required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (edit?.mode === 'create') {
        const { error } = await createUniversity(fieldsToPayload(fields));
        if (error) throw new Error(error.message);
        toast({ title: 'Institution added', description: fields.name_ko });
      } else if (edit?.mode === 'edit') {
        const { error } = await updateUniversity(edit.row.id, fieldsToPayload(fields));
        if (error) throw new Error(error.message);
        toast({ title: 'Saved', description: fields.name_ko });
      }
      setEdit(null);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const { error } = await deleteUniversity(confirmDelete.id);
      if (error) throw new Error(error.message);
      toast({ title: 'Deleted', description: confirmDelete.name_ko ?? confirmDelete.id });
      setConfirmDelete(null);
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onUploadFileChosen}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            {t('navigation.universities') ?? 'Institutions'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Backed by <code className="px-1 py-0.5 bg-muted rounded">public.institutions</code>{' '}
            (uni_db). The legacy <code className="px-1 py-0.5 bg-muted rounded">universities</code>{' '}
            table was dropped on 2026-05-10.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchUniversities()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add institution
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Partners</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.partners}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">On map</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.visibleOnMap}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">With domain</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.withDomain}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">With geo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.withGeo}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Korean / English name, domain, city"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
          <Button size="sm" variant={filter === 'partners' ? 'default' : 'outline'} onClick={() => setFilter('partners')}>
            <Star className="h-4 w-4 mr-1" /> Partners
          </Button>
          <Button size="sm" variant={filter === 'on_map' ? 'default' : 'outline'} onClick={() => setFilter('on_map')}>
            <MapPin className="h-4 w-4 mr-1" /> On map
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {institutions.length === 0
              ? <>No institutions yet. Click <strong>Add institution</strong> to seed your first one.</>
              : 'No matches for the current filter.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((row) => (
            <Card key={row.id} className={row.is_partner ? 'border-primary/40' : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{row.name_ko}</CardTitle>
                    {row.name_en ? (
                      <p className="text-xs text-muted-foreground truncate">{row.name_en}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <UploadStatusBadge status={statusMap.get(row.id)} />
                      {row.is_partner ? <Badge variant="lime">partner</Badge> : null}
                      {row.is_visible_on_map ? <Badge variant="outline">on map</Badge> : null}
                      <Badge variant="neutral">{row.institution_type}</Badge>
                      {row.tier !== null && row.tier !== undefined ? <Badge variant="info">tier {row.tier}</Badge> : null}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" /> {row.city_ko ?? '—'}
                </div>
                <div className="text-muted-foreground truncate">
                  {row.primary_domain || '—'}
                </div>
                {row.primary_admissions_url_ko ? (
                  <a
                    href={row.primary_admissions_url_ko}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 truncate"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" /> admissions site
                  </a>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t mt-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={row.is_partner ? 'Remove partner' : 'Mark as partner'}
                      onClick={() => togglePartner(row.id, !row.is_partner)}
                    >
                      {row.is_partner ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={row.is_visible_on_map ? 'Hide from map' : 'Show on map'}
                      onClick={() => toggleMapVisibility(row.id, !row.is_visible_on_map)}
                    >
                      {row.is_visible_on_map ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={uploadingId === row.id}
                      onClick={() => pickUpload(row.id)}
                      title="Upload admission-guideline PDF"
                    >
                      {uploadingId === row.id
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <UploadCloud className="h-4 w-4 mr-1" />}
                      Upload
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      title="View admissions data"
                      onClick={() => setDetail(row)}
                    >
                      <ListChecks className="h-4 w-4 mr-1" /> Admissions
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(row)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Disabled legacy features banner — visible only when the flag flips on */}
      {ENABLE_LEGACY_FEATURES ? (
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground">
            (Legacy AI add + bulk import would render here once re-implemented against institutions.)
          </CardContent>
        </Card>
      ) : null}

      <UniversityAdmissionsSheet
        institution={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit?.mode === 'create' ? 'Add institution' : 'Edit institution'}</DialogTitle>
            <DialogDescription>
              Minimal fields for now. Tuition, programs, scholarships, requirements live in their
              own uni_db tables (recruitment_units, tuition, scholarships, requirements).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="i-ko">Korean name *</Label>
              <Input id="i-ko" value={fields.name_ko} onChange={(e) => setFields({ ...fields, name_ko: e.target.value })} placeholder="서울대학교" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-en">English name</Label>
              <Input id="i-en" value={fields.name_en} onChange={(e) => setFields({ ...fields, name_en: e.target.value })} placeholder="Seoul National University" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="i-domain">Domain</Label>
                <Input id="i-domain" value={fields.primary_domain} onChange={(e) => setFields({ ...fields, primary_domain: e.target.value })} placeholder="snu.ac.kr" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="i-tier">Tier (1-5, optional)</Label>
                <Input id="i-tier" type="number" min={1} max={5} value={fields.tier} onChange={(e) => setFields({ ...fields, tier: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="i-type">Type</Label>
                <Select value={fields.institution_type} onValueChange={(v) => setFields({ ...fields, institution_type: v })}>
                  <SelectTrigger id="i-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSTITUTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="i-city">City (Korean)</Label>
                <Input id="i-city" value={fields.city_ko} onChange={(e) => setFields({ ...fields, city_ko: e.target.value })} placeholder="서울" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-url">Admissions URL (Korean)</Label>
              <Input id="i-url" value={fields.primary_admissions_url_ko} onChange={(e) => setFields({ ...fields, primary_admissions_url_ko: e.target.value })} placeholder="https://admission.snu.ac.kr" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} disabled={busy}>Cancel</Button>
            <Button onClick={submitEdit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {edit?.mode === 'create' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete institution?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{confirmDelete?.name_ko}</strong> from{' '}
              <code>public.institutions</code>. Any rows in dependent tables (university_programs,
              gks_designated_universities, etc.) will have their <code>institution_id</code> set
              to <code>NULL</code> via ON DELETE SET NULL — no cascade wipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
