/**
 * Block 6 "Ruxsat etilgan taklif" (spec §11): the offers this lead may be told
 * about, the forbidden words, the "Taklif turi" the stage Taklif needs, the
 * stage buttons, and the promises (discount / special terms) with the boss's
 * approval.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { decidePromise, setStage } from '../api';
import { STAGE_LABEL, explainError } from '../copy';
import { whenLabel } from '../time';
import type { LeadPromise, LeadV2, Stage } from '../types';
import { useLeadSettings } from '../useLeadSettings';
import { recommendedOffers } from './cardLogic';
import { ProductFitPicker } from './fields';
import { PROMISE_KIND_LABEL, PROMISE_STATUS_LABEL } from './timelineLogic';
import { Chip, Pill, Section } from './ui';
import { invalidateLead } from './useLead';
import { usePromises } from './useCardData';

type MoveStage = Extract<Stage, 'interested' | 'offer' | 'contract'>;
const MOVES: MoveStage[] = ['interested', 'offer', 'contract'];

interface OfferBlockProps {
  lead: LeadV2;
  disabled: boolean;
  saveField: (patch: Record<string, unknown>) => Promise<boolean>;
  onRequestPromise: () => void;
}

const STATUS_TONE: Record<LeadPromise['status'], 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export function OfferBlock({ lead, disabled, saveField, onRequestPromise }: OfferBlockProps) {
  const qc = useQueryClient();
  const { settings } = useLeadSettings();
  const { isAdmin } = useUserRole();
  const promises = usePromises(lead.id);
  const [stageError, setStageError] = useState<string | null>(null);
  const [moving, setMoving] = useState<MoveStage | null>(null);

  const recommended = recommendedOffers(lead, settings.offers, settings.objections);
  const recommendedKeys = recommended.map((r) => r.key);

  const move = async (stage: MoveStage) => {
    setStageError(null);
    setMoving(stage);
    try {
      await setStage(lead.id, stage, stage === 'offer' && lead.product_fit ? { product_fit: lead.product_fit } : {});
      toast.success(`Bosqich: ${STAGE_LABEL[stage]}`);
      invalidateLead(qc, lead.id);
    } catch (e) {
      const msg = explainError(e instanceof Error ? e.message : String(e));
      setStageError(msg);
      toast.error(msg);
    } finally {
      setMoving(null);
    }
  };

  const decide = async (p: LeadPromise, approve: boolean) => {
    try {
      await decidePromise(p.id, approve);
      toast.success(approve ? 'So‘rov tasdiqlandi' : 'So‘rov rad etildi');
      invalidateLead(qc, lead.id, ['promises']);
    } catch (e) {
      toast.error(explainError(e instanceof Error ? e.message : String(e)));
    }
  };

  const stageLocked = disabled || lead.stage === 'lost' || lead.stage === 'student';

  return (
    <Section title="Ruxsat etilgan taklif">
      <div className="space-y-3">
        {recommended.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            Mos taklif ko‘rsatilishi uchun maqsad, sertifikat va e'tirozni kiriting.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recommended.map(({ key, offer }) => (
              <li key={key} data-offer={key} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[13px]">{offer.title}</strong>
                  {offer.needs_boss && <Pill tone="warning">Rahbar tasdig'i bilan</Pill>}
                </div>
                <p className="mt-0.5 text-[12.5px] text-foreground/80">{offer.text}</p>
              </li>
            ))}
          </ul>
        )}

        {settings.forbidden_words.length > 0 && (
          <p className="flex items-start gap-1.5 text-[12px] text-destructive">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Taqiq:</strong> {settings.forbidden_words.join(', ')}
            </span>
          </p>
        )}

        <ProductFitPicker
          value={lead.product_fit}
          onChange={(v) => void saveField({ product_fit: v })}
          offers={settings.offers}
          recommended={recommendedKeys}
          disabled={disabled}
        />

        <div>
          <div role="group" aria-label="Bosqichni o'zgartirish" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] font-semibold">Bosqich:</span>
            {MOVES.map((s) => (
              <Chip key={s} selected={lead.stage === s} disabled={stageLocked || moving !== null} onClick={() => void move(s)}>
                {STAGE_LABEL[s]}
              </Chip>
            ))}
          </div>
          {stageError && (
            <p role="alert" className="mt-1.5 text-[12px] font-medium text-destructive">
              {stageError}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-2.5">
          <Button variant="outline" size="sm" className="h-8 min-h-0" onClick={onRequestPromise} disabled={disabled}>
            Chegirma / maxsus shart so'rash
          </Button>
          {(promises.data ?? []).length > 0 && (
            <ul className="space-y-1.5" aria-label="Va'dalar">
              {(promises.data ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-[12.5px]">
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-semibold">{PROMISE_KIND_LABEL[p.kind] ?? p.kind}:</span> {p.text}
                    </p>
                    {p.reason && <p className="text-[11.5px] text-muted-foreground">Sabab: {p.reason}</p>}
                    <p className="text-[11px] text-muted-foreground">{whenLabel(p.created_at)}</p>
                  </div>
                  <Pill tone={STATUS_TONE[p.status]}>{PROMISE_STATUS_LABEL[p.status] ?? p.status}</Pill>
                  {isAdmin && p.status === 'pending' && (
                    <div className="flex w-full justify-end gap-1.5">
                      <Button size="sm" className="h-7 min-h-0 px-2.5" onClick={() => void decide(p, true)}>
                        <Check aria-hidden="true" />
                        Tasdiqlash
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 min-h-0 px-2.5" onClick={() => void decide(p, false)}>
                        <X aria-hidden="true" />
                        Rad etish
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
