import type { ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNow } from '../hooks/useNow';
import type { DeskBucket, DeskRow } from '../types';
import { isBreached } from './deskModel';

const BLOCK_TITLE: Record<DeskBucket, string> = {
  hozir: 'HOZIR — 10 daqiqa',
  bugun: 'BUGUN — qayta aloqa va javob kutayotgan chatlar',
  keyin: 'KEYIN',
};

const BLOCK_EMPTY: Record<DeskBucket, string> = {
  hozir: "Hozir navbat yo'q",
  bugun: "Bugun uchun ish yo'q",
  keyin: "Keyingi ishlar yo'q",
};

interface DeskBlockProps {
  bucket: DeskBucket;
  /** how many rows the block holds (before any "show first 40" cut) */
  count: number;
  /** HOZIR: the rows on screen — the dot pulses while one of them is past its 10 minutes */
  hozirRows?: readonly DeskRow[];
  /** a search is on and nothing matched */
  searching?: boolean;
  children?: ReactNode;
  /** KEYIN: "Hammasini ko'rsatish" */
  more?: { hidden: number; expanded: boolean; onToggle: () => void };
}

const DOT: Record<DeskBucket, string> = {
  hozir: 'bg-destructive',
  bugun: 'bg-info',
  keyin: 'bg-muted-foreground/60',
};

/** The HOZIR dot ticks with the clock: it pulses while any lead is past its 10 minutes. */
function HozirDot({ rows }: { rows: readonly DeskRow[] }) {
  const now = useNow();
  const breached = rows.some((r) => isBreached(r, now));
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT.hozir, breached && 'animate-pulse')} aria-hidden />;
}

/**
 * One of the desk's three blocks. HOZIR is never hidden: when it is empty it
 * says so in a calm green line instead of disappearing (spec §3.1).
 */
export function DeskBlock({ bucket, count, hozirRows, searching = false, children, more }: DeskBlockProps) {
  const headingId = `desk-block-title-${bucket}`;
  const empty = count === 0;

  return (
    <section id={`desk-block-${bucket}`} aria-labelledby={headingId} className="mb-4 last:mb-0">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-1.5 backdrop-blur">
        {bucket === 'hozir' ? (
          <HozirDot rows={hozirRows ?? []} />
        ) : (
          <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[bucket])} aria-hidden />
        )}
        <h3
          id={headingId}
          className={cn(
            'text-[12px] font-bold uppercase tracking-wide',
            bucket === 'hozir' && count > 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {BLOCK_TITLE[bucket]}
        </h3>
        <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-semibold tabular-nums text-muted-foreground">{count}</span>
      </div>

      {empty ? (
        bucket === 'hozir' && !searching ? (
          <div
            role="status"
            className="mx-3 mt-2 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {BLOCK_EMPTY.hozir}
          </div>
        ) : (
          <p className="px-3 py-3 text-sm text-muted-foreground">{searching ? 'Hech narsa topilmadi' : BLOCK_EMPTY[bucket]}</p>
        )
      ) : (
        <div role="list">{children}</div>
      )}

      {more && more.hidden > 0 && (
        <div className="flex justify-center px-3 py-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 min-h-0 text-xs" onClick={more.onToggle}>
            {more.expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            {more.expanded ? 'Kamroq ko‘rsatish' : `Hammasini ko'rsatish (yana ${more.hidden} ta)`}
          </Button>
        </div>
      )}
    </section>
  );
}



