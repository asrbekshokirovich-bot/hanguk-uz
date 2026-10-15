import type { LeadV2 } from '../types';
import { mandatoryOf, missingMandatory } from './cardLogic';
import { MandatoryFieldsEditor } from './fields';
import { Pill, Section } from './ui';

interface MandatoryBlockProps {
  lead: LeadV2;
  disabled: boolean;
  saveField: (patch: Record<string, unknown>) => Promise<boolean>;
}

/**
 * Block 4: the 5 mandatory fields (spec §5.1). One tap each, saved on change.
 * Empty ones carry a red dot; the header says how many are left.
 */
export function MandatoryBlock({ lead, disabled, saveField }: MandatoryBlockProps) {
  const value = mandatoryOf(lead);
  const left = missingMandatory(value).length;
  return (
    <Section
      title="5 majburiy maydon"
      right={<Pill tone={left === 0 ? 'success' : 'danger'}>{left === 0 ? "To'liq" : `${left} ta qoldi`}</Pill>}
    >
      <MandatoryFieldsEditor value={value} onChange={(patch) => void saveField(patch)} disabled={disabled} />
    </Section>
  );
}
