import { FUNNEL_STEPS, bandLabel, channelName, money, perOne, periodLabel, segSummary, type Cohort, type Marketing } from './marketing';

/**
 * The Marketing panel to a file (S8: Excel and CSV). Excel: one sheet per
 * block, the way the page shows them; CSV: the three numbers and the channel
 * table. write-excel-file loads only when someone presses the button (as the
 * students list does).
 */
type T = (k: string, o?: Record<string, unknown>) => string;
type Cell = string | number | null | { value: string | number | null; fontWeight?: 'bold' };

function fileName(data: Marketing, t: T, ext: string): string {
  return `${t('marketing.fileName')} ${periodLabel(data.from, data.to)}.${ext}`;
}

function kpiRows(data: Marketing, prev: Marketing | null, t: T): Cell[][] {
  const k = data.kpi;
  const p = prev?.kpi;
  return [
    [t('marketing.kpi.newActive'), k.new_devices, p?.new_devices ?? null],
    [t('marketing.kpi.activeOnly'), k.new_active, p?.new_active ?? null],
    [t('marketing.kpi.requests'), k.requests, p?.requests ?? null],
    [t('marketing.kpi.requestsFormOnly'), k.requests_form, p?.requests_form ?? null],
    [t('marketing.kpi.requestsTelegramOnly'), k.requests_telegram, p?.requests_telegram ?? null],
    [t('marketing.kpi.newLeads'), k.new_leads, p?.new_leads ?? null],
    [t('marketing.kpi.contracts'), k.app_contracts, p?.app_contracts ?? null],
    [t('marketing.kpi.allContracts'), k.contracts, p?.contracts ?? null],
  ];
}

function channelRows(data: Marketing, names: Record<string, string>, t: T): Cell[][] {
  return data.channels.map((c) => [
    channelName(c.key, names, t),
    c.new_devices,
    c.active,
    c.requests,
    c.contracts,
    money(c.spend) ?? '',
    perOne(c.spend, c.requests) ?? '',
  ]);
}

const bold = (value: string): Cell => ({ value, fontWeight: 'bold' });

