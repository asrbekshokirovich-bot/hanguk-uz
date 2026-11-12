import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { IshReport, ReportStatus } from '@/lib/ish/types';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ishErrorText, ishKeys, useIshApi } from './context';

const REPORT_STATUSES: readonly ReportStatus[] = ['open', 'in_review', 'closed'];

/**
 * «Shikoyatlar» (P52): what the workers sent from the app (A11). The app
 * tells them «we will look into it soon»; here the staff read each one and
 * note where it stands.
 */
export function IshReports() {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const list = useQuery({ queryKey: ishKeys.reports, queryFn: api.reports });

  if (list.isLoading) return <Skeleton className="h-40 w-full" />;
  if (list.isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, list.error)}</CardContent>
      </Card>
    );
  }
  const reports = list.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('ish.reports.intro')}</p>
      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t('ish.reports.empty')}</CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ish.reports.when')}</TableHead>
                <TableHead>{t('ish.reports.reason')}</TableHead>
                <TableHead>{t('ish.reports.text')}</TableHead>
                <TableHead>{t('ish.reports.worker')}</TableHead>
                <TableHead>{t('ish.reports.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id} data-testid={`ish-report-${r.id}`} className={r.status === 'closed' ? 'opacity-60' : ''}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(r.created_at).toLocaleString(i18n.language, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'Asia/Seoul',
                    })}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {t(`ish.reports.reasons.${r.reason}`, { defaultValue: r.reason })}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-pre-wrap text-sm">{r.body}</TableCell>
                  <TableCell className="text-sm">
                    <Reporter report={r} />
                  </TableCell>
                  <TableCell>
                    <StatusSelect report={r} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function Reporter({ report }: { report: IshReport }) {
  const { t } = useTranslation();
  const w = report.worker;
  if (!w) return null;
  const name = `${w.first_name} ${w.last_name}`.trim();
  return (
    <div>
      <div className="font-medium">{name || t('ish.reports.noName')}</div>
      {w.phone && (
        <a href={`tel:${w.phone}`} className="text-xs text-primary hover:underline">
          {w.phone}
        </a>
      )}
      <div className="text-xs text-muted-foreground">
        {t('ish.reports.history', { completed: w.completed, noShows: w.no_shows })}
      </div>
    </div>
  );
}

function StatusSelect({ report }: { report: IshReport }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (status: ReportStatus) => api.setReportStatus(report.id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ishKeys.reports });
      toast.success(t('ish.reports.changed'));
    },
    onError: (e) => toast.error(ishErrorText(t, e)),
  });
  return (
    <Select
      value={report.status}
      onValueChange={(v) => change.mutate(v as ReportStatus)}
      disabled={change.isPending}
    >
      <SelectTrigger className="w-44" aria-label={t('ish.reports.status')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {REPORT_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`ish.reports.statuses.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
