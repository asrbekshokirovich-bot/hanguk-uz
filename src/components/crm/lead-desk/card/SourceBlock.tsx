/**
 * Block 7 "Manba" (spec §5.4, §5 "Bir odam — bir karta"): where the lead came
 * from, and the merge suggestions ("Bu odam bo'lishi mumkin").
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { confirmMerge, dismissMerge } from '../api';
import { STAGE_LABEL, channelLabel, explainError } from '../copy';
import { shortDate, whenLabel } from '../time';
import type { LeadV2 } from '../types';
import { Section } from './ui';
import { invalidateLead } from './useLead';
import { useMergeCandidates } from './useCardData';

const REASON_LABEL: Record<string, string> = {
  same_name: 'Ismi bir xil',
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-[12.5px]">
      <dt className="w-[6.5rem] shrink-0 font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium">{value}</dd>
    </div>
  );
}

/** "utm_source=ig, utm_campaign=hanbox" from the jsonb `utm`. */
function utmText(utm: Record<string, unknown> | null | undefined): string {
  return Object.entries(utm ?? {})
    .filter(([, v]) => v != null && typeof v !== 'object' && String(v).trim() !== '')
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');
}

export function SourceBlock({ lead, disabled }: { lead: LeadV2; disabled: boolean }) {
  const qc = useQueryClient();
  const merges = useMergeCandidates(lead.id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const candidates = merges.data ?? [];

  const act = async (id: string, kind: 'merge' | 'dismiss') => {
    setBusyId(id);
    try {
      if (kind === 'merge') {
        await confirmMerge(id);
        toast.success('Kartalar birlashtirildi');
      } else {
        await dismissMerge(id);
        toast.success('Rad etildi');
      }
      invalidateLead(qc, lead.id, ['merges']);
    } catch (e) {
      toast.error(explainError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  };

  const utm = utmText(lead.utm);

  return (
    // opens by itself when there is a person to confirm
    <Section
      key={candidates.length > 0 ? 'with-suggestions' : 'plain'}
      title="Manba"
      defaultOpen={candidates.length > 0}
      right={candidates.length > 0 ? <span className="text-[11px] font-semibold text-warning">{candidates.length} ta taklif</span> : undefined}
    >
      <div className="space-y-3">
        {candidates.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.05em] text-warning">Bu odam bo'lishi mumkin</h4>
            {candidates.map(({ suggestion, other }) => (
              <div key={suggestion.id} className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-2.5 py-2 text-[12.5px]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{other?.full_name ?? 'Boshqa karta'}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {[
                      other?.phone,
                      other ? channelLabel(other.source) : null,
                      other ? STAGE_LABEL[other.stage] : null,
                      other ? shortDate(other.created_at) : null,
                      REASON_LABEL[suggestion.reason] ?? suggestion.reason,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button size="sm" className="h-8 min-h-0" disabled={disabled || busyId === suggestion.id} onClick={() => void act(suggestion.id, 'merge')}>
                  Birlashtirish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 min-h-0"
                  disabled={disabled || busyId === suggestion.id}
                  onClick={() => void act(suggestion.id, 'dismiss')}
                >
                  Rad etish
                </Button>
              </div>
            ))}
          </div>
        )}

        <dl className="space-y-1">
          <Row label="Manba" value={channelLabel(lead.source) === '—' ? null : channelLabel(lead.source)} />
          <Row label="Kampaniya" value={lead.campaign_name} />
          <Row label="Reklama to'plami" value={lead.adset_name} />
          <Row label="Reklama" value={lead.ad_name} />
          <Row label="Forma" value={lead.form_name} />
          <Row label="UTM" value={utm} />
          <Row label="Qanday eshitgan" value={lead.how_heard} />
          <Row label="Birinchi aloqa" value={lead.first_contact_at ? whenLabel(lead.first_contact_at) : null} />
        </dl>
      </div>
    </Section>
  );
}
