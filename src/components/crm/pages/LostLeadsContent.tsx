import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchLostLeads, reopenLead, type LeadListRow } from '@/components/crm/lead-desk/api';
import { whenLabel } from '@/components/crm/lead-desk/time';
import { useLeadSettings } from '@/components/crm/lead-desk/useLeadSettings';
import { Dash, LeadNameCell } from '@/components/crm/lead-desk/lists/cells';
import ConfirmDialog from '@/components/crm/lead-desk/lists/ConfirmDialog';
import { PageHeader, SearchBox } from '@/components/crm/lead-desk/lists/FilterControls';
import { buildListFilter, EMPTY_FILTERS, type ListFilterState } from '@/components/crm/lead-desk/lists/filters';
import { explainLeadError, GENERATION_LABEL, PAGE_SIZE } from '@/components/crm/lead-desk/lists/labels';
import LeadCardSheet from '@/components/crm/lead-desk/lists/LeadCardSheet';
import LeadListTable, { type ListColumn } from '@/components/crm/lead-desk/lists/LeadListTable';
import { fetchLostReasonCounts } from '@/components/crm/lead-desk/lists/lostApi';
import QueueCards from '@/components/crm/lead-desk/lists/QueueCards';
import { useDebouncedValue } from '@/components/crm/lead-desk/lists/useDebouncedValue';
import { useStaffNames } from '@/components/crm/lead-desk/lists/useStaffNames';
import { cn } from '@/lib/utils';

/**
 * Yo'qotilgan va qayta faollashtirish (spec §3.4): lost leads by reason, and the
 * reactivation queues.
 */
