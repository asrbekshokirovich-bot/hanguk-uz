import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { waitLead } from '../api';
import { explainError } from '../copy';
import type { WaitReason } from '../types';
import { problemSentence, tomorrowKey } from './cardLogic';
import { DialogBody, DialogFoot, DialogFrame } from './DialogFrame';
import { WaitFields } from './fields';
import { invalidateLead } from './useLead';

export interface LeadActionDialogProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

/** Kutish (spec §8): a date from tomorrow on and a reason; on that date the lead returns to BUGUN. */
export function WaitDialog({ leadId, open, onOpenChange, onDone }: LeadActionDialogProps) {
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Kutish"
      description="Lidni sana va sabab bilan kutishga qo'ying"
      widthClass="max-w-md"
    >
      {open && <WaitBody leadId={leadId} close={() => onOpenChange(false)} onDone={onDone} />}
    </DialogFrame>
  );
}

function WaitBody({ leadId, close, onDone }: { leadId: string; close: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState<WaitReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems: string[] = [];
  if (!date || date < tomorrowKey()) problems.push('wait_until');
  if (!reason) problems.push('wait_reason');

  const submit = async () => {
    if (problems.length > 0 || saving || !reason) return;
    setSaving(true);
    setError(null);
    try {
      await waitLead(leadId, date, reason);
      toast.success('Lid kutishga qo‘yildi');
      invalidateLead(qc, leadId);
      onDone?.();
      close();
    } catch (e) {
      const msg = explainError(e instanceof Error ? e.message : String(e));
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogBody>
        <WaitFields
          date={date}
          onDate={setDate}
          reason={reason}
          onReason={setReason}
          invalidDate={false}
          invalidReason={false}
        />
      </DialogBody>
      <DialogFoot>
        {problems.length > 0 && (
          <p role="status" className="text-[12px] text-muted-foreground">
            {problemSentence(problems)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-[12px] font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-0" onClick={close}>
            Bekor qilish
          </Button>
          <Button className="min-h-0" onClick={submit} disabled={problems.length > 0 || saving}>
            {saving ? 'Saqlanmoqda…' : 'Kutishga qo‘yish'}
          </Button>
        </div>
      </DialogFoot>
    </>
  );
}
