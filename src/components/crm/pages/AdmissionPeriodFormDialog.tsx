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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  useCreateAdmissionPeriod,
  useUpdateAdmissionPeriod,
  type AdmissionPeriodInput,
} from '@/hooks/useAdmissionPeriodMutations';

// Empty number inputs arrive as NaN (valueAsNumber); coerce them to null so an
// empty optional fee field doesn't silently fail validation.
const optionalNum = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v),
  z.coerce.number().min(0).nullable(),
);

const schema = z.object({
  semester: z.enum(['spring', 'fall']),
  year: z.coerce.number().min(2024).max(2030),
  program_level: z.string().min(1, 'Tanlang'),
  language_track: z.string().nullable(),
  application_start: z.string().nullable(),
  application_end: z.string().nullable(),
  document_deadline: z.string().nullable(),
  result_announcement: z.string().nullable(),
  online_application_start: z.string().nullable(),
  online_application_end: z.string().nullable(),
  application_fee_krw: optionalNum,
  application_fee_usd: optionalNum,
  application_form_url: z.string().url().nullable().or(z.literal('')),
  application_guide_url: z.string().url().nullable().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface EditPeriod {
  id: string;
  semester: string | null;
  year: number | null;
  program_level: string | null;
  language_track: string | null;
  application_start: string | null;
  application_end: string | null;
  document_deadline: string | null;
  result_announcement: string | null;
  online_application_start?: string | null;
  online_application_end?: string | null;
  application_fee_krw?: number | null;
  application_fee_usd?: number | null;
  application_form_url?: string | null;
  application_guide_url?: string | null;
}

interface Props {
  institutionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPeriod?: EditPeriod | null;
}

const currentYear = new Date().getFullYear();

export function AdmissionPeriodFormDialog({ institutionId, open, onOpenChange, editPeriod }: Props) {
  const createMut = useCreateAdmissionPeriod();
  const updateMut = useUpdateAdmissionPeriod();
  const isEdit = !!editPeriod;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      semester: 'fall',
      year: currentYear + 1,
      program_level: 'undergraduate',
      language_track: null,
      application_start: null,
      application_end: null,
      document_deadline: null,
      result_announcement: null,
      online_application_start: null,
      online_application_end: null,
      application_fee_krw: null,
      application_fee_usd: null,
      application_form_url: null,
      application_guide_url: null,
    },
  });

  useEffect(() => {
    if (open && editPeriod) {
      reset({
        semester: (editPeriod.semester as 'spring' | 'fall') || 'fall',
        year: editPeriod.year || currentYear + 1,
        program_level: editPeriod.program_level || 'undergraduate',
        language_track: editPeriod.language_track || null,
        application_start: editPeriod.application_start || null,
        application_end: editPeriod.application_end || null,
        document_deadline: editPeriod.document_deadline || null,
        result_announcement: editPeriod.result_announcement || null,
        online_application_start: editPeriod.online_application_start || null,
        online_application_end: editPeriod.online_application_end || null,
        application_fee_krw: editPeriod.application_fee_krw ?? null,
        application_fee_usd: editPeriod.application_fee_usd ?? null,
        application_form_url: editPeriod.application_form_url || null,
        application_guide_url: editPeriod.application_guide_url || null,
      });
    } else if (open) {
      reset({
        semester: 'fall',
        year: currentYear + 1,
        program_level: 'undergraduate',
        language_track: null,
        application_start: null,
        application_end: null,
        document_deadline: null,
        result_announcement: null,
        online_application_start: null,
        online_application_end: null,
        application_fee_krw: null,
        application_fee_usd: null,
        application_form_url: null,
        application_guide_url: null,
      });
    }
  }, [open, editPeriod, reset]);

  const onSubmit = async (vals: FormValues) => {
    const input: AdmissionPeriodInput = {
      institution_id: institutionId,
      semester: vals.semester,
      year: vals.year,
      program_level: vals.program_level,
      language_track: vals.language_track || null,
      application_start: vals.application_start || null,
      application_end: vals.application_end || null,
      document_deadline: vals.document_deadline || null,
      result_announcement: vals.result_announcement || null,
      online_application_start: vals.online_application_start || null,
      online_application_end: vals.online_application_end || null,
      application_fee_krw: vals.application_fee_krw || null,
      application_fee_usd: vals.application_fee_usd || null,
      application_form_url: vals.application_form_url || null,
      application_guide_url: vals.application_guide_url || null,
    };

    if (isEdit && editPeriod) {
      await updateMut.mutateAsync({ ...input, id: editPeriod.id });
    } else {
      await createMut.mutateAsync(input);
    }
    onOpenChange(false);
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Qabul davrini tahrirlash' : 'Yangi qabul davri qo\'shish'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Semestr *</Label>
              <Select value={watch('semester')} onValueChange={(v) => setValue('semester', v as 'spring' | 'fall')}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spring">Bahor (Spring)</SelectItem>
                  <SelectItem value="fall">Kuz (Fall)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Yil *</Label>
              <Input type="number" className="h-9 text-xs" {...register('year', { valueAsNumber: true })} />
              {errors.year && <p className="text-[10px] text-destructive mt-0.5">{errors.year.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Daraja *</Label>
              <Select value={watch('program_level')} onValueChange={(v) => setValue('program_level', v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="undergraduate">Bakalavr</SelectItem>
                  <SelectItem value="graduate">Magistr</SelectItem>
                  <SelectItem value="phd">PhD</SelectItem>
                  <SelectItem value="language">Til kursi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Til</Label>
              <Select value={watch('language_track') || 'none'} onValueChange={(v) => setValue('language_track', v === 'none' ? null : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belgilanmagan</SelectItem>
                  <SelectItem value="korean">Korean</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Sanalar</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Ariza boshlanishi</Label>
                <Input type="date" className="h-9 text-xs" {...register('application_start')} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Ariza tugashi</Label>
                <Input type="date" className="h-9 text-xs" {...register('application_end')} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Hujjat deadline</Label>
                <Input type="date" className="h-9 text-xs" {...register('document_deadline')} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Natija e'lon</Label>
                <Input type="date" className="h-9 text-xs" {...register('result_announcement')} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Online ariza boshi</Label>
                <Input type="date" className="h-9 text-xs" {...register('online_application_start')} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Online ariza oxiri</Label>
                <Input type="date" className="h-9 text-xs" {...register('online_application_end')} />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Ariza to'lovi</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">KRW (₩)</Label>
                <Input type="number" className="h-9 text-xs" placeholder="50000" {...register('application_fee_krw', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">USD ($)</Label>
                <Input type="number" className="h-9 text-xs" placeholder="40" {...register('application_fee_usd', { valueAsNumber: true })} />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Havolalar</p>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Ariza formasi URL</Label>
                <Input type="url" className="h-9 text-xs" placeholder="https://..." {...register('application_form_url')} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Qo'llanma URL</Label>
                <Input type="url" className="h-9 text-xs" placeholder="https://..." {...register('application_guide_url')} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
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
