import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useProposedSources,
  useDismissProposedSource,
  type ProposedSourceRow,
} from '@/hooks/useProposedSources';
import { fmtDateKST } from './reviewGroups';
import { LinkPdfUpload } from './LinkPdfUpload';

/**
 * "Havolalar" tab — the links the nightly Routine could not fetch itself.
 *
 * Each proposed source row gets its own card — one link, one card.
 */

function isBlockedNote(note: string | null): boolean {
  return !!note && /fetch failed|403|401|blocked|forbidden|timeout|ssl|refused/i.test(note);
}

function LinkCard({
  row,
  onDismiss,
  dismissing,
}: {
  row: ProposedSourceRow;
  onDismiss: (row: ProposedSourceRow) => void;
  dismissing: boolean;
}) {
  const { t } = useTranslation();
  const hasRoutine = row.proposed_by === 'manual';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 px-[18px] shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-semibold">
          {row.candidate_title ?? row.url_ko}
        </span>
        <span className="flex-1" />
        {hasRoutine ? (
          <span className="inline-flex h-[22px] items-center rounded-full bg-warning/10 px-2.5 text-[11.5px] font-semibold text-warning">
            {t('uniReview.links.fromRoutine')}
          </span>
        ) : (
          <span className="inline-flex h-[22px] items-center rounded-full bg-info/10 px-2.5 text-[11.5px] font-semibold text-info">
            {t('uniReview.links.fromSearch')}
          </span>
        )}
        {row.was_closed ? (
          /* Without this the card looks untouched, and the operator re-does
             work someone already did. The two cases read differently: a person
             judged this link, or the crawler recorded why it could not fetch
             it. */
          <span
            className="inline-flex h-[22px] items-center rounded-full bg-warning/10 px-2.5 text-[11.5px] font-semibold text-warning"
            title={t('uniReview.links.reopenedTitle')}
          >
            {t(row.closed_by_person
              ? 'uniReview.links.closedByPerson'
              : 'uniReview.links.closedByCrawler')}
          </span>
        ) : null}
        <span className="whitespace-nowrap font-mono text-[11.5px] text-muted-foreground/80">
          {fmtDateKST(row.proposed_at)?.split(' · ')[0] ?? ''}
        </span>
      </div>

      <a
        href={row.url_ko}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-[12.5px] font-medium text-info underline-offset-2 hover:underline"
      >
        {row.url_ko}
      </a>

      {row.review_notes ? (
        <div className="flex items-start gap-2">
          {isBlockedNote(row.review_notes) ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          ) : null}
          <span className="break-words text-[12.5px] text-muted-foreground">
            {row.review_notes}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <LinkPdfUpload
          url={row.url_ko}
          candidateTitle={row.candidate_title}
          onUploaded={() => onDismiss(row)}
        />
        <Button asChild size="sm" variant="outline" className="h-8">
          <a href={row.url_ko} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-[14px] w-[14px]" />
            {t('uniReview.links.open')}
          </a>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-muted-foreground"
          disabled={dismissing}
          onClick={() => onDismiss(row)}
        >
          {dismissing ? (
            <Loader2 className="mr-1.5 h-[14px] w-[14px] animate-spin" />
          ) : (
            <X className="mr-1.5 h-[14px] w-[14px]" />
          )}
          {t('uniReview.links.dismiss')}
        </Button>
      </div>
    </div>
  );
}

export function ProposedLinksView() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading, error, refetch } = useProposedSources();
  const dismiss = useDismissProposedSource();
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.url_ko.toLowerCase().includes(q) ||
            (r.candidate_title ?? '').toLowerCase().includes(q) ||
            (r.review_notes ?? '').toLowerCase().includes(q),
        )
      : rows;

    return [...filtered].sort(
      (a, b) =>
        Number(b.proposed_by === 'manual') - Number(a.proposed_by === 'manual'),
    );
  }, [rows, search]);

  const onDismiss = (row: ProposedSourceRow) =>
    dismiss.mutate(
      { id: row.id },
      {
        onSuccess: () => toast.success(t('uniReview.links.dismissed')),
        onError: (e) => toast.error(e.message),
      },
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {t('uniReview.states.error', { message: error.message })}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t('uniReview.states.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[880px] flex-col gap-3">
      <div className="flex items-start gap-2 rounded-[10px] bg-info/10 p-3 px-3.5">
        <Link2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-info" />
        <span className="text-[12.5px] font-medium leading-relaxed text-info">
          {t('uniReview.links.banner')}
        </span>
      </div>

      <Input
        placeholder={t('uniReview.links.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <h3 className="font-medium">{t('uniReview.links.emptyTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? t('uniReview.links.emptyFiltered') : t('uniReview.links.emptyBody')}
            </p>
          </CardContent>
        </Card>
      ) : (
        visible.map((row) => (
          <LinkCard
            key={row.id}
            row={row}
            onDismiss={onDismiss}
            dismissing={dismiss.isPending && dismiss.variables?.id === row.id}
          />
        ))
      )}
    </div>
  );
}

export default ProposedLinksView;
