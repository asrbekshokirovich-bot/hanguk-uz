/**
 * Block 5 "Malaka va taklif" (spec §6): exam date, intake, budget, the other
 * centre, what is holding the client back, and the referral source.
 */
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LeadV2, ReferralType } from '../types';
import { useLeadSettings } from '../useLeadSettings';
import { semesterOptions } from '../../leads/intake/options';
import { CompetitorPicker, ObjectionPicker, ReferralPicker } from './fields';
import { InlineText } from './InlineText';
import { ChipGroup, FieldLabel, Section, inputCls } from './ui';

interface QualificationBlockProps {
  lead: LeadV2;
  disabled: boolean;
  saveField: (patch: Record<string, unknown>) => Promise<boolean>;
}

export function QualificationBlock({ lead, disabled, saveField }: QualificationBlockProps) {
  const { settings } = useLeadSettings();
  const intakes = semesterOptions();
  const intakeOptions = intakes.map((s) => ({ value: s, label: s }));
  if (lead.target_intake && !intakes.includes(lead.target_intake)) {
    intakeOptions.push({ value: lead.target_intake, label: lead.target_intake });
  }

  // the referral name is typed: keep it locally and save when the field loses focus
  const [refName, setRefName] = useState(lead.referral_name ?? '');
  useEffect(() => setRefName(lead.referral_name ?? ''), [lead.referral_name]);

  return (
    <Section title="Malaka va taklif">
      <div className="space-y-3">
        <div className="space-y-0.5">
          <div className="flex min-h-[1.75rem] items-center gap-2 text-[12.5px]">
            <label htmlFor="q-exam" className="w-[6.5rem] shrink-0 font-semibold text-muted-foreground">
              Imtihon sanasi
            </label>
            <input
              id="q-exam"
              type="date"
              value={lead.exam_date ?? ''}
              disabled={disabled}
              onChange={(e) => void saveField({ exam_date: e.target.value || null })}
              className={cn(inputCls, 'h-7 w-40')}
            />
          </div>
          <InlineText
            label="Byudjet"
            value={lead.budget_range}
            placeholder="Byudjet / moliyalash"
            disabled={disabled}
            onSave={(v) => saveField({ budget_range: v.trim() === '' ? null : v.trim() })}
          />
        </div>

        <div>
          <FieldLabel>Qabul (target_intake)</FieldLabel>
          <ChipGroup
            label="Qabul"
            options={intakeOptions}
            value={lead.target_intake}
            onChange={(v) => void saveField({ target_intake: v })}
            allowClear
            disabled={disabled}
          />
        </div>

        <CompetitorPicker
          value={lead.competitor}
          onChange={(v) => void saveField({ competitor: v })}
          competitors={settings.competitors}
          disabled={disabled}
        />

        <ObjectionPicker
          value={lead.objection}
          onChange={(v) => void saveField({ objection: v })}
          options={settings.objections}
          disabled={disabled}
        />

        <div className="border-t border-border pt-2.5">
          <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Tavsiya manbai — birinchi ustuvorlik
          </h4>
          <ReferralPicker
            type={lead.referral_type}
            name={refName}
            onType={(t: ReferralType | null) => void saveField(t ? { referral_type: t } : { referral_type: null, referral_name: null })}
            onName={setRefName}
            onNameBlur={() => {
              if (refName.trim() !== (lead.referral_name ?? '')) void saveField({ referral_name: refName.trim() || null });
            }}
            disabled={disabled}
          />
        </div>
      </div>
    </Section>
  );
}
