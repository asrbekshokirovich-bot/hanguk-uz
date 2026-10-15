import { useState } from 'react';
import { ago } from '../time';
import type { LeadV2 } from '../types';
import { Section } from './ui';

/** Block 2: the AI summary (spec §10, read-only), 4–6 lines, with when it was refreshed. */
export function AiBrief({ lead }: { lead: Pick<LeadV2, 'ai_summary' | 'ai_brief_at'> }) {
  const [expanded, setExpanded] = useState(false);
  const text = (lead.ai_summary ?? '').trim();
  const long = text.length > 380;
  return (
    <Section
      title="AI qisqacha"
      right={
        lead.ai_brief_at ? (
          <span className="text-[11px] text-muted-foreground">yangilangan {ago(lead.ai_brief_at)}</span>
        ) : null
      }
    >
      {text ? (
        <>
          <p
            className={`whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground ${expanded ? '' : 'line-clamp-6'}`}
          >
            {text}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 min-h-0 min-w-0 text-[11.5px] font-semibold text-primary hover:underline"
            >
              {expanded ? 'Kamroq' : "Ko'proq"}
            </button>
          )}
        </>
      ) : (
        <p className="text-[12.5px] italic text-muted-foreground">AI qisqacha hali yo'q</p>
      )}
    </Section>
  );
}
