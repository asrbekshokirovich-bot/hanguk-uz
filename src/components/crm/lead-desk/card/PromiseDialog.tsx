import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { requestPromise } from '../api';
import { explainError } from '../copy';
import type { LeadPromise } from '../types';
import { DialogBody, DialogFoot, DialogFrame } from './DialogFrame';
import { ChipGroup, FieldLabel, inputCls, textareaCls } from './ui';
import { invalidateLead } from './useLead';
import type { LeadActionDialogProps } from './WaitDialog';

const KIND_OPTIONS: { value: LeadPromise['kind']; label: string }[] = [
  { value: 'discount', label: 'Chegirma (%)' },
  { value: 'installment', label: "Bo'lib to'lash" },
  { value: 'other', label: 'Boshqa' },
];

/**
 * "Chegirma / maxsus shart so'rash" (spec §11). The request reaches the boss
 * as pending; until it is approved the composer will not send the condition.
 */
export function PromiseDialog({ leadId, open, onOpenChange, onDone }: LeadActionDialogProps) {
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Chegirma / maxsus shart so'rash"
      description="Rahbar tasdig'i uchun so'rov yuboring"
      widthClass="max-w-md"
    >
      {open && <PromiseBody leadId={leadId} close={() => onOpenChange(false)} onDone={onDone} />}
    </DialogFrame>
  );
}

function PromiseBody({ leadId, close, onDone }: { leadId: string; close: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<LeadPromise['kind']>('discount');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = text.trim() !== '' && !saving;

  const submit = async () => {
    if (!canSend) return;
    setSaving(true);
    setError(null);
    try {
      await requestPromise(leadId, kind, text.trim(), reason.trim() || undefined);
      toast.success("So'rov rahbarga yuborildi");
      invalidateLead(qc, leadId, ['promises']);
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
        <div>
          <FieldLabel>Turi</FieldLabel>
          <ChipGroup<LeadPromise['kind']>
            label="So'rov turi"
            options={KIND_OPTIONS}
            value={kind}
            onChange={(v) => v && setKind(v)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="promise-text" missing={text.trim() === ''}>
            Nima so'rayapsiz? (masalan: 10% chegirma)
          </FieldLabel>
          <textarea id="promise-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={textareaCls} />
        </div>
        <div>
          <FieldLabel htmlFor="promise-reason">Sabab (ixtiyoriy)</FieldLabel>
          <input id="promise-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Rahbar tasdiqlamaguncha bu shartni mijozga yozib bo'lmaydi.
        </p>
      </DialogBody>
      <DialogFoot>
        {error && (
          <p role="alert" className="text-[12px] font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-0" onClick={close}>
            Bekor qilish
          </Button>
          <Button className="min-h-0" onClick={submit} disabled={!canSend}>
            {saving ? 'Yuborilmoqda…' : "So'rov yuborish"}
          </Button>
        </div>
      </DialogFoot>
    </>
  );
}
