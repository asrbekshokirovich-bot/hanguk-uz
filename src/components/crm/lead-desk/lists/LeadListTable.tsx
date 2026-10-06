import type { KeyboardEvent, ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ListColumn<T> {
  key: string;
  header: string;
  /** width / alignment classes for the header and the cells */
  className?: string;
  render: (row: T) => ReactNode;
}

interface LeadListTableProps<T extends { id: string }> {
  rows: T[];
  columns: ListColumn<T>[];
  /** first load: nothing to show yet */
  loading: boolean;
  /** a refetch with the previous rows still on screen */
  fetching?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle: string;
  emptyHint?: string;
  onRowClick?: (row: T) => void;
  selectedId?: string | null;
  /** 0-based */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  ariaLabel: string;
}

/**
 * The dense table the secondary lead pages share: sticky header, row click,
 * loading / empty / error states and the 50-per-page pager. Cells that hold
 * buttons must stop the click themselves (`e.stopPropagation()`).
 */
export default function LeadListTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  fetching,
  error,
  onRetry,
  emptyTitle,
  emptyHint,
  onRowClick,
  selectedId,
  page,
  pageSize,
  total,
  onPageChange,
  ariaLabel,
}: LeadListTableProps<T>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, page * pageSize + rows.length);

  if (error && rows.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-10 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="text-sm font-medium">Ro'yxatni yuklab bo'lmadi</p>
        <p className="max-w-lg text-[13px] text-muted-foreground">{error}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Qayta urinish
          </Button>
        )}
      </div>
    );
  }

  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-[13px]">
          <span>{error}</span>
          {onRetry && (
            <Button size="sm" variant="ghost" className="h-7" onClick={onRetry}>
              Qayta urinish
            </Button>
          )}
        </div>
      )}

      <div
        className={cn('max-h-[calc(100vh-19rem)] min-h-[8rem] overflow-auto rounded-md border bg-background', fetching && 'opacity-70')}
        aria-busy={loading || fetching ? true : undefined}
      >
        <table className="w-full min-w-[1000px] border-collapse text-[13px]" aria-label={ariaLabel}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b bg-muted px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 7 }, (_, i) => (
                  <tr key={`sk-${i}`} className="border-b">
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-2">
                        <Skeleton className="h-4 w-full max-w-[9rem]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-selected={selectedId === row.id ? true : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                    className={cn(
                      'border-b align-top transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none',
                      onRowClick && 'cursor-pointer',
                      selectedId === row.id && 'bg-accent/10',
                    )}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-2 py-1.5', c.className)}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>

        {!loading && rows.length === 0 && !error && (
          <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{emptyTitle}</p>
            {emptyHint && <p className="max-w-md text-[13px] text-muted-foreground">{emptyHint}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span aria-live="polite">{total === 0 ? '0 ta' : `${first}–${last} / ${total} ta`}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            disabled={page <= 0 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Oldingi sahifa"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4.5rem] text-center tabular-nums">
            {page + 1} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            disabled={page + 1 >= pages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Keyingi sahifa"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