export async function exportXlsx(
  data: Marketing,
  prev: Marketing | null,
  names: Record<string, string>,
  cohorts: Cohort[],
  t: T,
) {
  try {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const period = periodLabel(data.from, data.to);
    const prevLabel = prev ? periodLabel(prev.from, prev.to) : '';
    const funnelKeys = ['all', ...data.channels.map((c) => c.key).filter((k) => data.funnel[k])];
    const sheets = [
      {
        sheet: t('marketing.sheets.kpi'),
        data: [
          [bold(t('marketing.sheets.metric')), bold(period), bold(prevLabel)],
          ...kpiRows(data, prev, t),
          [t('marketing.seg.keys.title'), segSummary(data.seg ?? {}, names, t) || t('marketing.seg.everyone'), ''],
        ],
        columns: [{ width: 40 }, { width: 14 }, { width: 14 }],
      },
      {
        sheet: t('marketing.sheets.channels'),
        data: [
          [
            t('marketing.cols.channel'),
            t('marketing.cols.newDevices'),
            t('marketing.cols.active'),
            t('marketing.cols.requests'),
            t('marketing.cols.contracts'),
            t('marketing.cols.spend'),
            t('marketing.cols.perRequest'),
          ].map(bold),
          ...channelRows(data, names, t),
        ],
        columns: [{ width: 32 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 16 }],
      },
      {
        sheet: t('marketing.blocks.funnel'),
        data: [
          [bold(t('marketing.sheets.step')), ...funnelKeys.map((k) => bold(k === 'all' ? t('marketing.allChannels') : channelName(k, names, t)))],
          ...FUNNEL_STEPS.map((s, i) => [t(`marketing.steps.${s}`), ...funnelKeys.map((k) => data.funnel[k]?.[i] ?? 0)]),
        ],
        columns: [{ width: 24 }, ...funnelKeys.map(() => ({ width: 14 }))],
      },
      {
        sheet: t('marketing.blocks.demand'),
        data: [
          [bold(t('marketing.sheets.what')), bold(t('marketing.sheets.value')), bold(t('marketing.demand.devices'))],
          ...data.demand.filters.map((f) => [t(`marketing.demand.${f.field}`, { defaultValue: f.field }), f.value, f.devices]),
          ...data.demand.answers.map((a) => [t(`marketing.questions.${a.q}`, { defaultValue: a.q }), bandLabel(a.q, a.band, t), a.devices]),
          ...data.demand.universities.map((u) => [t('marketing.demand.university'), u.name_en || u.name_ko || u.institution_id, u.devices]),
        ],
        columns: [{ width: 28 }, { width: 36 }, { width: 12 }],
      },
      {
        sheet: t('marketing.blocks.stops'),
        data: [
          [bold(t('marketing.sheets.what')), bold(t('marketing.sheets.value'))],
          [t('marketing.sheets.languageExits'), data.stops.language_exits],
          [t('marketing.sheets.clientCodeSeen'), data.stops.client_code_seen],
          [t('marketing.sheets.clientCodeLeft'), data.stops.client_code_left],
          ...data.stops.locked_tabs.map((x) => [t('marketing.sheets.locked', { tab: x.tab }), x.devices]),
          [t('marketing.sheets.formOpened'), data.stops.lead_form.opened],
          [t('marketing.sheets.formErrors'), data.stops.lead_form.field_error],
          [t('marketing.sheets.formSent'), data.stops.lead_form.submitted],
          ...data.stops.exit_screens.map((x) => [t('marketing.sheets.exitScreen', { screen: x.screen }), x.sessions]),
        ],
        columns: [{ width: 44 }, { width: 12 }],
      },
      {
        sheet: t('marketing.blocks.return'),
        data: [
          [t('marketing.return.week'), t('marketing.return.devices'), t('marketing.return.d1'), t('marketing.return.d7'), t('marketing.return.d30')].map(bold),
          ...cohorts.map((c) => [c.week, c.devices, c.d1, c.d7, c.d30]),
        ],
        columns: [{ width: 14 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 14 }],
      },
      {
        sheet: t('marketing.blocks.spend'),
        data: [
          [t('marketing.spend.week'), t('marketing.cols.channel'), t('marketing.spend.amount'), t('marketing.spend.currency'), t('marketing.spend.comment')].map(bold),
          ...data.spend.map((r) => [r.week, channelName(r.channel, names, t), Number(r.amount), r.currency, r.note ?? '']),
        ],
        columns: [{ width: 14 }, { width: 30 }, { width: 14 }, { width: 10 }, { width: 30 }],
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (writeXlsxFile as any)(sheets).toFile(fileName(data, t, 'xlsx'));
  } catch (err) {
    console.error('marketing export failed', err);
    const { toast } = await import('sonner');
    toast.error(t('marketing.exportFailed'));
  }
}

function csvCell(v: Cell): string {
  const raw = v && typeof v === 'object' ? v.value : v;
  const s = raw == null ? '' : String(raw);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The three numbers and the channel table, as CSV (UTF-8 with BOM, so Excel reads it). */
export function buildCsv(data: Marketing, names: Record<string, string>, t: T): string {
  const rows: Cell[][] = [
    [t('marketing.sheets.metric'), periodLabel(data.from, data.to)],
    ...kpiRows(data, null, t).map((r) => r.slice(0, 2)),
    [t('marketing.seg.keys.title'), segSummary(data.seg ?? {}, names, t) || t('marketing.seg.everyone')],
    [],
    [
      t('marketing.cols.channel'),
      t('marketing.cols.newDevices'),
      t('marketing.cols.active'),
      t('marketing.cols.requests'),
      t('marketing.cols.contracts'),
      t('marketing.cols.spend'),
      t('marketing.cols.perRequest'),
    ],
    ...channelRows(data, names, t),
  ];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function exportCsv(data: Marketing, names: Record<string, string>, t: T) {
  const blob = new Blob([buildCsv(data, names, t)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(data, t, 'csv');
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
