import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchReport } from '@/components/crm/lead-desk/api';
import { useLeadSettings } from '@/components/crm/lead-desk/useLeadSettings';
import { DateField, FilterSelect, PageHeader } from '@/components/crm/lead-desk/lists/FilterControls';
import { explainLeadError, sourceLabel } from '@/components/crm/lead-desk/lists/labels';
import LeadCardSheet from '@/components/crm/lead-desk/lists/LeadCardSheet';
import PromisesPanel from '@/components/crm/lead-desk/lists/PromisesPanel';
import {
  AdTable,
  Empty,
  FunnelTable,
  GenerationCompare,
  LostBars,
  OperatorBars,
  Panel,
  Tile,
} from '@/components/crm/lead-desk/lists/ReportParts';
import {
  PERIOD_LABEL,
  adRows,
  controlLine,
  formatPct,
  funnelRows,
  funnelTotal,
  generationCompare,
  headlineTiles,
  lostShares,
  periodRange,
  type PeriodKind,
} from '@/components/crm/lead-desk/lists/reportMath';
import { loadSpend, saveSpend } from '@/components/crm/lead-desk/lists/spendStore';
import { useStaffNames } from '@/components/crm/lead-desk/lists/useStaffNames';
import { cn } from '@/lib/utils';

const PERIODS: PeriodKind[] = ['today', 'yesterday', '7d', '30d', 'custom'];

/**
 * Hisobot (spec §3.5 / §14): results only — contracts, the funnel by source,
 * ads, lost reasons, operators, old vs new. Calls are not counted as a KPI.
 */
