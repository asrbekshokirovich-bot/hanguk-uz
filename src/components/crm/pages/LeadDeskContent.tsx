import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { claimLead } from '@/components/crm/lead-desk/api';
import { explainError } from '@/components/crm/lead-desk/copy';
import { COUNTS_KEY, useDeskCounts } from '@/components/crm/lead-desk/hooks/useDeskCounts';
import { DESK_KEY, useDesk } from '@/components/crm/lead-desk/hooks/useDesk';
import { useHozirAlerts } from '@/components/crm/lead-desk/hooks/useHozirAlerts';
import { useRerenderAt } from '@/components/crm/lead-desk/hooks/useNow';
import { useStaffNames } from '@/components/crm/lead-desk/hooks/useStaffNames';
import { ClaimGate } from '@/components/crm/lead-desk/desk/ClaimGate';
import { DeskBlock } from '@/components/crm/lead-desk/desk/DeskBlock';
import { DeskHeader } from '@/components/crm/lead-desk/desk/DeskHeader';
import { DeskRowItem } from '@/components/crm/lead-desk/desk/DeskRowItem';
import { DeskError, DeskSkeleton } from '@/components/crm/lead-desk/desk/DeskStates';
import {
  BUCKETS,
  filterGrouped,
  isClaimable,
  KEYIN_PREVIEW,
  ownerLabel,
} from '@/components/crm/lead-desk/desk/deskModel';
import type { DeskBucket, DeskRow } from '@/components/crm/lead-desk/types';
import LeadCard from '@/components/crm/lead-desk/card/LeadCard';
import ManualLeadDialog from '@/components/crm/lead-desk/card/ManualLeadDialog';
import CommentsPanel from '@/components/crm/lead-desk/comments/CommentsPanel';

const LEAD_PARAM = 'lead';

interface DetailPaneProps {
  leadId: string;
  row: DeskRow | undefined;
  myId: string | null;
  /** seniors and bosses may open any card without taking the lead */
  canSkipClaim: boolean;
  ownerName: string;
  claiming: boolean;
  startCall: boolean;
  callNonce: number;
  onClaim: (leadId: string) => void;
  onClose: () => void;
}

/**
 * The right-hand pane: the lead's card — or, for a breached lead another
 * operator owns, the "Olish" gate in front of it. Re-renders once when the
 * deadline passes, not every second, so the card is not re-rendered by the clock.
 */
function DetailPane({ leadId, row, myId, canSkipClaim, ownerName, claiming, startCall, callNonce, onClaim, onClose }: DetailPaneProps) {
  useRerenderAt(row?.due_at);
  const gated = Boolean(row) && !canSkipClaim && isClaimable(row as DeskRow, myId, new Date());

  if (gated && row) {
    return <ClaimGate row={row} ownerName={ownerName} claiming={claiming} onClaim={() => onClaim(leadId)} onClose={onClose} />;
  }
  // A new key restarts the card, which is how "Qo'ng'iroq" re-opens the call even on the open lead.
  return <LeadCard key={`${leadId}:${startCall ? callNonce : 0}`} leadId={leadId} onClose={onClose} startCall={startCall} className="h-full" />;
}

/**
 * Ish stoli (spec §3, §3.1): the one screen an operator never leaves. HOZIR,
 * BUGUN and KEYIN from `lead_desk()`, and the open lead's card beside them — the
 * selected lead is in the URL (`?lead=<id>`), so a link opens it.
 */
