import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { fetchBazaLeads, type LeadListRow } from '@/components/crm/lead-desk/api';
import { CERTIFICATES, REGIONS, STAGE_LABEL } from '@/components/crm/lead-desk/copy';
import { whenLabel } from '@/components/crm/lead-desk/time';
import { ChannelChips, Dash, LeadNameCell, StageBadge } from '@/components/crm/lead-desk/lists/cells';
import { Button } from '@/components/ui/button';
import { DateField, FilterSelect, PageHeader, SearchBox } from '@/components/crm/lead-desk/lists/FilterControls';
import { activeFilterCount, buildListFilter, EMPTY_FILTERS, type ListFilterState } from '@/components/crm/lead-desk/lists/filters';
import { BAZA_STAGES, explainLeadError, PAGE_SIZE } from '@/components/crm/lead-desk/lists/labels';
import LeadCardSheet from '@/components/crm/lead-desk/lists/LeadCardSheet';
import LeadListTable, { type ListColumn } from '@/components/crm/lead-desk/lists/LeadListTable';
import { lastActionAt, truncate } from '@/components/crm/lead-desk/lists/rowFormat';
import { queueStatusText, useQueueStatus } from '@/components/crm/lead-desk/lists/useQueueStatus';
import { useDebouncedValue } from '@/components/crm/lead-desk/lists/useDebouncedValue';

const SUMMARY_CHARS = 140;

/**
 * Baza (eski CRM) (spec §3.6 / §16): every lead of the old CRM with its 05.10
 * analysis and the old call result. Read-only: nothing here edits a lead.
 */
export default function LeadBazaContent() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<ListFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const debouncedQ = useDebouncedValue(filters.q, 300);
  const query = useMemo(() => buildListFilter({ ...filters, q: debouncedQ }, page), [filters, debouncedQ, page]);

  const list = useQuery({
    queryKey: ['lead-v2', 'list', 'baza', query],
    queryFn: () => fetchBazaLeads(query),
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(() => list.data?.rows ?? [], [list.data]);
  const total = list.data?.total ?? 0;

  useEffect(() => {
    if (list.data && page > 0 && page * PAGE_SIZE >= list.data.total) {
      setPage(Math.max(0, Math.ceil(list.data.total / PAGE_SIZE) - 1));
    }
  }, [list.data, page]);

  const lostIds = useMemo(() => rows.filter((r) => r.stage === 'lost').map((r) => r.id), [rows]);
  const queues = useQueueStatus(lostIds);

  const setFilter = (patch: Partial<ListFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns: ListColumn<LeadListRow>[] = [
    { key: 'name', header: 'Ism', className: 'min-w-[11rem] max-w-[14rem]', render: (r) => <LeadNameCell row={r} /> },
    { key: 'channels', header: 'Kanallar', className: 'w-24', render: (r) => <ChannelChips row={r} /> },
    { key: 'stage', header: 'Bosqich', className: 'w-24', render: (r) => <StageBadge stage={r.stage} /> },
    { key: 'call', header: "Eski qo'ng'iroq natijasi", className: 'w-36', render: (r) => r.call_result || <Dash /> },
    {
      key: 'summary',
      header: '05.10 tahlili',
      className: 'min-w-[20rem] max-w-[34rem]',
      render: (r) => {
        const text = (r.ai_summary ?? '').trim();
        if (!text) return <Dash />;
        const long = text.length > SUMMARY_CHARS;
        const open = expanded.has(r.id);
        return (
          <div>
            <p className={open ? 'whitespace-pre-wrap' : undefined}>{open || !long ? text : truncate(text, SUMMARY_CHARS)}</p>
            {long && (
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? `Tahlilni yig'ish: ${r.full_name}` : `Tahlilni to'liq ko'rsatish: ${r.full_name}`}
                className="text-[12px] text-primary underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(r.id);
                }}
              >
                {open ? 'Kamroq' : "Ko'proq"}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'last',
      header: 'Oxirgi aloqa',
      className: 'w-28 whitespace-nowrap',
      render: (r) => {
        const at = lastActionAt(r);
        return at ? whenLabel(at) : <Dash />;
      },
    },
    {
      key: 'queue',
      header: 'Navbatga',
      className: 'w-40',
      render: (r) => {
        if (r.stage !== 'lost') return <Dash />;
        const text = queueStatusText(queues.byLead[r.id]);
        return text ? <span>{text}</span> : <span className="text-muted-foreground">Navbatda emas</span>;
      },
    },
  ];

  const filtersOn = activeFilterCount(filters) > 0 || filters.q !== '';

  return (
    <div className="space-y-3">
      <PageHeader title="Baza (eski CRM)" description="Eski CRMdagi barcha lidlar, 05.10 tahlillari bilan. Faqat o'qish uchun." />

      <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-[13px]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>Eski CRM lidlari Ish stoliga tushmaydi; mijoz yana yozsa karta HOZIR'ga chiqadi.</span>
      </p>

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
          options={BAZA_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
        />
        <FilterSelect label="Viloyat" value={filters.city} onChange={(city) => setFilter({ city })} options={REGIONS.map((r) => ({ value: r, label: r }))} />
        <FilterSelect label="Sertifikat" value={filters.cert} onChange={(cert) => setFilter({ cert })} options={CERTIFICATES.map((c) => ({ value: c, label: c }))} />
        <DateField label="Yaratilgan: dan" value={filters.fromDay} onChange={(fromDay) => setFilter({ fromDay })} />
        <DateField label="gacha" value={filters.toDay} onChange={(toDay) => setFilter({ toDay })} />
        {filtersOn && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setFilter(EMPTY_FILTERS)}>
            Tozalash
          </Button>
        )}
      </div>

      <LeadListTable
        ariaLabel="Baza"
        rows={rows}
        columns={columns}
        loading={list.isLoading}
        fetching={list.isFetching && !list.isLoading}
        error={list.error ? explainLeadError(list.error) : null}
        onRetry={() => void list.refetch()}
        emptyTitle={filtersOn ? 'Filtrga mos lid topilmadi' : "Bazada lid yo'q"}
        emptyHint={filtersOn ? "Filtrni o'zgartiring yoki tozalang." : "Eski CRM lidlari migratsiyadan keyin shu yerda ko'rinadi."}
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
          void qc.invalidateQueries({ queryKey: ['lead-v2', 'list'] });
        }}
      />
    </div>
  );
}
