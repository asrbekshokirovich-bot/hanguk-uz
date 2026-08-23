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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useProposedSources,
  useDismissProposedSource,
  LINK_DISMISS_REASONS,
  type LinkDismissReason,
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
  onDismiss: (row: ProposedSourceRow, reason: LinkDismissReason, detail: string) => void;
  dismissing: boolean;
}) {
  const { t } = useTranslation();
  const hasRoutine = row.proposed_by === 'manual';
  // Closing asks for a reason before it writes. 2 511 links were closed with
  // none, and working out which of them deserved to come back meant grouping
  // the crawler's prose by regex — a cost paid once, and not again.
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState<LinkDismissReason>('not_2027');
  const [detail, setDetail] = useState('');

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
          /* The upload IS the reason — no need to ask twice. */
          onUploaded={() => onDismiss(row, 'uploaded', '')}
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
          disabled={dismissing || closing}
          onClick={() => setClosing(true)}
        >
          {dismissing ? (
            <Loader2 className="mr-1.5 h-[14px] w-[14px] animate-spin" />
          ) : (
            <X className="mr-1.5 h-[14px] w-[14px]" />
          )}
          {t('uniReview.links.dismiss')}
        </Button>
      </div>

      {closing ? (
        <div className="flex animate-fade-up flex-col gap-2 rounded-[10px] bg-secondary p-3 px-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold">
              {t('uniReview.links.reasonLabel')}
            </span>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as LinkDismissReason)}
            >
              <SelectTrigger className="h-[30px] w-[230px] bg-card text-[12.5px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_DISMISS_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`uniReview.links.reasons.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 'other' is the escape hatch, so it is the one case where a bare
              code records nothing — make the words mandatory there. */}
          <Input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={t('uniReview.links.detailPlaceholder')}
            className="h-[30px] bg-card text-[12.5px]"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-[30px]"
              disabled={dismissing || (reason === 'other' && !detail.trim())}
              onClick={() => {
                onDismiss(row, reason, detail);
                setClosing(false);
                setDetail('');
              }}
            >
              {t('uniReview.links.confirmDismiss')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-[30px] w-[30px] p-0 text-muted-foreground"
              onClick={() => setClosing(false)}
              title={t('uniReview.actions.cancel')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
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

  const onDismiss = (
    row: ProposedSourceRow,
    reason: LinkDismissReason,
    detail: string,
  ) =>
    dismiss.mutate(
      { id: row.id, reason, detail },
      {
        onSuccess: () =>
          toast.success(
            t('uniReview.links.dismissedWithReason', {
              reason: t(`uniReview.links.reasons.${reason}`),
            }),
          ),
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