export default function LeadDeskContent() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(LEAD_PARAM);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isLeadSenior } = useUserRole();
  const myId = user?.id ?? null;

  const { rows, grouped, loading, error, isFetching, refetch } = useDesk();
  const { counts } = useDeskCounts();
  const { names } = useStaffNames();

  const [search, setSearch] = useState('');
  const [showAllKeyin, setShowAllKeyin] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [callIntent, setCallIntent] = useState<{ id: string; nonce: number } | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // ---- the list keeps its scroll position when a lead is opened or closed ------------------------
  // At >= 1280 px the list just narrows and never remounts, so nothing is lost. Below that the list
  // is hidden (display: none) while a card is open, and a hidden element forgets its scroll offset:
  // so the offset is read before the card opens and put back when it closes.
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const rememberScroll = useCallback(() => {
    const el = listRef.current;
    if (el && el.clientHeight > 0) scrollTop.current = el.scrollTop;
  }, []);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && el.clientHeight > 0 && el.scrollTop !== scrollTop.current) el.scrollTop = scrollTop.current;
  }, [selectedId]);

  // ---- selection lives in the URL ---------------------------------------------------
  const select = useCallback(
    (leadId: string, startCall = false) => {
      rememberScroll();
      setCallIntent(startCall ? { id: leadId, nonce: Date.now() } : null);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(LEAD_PARAM, leadId);
          return next;
        },
        { replace: true },
      );
    },
    [setParams, rememberScroll],
  );

  const close = useCallback(() => {
    rememberScroll();
    setCallIntent(null);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(LEAD_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setParams, rememberScroll]);

  const handleSelect = useCallback((leadId: string) => select(leadId), [select]);
  const handleCall = useCallback((leadId: string) => select(leadId, true), [select]);

  // ---- alerts for a lead that newly lands in HOZIR ----------------------------------
  const alerts = useHozirAlerts(rows, { onOpen: handleSelect });

  // ---- claiming ("Olish") ----------------------------------------------------------------
  const handleClaim = useCallback(
    async (leadId: string) => {
      setClaimingId(leadId);
      try {
        await claimLead(leadId);
        toast.success('Lid sizga biriktirildi');
        await queryClient.invalidateQueries({ queryKey: DESK_KEY });
        void queryClient.invalidateQueries({ queryKey: COUNTS_KEY });
        select(leadId);
      } catch (e) {
        toast.error(explainError(e instanceof Error ? e.message : String(e)));
      } finally {
        setClaimingId(null);
      }
    },
    [queryClient, select],
  );

  // ---- search and the "first 40" of KEYIN ----------------------------------------------------
  const searching = search.trim().length > 0;
  const visible = useMemo(() => filterGrouped(grouped, search), [grouped, search]);
  const keyinHidden = Math.max(0, visible.keyin.length - KEYIN_PREVIEW);
  const keyinRows = showAllKeyin || searching ? visible.keyin : visible.keyin.slice(0, KEYIN_PREVIEW);

  const sizes: Record<DeskBucket, number> = { hozir: grouped.hozir.length, bugun: grouped.bugun.length, keyin: grouped.keyin.length };

  const jump = useCallback((bucket: DeskBucket) => {
    document.getElementById(`desk-block-${bucket}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);

  const selectedRow = useMemo(() => (selectedId ? rows?.find((r) => r.id === selectedId) : undefined), [rows, selectedId]);
  const split = Boolean(selectedId);

  const renderRows = (list: DeskRow[]) =>
    list.map((row) => (
      <DeskRowItem
        key={row.id}
        row={row}
        split={split}
        selected={row.id === selectedId}
        ownerName={ownerLabel(row.owner_id, names, myId)}
        myId={myId}
        claiming={claimingId === row.id}
        onSelect={handleSelect}
        onCall={handleCall}
        onClaim={handleClaim}
      />
    ));

  const showSkeleton = loading && !rows;
  const showError = Boolean(error) && !rows;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[32rem] flex-col gap-3">
      <DeskHeader
        sizes={sizes}
        hozirRows={grouped.hozir}
        comments={counts.comments}
        search={search}
        onSearch={setSearch}
        onNewLead={() => setManualOpen(true)}
        onOpenComments={() => setCommentsOpen(true)}
        onJump={jump}
        alerts={alerts}
      />

      {error && rows && <DeskError inline error={error} onRetry={() => void refetch()} retrying={isFetching} />}

      <div className="flex min-h-0 flex-1 gap-4">
        <div
          ref={listRef}
          className={cn(
            'min-h-0 min-w-0 overflow-y-auto rounded-lg border border-border bg-card',
            split ? 'hidden xl:block xl:flex-[58_1_0%]' : 'flex-1',
          )}
          aria-label="Ish stoli ro‘yxati"
        >
          {showSkeleton && <DeskSkeleton />}
          {showError && <DeskError error={error} onRetry={() => void refetch()} retrying={isFetching} />}
          {!showSkeleton && !showError && (
            <>
              {BUCKETS.map((bucket) => (
                <DeskBlock
                  key={bucket}
                  bucket={bucket}
                  count={visible[bucket].length}
                  searching={searching}
                  hozirRows={bucket === 'hozir' ? visible.hozir : undefined}
                  more={
                    bucket === 'keyin' && !searching && keyinHidden > 0
                      ? { hidden: keyinHidden, expanded: showAllKeyin, onToggle: () => setShowAllKeyin((v) => !v) }
                      : undefined
                  }
                >
                  {renderRows(bucket === 'keyin' ? keyinRows : visible[bucket])}
                </DeskBlock>
              ))}
            </>
          )}
        </div>

        {selectedId && (
          <aside
            aria-label="Lid kartasi"
            className="relative min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card xl:flex-[42_1_0%]"
          >
            <DetailPane
              leadId={selectedId}
              row={selectedRow}
              myId={myId}
              canSkipClaim={isLeadSenior}
              ownerName={ownerLabel(selectedRow?.owner_id ?? null, names, myId)}
              claiming={claimingId === selectedId}
              startCall={callIntent?.id === selectedId}
              callNonce={callIntent?.nonce ?? 0}
              onClaim={handleClaim}
              onClose={close}
            />
          </aside>
        )}
      </div>

      <ManualLeadDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreated={(leadId) => {
          void queryClient.invalidateQueries({ queryKey: DESK_KEY });
          void queryClient.invalidateQueries({ queryKey: COUNTS_KEY });
          select(leadId);
        }}
      />
      <CommentsPanel open={commentsOpen} onOpenChange={setCommentsOpen} />
    </div>
  );
}

