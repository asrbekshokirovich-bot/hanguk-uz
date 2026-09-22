import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Upload, X, Loader2 } from 'lucide-react';

export interface FeeReceipt {
  url: string;
  fileName: string;
}

interface FeeReceiptUploadProps {
  value: FeeReceipt | null;
  onChange: (receipt: FeeReceipt | null) => void;
  studentId: string;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_SIZE = 8 * 1024 * 1024;

/** Chek fayli — PDF yoki rasm. Bitta talaba uchun bir nechta blok bo'lgani uchun kichik va ixcham. */
export function FeeReceiptUpload({ value, onChange, studentId, disabled }: FeeReceiptUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Noto'g'ri fayl turi", description: 'PDF, PNG yoki JPG yuklang', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: 'Fayl juda katta', description: "Eng ko'pi 8MB", variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'bin';
      const path = `application-fees/${studentId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('payment-receipts').upload(path, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('payment-receipts').getPublicUrl(path);

      onChange({ url: publicUrl, fileName: file.name });
    } catch (err) {
      toast({
        title: "Yuklab bo'lmadi",
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void uploadFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const isPdf = value?.fileName.toLowerCase().endsWith('.pdf') ?? false;

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <a
          href={value.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline"
        >
          {isPdf ? (
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <img src={value.url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
          )}
          <span className="truncate">{value.fileName}</span>
        </a>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/50'}`}
    >
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Chek yuklash (PDF, PNG, JPG)</span>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
