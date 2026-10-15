/**
 * Block 1 of the card (spec §6): name, stage, channels, the live timer, owner,
 * priority, and the action buttons. Presentational — LeadCard owns the dialogs
 * and the calls.
 */
import { Clock, GraduationCap, MessageSquare, Phone, Pin, PinOff, RotateCcw, Timer, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STAGE_LABEL, TIMER_LABEL } from '../copy';
import { formatCountdown, secondsUntil, urgency, whenLabel } from '../time';
import type { LeadV2, Stage } from '../types';
import { channelChips, ladderLabel, type ChatChannel } from './cardLogic';
import { isDialable } from './phone';
import { IconButton, Pill } from './ui';
import { useNow } from './useNow';

const STAGE_TONE: Record<Stage, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'lime'> = {
  new: 'info',
  contacted: 'info',
  interested: 'success',
  offer: 'lime',
  contract: 'lime',
  student: 'success',
  waiting: 'warning',
  lost: 'danger',
};

function TimerChip({ lead }: { lead: LeadV2 }) {
  const now = useNow(1000, !!lead.due_at);
  if (!lead.due_at) return null;

  const ladder = ladderLabel(lead);
  // "Zinapoya · zinapoya 2/5" says the same twice: the step number is the label
  const kind = lead.timer_kind && !(lead.timer_kind === 'ladder' && ladder) ? TIMER_LABEL[lead.timer_kind] : '';
  const visible = !lead.timer_start_at || Date.parse(lead.timer_start_at) <= now.getTime();

  if (!visible) {
    return (
      <Pill tone="neutral" title="Taymer hali HOZIR'ga tushmagan">
        <Clock className="h-3 w-3" aria-hidden="true" />
        {[kind, whenLabel(lead.due_at, now), ladder].filter(Boolean).join(' · ')}
      </Pill>
    );
  }

  const left = secondsUntil(lead.due_at, now);
  const u = urgency(lead.due_at, now);
  const tone = u === 'late' ? 'danger' : u === 'warn' ? 'warning' : 'success';
  return (
    <Pill tone={tone} className={u === 'late' ? 'animate-pulse' : undefined}>
      <Timer className="h-3 w-3" aria-hidden="true" />
      <span>HOZIR</span>
      <span className="tabular-nums">{formatCountdown(left)}</span>
      {u === 'late' && <span>KECHIKDI</span>}
      {(kind || ladder) && <span className="font-medium">· {[kind, ladder].filter(Boolean).join(' · ')}</span>}
    </Pill>
  );
}

export interface CardHeaderProps {
  lead: LeadV2;
  chat: ChatChannel[];
  ownerName: string | null;
  isLeadSenior: boolean;
  /** the operator may not act on this lead */
  readOnly: boolean;
  /** shown instead of the action buttons: "Bu lid Omina'da" */
  banner: string | null;
  canClaim: boolean;
  isStudent: boolean;
  busy: boolean;
  onClose?: () => void;
  onCall: () => void;
  onWrite: () => void;
  onWait: () => void;
  onLose: () => void;
  onConvert: () => void;
  onReopen: () => void;
  onClaim: () => void;
  onPin: () => void;
}

export function CardHeader(p: CardHeaderProps) {
  const { lead } = p;
  const chips = channelChips(lead, p.chat);
  const canConvert = lead.stage === 'interested' || lead.stage === 'offer' || lead.stage === 'contract';
  const pool = !lead.owner_id;
  const score = lead.priority_score;

  return (
    <header data-testid="card-header" className="space-y-2 border-b border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-tight" title={lead.full_name}>
          {lead.full_name}
        </h2>
        {p.isLeadSenior && (
          <IconButton label={lead.pinned_at ? 'Pinni olib tashlash' : 'Pin qilish'} onClick={p.onPin} disabled={p.busy}>
            {lead.pinned_at ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
          </IconButton>
        )}
        {p.onClose && (
          <IconButton label="Kartani yopish" onClick={p.onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Pill>
        {lead.crm_generation === 'old' && <Pill tone="neutral">Eski CRM</Pill>}
        {p.isStudent && <Pill tone="success">Talaba</Pill>}
        {chips.map((c) => (
          <Pill key={c} tone="info">
            {c}
          </Pill>
        ))}
        {lead.pinned_at && (
          <Pill tone="lime">
            <Pin className="h-3 w-3" aria-hidden="true" />
            Pin
          </Pill>
        )}
        {score != null && (
          <Pill tone="neutral" title="Ustuvorlik bali (0–100). Operator o'zgartira olmaydi.">
            Ball {score}
          </Pill>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TimerChip lead={lead} />
        <span className="text-[12px] text-muted-foreground">
          {pool ? <Pill tone="warning">Hovuz</Pill> : <>Egasi: <strong className="font-semibold text-foreground">{p.ownerName ?? '…'}</strong></>}
        </span>
      </div>

      {p.banner && (
        <p role="status" className="rounded-md bg-warning/10 px-3 py-1.5 text-[12.5px] font-medium text-warning">
          {p.banner}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {p.canClaim && (
          <Button size="sm" variant="highlight" className="h-9 min-h-0" onClick={p.onClaim} disabled={p.busy}>
            Olish
          </Button>
        )}
        {!p.readOnly && lead.stage === 'lost' && (
          <Button size="sm" className="h-9 min-h-0" onClick={p.onReopen} disabled={p.busy}>
            <RotateCcw aria-hidden="true" />
            Qayta ochish
          </Button>
        )}
        {!p.readOnly && lead.stage !== 'lost' && (
          <>
            <Button
              size="sm"
              className="h-9 min-h-0"
              onClick={p.onCall}
              disabled={!isDialable(lead.phone)}
              title={isDialable(lead.phone) ? 'Raqamni nusxalaydi va telefon ilovasini ochadi' : 'Telefon raqami yo‘q'}
            >
              <Phone aria-hidden="true" />
              Qo'ng'iroq
              {lead.phone && <span className="font-normal opacity-90">{lead.phone}</span>}
            </Button>
            <Button size="sm" variant="outline" className="h-9 min-h-0" onClick={p.onWrite}>
              <MessageSquare aria-hidden="true" />
              Yozish
            </Button>
            <Button size="sm" variant="outline" className="h-9 min-h-0" onClick={p.onWait}>
              <Clock aria-hidden="true" />
              Kutish
            </Button>
            <Button size="sm" variant="outline" className="h-9 min-h-0" onClick={p.onLose}>
              <XCircle aria-hidden="true" />
              Yo'qotildi
            </Button>
            {canConvert && (
              <Button size="sm" variant="highlight" className="h-9 min-h-0" onClick={p.onConvert} disabled={p.busy}>
                <GraduationCap aria-hidden="true" />
                Talaba
              </Button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
