import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCreateAdmissionCycle, useCreateRequirement } from '@/hooks/useAdmissionCycleMutations';
import { useCreateAdmissionPeriod } from '@/hooks/useAdmissionPeriodMutations';

interface Props {
  institutionId: string;
  institutionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currentYear = new Date().getFullYear();
const STEPS = ['Sikl', 'Talab', 'Muddat'] as const;

export function QuickSetupWizard({ institutionId, institutionName, open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [cycleId, setCycleId] = useState<string | null>(null);

  // Step 1: cycle
  const [year, setYear] = useState(currentYear + 1);
  const [term, setTerm] = useState('fall');
  const [track, setTrack] = useState('foreign');
  const [category, setCategory] = useState('');

  // Step 2: requirement
  const [topik, setTopik] = useState<string>('');
  const [ielts, setIelts] = useState<string>('');
  const [interview, setInterview] = useState(false);

  // Step 3: period
  const [appStart, setAppStart] = useState('');
  const [appEnd, setAppEnd] = useState('');
  const [docDeadline, setDocDeadline] = useState('');
  const [level, setLevel] = useState('undergraduate');

  const createCycle = useCreateAdmissionCycle();
  const createReq = useCreateRequirement();
  const createPeriod = useCreateAdmissionPeriod();

  useEffect(() => {
    if (open) {
      setStep(0);
      setCycleId(null);
      setYear(currentYear + 1); setTerm('fall'); setTrack('foreign'); setCategory('');
      setTopik(''); setIelts(''); setInterview(false);
      setAppStart(''); setAppEnd(''); setDocDeadline(''); setLevel('undergraduate');
    }
  }, [open]);

  const handleStep1 = async () => {
    const c = await createCycle.mutateAsync({
      institution_id: institutionId,
      intake_year: year,
      intake_term: term,
      cycle_track: track,
      round_number: null,
      is_unified: false,
      applicant_category: category || null,
      status: 'draft',
    });
    setCycleId(c.id);
    setStep(1);
  };

  const handleStep2 = async () => {
    if (cycleId) {
      const englishTest = ielts ? { ielts_min: Number(ielts) } : null;
      await createReq.mutateAsync({
        cycle_id: cycleId,
        applicant_category: category || null,
        topik_min_level: topik ? Number(topik) : null,
        topik_deferred: false,
        english_test: englishTest,
        gpa_floor_pct: null,
        interview_required: interview,
        practical_exam_required: false,
        prose_ko: null,
      });
    }
    setStep(2);
  };

  const handleStep3 = async () => {
    await createPeriod.mutateAsync({
      institution_id: institutionId,
      semester: term,
      year,
      program_level: level,
      language_track: null,
      application_start: appStart || null,
      application_end: appEnd || null,
      document_deadline: docDeadline || null,
      result_announcement: null,
      online_application_start: null,
      online_application_end: null,
      application_fee_krw: null,
      application_fee_usd: null,
      application_form_url: null,
      application_guide_url: null,
    });
    onOpenChange(false);
  };

  const isPending = createCycle.isPending || createReq.isPending || createPeriod.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tezkor sozlash — {institutionName}</DialogTitle>
          <DialogDescription className="text-xs">Bo'sh universitetni 3 qadamda to'ldiring.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-1.5 ${i === step ? 'text-primary font-medium' : i < step ? 'text-success' : 'text-muted-foreground'}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs border ${i === step ? 'border-primary bg-primary/10' : i < step ? 'border-success bg-success/10' : 'border-muted'}`}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className="text-xs">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Cycle */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Yil</Label>
                <Input type="number" className="h-9 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Semestr</Label>
                <Select value={term} onValueChange={setTerm}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spring">Bahor</SelectItem>
                    <SelectItem value="fall">Kuz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Qabul turi</Label>
              <Select value={track} onValueChange={setTrack}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="foreign">Xorijiy (Foreign)</SelectItem>
                  <SelectItem value="overseas_korean_full">Koreys diaspora</SelectItem>
                  <SelectItem value="gks">GKS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kategoriya (ixtiyoriy)</Label>
              <Input className="h-9 text-xs" placeholder="외국인특별전형" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 2: Requirement */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">TOPIK min</Label>
                <Input type="number" min={1} max={6} className="h-9 text-xs" placeholder="3" value={topik} onChange={(e) => setTopik(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">IELTS min</Label>
                <Input type="number" step={0.5} className="h-9 text-xs" placeholder="5.5" value={ielts} onChange={(e) => setIelts(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="wiz-interview" checked={interview} onCheckedChange={setInterview} />
              <Label htmlFor="wiz-interview" className="text-xs cursor-pointer">Suhbat talab qilinadi</Label>
            </div>
            <p className="text-[10px] text-muted-foreground">Bo'sh qoldirsangiz talab qo'shilmaydi.</p>
          </div>
        )}

        {/* Step 3: Period */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Daraja</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="undergraduate">Bakalavr</SelectItem>
                  <SelectItem value="graduate">Magistr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Ariza boshi</Label>
                <Input type="date" className="h-9 text-xs" value={appStart} onChange={(e) => setAppStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Ariza oxiri</Label>
                <Input type="date" className="h-9 text-xs" value={appEnd} onChange={(e) => setAppEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Hujjat deadline</Label>
              <Input type="date" className="h-9 text-xs" value={docDeadline} onChange={(e) => setDocDeadline(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {step > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)} disabled={isPending}>
                <ArrowLeft className="h-3 w-3 mr-1" /> Orqaga
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Yopish</Button>
            {step === 0 && (
              <Button type="button" size="sm" disabled={isPending} onClick={handleStep1}>
                {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Keyingi <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            {step === 1 && (
              <Button type="button" size="sm" disabled={isPending} onClick={handleStep2}>
                {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Keyingi <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button type="button" size="sm" disabled={isPending} onClick={handleStep3}>
                {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Tugatish <Check className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
