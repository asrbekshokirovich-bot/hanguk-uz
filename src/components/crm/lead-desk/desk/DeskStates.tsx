import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { explainError } from '../copy';

/** The first load: three blocks' worth of grey rows, so the page never flashes empty. */
export function DeskSkeleton() {
  return (
    <div className="space-y-5 p-3" role="status" aria-label="Ish stoli yuklanmoqda">
      {[3, 4, 3].map((rows, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-48" />
          {Array.from({ length: rows }, (_, r) => (
            <Skeleton key={r} className="h-10 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface DeskErrorProps {
  error: Error | null;
  onRetry: () => void;
  retrying?: boolean;
  /** stale rows are still on screen: show a slim strip instead of the full panel */
  inline?: boolean;
}

/** `lead_desk()` failed. Never a blank screen: say what happened and offer a retry. */
export function DeskError({ error, onRetry, retrying = false, inline = false }: DeskErrorProps) {
  const reason = explainError(error?.message);

  if (inline) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-foreground"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Yangilab bo‘lmadi — oxirgi yuklangan ro‘yxat ko‘rsatilmoqda. {reason}</span>
        <Button type="button" size="sm" variant="ghost" className="h-6 min-h-0 min-w-0 px-2 text-xs" onClick={onRetry} disabled={retrying}>
          Qayta urinish
        </Button>
      </div>
    );
  }

  return (
    <div role="alert" className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <div>
        <h3 className="text-base font-semibold text-foreground">Ish stoli yuklanmadi</h3>
        <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
      </div>
      <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        Qayta urinish
      </Button>
    </div>
  );
}

