import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileUp, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUniversities, type Institution } from '@/hooks/useUniversities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * "PDF qo'shish" for a blocked link in the Havolalar tab.
 *
 * The row in `proposed_sources` is a 모집요강 URL the nightly Routine could not
 * fetch. A human opens it by hand, downloads the PDF, and drops it here: the
 * file goes through the `upload-guideline` edge function (staff-only, %PDF
 * magic-byte check, private `guideline-blobs` bucket) which inserts a
 * `guideline_documents` row with parse_status='pending' — the same front door
 * the Universities page uses. Extraction then picks it up and the result lands
 * back in the approval queue.
 *
 * The dialog only has to add the one thing the link row cannot infer: WHICH
 * institution the PDF belongs to. The picker pre-filters on the link's host so
 * the matching university is usually the first hit.
 */

const MAX_BYTES = 25 * 1024 * 1024; // mirrors the edge function's limit
const VISIBLE_MATCHES = 8;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** Registrable-ish host of the link, used to guess the institution. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Institutions whose domain appears in the link's host, best guess first. */
function rankByLink(rows: Institution[], url: string): Institution[] {
  const host = hostOf(url);
  if (!host) return rows;
  const scored = rows.filter((r) => {
    const domain = (r.primary_domain ?? '').toLowerCase();
    return domain && domain !== 'unknown.ac.kr' && host.includes(domain);
  });
  return scored.length > 0 ? scored : rows;
}

export function UploadGuidelineDialog({
  open,
  onOpenChange,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The proposed-source URL this PDF came from — used to pre-pick the institution. */
  url: string;
}) {
  const { t } = useTranslation();
  const { universities, loading } = useUniversities();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Institution | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? universities.filter((r) =>
          [r.name_ko, r.name_en, r.name_ko_short, r.primary_domain]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : rankByLink(universities, url);
    return pool.slice(0, VISIBLE_MATCHES);
  }, [universities, search, url]);

  const reset = () => {
    setSearch('');
    setSelected(null);
    setFile(null);
  };

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const onFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    e.target.value = ''; // allow re-picking the same file
    if (!chosen) return;
    const isPdf =
      chosen.type === 'application/pdf' || chosen.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      toast.error(t('uniReview.links.upload.notPdf'));
      return;
    }
    if (chosen.size > MAX_BYTES) {
      toast.error(t('uniReview.links.upload.tooLarge', { mb: MAX_BYTES / 1024 / 1024 }));
      return;
    }
    setFile(chosen);
  };

  const submit = async () => {
    if (!selected || !file) return;
    setBusy(true);
    try {
      const file_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('upload-guideline', {
        body: { institution_id: selected.id, file_base64, filename: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success(t('uniReview.links.upload.queued'));
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('uniReview.links.upload.title')}</DialogTitle>
          <DialogDescription className="break-all">
            {t('uniReview.links.upload.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('uniReview.links.upload.searchPlaceholder')}
              className="pl-8"
            />
          </div>

          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : matches.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                {t('uniReview.links.upload.noMatch')}
              </p>
            ) : (
              matches.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={cn(
                    'flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors',
                    selected?.id === row.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <span className="text-[13px] font-semibold">
                    {row.name_ko || row.name_en}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {[row.name_en, row.primary_domain].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={onFileChosen}
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 justify-start"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="mr-2 h-[15px] w-[15px]" />
            {file ? file.name : t('uniReview.links.upload.choose')}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
            {t('uniReview.links.upload.cancel')}
          </Button>
          <Button onClick={submit} disabled={busy || !selected || !file}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('uniReview.links.upload.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadGuidelineDialog;
