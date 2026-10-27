import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Upload, X, Loader2 } from 'lucide-react';
import { type FeeReceipt, MAX_FEE_RECEIPTS, addReceipts } from '@/lib/applicationFeeReceipts';

export type { FeeReceipt } from '@/lib/applicationFeeReceipts';

interface FeeReceiptUploadProps {
  value: FeeReceipt[];
  onChange: (receipts: FeeReceipt[]) => void;
  studentId: string;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_SIZE = 8 * 1024 * 1024;

const isPdf = (r: FeeReceipt) =>
  r.fileName.toLowerCase().endsWith('.pdf') || r.url.toLowerCase().split('?')[0].endsWith('.pdf');

/**
 * Cheklar — PDF yoki rasm, bitta to'lovga bir nechta (bo'lib to'langan yoki
 * bank ikkita chek bergan holat). Har bir chek alohida ko'riladi va o'chiriladi.
 */
export function FeeReceiptUpload({ value, onChange, studentId, disabled }: FeeReceiptUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Yuklash asinxron: bir nechta fayl tugaguncha `value` eskirib qolmasligi uchun
  // eng oxirgi ro'yxat shu yerda saqlanadi.
  const latest = useRef(value);
  latest.current = value;

  const remaining = MAX_FEE_RECEIPTS - value.length;

  const uploadOne = async (file: File): Promise<FeeReceipt | null> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Noto'g'ri fayl turi", description: `${file.name}: PDF, PNG yoki JPG yuklang`, variant: 'destructive' });
      return null;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: 'Fayl juda katta', description: `${file.name}: eng ko'pi 8MB`, variant: 'destructive' });
      return null;
    }
    const fileExt = file.name.split('.').pop() || 'bin';
    const path = `application-fees/${studentId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('payment-receipts').upload(path, file);
    if (uploadError) {
      toast({ title: "Yuklab bo'lmadi", description: `${file.name}: ${uploadError.message}`, variant: 'destructive' });
      return null;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('payment-receipts').getPublicUrl(path);
    return { url: publicUrl, fileName: file.name };
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > remaining) {
      toast({
        title: `Eng ko'pi ${MAX_FEE_RECEIPTS} ta chek`,
        description: `Yana ${Math.max(remaining, 0)} ta qo'shish mumkin`,
        variant: 'destructive',
      });
      files = files.slice(0, Math.max(remaining, 0));
      if (files.length === 0) return;
    }
    setUploading(true);
    try {
      const uploaded: FeeReceipt[] = [];
      for (const file of files) {
        const r = await uploadOne(file);
        if (r) uploaded.push(r);
      }
      if (uploaded.length > 0) onChange(addReceipts(latest.current, uploaded));
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    void uploadFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="min-w-0 space-y-1.5">
      {value.length > 0 && (
        <ul className="space-y-1.5" aria-label="Cheklar">
          {value.map((r, i) => (
            // Fayl nomi ko'pincha juda uzun (telefon skrinshoti) — ko'rsatilmaydi,
            // faqat kichik ko'rinish va tartib raqami, blok chegarasidan chiqmasligi uchun.
            <li
              key={r.url}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2 py-1.5"
            >
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline"
              >
                {isPdf(r) ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                ) : (
                  <img src={r.url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                )}
                <span className="shrink-0">{value.length > 1 ? `${i + 1}-chek` : "Chekni ko'rish"}</span>
              </a>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`${i + 1}-chekni olib tashlash`}
                  onClick={() => removeAt(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
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
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs transition-colors ${
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/50'}`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">
                {value.length === 0 ? 'Chek yuklash (PDF, PNG, JPG)' : "Yana chek qo'shish"}
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            data-testid="fee-receipt-input"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
        </div>
      )}
    </div>
  );
}
