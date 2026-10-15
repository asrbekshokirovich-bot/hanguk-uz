import { memo, type ReactNode } from 'react';
import { Hand, Loader2, MessageCircle, Phone, PhoneOff, Pin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { STAGE_LABEL } from '../copy';
import { useNow } from '../hooks/useNow';
import { formatCountdown, secondsUntil } from '../time';
import type { DeskRow } from '../types';
import {
  channelBadges,
  displayName,
  handleText,
  hozirTimer,
  isClaimable,
  ladderLabel,
  laterTimer,
  rowAction,
  sourceText,
  type HozirTimer,
} from './deskModel';

export interface DeskRowItemProps {
  row: DeskRow;
  /** a lead is open in the right-hand pane: the row drops to two lines */
  split: boolean;
  selected: boolean;
  /** "Hovuz", "Siz" or the owner's name */
  ownerName: string;
  myId: string | null;
  claiming: boolean;
  onSelect: (leadId: string) => void;
  onCall: (leadId: string) => void;
  onClaim: (leadId: string) => void;
}

/** A number that ticks down by itself. Only this leaf re-renders each second. */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const now = useNow();
  return (
    <span className={className} aria-live="off">
      {formatCountdown(secondsUntil(to, now))}
    </span>
  );
}

const CALL_LABEL = "Qo'ng'iroq";

const CHIP_TONE: Record<string, string> = {
  ok: 'bg-success/15 text-success',
  warn: 'bg-warning/20 text-warning',
  late: 'bg-destructive text-destructive-foreground',
  idle: 'bg-muted text-muted-foreground',
};

const ROW_TONE: Record<string, string> = {
  ok: 'border-l-success/60',
  warn: 'border-l-warning bg-warning/10',
  late: 'border-l-destructive bg-destructive/10',
  idle: 'border-l-transparent',
};

/** HOZIR rows tick every second; everything else is static text. */
export const DeskRowItem = memo(function DeskRowItem(props: DeskRowItemProps) {
  return props.row.bucket === 'hozir' ? <HozirRow {...props} /> : <RowView {...props} timer={null} claimable={false} now={new Date()} />;
});

function HozirRow(props: DeskRowItemProps) {
  const now = useNow();
  return <RowView {...props} timer={hozirTimer(props.row, now)} claimable={isClaimable(props.row, props.myId, now)} now={now} />;
}

interface RowViewProps extends DeskRowItemProps {
  timer: HozirTimer | null;
  claimable: boolean;
  now: Date;
}

