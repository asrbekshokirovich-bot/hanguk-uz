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
  useCreateRequirement,
  useUpdateRequirement,
} from '@/hooks/useAdmissionCycleMutations';

const schema = z.object({
  applicant_category: z.string().nullable(),
  topik_min_level: z.coerce.number().min(1).max(6).nullable(),
  topik_deferred: z.boolean(),
  ielts_min: z.coerce.number().min(0).max(9).nullable(),
  toefl_min: z.coerce.number().min(0).max(120).nullable(),
  gpa_floor_pct: z.coerce.number().min(0).max(100).nullable(),
  interview_required: z.boolean(),
  practical_exam_required: z.boolean(),
  prose_ko: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface EditReq {
  id: string;
  applicant_category: string | null;
  topik_min_level: number | null;
  topik_deferred: boolean | null;
  english_test: unknown | null;
  gpa_floor_pct: number | null;
  interview_required: boolean | null;
  practical_exam_required: boolean | null;
  prose_ko: string | null;
}

interface Props {
  cycleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editReq?: EditReq | null;
}

function parseEnglishTest(et: unknown): { ielts: number | null; toefl: number | null } {
  if (!et || typeof et !== 'object') return { ielts: null, toefl: null };
  const obj = et as Record<string, unknown>;
  return {
    ielts: typeof obj.ielts_min === 'number' ? obj.ielts_min : null,
    toefl: typeof obj.toefl_min === 'number' ? obj.toefl_min : null,
  };
}

export function RequirementFormDialog({ cycleId, open, onOpenChange, editReq }: Props) {
  const createMut = useCreateRequirement();
  const updateMut = useUpdateRequirement();
  const isEdit = !!editReq;

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      applicant_category: null,
      topik_min_level: null,
      topik_deferred: false,
      ielts_min: null,
      toefl_min: null,
      gpa_floor_pct: null,
      interview_required: false,
      practical_exam_required: false,
      prose_ko: null,
    },
  });

  useEffect(() => {
    if (open && editReq) {
      const { ielts, toefl } = parseEnglishTest(editReq.english_test);
      reset({
        applicant_category: editReq.applicant_category || null,
        topik_min_level: editReq.topik_min_level ?? null,
        topik_deferred: editReq.topik_deferred ?? false,
        ielts_min: ielts,
        toefl_min: toefl,
        gpa_floor_pct: editReq.gpa_floor_pct ?? null,
        interview_required: editReq.interview_required ?? false,
        practical_exam_required: editReq.practical_exam_required ?? false,
        prose_ko: editReq.prose_ko || null,
      });
    } else if (open) {
      reset({
        applicant_category: null,
        topik_min_level: null,
        topik_deferred: false,
        ielts_min: null,
        toefl_min: null,
        gpa_floor_pct: null,
        interview_required: false,
        practical_exam_required: false,
        prose_ko: null,
      });
    }
  }, [open, editReq, reset]);

  const onSubmit = async (vals: FormValues) => {
    const englishTest = (vals.ielts_min || vals.toefl_min)
      ? { ...(vals.ielts_min ? { ielts_min: vals.ielts_min } : {}), ...(vals.toefl_min ? { toefl_min: vals.toefl_min } : {}) }
      : null;

    const input = {
      cycle_id: cycleId,
      applicant_category: vals.applicant_category || null,
      topik_min_level: vals.topik_min_level ?? null,
      topik_deferred: vals.topik_deferred,
      english_test: englishTest,
      gpa_floor_pct: vals.gpa_floor_pct ?? null,
      interview_required: vals.interview_required,
      practical_exam_required: vals.practical_exam_required,
      prose_ko: vals.prose_ko || null,
    };

    if (isEdit && editReq) {
      await updateMut.mutateAsync({ ...input, id: editReq.id });
    } else {
      await createMut.mutateAsync(input);
    }
    onOpenChange(false);
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Talabni tahrirlash' : 'Yangi talab qo\'shish'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-xs">Ariza beruvchi kategoriyasi</Label>
            <Input className="h-9 text-xs" placeholder="외국인특별전형" {...register('applicant_category')} />
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Til sertifikatlari</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">TOPIK min</Label>
                <Input type="number" min={1} max={6} className="h-9 text-xs" placeholder="3" {...register('topik_min_level', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">IELTS min</Label>
                <Input type="number" step={0.5} min={0} max={9} className="h-9 text-xs" placeholder="5.5" {...register('ielts_min', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">TOEFL min</Label>
                <Input type="number" min={0} max={120} className="h-9 text-xs" placeholder="80" {...register('toefl_min', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Switch id="topik-deferred" checked={watch('topik_deferred')} onCheckedChange={(v) => setValue('topik_deferred', v)} />
              <Label htmlFor="topik-deferred" className="text-xs cursor-pointer">TOPIK kechiktirilgan</Label>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Boshqa talablar</p>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Min GPA (%)</Label>
                <Input type="number" min={0} max={100} className="h-9 text-xs" placeholder="60" {...register('gpa_floor_pct', { valueAsNumber: true })} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="interview-req" checked={watch('interview_required')} onCheckedChange={(v) => setValue('interview_required', v)} />
                  <Label htmlFor="interview-req" className="text-xs cursor-pointer">Suhbat</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="practical-req" checked={watch('practical_exam_required')} onCheckedChange={(v) => setValue('practical_exam_required', v)} />
                  <Label htmlFor="practical-req" className="text-xs cursor-pointer">Amaliy imtihon</Label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Qo'shimcha ma'lumot (koreys tili)</Label>
            <Textarea className="text-xs min-h-[60px]" placeholder="추가 요구 사항..." {...register('prose_ko')} />
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
