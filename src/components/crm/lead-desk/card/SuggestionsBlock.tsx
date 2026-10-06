/**
 * "AI taklif qilgan maydonlar" (spec §10 "Maydon takliflari"): what the AI read
 * out of the conversations for fields that are still empty on the card. The
 * operator corrects the value if needed and accepts, or rejects. Nothing is
 * written without a click, and an accepted value goes through the same field
 * whitelist the card uses (`lead_apply_suggestion`).
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { applySuggestion, rejectSuggestion, type FieldSuggestion } from '../api';
import { channelLabel, explainError } from '../copy';
import type { LeadV2 } from '../types';
import { useLeadSettings } from '../useLeadSettings';
import { SUGGESTION_FIELD_LABEL, suggestionInputKind, suggestionOptions, visibleSuggestions } from './cardLogic';
import { Pill, Section, inputCls } from './ui';
import { invalidateLead } from './useLead';
import { useSuggestions } from './useCardData';

interface SuggestionsBlockProps {
  lead: LeadV2;
  disabled: boolean;
}

export function SuggestionsBlock({ lead, disabled }: SuggestionsBlockProps) {
  const suggestions = useSuggestions(lead.id);
  const rows = visibleSuggestions(suggestions.data ?? [], lead);
  if (rows.length === 0) return null;

  return (
    <Section title="AI taklif qilgan maydonlar" right={<Pill tone="info">{rows.length}</Pill>}>
      <ul aria-label="AI takliflari" className="space-y-2">
        {rows.map((s) => (
          <SuggestionRow key={s.id} lead={lead} suggestion={s} disabled={disabled} />
        ))}
      </ul>
    </Section>
  );
}

function SuggestionRow({ lead, suggestion: s, disabled }: { lead: LeadV2; suggestion: FieldSuggestion; disabled: boolean }) {
  const qc = useQueryClient();
  const { settings } = useLeadSettings();
  const original = s.suggested_value ?? '';
  const [value, setValue] = useState(original);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = SUGGESTION_FIELD_LABEL[s.field] ?? s.field;
  const options = suggestionOptions(s.field, settings);
  // the AI's own wording may not be on the list: keep it selectable
  const choices = options && value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
  const changed = value.trim() !== original.trim();
  const inputId = `suggestion-${s.id}`;

  const run = async (kind: 'accept' | 'reject') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'accept') {
        await applySuggestion(s.id, changed ? value.trim() : undefined);
        toast.success(`${label}: qabul qilindi`);
      } else {
        await rejectSuggestion(s.id);
        toast.success(`${label}: rad etildi`);
      }
      invalidateLead(qc, lead.id, ['suggestions']);
    } catch (e) {
      const msg = explainError(e instanceof Error ? e.message : String(e));
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const confidence = s.confidence != null ? Math.round(Number(s.confidence) * 100) : null;
  const kind = suggestionInputKind(s.field);

  return (
    <li data-suggestion={s.field} className="rounded-md border border-border px-2.5 py-2">
      <label htmlFor={inputId} className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold">
        <Sparkles className="h-3 w-3 text-info" aria-hidden="true" />
        {label}
        {confidence != null && <span className="text-[11px] font-normal text-muted-foreground">ishonch {confidence}%</span>}
      </label>

      {choices ? (
        <select
          id={inputId}
          value={value}
          disabled={disabled || busy !== null}
          onChange={(e) => setValue(e.target.value)}
          className={cn(inputCls, 'max-w-[260px]')}
        >
          {choices.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          type={kind}
          value={value}
          disabled={disabled || busy !== null}
          onChange={(e) => setValue(e.target.value)}
          className={cn(inputCls, kind === 'text' ? '' : 'max-w-[200px]')}
        />
      )}

      {s.evidence ? (
        <p className="mt-1.5 text-[12px] italic leading-relaxed text-muted-foreground">
          “{s.evidence}”
          {s.evidence_channel && (
            <Pill tone="info" className="ml-1.5 px-1.5 py-0 align-middle text-[10px] not-italic">
              {channelLabel(s.evidence_channel)}
            </Pill>
          )}
        </p>
      ) : s.evidence_channel ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{channelLabel(s.evidence_channel)} xabaridan</p>
      ) : null}

      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className="h-7 min-h-0 px-2.5"
          disabled={disabled || busy !== null || value.trim() === ''}
          onClick={() => void run('accept')}
        >
          <Check aria-hidden="true" />
          Qabul qilish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 min-h-0 px-2.5"
          disabled={disabled || busy !== null}
          onClick={() => void run('reject')}
        >
          <X aria-hidden="true" />
          Rad etish
        </Button>
      </div>
    </li>
  );
}
