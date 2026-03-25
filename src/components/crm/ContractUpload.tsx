import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, X, Loader2, ExternalLink } from 'lucide-react';

interface ContractUploadProps {
  value: string;
  onChange: (url: string) => void;
  studentId?: string;
  disabled?: boolean;
}

export function ContractUpload({ value, onChange, studentId, disabled }: ContractUploadProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [uploading, setUploading] = useState(false);
  const [openingUrl, setOpeningUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('common.error'),
        description: 'Please upload a PDF or image file (JPEG, PNG, WebP)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: 'File size must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique file path — store under the standard student folder
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const filePath = studentId 
        ? `${studentId}/contract-${timestamp}-${randomId}.${fileExt}`
        : `contracts/temp/${timestamp}-${randomId}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file_path (not a public URL) — signed URLs are generated on demand
      onChange(filePath);

      toast({
        title: t('common.success'),
        description: 'Contract uploaded successfully',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to upload contract',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  // Fetch contract via proxy edge function to avoid browser extension blocking
  const handleOpenContract = async () => {
    if (!value) return;
    setOpeningUrl(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // value may be a file_path or a legacy public URL
      const isFilePath = !value.startsWith('http');
      const filePath = isFilePath ? value : extractFilePathFromUrl(value);

      if (!filePath) {
        // Legacy public URL fallback
        const a = document.createElement('a');
        a.href = value;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-proxy`
        + `?path=${encodeURIComponent(filePath)}&bucket=student-documents`;

      const resp = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!resp.ok) throw new Error(`Failed to load contract: ${resp.statusText}`);

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      const name = getFileName(filePath || value);
      const ext = (filePath || value).split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);

      if (isImage) {
        // For images, show inline preview in a simple window — images are not blocked
        const imgWin = window.open('', '_blank');
        if (imgWin) {
          imgWin.document.write(`<img src="${blobUrl}" style="max-width:100%;height:auto;" />`);
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } else {
        // Force download — never blocked by Chrome, extensions, or popup blockers
        const fileName = name || 'contract.pdf';
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: 'Failed to open contract. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOpeningUrl(false);
    }
  };

  const extractFilePathFromUrl = (url: string): string | null => {
    try {
      // Extract path after /student-documents/
      const match = url.match(/student-documents\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const getFileName = (pathOrUrl: string) => {
    try {
      const parts = pathOrUrl.split('/');
      return parts[parts.length - 1];
    } catch {
      return 'Contract file';
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Contract Document
        </Label>

        {value ? (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-success/10 border-success/30">
            <FileText className="h-5 w-5 text-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{getFileName(value)}</p>
              <p className="text-xs text-muted-foreground">Contract uploaded</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleOpenContract}
                disabled={openingUrl}
              >
                {openingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click to upload contract (PDF or image)
                </span>
                <span className="text-xs text-muted-foreground">Max 10MB</span>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>
    </>
  );
}
