import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { loseLead } from '../api';
import { explainError } from '../copy';
import { useLeadSettings } from '../useLeadSettings';
import { problemSentence } from './cardLogic';
import { DialogBody, DialogFoot, DialogFrame } from './DialogFrame';
import { LostFields } from './fields';
import { FieldLabel, textareaCls } from './ui';
import { invalidateLead } from './useLead';
import type { LeadActionDialogProps } from './WaitDialog';

/**
 * Yo'qotildi (spec §8): a reason from the settings list — each shows the
 * reactivation queue the lead will join — the competitor when the reason is
 * "Boshqa markaz", and an optional note.
 */
export function LoseDialog({ leadId, open, onOpenChange, onDone }: LeadActionDialogProps) {
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Yo'qotildi"
      description="Lidni yopish sababini tanlang"
      widthClass="max-w-lg"
    >
      {open && <LoseBody leadId={leadId} close={() => onOpenChange(false)} onDone={onDone} />}
    </DialogFrame>
  );
}

function LoseBody({ leadId, close, onDone }: { leadId: string; close: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const { settings } = useLeadSettings();
  const [reason, setReason] = useState<string | null>(null);
  const [competitor, setCompetitor] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems: string[] = [];
  if (!reason) problems.push('lost_reason');
  else if (reason === 'other_center' && competitor.trim() === '') problems.push('lost_competitor');

  const submit = async () => {
    if (problems.length > 0 || saving || !reason) return;
    setSaving(true);
    setError(null);
    try {
      await loseLead(leadId, reason, reason === 'other_center' ? competitor.trim() : null, note.trim() || null);
      toast.success("Lid yo'qotildi sifatida yopildi");
      invalidateLead(qc, leadId, ['drafts']);
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
        <LostFields
          reasons={settings.lost_reasons}
          reason={reason}
          onReason={setReason}
          competitor={competitor}
          onCompetitor={setCompetitor}
          competitorSuggestions={settings.competitors}
        />
        <div>
          <FieldLabel htmlFor="lose-note">Izoh (ixtiyoriy)</FieldLabel>
          <textarea id="lose-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={textareaCls} />
        </div>
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
          <Button variant="destructive" className="min-h-0" onClick={submit} disabled={problems.length > 0 || saving}>
            {saving ? 'Saqlanmoqda…' : "Yo'qotildi"}
          </Button>
        </div>
      </DialogFoot>
    </>
  );
}