function RowView({ row, split, selected, ownerName, claiming, onSelect, onCall, onClaim, timer, claimable, now }: RowViewProps) {
  const name = displayName(row);
  const handle = handleText(row);
  const channels = channelBadges(row);
  const source = sourceText(row);
  const action = rowAction(row, now);
  const ladder = ladderLabel(row);
  const late = timer?.late ?? false;
  const hasPhone = Boolean(row.phone);

  // --- the pieces that are a column on a wide screen and a second line when the row is narrow
  const sourceCell = source ? (
    <span className="truncate text-muted-foreground" title={source}>
      {source}
    </span>
  ) : null;

  const stageCell = (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
      {STAGE_LABEL[row.stage] ?? row.stage}
    </span>
  );

  const phoneCell = (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1', hasPhone ? 'text-success' : 'text-muted-foreground')}
      title={hasPhone ? row.phone ?? undefined : 'Telefon raqami yo‘q'}
    >
      {hasPhone ? <Phone className="h-3 w-3" aria-hidden /> : <PhoneOff className="h-3 w-3" aria-hidden />}
      {hasPhone ? 'telefon bor' : "telefon yo'q"}
    </span>
  );

  const actionCell = (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden" title={action.title || undefined}>
      <span className="shrink-0 font-medium text-foreground">{action.label}</span>
      {ladder && (
        <span className="shrink-0 rounded bg-info/10 px-1 py-px text-[10px] font-semibold text-info">{ladder}</span>
      )}
      {action.detail && <span className="truncate text-muted-foreground">{action.detail}</span>}
    </span>
  );

  const ownerCell = (
    <span className={cn('truncate', row.owner_id ? 'text-foreground' : 'text-muted-foreground')} title="Egasi">
      {ownerName}
    </span>
  );

  return (
    <div
      role="listitem"
      onClick={() => onSelect(row.id)}
      data-lead-id={row.id}
      data-bucket={row.bucket}
      data-late={late ? 'true' : undefined}
      className={cn(
        'group relative flex min-h-10 cursor-pointer items-center gap-2 border-b border-l-4 border-border/60 px-3 py-1 text-[13px] transition-colors hover:bg-muted/60',
        timer ? ROW_TONE[timer.tone] : 'border-l-transparent',
        late && 'font-semibold',
        selected && 'bg-primary/10 hover:bg-primary/10',
      )}
    >
      {/* timer chip, or the time the lead is for */}
      <div className="w-[7.5rem] shrink-0">
        {timer ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[13px] font-bold tabular-nums',
              CHIP_TONE[timer.tone],
            )}
            aria-live="off"
            title={late ? 'Muddat o‘tdi' : '10 daqiqalik muddat'}
          >
            {timer.text}
            {timer.suffix && <span className="font-sans text-[10px] font-extrabold tracking-wide">{timer.suffix}</span>}
          </span>
        ) : (
          <LaterTimerCell row={row} now={now} />
        )}
      </div>

      {/* name, @handle, channels, markers — and on a narrow row the facts underneath */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {row.referral && (
            <span className="shrink-0" title="Tavsiya bilan kelgan (birinchi ustuvorlik)" role="img" aria-label="Tavsiya bilan kelgan">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
            </span>
          )}
          {row.pinned && (
            <span className="shrink-0" title="Senior belgilagan" role="img" aria-label="Senior belgilagan">
              <Pin className="h-3.5 w-3.5 text-primary" aria-hidden />
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(row.id);
            }}
            title={row.ai_summary || undefined}
            aria-current={selected ? 'true' : undefined}
            className="min-h-0 min-w-0 truncate rounded-sm text-left font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {name}
          </button>
          {handle && <span className="truncate text-xs font-normal text-muted-foreground">{handle}</span>}
          {channels.map((c) => (
            <span
              key={c}
              className="shrink-0 rounded border border-border bg-background px-1 py-px text-[10px] font-semibold leading-none text-muted-foreground"
            >
              {c}
            </span>
          ))}
          {row.missing > 0 && (
            <span
              className="inline-flex shrink-0 items-center"
              title={`Majburiy maydonlar to‘ldirilmagan: ${row.missing} ta`}
              role="img"
              aria-label={`Majburiy maydonlar to‘ldirilmagan: ${row.missing} ta`}
            >
              <span className="h-2 w-2 rounded-full bg-destructive" />
            </span>
          )}
          {row.pending_drafts > 0 && (
            <span
              className="shrink-0 text-[10px] font-semibold text-primary"
              title={`Yuborilishi kutilayotgan qoralama: ${row.pending_drafts} ta`}
            >
              ● qoralama
            </span>
          )}
        </div>
        <div className={cn('mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] text-muted-foreground', !split && 'xl:hidden')}>
          {stageCell}
          {phoneCell}
          {sourceCell}
          {actionCell}
          <span className="min-w-0 max-w-[7rem] shrink-0 truncate">· {ownerName}</span>
        </div>
      </div>

      {/* the same facts as columns, when there is room */}
      <div className={cn('hidden', !split && 'xl:contents')}>
        <div className="flex w-24 shrink-0 text-[12px]">{sourceCell}</div>
        <div className="flex w-[4.25rem] shrink-0 text-[12px]">{stageCell}</div>
        <div className="flex w-20 shrink-0 text-[12px]">{phoneCell}</div>
        <div className="flex w-36 shrink-0 text-[12px]">{actionCell}</div>
        <div className="flex w-20 shrink-0 text-[12px]">{ownerCell}</div>
      </div>

      <div className="flex w-[8.25rem] shrink-0 items-center justify-end gap-1">
        {claimable ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-7 min-h-0 min-w-0 px-2.5 text-xs"
            disabled={claiming}
            onClick={(e) => {
              e.stopPropagation();
              onClaim(row.id);
            }}
            title="Muddati o‘tgan lidni o‘zingizga olish"
          >
            {claiming ? <Loader2 className="animate-spin" aria-hidden /> : <Hand aria-hidden />}
            Olish
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 min-h-0 min-w-0 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onCall(row.id);
              }}
              title={hasPhone ? 'Kartani ochib, qo‘ng‘iroq qilish' : 'Telefon yo‘q: kartani ochish'}
            >
              <Phone aria-hidden />
              {CALL_LABEL}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 min-h-0 min-w-0 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(row.id);
              }}
              title="Kartani ochish va yozish"
            >
              <MessageCircle aria-hidden />
              Chat
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function LaterTimerCell({ row, now }: { row: DeskRow; now: Date }): ReactNode {
  const t = laterTimer(row, now);
  return (
    <div className="flex flex-col leading-tight">
      <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">{t.primary}</span>
      {t.countdownTo && (
        <span className="text-[11px] text-muted-foreground">
          HOZIR&apos;ga <Countdown to={t.countdownTo} className="font-mono tabular-nums" />
        </span>
      )}
    </div>
  );
}








