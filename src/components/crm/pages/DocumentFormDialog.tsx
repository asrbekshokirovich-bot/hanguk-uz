import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import {
  useCreateDocument,
  useUpdateDocument,
} from '@/hooks/useDocumentMutations';

const schema = z.object({
  document_type: z.string().min(1, 'Hujjat turini kiriting'),
  applicant_category: z.string().nullable(),
  is_required: z.boolean(),
  is_apostille_required: z.boolean(),
  notes_ko: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface EditDoc {
  id: string;
  document_type: string;
  applicant_category: string | null;
  is_required: boolean | null;
  is_apostille_required: boolean | null;
  notes_ko: string | null;
}

interface Props {
  cycleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDoc?: EditDoc | null;
}

export function DocumentFormDialog({ cycleId, open, onOpenChange, editDoc }: Props) {
  const createMut = useCreateDocument();
  const updateMut = useUpdateDocument();
  const isEdit = !!editDoc;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      document_type: '',
      applicant_category: null,
      is_required: true,
      is_apostille_required: false,
      notes_ko: null,
    },
  });

  useEffect(() => {
    if (open && editDoc) {
      reset({
        document_type: editDoc.document_type,
        applicant_category: editDoc.applicant_category || null,
        is_required: editDoc.is_required ?? true,
        is_apostille_required: editDoc.is_apostille_required ?? false,
        notes_ko: editDoc.notes_ko || null,
      });
    } else if (open) {
      reset({
        document_type: '',
        applicant_category: null,
        is_required: true,
        is_apostille_required: false,
        notes_ko: null,
      });
    }
  }, [open, editDoc, reset]);

  const onSubmit = async (vals: FormValues) => {
    const input = {
      cycle_id: cycleId,
      document_type: vals.document_type,
      applicant_category: vals.applicant_category || null,
      is_required: vals.is_required,
      is_apostille_required: vals.is_apostille_required,
      notes_ko: vals.notes_ko || null,
    };

    if (isEdit && editDoc) {
      await updateMut.mutateAsync({ ...input, id: editDoc.id });
    } else {
      await createMut.mutateAsync(input);
    }
    onOpenChange(false);
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Hujjatni tahrirlash' : 'Yangi hujjat qo\'shish'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-xs">Hujjat turi *</Label>
            <Input className="h-9 text-xs" placeholder="Pasport nusxasi / 졸업증명서" {...register('document_type')} />
            {errors.document_type && <p className="text-[10px] text-destructive mt-0.5">{errors.document_type.message}</p>}
          </div>

          <div>
            <Label className="text-xs">Ariza beruvchi kategoriyasi</Label>
            <Input className="h-9 text-xs" placeholder="외국인특별전형 (ixtiyoriy)" {...register('applicant_category')} />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="doc-required" checked={watch('is_required')} onCheckedChange={(v) => setValue('is_required', v)} />
              <Label htmlFor="doc-required" className="text-xs cursor-pointer">Majburiy</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="doc-apostille" checked={watch('is_apostille_required')} onCheckedChange={(v) => setValue('is_apostille_required', v)} />
              <Label htmlFor="doc-apostille" className="text-xs cursor-pointer">Apostil kerak</Label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Izoh (koreys tili)</Label>
            <Textarea className="text-xs min-h-[60px]" placeholder="추가 메모..." {...register('notes_ko')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Bekor</Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {isEdit ? 'Saqlash' : 'Qo\'shish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