export default function LostLeadsContent() {
  return (
    <div className="space-y-3">
      <PageHeader
        title="Yo'qotilgan va qayta faollashtirish"
        description="Yo'qotilgan lidlar sabab bo'yicha va ularni qaytaradigan avtomatik navbatlar."
      />
      <Tabs defaultValue="lost">
        <TabsList className="h-9 w-auto justify-start">
          <TabsTrigger value="lost" className="flex-none px-4">
            Yo'qotilganlar
          </TabsTrigger>
          <TabsTrigger value="queues" className="flex-none px-4">
            Navbatlar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lost" className="mt-3">
          <LostTab />
        </TabsContent>
        <TabsContent value="queues" className="mt-3">
          <QueueCards />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LostTab() {
  const qc = useQueryClient();
  const { settings } = useLeadSettings();
  const { nameOf } = useStaffNames();

  const [filters, setFilters] = useState<ListFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reopen, setReopen] = useState<LeadListRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(filters.q, 300);
  const query = useMemo(() => buildListFilter({ ...filters, q: debouncedQ }, page), [filters, debouncedQ, page]);

  const list = useQuery({
    queryKey: ['lead-v2', 'list', 'lost', query],
    queryFn: () => fetchLostLeads(query),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({ queryKey: ['lead-v2', 'lost-counts'], queryFn: fetchLostReasonCounts, staleTime: 60_000 });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  useEffect(() => {
    if (list.data && page > 0 && page * PAGE_SIZE >= list.data.total) {
      setPage(Math.max(0, Math.ceil(list.data.total / PAGE_SIZE) - 1));
    }
  }, [list.data, page]);

  const reasonLabel = (key: string | null | undefined) =>
    key ? (settings.lost_reasons.find((r) => r.key === key)?.label ?? key) : null;

  const setFilter = (patch: Partial<ListFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['lead-v2', 'list'] }),
      qc.invalidateQueries({ queryKey: ['lead-v2', 'lost-counts'] }),
      qc.invalidateQueries({ queryKey: ['lead-v2', 'queues'] }),
    ]);
  };

  const submitReopen = async () => {
    if (!reopen) return;
    setBusy(true);
    setError(null);
    try {
      await reopenLead(reopen.id);
      toast.success(`${reopen.full_name} qayta ochildi`);
      setReopen(null);
      await refresh();
    } catch (e) {
      setError(explainLeadError(e));
    } finally {
      setBusy(false);
    }
  };

  const closedBy = (r: LeadListRow): string => {
    if (r.lost_by) return nameOf(r.lost_by) ?? '—';
    return r.crm_generation === 'old' ? 'Eski CRM' : 'Avtomatik';
  };

  const columns: ListColumn<LeadListRow>[] = [
    { key: 'name', header: 'Ism', className: 'min-w-[12rem] max-w-[16rem]', render: (r) => <LeadNameCell row={r} /> },
    {
      key: 'reason',
      header: 'Sabab',
      className: 'w-40',
      render: (r) => reasonLabel(r.lost_reason) ?? <span className="text-muted-foreground">Ko'rsatilmagan</span>,
    },
    { key: 'competitor', header: 'Raqobatchi', className: 'w-32', render: (r) => r.lost_competitor || <Dash /> },
    { key: 'date', header: 'Sana', className: 'w-28 whitespace-nowrap', render: (r) => (r.lost_at ? whenLabel(r.lost_at) : <Dash />) },
    { key: 'by', header: 'Kim yopgan', className: 'w-28', render: (r) => closedBy(r) },
    { key: 'gen', header: 'Avlod', className: 'w-20', render: (r) => GENERATION_LABEL[r.crm_generation] ?? r.crm_generation },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (r) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[12px]"
          aria-label={`Qayta ochish: ${r.full_name}`}
          onClick={(e) => {
            e.stopPropagation();
            setError(null);
            setReopen(r);
          }}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Qayta ochish
        </Button>
      ),
    },
  ];

  const known = new Set(settings.lost_reasons.map((r) => r.key));
  const reasonCounts = (counts.data ?? []).filter((c) => c.reason != null);
  const noReason = (counts.data ?? []).find((c) => c.reason == null)?.n ?? 0;
  // reasons that are not in the settings list any more still show, under their raw key
  const chips = [
    ...settings.lost_reasons.map((r) => ({ key: r.key, label: r.label, n: reasonCounts.find((c) => c.reason === r.key)?.n ?? 0 })),
    ...reasonCounts.filter((c) => !known.has(c.reason as string)).map((c) => ({ key: c.reason as string, label: c.reason as string, n: c.n })),
  ];
  const allCount = (counts.data ?? []).reduce((acc, c) => acc + c.n, 0);
  const filtersOn = filters.lostReason !== '' || filters.q !== '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <SearchBox
          label="Lidlarni qidirish"
          placeholder="Ism, telefon yoki @username"
          value={filters.q}
          onChange={(q) => setFilter({ q })}
          className="w-64"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sabab bo'yicha">
        <ReasonChip active={filters.lostReason === ''} onClick={() => setFilter({ lostReason: '' })} label="Hammasi" n={counts.data ? allCount : null} />
        {chips.map((c) => (
          <ReasonChip
            key={c.key}
            active={filters.lostReason === c.key}
            onClick={() => setFilter({ lostReason: filters.lostReason === c.key ? '' : c.key })}
            label={c.label}
            n={counts.data ? c.n : null}
          />
        ))}
        {noReason > 0 && <span className="px-1.5 py-1 text-[12px] text-muted-foreground">Sababsiz: {noReason}</span>}
      </div>

      <LeadListTable
        ariaLabel="Yo'qotilgan lidlar"
        rows={rows}
        columns={columns}
        loading={list.isLoading}
        fetching={list.isFetching && !list.isLoading}
        error={list.error ? explainLeadError(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyTitle={filtersOn ? 'Filtrga mos lid topilmadi' : "Yo'qotilgan lid yo'q"}
        emptyHint={filtersOn ? "Sabab yoki qidiruvni o'zgartiring." : "Lid yo'qotilganda sababi bilan shu yerga tushadi."}
        onRowClick={(r) => setOpenId(r.id)}
        selectedId={openId}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <LeadCardSheet
        leadId={openId}
        onClose={() => {
          setOpenId(null);
          void refresh();
        }}
      />

      <ConfirmDialog
        open={reopen != null}
        title="Lidni qayta ochish"
        description={
          reopen
            ? `${reopen.full_name} «Aloqada» bosqichiga qaytadi va hovuzga tushadi; u turgan qayta faollashtirish navbatlari bekor qilinadi.`
            : undefined
        }
        confirmLabel="Qayta ochish"
        busy={busy}
        error={error}
        onConfirm={() => void submitReopen()}
        onCancel={() => setReopen(null)}
      />
    </div>
  );
}

function ReasonChip({ label, n, active, onClick }: { label: string; n: number | null; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
        active ? 'border-accent bg-accent/15 font-semibold' : 'bg-background hover:bg-muted',
      )}
    >
      {label}
      {n != null && <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>}
    </button>
  );
}
