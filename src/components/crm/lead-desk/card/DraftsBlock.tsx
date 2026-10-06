/**
 * Block 8 "Qoralamalar" (spec §10): follow-ups, ladder DMs, reminders, AI
 * replies. Each is a draft: "Yuborish" sends it through the composer, "Tahrir"
 * moves it into the composer, "O'tkazib yuborish" drops it. Nothing goes out
 * without a click.
 */
import { useState } from 'react';
import { Pencil, Send, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { channelLabel } from '../copy';
import { whenLabel } from '../time';
import type { LeadDraft } from '../types';
import { evaluateGuard } from './cardLogic';
import { Pill, Section } from './ui';

const DRAFT_KIND_LABEL: Record<LeadDraft['kind'], string> = {
  followup_d1: 'Kuzatuv · 1-kun',
  followup_d3: 'Kuzatuv · 3-kun',
  followup_d7: 'Kuzatuv · 7-kun',
  ladder_dm: 'Zinapoya · xabar',
  wait_reminder: 'Kutish eslatmasi',
  ai_reply: 'AI javob qoralamasi',
  reactivation: 'Qayta faollashtirish',
};

interface DraftsBlockProps {
  drafts: LeadDraft[];
  forbiddenWords: string[];
  hasApproved: boolean;
  disabled: boolean;
  /** resolves true when the message really went out */
  onSend: (draft: LeadDraft) => Promise<boolean>;
  onEdit: (draft: LeadDraft) => void;
  onSkip: (draft: LeadDraft) => Promise<void>;
}

export function DraftsBlock({ drafts, forbiddenWords, hasApproved, disabled, onSend, onEdit, onSkip }: DraftsBlockProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (drafts.length === 0) return null;

  const run = async (id: string, job: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await job();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section
      title="Qoralamalar"
      right={<Pill tone="warning">{drafts.length}</Pill>}
    >
      <ul className="space-y-2">
        {drafts.map((d) => {
          const guard = evaluateGuard(d.text, forbiddenWords, hasApproved);
          return (
            <li key={d.id} data-draft={d.kind} className="rounded-md border border-border px-2.5 py-2">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                <strong className="text-[12px] text-foreground">{DRAFT_KIND_LABEL[d.kind] ?? d.kind}</strong>
                {d.channel && <Pill tone="info">{channelLabel(d.channel)}</Pill>}
                <span>{whenLabel(d.due_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{d.text}</p>
              {!guard.ok && (
                <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive">
                  {guard.reason}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  className="h-7 min-h-0 px-2.5"
                  disabled={disabled || !guard.ok || busyId === d.id}
                  onClick={() => void run(d.id, () => onSend(d))}
                >
                  <Send aria-hidden="true" />
                  Yuborish
                </Button>
                <Button size="sm" variant="outline" className="h-7 min-h-0 px-2.5" disabled={disabled} onClick={() => onEdit(d)}>
                  <Pencil aria-hidden="true" />
                  Tahrir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 min-h-0 px-2.5"
                  disabled={disabled || busyId === d.id}
                  onClick={() => void run(d.id, () => onSkip(d))}
                >
                  <SkipForward aria-hidden="true" />
                  O'tkazib yuborish
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
