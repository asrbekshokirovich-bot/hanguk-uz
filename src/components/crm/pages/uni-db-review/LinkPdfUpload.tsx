import { useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { edgeFunctionError } from '@/lib/edgeFunctionError';
import {
  MAX_GUIDELINE_PDF_MB,
  fileSizeMb,
  isTooLarge,
  uploadGuidelineViaSignedUrl,
} from '@/lib/guidelinePdf';
import {
  institutionLabel,
  matchInstitution,
  type MatchableInstitution,
} from './linkInstitutionMatch';

/**
 * Upload the PDF for a link the scanner could not fetch.
 *
 * The whole point of the Havolalar tab is that a Korean host blocked the
 * crawler — so the human opens the link, saves the 모집요강 PDF, and drops it
 * here. The file goes through the existing `upload-guideline` edge function
 * (same front door as the Universitetlar page): it stores the blob and inserts
 * a `guideline_documents` row with parse_status='pending', which the extraction
 * pipeline picks up and routes back into the approval queue.
 *
 * That function requires an institution_id, and `proposed_sources` has none, so
 * the university is guessed from the link (see linkInstitutionMatch) and shown
 * in an overridable picker. Upload is disabled until a university is set —
 * a PDF filed against the wrong school is worse than no PDF at all.
 */

const INSTITUTIONS_KEY = ['uni_db', 'institutions_for_upload'] as const;

function useInstitutions() {
  return useQuery<MatchableInstitution[], Error>({
    queryKey: INSTITUTIONS_KEY,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name_ko, name_en, primary_domain')
        .order('name_ko', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MatchableInstitution[];
    },
  });
}

export function LinkPdfUpload({
  url,
  candidateTitle,
  onUploaded,
}: {
  url: string;
  candidateTitle: string | null;
  /** Called after a successful upload so the caller can clear the link. */
  onUploaded: () => void;
}) {
  const { t } = useTranslation();
  const { data: institutions = [] } = useInstitutions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [override, setOverride] = useState<MatchableInstitution | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const guessed = matchInstitution(institutions, url, candidateTitle);
  const chosen = override ?? guessed;

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!file || !chosen) return;
    if (
      file.type &&
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      toast.error(t('uniReview.links.notPdf'));
      return;
    }
    // Catch an oversize file before spending a base64 round trip on it.
    if (isTooLarge(file)) {
      toast.error(
        t('uniReview.links.tooLarge', { size: fileSizeMb(file), max: MAX_GUIDELINE_PDF_MB }),
      );
      return;
    }
    setUploading(true);
    try {
      await uploadGuidelineViaSignedUrl(
        supabase,
        chosen.id,
        file,
        (err, fallback) => edgeFunctionError(err, fallback),
        t('uniReview.links.uploadFailed'),
      );
      toast.success(t('uniReview.links.uploaded', { uni: institutionLabel(chosen) }));
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onFileChosen}
      />

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            className={cn('h-8 max-w-[280px] justify-between', !chosen && 'text-muted-foreground')}
          >
            <span className="truncate">
              {chosen ? institutionLabel(chosen) : t('uniReview.links.pickUni')}
            </span>
            <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command
            filter={(value, search) =>
              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder={t('uniReview.links.searchUni')} />
            <CommandList>
              <CommandEmpty>{t('uniReview.links.noUni')}</CommandEmpty>
              {institutions.map((i) => (
                <CommandItem
                  key={i.id}
                  value={institutionLabel(i)}
                  onSelect={() => {
                    setOverride(i);
                    setPickerOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-3.5 w-3.5',
                      chosen?.id === i.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{institutionLabel(i)}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={!chosen || uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-1.5 h-[14px] w-[14px] animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-[14px] w-[14px]" />
        )}
        {t('uniReview.links.uploadPdf')}
      </Button>
    </div>
  );
}

export default LinkPdfUpload;
