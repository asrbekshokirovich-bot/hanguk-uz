import { Hand, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from './DeskRowItem';
import { displayName } from './deskModel';
import type { DeskRow } from '../types';

interface ClaimGateProps {
  row: DeskRow;
  ownerName: string;
  claiming: boolean;
  onClaim: () => void;
  onClose: () => void;
}

/**
 * What the right-hand pane shows for a breached lead that another operator owns
 * (spec §4): the card is not usable until it is taken. "Olish" attaches the lead
 * to the person who pressed it and opens the card.
 */
export function ClaimGate({ row, ownerName, claiming, onClaim, onClose }: ClaimGateProps) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-4 p-6 text-center">
      <button
        type="button"
        onClick={onClose}
        title="Yopish"
        aria-label="Kartani yopish"
        className="absolute right-3 top-3 min-h-0 min-w-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Hand className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{displayName(row)}</h3>
        <p className="text-sm text-muted-foreground">
          Egasi: <span className="font-medium text-foreground">{ownerName}</span>. 10 daqiqalik muddat o‘tdi
          {row.due_at && (
            <>
              {' '}
              (<Countdown to={row.due_at} className="font-mono font-semibold text-destructive" />).
            </>
          )}
          {!row.due_at && '.'} Javob berish uchun lidni o‘zingizga oling.
        </p>
      </div>
      <Button type="button" variant="destructive" onClick={onClaim} disabled={claiming}>
        {claiming ? <Loader2 className="animate-spin" aria-hidden /> : <Hand aria-hidden />}
        Olish
      </Button>
    </div>
  );
}

