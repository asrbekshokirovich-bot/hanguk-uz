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
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import {
  useCreateAdmissionCycle,
  useUpdateAdmissionCycle,
} from '@/hooks/useAdmissionCycleMutations';

const schema = z.object({
  intake_year: z.coerce.number().min(2024).max(2030),
  intake_term: z.enum(['spring', 'fall']),
  cycle_track: z.string().min(1),
  round_number: z.coerce.number().nullable(),
  is_unified: z.boolean(),
  applicant_category: z.string().nullable(),
  status: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface EditCycle {
  id: string;
  intake_year: number | null;
  intake_term: string | null;
  cycle_track: string | null;
  round_number: number | null;
  is_unified: boolean | null;
  applicant_category: string | null;
  status: string | null;
}

interface Props {
  institutionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCycle?: EditCycle | null;
}

const currentYear = new Date().getFullYear();

export function AdmissionCycleFormDialog({ institutionId, open, onOpenChange, editCycle }: Props) {
  const createMut = useCreateAdmissionCycle();
  const updateMut = useUpdateAdmissionCycle();
  const isEdit = !!editCycle;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      intake_year: currentYear + 1,
      intake_term: 'spring',
      cycle_track: 'foreign',
      round_number: null,
      is_unified: false,
      applicant_category: null,
      status: 'unverified',
    },
  });

  useEffect(() => {
    if (open && editCycle) {
      reset({
        intake_year: editCycle.intake_year || currentYear + 1,
        intake_term: (editCycle.intake_term as 'spring' | 'fall') || 'spring',
        cycle_track: editCycle.cycle_track || 'foreign',
        round_number: editCycle.round_number ?? null,
        is_unified: editCycle.is_unified ?? false,
        applicant_category: editCycle.applicant_category || null,
        status: editCycle.status || 'unverified',
      });
    } else if (open) {
      reset({
        intake_year: currentYear + 1,
        intake_term: 'spring',
        cycle_track: 'foreign',
        round_number: null,
        is_unified: false,
        applicant_category: null,
        status: 'unverified',
      });
    }
  }, [open, editCycle, reset]);

  const onSubmit = async (vals: FormValues) => {
    const input = {
      institution_id: institutionId,
      intake_year: vals.intake_year,
      intake_term: vals.intake_term,
      cycle_track: vals.cycle_track,
      round_number: vals.round_number,
      is_unified: vals.is_unified,
      applicant_category: vals.applicant_category || null,
      status: vals.status,
    };

    if (isEdit && editCycle) {
      await updateMut.mutateAsync({ ...input, id: editCycle.id });
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
          <DialogTitle>{isEdit ? 'Qabul siklini tahrirlash' : 'Yangi qabul sikli'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Yil *</Label>
              <Input type="number" className="h-9 text-xs" {...register('intake_year', { valueAsNumber: true })} />
            </div>
            <div>
              <Label className="text-xs">Semestr *</Label>
              <Select value={watch('intake_term')} onValueChange={(v) => setValue('intake_term', v as 'spring' | 'fall')}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spring">Bahor (Spring)</SelectItem>
                  <SelectItem value="fall">Kuz (Fall)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Qabul turi *</Label>
              <Select value={watch('cycle_track')} onValueChange={(v) => setValue('cycle_track', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="foreign">Xorijiy (Foreign)</SelectItem>
                  <SelectItem value="overseas_korean_full">Koreys diaspora</SelectItem>
                  <SelectItem value="gks">GKS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Raund raqami</Label>
              <Input type="number" className="h-9 text-xs" placeholder="1" {...register('round_number', { valueAsNumber: true })} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Ariza beruvchi kategoriyasi</Label>
            <Input className="h-9 text-xs" placeholder="외국인특별전형" {...register('applicant_category')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Holat</Label>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unverified">Tekshirilmagan</SelectItem>
                  <SelectItem value="verified">Tasdiqlangan</SelectItem>
                  <SelectItem value="draft">Qoralama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch id="is-unified" checked={watch('is_unified')} onCheckedChange={(v) => setValue('is_unified', v)} />
              <Label htmlFor="is-unified" className="text-xs cursor-pointer">Yagona qabul</Label>
            </div>
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
