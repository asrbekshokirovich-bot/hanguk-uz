import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pin, PinOff, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchAllLeads, pinLead, reassignLead, type LeadListRow } from '@/components/crm/lead-desk/api';
import { CERTIFICATES, REGIONS, STAGE_LABEL } from '@/components/crm/lead-desk/copy';
import { dayKey, whenLabel } from '@/components/crm/lead-desk/time';
import { ChannelChips, Dash, LeadNameCell, ScoreCell, StageBadge } from '@/components/crm/lead-desk/lists/cells';
import ConfirmDialog from '@/components/crm/lead-desk/lists/ConfirmDialog';
import { collectAllPages, downloadCsv, leadsToCsv } from '@/components/crm/lead-desk/lists/csv';
import { DateField, FilterSelect, PageHeader, SearchBox, fieldClass } from '@/components/crm/lead-desk/lists/FilterControls';
import { activeFilterCount, buildListFilter, EMPTY_FILTERS, type ListFilterState } from '@/components/crm/lead-desk/lists/filters';
import { ACTIVE_STAGES, explainLeadError, PAGE_SIZE, SOURCE_OPTIONS } from '@/components/crm/lead-desk/lists/labels';
import LeadCardSheet from '@/components/crm/lead-desk/lists/LeadCardSheet';
import LeadListTable, { type ListColumn } from '@/components/crm/lead-desk/lists/LeadListTable';
import { lastActionAt, nextActionText } from '@/components/crm/lead-desk/lists/rowFormat';
import { useDebouncedValue } from '@/components/crm/lead-desk/lists/useDebouncedValue';
import { useStaffNames } from '@/components/crm/lead-desk/lists/useStaffNames';

/**
 * Barcha lidlar (spec §3.3): the active leads as one dense table. Operators see
 * their own scope because the database filters the rows; seniors and the boss
 * can also reassign, pin and export.
 */
