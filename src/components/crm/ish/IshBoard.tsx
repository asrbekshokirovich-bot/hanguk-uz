import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import type { IshBoardRow } from '@/lib/ish/types';
import { addDays, dayLabel, seoulMidnight, seoulToday, timeRange, weekStart, won } from '@/lib/ish/time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ishErrorText, ishKeys, useIshApi } from './context';
import { IshJobDialog } from './IshJobDialog';

/** The name the staff know an employer by: theirs in Uzbek, else the Korean. */
export function businessName(b: { name: string; name_i18n?: Record<string, string> | null }, lang: string): string {
  return b.name_i18n?.[lang] || b.name_i18n?.uz || b.name;
}

/** «Ishlar»: a week of jobs (Seoul's Monday to Sunday). */
export function IshBoard({ onOpen }: { onOpen: (jobId: string) => void }) {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const [week, setWeek] = useState(() => weekStart(seoulToday()));
  const [creating, setCreating] = useState(false);
  const board = useQuery({
    queryKey: ishKeys.board(week),
    queryFn: () => api.board(seoulMidnight(week), seoulMidnight(addDays(week, 7))),
    // New applications and answers show without a reload (only while the
    // tab is in front).
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" aria-label={t('ish.board.prev')} onClick={() => setWeek(addDays(week, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setWeek(weekStart(seoulToday()))}>
            {t('ish.board.thisWeek')}
          </Button>
          <Button size="icon" variant="outline" aria-label={t('ish.board.next')} onClick={() => setWeek(addDays(week, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {dayLabel(`${week}T12:00:00+09:00`, i18n.language)} – {dayLabel(`${addDays(week, 6)}T12:00:00+09:00`, i18n.language)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" aria-label={t('ish.refresh')} onClick={() => void board.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('ish.board.newJob')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('ish.seoulTime')}</p>

      {board.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : board.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, board.error)}</CardContent>
        </Card>
      ) : (board.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t('ish.board.empty')}</CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ish.board.when')}</TableHead>
                <TableHead>{t('ish.board.job')}</TableHead>
                <TableHead className="text-right">{t('ish.board.wage')}</TableHead>
                <TableHead className="text-center">{t('ish.board.places')}</TableHead>
                <TableHead>{t('ish.board.offers')}</TableHead>
                <TableHead>{t('ish.board.applications')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(board.data ?? []).map((row) => (
                <BoardRow key={row.id} row={row} onOpen={() => onOpen(row.id)} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {creating && (
        <IshJobDialog
          open
          onOpenChange={(open) => !open && setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      )}
    </div>
  );
}

function BoardRow({ row, onOpen }: { row: IshBoardRow; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const confirmed = row.applications.confirmed + row.applications.completed;
  return (
    <TableRow className="cursor-pointer" onClick={onOpen} data-testid={`ish-job-${row.id}`}>
      <TableCell className="whitespace-nowrap">
        <div className="font-medium">{dayLabel(row.starts_at, i18n.language)}</div>
        <div className="text-xs text-muted-foreground">{timeRange(row.starts_at, row.ends_at)}</div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{row.title}</div>
        <div className="text-xs text-muted-foreground">{businessName(row.business, i18n.language)}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {row.status === 'cancelled' && <Badge variant="destructive">{t('ish.status.cancelled')}</Badge>}
          {row.attendance_due && (
            <Badge className="bg-amber-500 hover:bg-amber-500">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {t('ish.status.attendanceDue')}
            </Badge>
          )}
          {!row.managed && <Badge variant="outline">{t('ish.status.inApp')}</Badge>}
          {row.managed && !row.invite_only && <Badge variant="outline">{t('ish.status.public')}</Badge>}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">{won(row.hourly_wage)}</TableCell>
      <TableCell className="text-center">
        {confirmed}/{row.slots}
      </TableCell>
      <TableCell className="text-xs">
        <Counts
          parts={[
            [t('ish.offer.sent'), row.offers.sent],
            [t('ish.offer.applied'), row.offers.applied],
            [t('ish.offer.declined'), row.offers.declined],
          ]}
        />
      </TableCell>
      <TableCell className="text-xs">
        <Counts
          parts={[
            [t('ish.application.pending'), row.applications.pending],
            [t('ish.application.confirmed'), row.applications.confirmed],
            [t('ish.application.completed'), row.applications.completed],
            [t('ish.application.no_show'), row.applications.no_show],
          ]}
          highlight={0}
        />
      </TableCell>
    </TableRow>
  );
}

/** «Yuborildi 3 · Ariza berdi 1»: the non-zero ones; [highlight] stands out (waiting for the staff). */
function Counts({ parts, highlight }: { parts: [string, number][]; highlight?: number }) {
  const shown = parts.map((p, i) => [...p, i] as const).filter(([, n]) => n > 0);
  if (shown.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="space-x-2">
      {shown.map(([label, n, i]) => (
        <span key={label} className={i === highlight ? 'font-semibold text-primary' : undefined}>
          {label} {n}
        </span>
      ))}
    </span>
  );
}
