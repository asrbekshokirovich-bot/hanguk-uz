import { Bell, MessageSquare, Search, Volume2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useNow } from '../hooks/useNow';
import type { DeskBucket, DeskRow } from '../types';
import { isBreached } from './deskModel';

interface DeskHeaderProps {
  /** how many rows each block holds (unfiltered) */
  sizes: Record<DeskBucket, number>;
  /** the HOZIR rows, to see whether any is past its 10 minutes */
  hozirRows: readonly DeskRow[];
  /** `counts.comments`: comments nobody has answered */
  comments: number;
  search: string;
  onSearch: (value: string) => void;
  onNewLead: () => void;
  onOpenComments: () => void;
  onJump: (bucket: DeskBucket) => void;
  alerts: {
    notify: boolean;
    sound: boolean;
    setNotify: (on: boolean) => void | Promise<void>;
    setSound: (on: boolean) => void;
    notificationsSupported: boolean;
  };
}

function Chip({
  label,
  value,
  tone,
  pulse = false,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'red' | 'blue' | 'muted';
  pulse?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} blokiga o‘tish`}
      className={cn(
        'inline-flex h-8 min-h-0 min-w-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tone === 'red' && 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
        tone === 'blue' && 'border-info/30 bg-info/10 text-info hover:bg-info/15',
        tone === 'muted' && 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
        pulse && 'animate-pulse',
      )}
    >
      {label}
      <span className="rounded-full bg-black/10 px-1.5 text-xs tabular-nums dark:bg-white/15">{value}</span>
    </button>
  );
}

/**
 * The desk's top bar (spec §3, §3.1): the title, the three block counts, search,
 * "+ Lid", the "Izohlar · N" badge and the two alert switches.
 */
export function DeskHeader({
  sizes,
  hozirRows,
  comments,
  search,
  onSearch,
  onNewLead,
  onOpenComments,
  onJump,
  alerts,
}: DeskHeaderProps) {
  const now = useNow();
  const breached = hozirRows.some((r) => isBreached(r, now));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2">
      <h2 className="mr-1 text-lg font-bold tracking-tight text-foreground">Ish stoli</h2>

      <div className="flex items-center gap-1.5" role="group" aria-label="Bloklar bo‘yicha lidlar soni">
        <Chip label="Hozir" value={sizes.hozir} tone={sizes.hozir > 0 ? 'red' : 'muted'} pulse={breached} onClick={() => onJump('hozir')} />
        <Chip label="Bugun" value={sizes.bugun} tone="blue" onClick={() => onJump('bugun')} />
        <Chip label="Keyin" value={sizes.keyin} tone="muted" onClick={() => onJump('keyin')} />
      </div>

      <div className="relative min-w-[12rem] max-w-xs flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="text"
          autoComplete="off"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Ism, telefon yoki @username"
          aria-label="Lidlarni qidirish"
          className="h-9 pl-8 pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label="Qidiruvni tozalash"
            className="absolute right-2 top-1/2 min-h-0 min-w-0 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground" title="HOZIR'ga yangi lid tushsa brauzer bildirishnomasi">
          <Bell className="h-3.5 w-3.5" aria-hidden />
          Bildirishnoma
          <Switch
            checked={alerts.notify}
            onCheckedChange={(on) => void alerts.setNotify(on)}
            disabled={!alerts.notificationsSupported}
            aria-label="Brauzer bildirishnomasi"
            className="min-h-0 min-w-0"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground" title="HOZIR'ga yangi lid tushsa qisqa signal">
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
          Ovoz
          <Switch
            checked={alerts.sound}
            onCheckedChange={alerts.setSound}
            aria-label="Ovozli signal"
            className="min-h-0 min-w-0"
          />
        </label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-8 min-h-0 min-w-0 gap-1.5 text-xs', comments > 0 && 'border-warning/50 bg-warning/10 text-warning hover:bg-warning/15')}
          onClick={onOpenComments}
          title="Javob kutayotgan izohlar"
        >
          <MessageSquare aria-hidden />
          Izohlar · {comments}
        </Button>

        <Button type="button" size="sm" className="h-8 min-h-0 min-w-0 text-xs" onClick={onNewLead} title="Qo‘lda lid qo‘shish">
          + Lid
        </Button>
      </div>
    </div>
  );
}