export default function LeadReportContent() {
  const { isLeadSenior, isAdmin, loading: roleLoading } = useUserRole();
  const { settings } = useLeadSettings();
  const { nameOf } = useStaffNames();

  const [kind, setKind] = useState<PeriodKind>('7d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [source, setSource] = useState('');
  const [operator, setOperator] = useState('');
  const [spend, setSpend] = useState<Record<string, number>>(() => loadSpend());
  const [openId, setOpenId] = useState<string | null>(null);

  const range = useMemo(() => periodRange(kind, new Date(), custom), [kind, custom]);

  const report = useQuery({
    queryKey: ['lead-v2', 'report', range.from, range.to],
    queryFn: () => fetchReport(range.from, range.to),
    enabled: isLeadSenior,
    staleTime: 60_000,
  });

  const setSpendValue = (key: string, value: number | null) => {
    const next = { ...spend };
    if (value == null) delete next[key];
    else next[key] = value;
    setSpend(next);
    saveSpend(next);
  };

  if (roleLoading) return <Skeleton className="h-40 w-full" />;
  if (!isLeadSenior) {
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-md border bg-muted/40 px-4 py-6 text-center text-sm">
        Hisobot faqat senior operator va rahbar uchun.
      </div>
    );
  }

  const data = report.data;
  const labelOfReason = (key: string) => settings.lost_reasons.find((r) => r.key === key)?.label ?? key;

  const sources = data ? data.by_source.map((s) => s.source) : [];
  const operators = data ? data.by_operator : [];
  const operatorRows = operators
    .filter((o) => !operator || o.operator_id === operator)
    .map((o) => ({ id: o.operator_id, name: nameOf(o.operator_id) ?? "Noma'lum", students: Number(o.students) || 0 }));

  const tiles = data ? headlineTiles(data, source) : null;
  const funnel = data ? funnelRows(data, source) : [];
  const gens = data ? generationCompare(data) : null;
  const control = data ? controlLine(data) : null;

  return (
    <div className="space-y-3">
      <PageHeader title="Hisobot" description="Faqat natija ko'rsatkichlari: shartnomalar, manba va reklama bo'yicha konversiya, yo'qotish sabablari." />

      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Davr" className="flex overflow-hidden rounded-md border">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={kind === p}
              onClick={() => setKind(p)}
              className={cn(
                'h-8 border-r px-3 text-[13px] last:border-r-0',
                kind === p ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        {kind === 'custom' && (
          <>
            <DateField label="Boshlanish" value={custom.from} onChange={(from) => setCustom((c) => ({ ...c, from }))} />
            <DateField label="Tugash" value={custom.to} onChange={(to) => setCustom((c) => ({ ...c, to }))} />
          </>
        )}
        <span className="pb-1.5 text-[12px] text-muted-foreground tabular-nums">
          {range.from === range.to ? range.from : `${range.from} — ${range.to}`}
        </span>
        <FilterSelect
          label="Manba"
          value={source}
          onChange={setSource}
          allLabel="Barcha manbalar"
          options={sources.map((s) => ({ value: s, label: sourceLabel(s) }))}
        />
        <FilterSelect
          label="Operator"
          value={operator}
          onChange={setOperator}
          allLabel="Barcha operatorlar"
          options={operators.map((o) => ({ value: o.operator_id, label: nameOf(o.operator_id) ?? o.operator_id }))}
        />
      </div>

      {report.isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : report.error ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium">Hisobotni yuklab bo'lmadi</p>
          <p className="text-[13px] text-muted-foreground">{explainLeadError(report.error)}</p>
          <Button size="sm" variant="outline" onClick={() => void report.refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : data && tiles && gens && control ? (
        <>
          <div className={cn('grid grid-cols-2 gap-3 xl:grid-cols-4', report.isFetching && 'opacity-70')}>
            <Tile label="Shartnomalar" value={tiles.students} sub={`Konversiya: ${formatPct(tiles.conversion, 1)}`} strong />
            <Tile label="Taklif" value={tiles.offers} />
            <Tile label="Gaplashildi" value={tiles.talked} sub="mijozlar soni (qo'ng'iroqlar emas)" />
            <Tile label="Lidlar" value={tiles.leads} />
          </div>
          {tiles.scoped && (
            <p className="text-[12px] text-muted-foreground">
              «{sourceLabel(source)}» manbasi: shu davrda kelgan lidlar va ularning natijasi. Manbasiz davr hisobi bilan farq qilishi mumkin.
            </p>
          )}

          <Panel title="Konversiya voronkasi manba bo'yicha" hint="lid → javob → gaplashildi → taklif → shartnoma (soni va lidga nisbatan %)">
            <FunnelTable rows={funnel} total={funnelTotal(funnel)} sourceLabel={sourceLabel} />
          </Panel>

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Reklama samarasi" hint="Har reklama / forma uchun lid → shartnoma. Sarfni o'zingiz kiriting.">
              <AdTable rows={adRows(data, spend, range.from, range.to)} from={range.from} to={range.to} onSpend={setSpendValue} />
            </Panel>

            <div className="space-y-3">
              <Panel title="Yo'qotish sabablari" hint="Shu davrda yo'qotilgan lidlar ulushi">
                <LostBars shares={lostShares(data, labelOfReason)} />
              </Panel>
              <Panel title="Operatorlar" hint="Shartnomalar (talabaga o'tgan lidlar) operator bo'yicha">
                <OperatorBars rows={operatorRows} />
              </Panel>
            </div>
          </div>

          <Panel title="Eski vs yangi" hint="Eski CRM lidlari va yangi tizim lidlari yonma-yon (shu davrda yaratilganlar)">
            {data.generation.length === 0 ? <Empty>Bu davrda lid yo'q</Empty> : <GenerationCompare old={gens.old} current={gens.new} />}
          </Panel>

          {settings.control_line_10min && (
            <section
              aria-label="Nazorat chizig'i"
              className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2.5"
            >
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Nazorat chizig'i (KPI emas)</h2>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-[13px]">10 daqiqa ichida javob %</span>
                <span className="text-xl font-semibold tabular-nums" data-testid="control-line">
                  {formatPct(control.pct, 0)}
                </span>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {control.answeredIn10} / {control.leads} lid
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Faqat rahbar va senior ko'radi; operatorlarning ko'rsatkichi emas. Butun davr bo'yicha (manba filtri ta'sir qilmaydi).
              </p>
            </section>
          )}
        </>
      ) : null}

      {isAdmin && <PromisesPanel onOpenLead={setOpenId} />}

      <LeadCardSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
