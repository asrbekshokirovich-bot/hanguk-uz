import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ShieldAlert, Loader2, Search, UploadCloud } from 'lucide-react';

/**
 * Manual guideline-PDF upload — the new ingestion front door.
 *
 * A staff member finds each university's current admission-guideline PDF and
 * uploads it; the `upload-guideline` edge function stores it and queues a
 * `guideline_documents` row (parse_status='pending') that the extraction
 * pipeline analyzes and publishes. This replaces the brittle
 * crawl/fetch/resolver layer with a human-picked PDF.
 *
 * v1 lists institutions + an Upload button. Per-university freshness status is
 * a fast-follow (needs a staff-readable view over guideline_documents).
 */

interface Institution {
  id: string;
  name_ko: string | null;
  name_en: string | null;
}

const INSTITUTIONS_KEY = ['uni_db', 'institutions_for_upload'] as const;

function useInstitutions() {
  return useQuery<Institution[], Error>({
    queryKey: INSTITUTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name_ko, name_en')
        .order('name_ko', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Institution[];
    },
  });
}

function institutionLabel(i: Institution): string {
  return i.name_en || i.name_ko || 'Unknown institution';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function UploadView() {
  const { data: institutions = [], isLoading, error } = useInstitutions();
  const [search, setSearch] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingInstitution = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return institutions;
    return institutions.filter(
      (i) =>
        (i.name_en ?? '').toLowerCase().includes(q) ||
        (i.name_ko ?? '').toLowerCase().includes(q),
    );
  }, [institutions, search]);

  const pickFile = (institutionId: string) => {
    pendingInstitution.current = institutionId;
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    const institutionId = pendingInstitution.current;
    pendingInstitution.current = null;
    if (!file || !institutionId) return;
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file.');
      return;
    }
    setUploadingId(institutionId);
    try {
      const file_base64 = await fileToBase64(file);
      const { data, error: fnError } = await supabase.functions.invoke('upload-guideline', {
        body: { institution_id: institutionId, file_base64, filename: file.name },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));
      toast.success('PDF uploaded — queued for analysis.');
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Could not load universities: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onFileChosen}
      />
      <div>
        <h2 className="text-lg font-semibold">Upload admission guidelines</h2>
        <p className="text-sm text-muted-foreground">
          Find each university's current 모집요강 PDF and upload it — the system extracts the
          requirements, documents, scholarships and dates automatically.
        </p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search universities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <ScrollArea className="h-[calc(100vh-18rem)]">
        <div className="space-y-2 pr-3">
          {filtered.map((inst) => (
            <Card key={inst.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{institutionLabel(inst)}</div>
                  {inst.name_ko && inst.name_en && (
                    <div className="truncate text-xs text-muted-foreground">{inst.name_ko}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadingId === inst.id}
                  onClick={() => pickFile(inst.id)}
                >
                  {uploadingId === inst.id ? (
                    <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Uploading…</>
                  ) : (
                    <><UploadCloud className="mr-1 h-4 w-4" /> Upload PDF</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No universities match your search.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function UniDbUploadContent() {
  const { canReview, loading } = useCanReviewUniDb();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You don't have permission to manage university data.
        </p>
      </div>
    );
  }

  return <UploadView />;
}

export default UniDbUploadContent;