export default function AllLeadsContent() {
  const qc = useQueryClient();
  const { isLeadSenior, isAdmin } = useUserRole();
  const { staffList, nameOf } = useStaffNames();

  const [filters, setFilters] = useState<ListFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reassign, setReassign] = useState<{ row: LeadListRow; owner: string } | null>(null);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(filters.q, 300);
  const query = useMemo(() => buildListFilter({ ...filters, q: debouncedQ }, page), [filters, debouncedQ, page]);

  const list = useQuery({
    queryKey: ['lead-v2', 'list', 'all', query],
    queryFn: () => fetchAllLeads(query),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  // the filter shrank the list under the current page
  useEffect(() => {
    if (list.data && page > 0 && page * PAGE_SIZE >= list.data.total) {
      setPage(Math.max(0, Math.ceil(list.data.total / PAGE_SIZE) - 1));
    }
  }, [list.data, page]);

  const setFilter = (patch: Partial<ListFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['lead-v2', 'list'] });

  const togglePin = async (row: LeadListRow) => {
    try {
      await pinLead(row.id, !row.pinned_at);
      toast.success(row.pinned_at ? 'Pin olib tashlandi' : 'Lid pin qilindi');
      await refresh();
    } catch (e) {
      toast.error(explainLeadError(e));
    }
  };

  const submitReassign = async () => {
    if (!reassign) return;
    setReassignBusy(true);
    setReassignError(null);
    try {
      await reassignLead(reassign.row.id, reassign.owner || null);
      toast.success("Egasi o'zgartirildi");
      setReassign(null);
      await refresh();
    } catch (e) {
      setReassignError(explainLeadError(e));
    } finally {
      setReassignBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const base = buildListFilter(filters, 0);
      const { rows: all, total: t, truncated } = await collectAllPages((offset, limit) =>
        fetchAllLeads({ ...base, offset, limit }),
      );
      downloadCsv(`barcha-lidlar-${dayKey(new Date())}.csv`, leadsToCsv(all, { ownerName: nameOf }));
      if (truncated) toast.warning(`Eksport ${all.length} ta bilan cheklandi (jami ${t} ta). Filtrni toraytiring.`);
      else toast.success(`${all.length} ta lid eksport qilindi`);
    } catch (e) {
      toast.error(`Eksport bajarilmadi: ${explainLeadError(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const columns: ListColumn<LeadListRow>[] = [
    { key: 'name', header: 'Ism', className: 'min-w-[12rem] max-w-[16rem]', render: (r) => <LeadNameCell row={r} /> },
    { key: 'channels', header: 'Kanallar', className: 'w-24', render: (r) => <ChannelChips row={r} /> },
    { key: 'stage', header: 'Bosqich', className: 'w-24', render: (r) => <StageBadge stage={r.stage} /> },
    {
      key: 'owner',
      header: 'Egasi',
      className: 'w-28',
      render: (r) => (r.owner_id ? <span className="truncate">{nameOf(r.owner_id)}</span> : <span className="text-muted-foreground">Hovuz</span>),
    },
    { key: 'cert', header: 'Sertifikat', className: 'w-24', render: (r) => r.cert_level || <Dash /> },
    { key: 'goal', header: 'Maqsad', className: 'w-24', render: (r) => r.education_level || <Dash /> },
    { key: 'city', header: 'Viloyat', className: 'w-24', render: (r) => r.city || <Dash /> },
    {
      key: 'last',
      header: 'Oxirgi harakat',
      className: 'w-28 whitespace-nowrap',
      render: (r) => {
        const at = lastActionAt(r);
        return at ? whenLabel(at) : <Dash />;
      },
    },
    { key: 'next', header: 'Keyingi harakat', className: 'w-40 whitespace-nowrap', render: (r) => nextActionText(r) },
    { key: 'score', header: 'Ball', className: 'w-24', render: (r) => <ScoreCell score={r.priority_score} /> },
  ];

  if (isLeadSenior) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-20 whitespace-nowrap text-right',
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={`Egasini o'zgartirish: ${r.full_name}`}
            title="Egasini o'zgartirish"
            onClick={(e) => {
              e.stopPropagation();
              setReassignError(null);
              setReassign({ row: r, owner: r.owner_id ?? '' });
            }}
          >
            <UserCog className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={r.pinned_at ? `Pinni olib tashlash: ${r.full_name}` : `Pin qilish: ${r.full_name}`}
            title={r.pinned_at ? 'Pinni olib tashlash' : 'Pin qilish (Ish stolida tepaga chiqadi)'}
            onClick={(e) => {
              e.stopPropagation();
              void togglePin(r);
            }}
          >
            {r.pinned_at ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
        </div>
      ),
    });
  }

  const filtersOn = activeFilterCount(filters) > 0 || filters.q !== '';
  const errorText = list.error ? explainLeadError(list.error) : null;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Barcha lidlar"
        description="Faol lidlar (Talaba va Yo'qotilganlar alohida sahifalarda). Operator o'z lidlarini va hovuzni ko'radi; senior va rahbar hammasini."
      >
        {/* Export is the boss's (spec §13: "Rahbar / admin ... eksport"); a senior reassigns and pins. */}
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => void exportCsv()} disabled={exporting || total === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? 'Eksport…' : 'Eksport'}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-end gap-2">
        <SearchBox
          label="Lidlarni qidirish"
          placeholder="Ism, telefon yoki @username"
          value={filters.q}
          onChange={(q) => setFilter({ q })}
          className="w-64"
        />
        <FilterSelect
          label="Bosqich"
          value={filters.stage}
          onChange={(v) => setFilter({ stage: v as ListFilterState['stage'] })}
          options={ACTIVE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
        />
        <FilterSelect label="Manba" value={filters.source} onChange={(source) => setFilter({ source })} options={SOURCE_OPTIONS} />
        <FilterSelect
          label="Egasi"
          value={filters.owner}
          onChange={(owner) => setFilter({ owner })}
          options={[{ value: 'none', label: 'Hovuz (egasiz)' }, ...staffList.map((s) => ({ value: s.user_id, label: s.full_name }))]}
        />
        <FilterSelect label="Viloyat" value={filters.city} onChange={(city) => setFilter({ city })} options={REGIONS.map((r) => ({ value: r, label: r }))} />
        <FilterSelect label="Sertifikat" value={filters.cert} onChange={(cert) => setFilter({ cert })} options={CERTIFICATES.map((c) => ({ value: c, label: c }))} />
        <DateField label="Kelgan sana: dan" value={filters.fromDay} onChange={(fromDay) => setFilter({ fromDay })} />
        <DateField label="gacha" value={filters.toDay} onChange={(toDay) => setFilter({ toDay })} />
        {filtersOn && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setFilter(EMPTY_FILTERS)}>
            Tozalash
          </Button>
        )}
      </div>

      <LeadListTable
        ariaLabel="Barcha lidlar"
        rows={rows}
        columns={columns}
        loading={list.isLoading}
        fetching={list.isFetching && !list.isLoading}
        error={errorText}
        onRetry={() => void list.refetch()}
        emptyTitle={filtersOn ? 'Filtrga mos lid topilmadi' : "Faol lid yo'q"}
        emptyHint={filtersOn ? "Filtrni o'zgartiring yoki tozalang." : "Yangi lidlar Ish stolida ko'rinadi, ular shu yerga ham tushadi."}
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
        open={reassign != null}
        title="Egasini o'zgartirish"
        description={reassign ? `${reassign.row.full_name}: yangi egasini tanlang. «Hovuz» — egasiz qoldirish.` : undefined}
        confirmLabel="Saqlash"
        busy={reassignBusy}
        error={reassignError}
        onConfirm={() => void submitReassign()}
        onCancel={() => setReassign(null)}
      >
        {reassign && (
          <label className="flex flex-col gap-1 text-sm">
            Egasi
            <select
              className={fieldClass + ' h-9'}
              value={reassign.owner}
              onChange={(e) => setReassign({ ...reassign, owner: e.target.value })}
            >
              <option value="">Hovuz (egasiz)</option>
              {staffList.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
}
