import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createManualLead } from '../api';
import { CERTIFICATES, GOALS, REGIONS, explainError } from '../copy';
import type { ReferralType } from '../types';
import { DialogBody, DialogFoot, DialogFrame } from './DialogFrame';
import { ReferralPicker } from './fields';
import { isDialable } from './phone';
import { ChipGroup, FieldLabel, inputCls } from './ui';

interface ManualLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (leadId: string) => void;
}

type Origin = 'office' | 'referral';

/** "+ Lid" (spec §5 "Qo'lda"): a lead typed in by hand — an office visit or a referral. */
export default function ManualLeadDialog({ open, onOpenChange, onCreated }: ManualLeadDialogProps) {
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="+ Lid"
      description="Qo'lda yangi lid qo'shish: ofisga kelgan yoki tavsiya bilan"
      widthClass="max-w-lg"
    >
      {open && <ManualBody close={() => onOpenChange(false)} onCreated={onCreated} />}
    </DialogFrame>
  );
}

function ManualBody({ close, onCreated }: { close: () => void; onCreated?: (leadId: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [origin, setOrigin] = useState<Origin>('office');
  const [refType, setRefType] = useState<ReferralType | null>(null);
  const [refName, setRefName] = useState('');
  const [more, setMore] = useState(false);
  const [goal, setGoal] = useState<string | null>(null);
  const [cert, setCert] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems: string[] = [];
  if (name.trim() === '') problems.push('Ism');
  if (!isDialable(phone)) problems.push('Telefon (kamida 9 raqam)');
  if (origin === 'referral' && !refType) problems.push('Kim tavsiya qildi (turi)');
  if (origin === 'referral' && refName.trim() === '') problems.push('Tavsiya qilgan odam ismi');
  const canSave = problems.length === 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const fields: Record<string, unknown> = {};
      if (goal) fields.education_level = goal;
      if (cert) fields.cert_level = cert;
      if (region) fields.city = region;
      const id = await createManualLead({
        name: name.trim(),
        phone: phone.trim(),
        origin,
        referralType: origin === 'referral' ? refType : null,
        referralName: origin === 'referral' ? refName.trim() : null,
        fields,
      });
      toast.success("Lid qo'shildi");
      void qc.invalidateQueries({ queryKey: ['lead-v2', 'desk'] });
      void qc.invalidateQueries({ queryKey: ['lead-v2', 'counts'] });
      onCreated?.(id);
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="manual-name" missing={name.trim() === ''}>
              Ism
            </FieldLabel>
            <input
              id="manual-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel htmlFor="manual-phone" missing={!isDialable(phone)}>
              Telefon
            </FieldLabel>
            <input
              id="manual-phone"
              type="tel"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Manba</FieldLabel>
          <ChipGroup<Origin>
            label="Manba"
            options={[
              { value: 'office', label: 'Ofis' },
              { value: 'referral', label: 'Tavsiya' },
            ]}
            value={origin}
            onChange={(v) => v && setOrigin(v)}
          />
        </div>

        {origin === 'referral' && (
          <ReferralPicker
            title="Kim tavsiya qildi? (majburiy)"
            type={refType}
            name={refName}
            onType={setRefType}
            onName={setRefName}
          />
        )}

        <div>
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="flex min-h-0 min-w-0 items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {more ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            Qo'shimcha maydonlar (ixtiyoriy)
          </button>
          {more && (
            <div className="mt-2 space-y-2.5">
              <div>
                <FieldLabel>Maqsad</FieldLabel>
                <ChipGroup label="Maqsad" allowClear options={GOALS.map((g) => ({ value: g, label: g }))} value={goal} onChange={setGoal} />
              </div>
              <div>
                <FieldLabel>Sertifikat / daraja</FieldLabel>
                <ChipGroup
                  label="Sertifikat / daraja"
                  allowClear
                  options={CERTIFICATES.map((g) => ({ value: g, label: g }))}
                  value={cert}
                  onChange={setCert}
                />
              </div>
              <div>
                <FieldLabel>Viloyat</FieldLabel>
                <ChipGroup label="Viloyat" allowClear options={REGIONS.map((g) => ({ value: g, label: g }))} value={region} onChange={setRegion} />
              </div>
            </div>
          )}
        </div>
      </DialogBody>

      <DialogFoot>
        {problems.length > 0 && (
          <p role="status" className="text-[12px] text-muted-foreground">
            To‘ldirilmagan: {problems.join(', ')}
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
          <Button className="min-h-0" onClick={submit} disabled={!canSave}>
            {saving ? 'Saqlanmoqda…' : "Lid qo'shish"}
          </Button>
        </div>
      </DialogFoot>
    </>
  );
}
