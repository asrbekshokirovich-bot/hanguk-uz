// ---------------------------------------------------------------------------
// investor-export
//
// The four server-side exports the investor portal offers:
//
//   pnl-pdf            -> hanguk-pnl-2027-spring.pdf
//   pnl-xlsx           -> hanguk-pnl-2027-spring.xlsx
//   applications-xlsx  -> hanguk-applications-2027-spring.xlsx
//   season-report-pdf  -> hanguk-season-report-2027-spring.pdf
//
// SECURITY. This function never uses the service-role key. It builds a client
// from the anon key with the caller's own Authorization header attached, so
// every query runs as auth.uid() and RLS decides what comes back. That matters
// more here than anywhere else in the portal: an export is exactly the shape
// of bug that quietly turns into a data leak. The function reads only the
// v_investor_* views and investor_payouts, all of which self-gate on
// investor_can_view_intake(); it never touches documents, storage, or student
// records. A staff member calling this endpoint gets 403, not a spreadsheet.
// ---------------------------------------------------------------------------

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { INK, INK_MUTED, LINE, Pdf, ROYAL, TINT, WHITE } from './pdf.ts';
import { buildXlsx, type CellValue, type Sheet } from './xlsx.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-disposition',
};

type Kind = 'pnl-pdf' | 'pnl-xlsx' | 'applications-xlsx' | 'season-report-pdf';
const KINDS: Kind[] = ['pnl-pdf', 'pnl-xlsx', 'applications-xlsx', 'season-report-pdf'];

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

/* ---------------------------------------------------------------- formatting */

const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v: unknown) => GROUPED.format(Math.round(num(v)));

const pct = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '-';
};

const isoDate = (v: unknown): string =>
  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const monthLabel = (v: unknown): string => {
  const s = isoDate(v);
  if (!s) return '';
  const [y, m] = s.split('-');
  const i = Number(m) - 1;
  return MONTHS[i] ? `${MONTHS[i]} ${y}` : s;
};

/** payments.payment_type slugs are not written for a human to read. */
const humanizeLineItem = (slug: unknown): string => {
  const s = String(slug ?? '').trim();
  if (!s) return 'Unspecified';
  if (s === 'other') return 'Other income';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const titleCase = (s: unknown) =>
  String(s ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || '-';

/* --------------------------------------------------------------------- data */

interface Season {
  intake_id: string;
  season: string;
  year: number;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
}

interface Bundle {
  season: Season;
  slug: string;
  investorName: string;
  equity: number | null;
  position: any[];
  pnl: any[];
  monthly: any[];
  funnel: any[];
  applications: any[];
  payouts: any[];
  generatedAt: string;
}

const HEADLINE = 'UZS';

/** Currencies present in a result set, headline first. */
function currencies(rows: any[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.currency) set.add(String(r.currency));
  const all = [...set];
  return all.sort((a, b) => (a === HEADLINE ? -1 : b === HEADLINE ? 1 : a.localeCompare(b)));
}

async function load(client: any, intakeId: string | null): Promise<Bundle> {
  const { data: intakes, error: intakeErr } = await client
    .from('v_investor_intakes')
    .select('*')
    .order('sort_key', { ascending: false });
  if (intakeErr) throw new Error(`intakes: ${intakeErr.message}`);
  if (!intakes || intakes.length === 0) throw new Error('NO_SEASONS');

  const season: Season =
    (intakeId && intakes.find((i: any) => i.intake_id === intakeId)) ??
    intakes.find((i: any) => i.is_default) ??
    intakes[0];

  const id = season.intake_id;

  const [position, pnl, monthly, funnel, applications, payouts] = await Promise.all([
    client.from('v_investor_position').select('*').eq('intake_id', id),
    client.from('v_investor_season_pnl').select('*').eq('intake_id', id),
    client.from('v_investor_season_monthly').select('*').eq('intake_id', id).order('month'),
    client.from('v_investor_season_funnel').select('*').eq('intake_id', id).order('stage_order'),
    client
      .from('v_investor_applications')
      .select('*')
      .eq('intake_id', id)
      .order('updated_at', { ascending: false }),
    client.from('investor_payouts').select('*').order('due_date', { ascending: false }),
  ]);

  for (const r of [position, pnl, monthly, funnel, applications, payouts]) {
    if (r.error) throw new Error(r.error.message);
  }

  const pos = position.data ?? [];
  const headline = pos.find((p: any) => p.currency === HEADLINE) ?? pos[0] ?? null;

  return {
    season,
    slug: `${season.year}-${String(season.season ?? '').toLowerCase()}`,
    investorName: headline?.full_name ?? 'Investor',
    equity: headline?.equity_percent != null ? Number(headline.equity_percent) : null,
    position: pos,
    pnl: pnl.data ?? [],
    monthly: monthly.data ?? [],
    funnel: funnel.data ?? [],
    applications: applications.data ?? [],
    payouts: payouts.data ?? [],
    generatedAt: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------- pdf shared */

function header(doc: Pdf, title: string, b: Bundle): void {
  doc.rect(0, 841.89 - 96, 595.28, 96, ROYAL);
  doc.y = 841.89 - 46;
  doc.text('HANGUK CONSULTING', doc.x0, 9, { face: 'sans-bold', colour: { r: 0.62, g: 0.72, b: 0.86 } });
  doc.down(22);
  doc.text(title, doc.x0, 22, { face: 'sans-bold', colour: WHITE });
  doc.down(16);
  doc.text(`${b.season.label} intake`, doc.x0, 11, {
    colour: { r: 0.78, g: 0.84, b: 0.93 },
  });
  doc.y = 841.89 - 96 - 30;
  doc.text(
    `Prepared for ${b.investorName}${b.equity != null ? `, ${b.equity}% equity` : ''}`,
    doc.x0,
    10,
    { colour: INK_MUTED },
  );
  doc.text(b.generatedAt.slice(0, 10), doc.x1, 10, {
    face: 'mono',
    align: 'right',
    colour: INK_MUTED,
  });
  doc.down(14);
  doc.rule();
  doc.down(24);
}

function sectionTitle(doc: Pdf, s: string): void {
  doc.ensure(60);
  doc.text(s, doc.x0, 13, { face: 'sans-bold' });
  doc.down(16);
}

/** A row of label + right-aligned mono columns. */
function row(
  doc: Pdf,
  label: string,
  cols: string[],
  opts: { bold?: boolean; tint?: boolean; muted?: boolean } = {},
): void {
  doc.ensure(20);
  const stops = [doc.x1 - 90, doc.x1];
  const use = cols.length === 1 ? [doc.x1] : stops;
  if (opts.tint) doc.rect(doc.x0, doc.y - 6, doc.width, 20, TINT);
  doc.text(label, doc.x0 + (opts.tint ? 8 : 0), 10, {
    face: opts.bold ? 'sans-bold' : 'sans',
    colour: opts.muted ? INK_MUTED : INK,
  });
  cols.forEach((c, i) => {
    doc.text(c, (use[i] ?? doc.x1) - (opts.tint ? 8 : 0), 10, {
      face: opts.bold ? 'mono-bold' : 'mono',
      align: 'right',
      colour: opts.muted ? INK_MUTED : INK,
    });
  });
  doc.down(18);
}

function footNote(doc: Pdf, lines: string[]): void {
  doc.ensure(24 + lines.length * 12);
  doc.down(10);
  doc.rule();
  doc.down(14);
  for (const l of lines) {
    doc.text(l, doc.x0, 8.5, { colour: INK_MUTED });
    doc.down(11);
  }
}

/* ------------------------------------------------------------------ P&L PDF */

function pnlPdf(b: Bundle): Uint8Array {
  const doc = new Pdf(`Hanguk P&L ${b.season.label}`);
  header(doc, 'Profit & Loss', b);

  const list = currencies(b.pnl);
  if (list.length === 0) {
    doc.text('No income or expenses have been recorded for this season yet.', doc.x0, 11, {
      colour: INK_MUTED,
    });
    doc.down(18);
  }

  for (const cur of list) {
    const rows = b.pnl.filter((r) => r.currency === cur);
    // v_investor_season_pnl emits side='revenue' (not 'income') — see the
    // matching UI filter in InvestorFinance.tsx.
    const income = rows.filter((r) => r.side === 'revenue');
    const expense = rows.filter((r) => r.side === 'expense');
    // Informational only: the gap between a discounted student's undiscounted
    // plan price and the price actually contracted. Revenue above is already
    // the discounted (net) amount actually collected, so this line never
    // feeds into revenue/expense/net — it only explains why revenue per
    // student can read below the published plan price.
    const discount = rows.filter((r) => r.side === 'discount');
    const revenue = income.reduce((n, r) => n + num(r.amount), 0);
    const spend = expense.reduce((n, r) => n + num(r.amount), 0);
    const discountGiven = discount.reduce((n, r) => n + num(r.amount), 0);

    sectionTitle(doc, cur);
    row(doc, 'Line item', [`Amount (${cur})`, '% of rev'], { muted: true });
    doc.rule();
    doc.down(16);

    row(doc, 'Income', [], { bold: true });
    if (income.length === 0) row(doc, 'Nothing recorded', ['-', '-'], { muted: true });
    for (const r of income) {
      row(doc, humanizeLineItem(r.line_item), [money(r.amount), pct(r.pct_of_revenue)]);
    }
    row(doc, 'Total revenue', [money(revenue), '100.0%'], { bold: true });
    doc.down(8);

    if (discountGiven > 0) {
      row(doc, 'Discounts given (informational, not deducted from revenue)', [], { bold: true });
      for (const r of discount) {
        row(doc, humanizeLineItem(r.line_item), [money(r.amount), pct(r.pct_of_revenue)]);
      }
      doc.down(8);
    }

    row(doc, 'Expenses', [], { bold: true });
    if (expense.length === 0) {
      row(doc, 'No expenses booked against this season', ['-', '-'], { muted: true });
    }
    for (const r of expense) {
      row(doc, humanizeLineItem(r.line_item), [money(r.amount), pct(r.pct_of_revenue)]);
    }
    row(doc, 'Total expenses', [money(spend), revenue ? pct((spend * 100) / revenue) : '-'], {
      bold: true,
    });
    doc.down(8);

    const net = revenue - spend;
    row(doc, 'Net profit', [money(net), revenue ? pct((net * 100) / revenue) : '-'], {
      bold: true,
      tint: true,
    });
    doc.down(18);

    const share = b.position.find((p) => p.currency === cur);
    if (share && b.equity != null) {
      row(
        doc,
        `Your ${b.equity}% share of ${cur} net profit`,
        [money(share.profit_share), ''],
        { bold: true },
      );
      doc.down(10);
    }
  }

  if (b.monthly.length > 0) {
    doc.down(10);
    sectionTitle(doc, 'Month by month');
    row(doc, 'Month', ['Revenue', 'Net'], { muted: true });
    doc.rule();
    doc.down(16);
    for (const m of b.monthly.filter((r) => r.currency === HEADLINE)) {
      row(doc, `${monthLabel(m.month)}  ${HEADLINE}`, [money(m.revenue), money(m.net)]);
    }
    const others = b.monthly.filter((r) => r.currency !== HEADLINE);
    for (const m of others) {
      row(doc, `${monthLabel(m.month)}  ${m.currency}`, [money(m.revenue), money(m.net)]);
    }
  }

  footNote(doc, [
    'Currencies are reported separately and never summed; no exchange rate is held in the CRM.',
    'Read-only investor export. Student documents and personal files are not included.',
  ]);
  return doc.build();
}

/* -------------------------------------------------------- Season report PDF */

function seasonReportPdf(b: Bundle): Uint8Array {
  const doc = new Pdf(`Hanguk Season Report ${b.season.label}`);
  header(doc, 'Season Report', b);

  const headline = b.position.find((p) => p.currency === HEADLINE) ?? b.position[0] ?? null;
  sectionTitle(doc, 'Headline');
  if (!headline) {
    row(doc, 'Nothing has been recorded for this season yet', ['-'], { muted: true });
  } else {
    row(doc, `Revenue (${headline.currency})`, [money(headline.season_revenue)]);
    if (num(headline.season_discounts_given) > 0) {
      row(doc, `Discounts given (${headline.currency}, informational)`, [
        money(headline.season_discounts_given),
      ], { muted: true });
    }
    row(doc, `Expenses (${headline.currency})`, [money(headline.season_expenses)]);
    row(doc, `Net profit (${headline.currency})`, [money(headline.season_net_profit)], {
      bold: true,
      tint: true,
    });
    if (b.equity != null) {
      row(doc, `Your ${b.equity}% share`, [money(headline.profit_share)], { bold: true });
    }
    for (const p of b.position.filter((x) => x !== headline)) {
      row(doc, `Net profit (${p.currency})`, [money(p.season_net_profit)], { muted: true });
    }
  }
  doc.down(16);

  sectionTitle(doc, 'Pipeline');
  row(doc, 'Stage', ['Students'], { muted: true });
  doc.rule();
  doc.down(16);
  if (b.funnel.length === 0) row(doc, 'No students recorded', ['-'], { muted: true });
  for (const f of b.funnel) row(doc, String(f.stage), [money(f.student_count)]);
  doc.down(16);

  const byUni = new Map<string, number>();
  for (const a of b.applications) {
    const k = a.university ?? 'University not set';
    byUni.set(k, (byUni.get(k) ?? 0) + 1);
  }
  const unis = [...byUni.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12);
  sectionTitle(doc, 'Where they applied');
  row(doc, 'University', ['Applications'], { muted: true });
  doc.rule();
  doc.down(16);
  if (unis.length === 0) row(doc, 'No applications opened', ['-'], { muted: true });
  for (const [name, n] of unis) row(doc, name, [String(n)]);
  doc.down(16);

  if (b.monthly.length > 0) {
    sectionTitle(doc, 'Month by month');
    row(doc, 'Month', ['Revenue', 'Net'], { muted: true });
    doc.rule();
    doc.down(16);
    for (const m of b.monthly) {
      row(doc, `${monthLabel(m.month)}  ${m.currency}`, [money(m.revenue), money(m.net)]);
    }
  }

  footNote(doc, [
    'Documents Ready, Offer Received and Visa Approved are not recorded in the CRM yet and read zero.',
    'Read-only investor export. Student documents and personal files are not included.',
  ]);
  return doc.build();
}

/* -------------------------------------------------------------------- XLSX */

function pnlXlsx(b: Bundle): Uint8Array {
  const pnlRows: CellValue[][] = b.pnl.map((r) => [
    String(r.currency ?? ''),
    titleCase(r.side),
    humanizeLineItem(r.line_item),
    num(r.amount),
    r.pct_of_revenue == null ? null : Number(Number(r.pct_of_revenue).toFixed(1)),
  ]);

  for (const cur of currencies(b.pnl)) {
    const rows = b.pnl.filter((r) => r.currency === cur);
    // v_investor_season_pnl emits side='revenue' (not 'income').
    const revenue = rows.filter((r) => r.side === 'revenue').reduce((n, r) => n + num(r.amount), 0);
    const spend = rows.filter((r) => r.side === 'expense').reduce((n, r) => n + num(r.amount), 0);
    // 'discount' rows are informational (see pnlPdf) and intentionally excluded
    // from this net-profit total, which must stay revenue - expenses.
    pnlRows.push([cur, 'Total', 'Net profit', revenue - spend, null]);
  }

  const sheets: Sheet[] = [
    {
      name: 'P&L',
      notes: [
        `Hanguk Consulting — Profit & Loss — ${b.season.label} intake`,
        `Prepared for ${b.investorName}. Generated ${b.generatedAt.slice(0, 10)}.`,
        'Currencies are reported separately and never summed; no exchange rate is held in the CRM.',
      ],
      columns: [
        { header: 'Currency', width: 11 },
        { header: 'Side', width: 12 },
        { header: 'Line item', width: 34 },
        { header: 'Amount', width: 18, numeric: true },
        { header: '% of revenue', width: 14, numeric: true },
      ],
      rows: pnlRows,
    },
    {
      name: 'Monthly',
      columns: [
        { header: 'Month', width: 14 },
        { header: 'Currency', width: 11 },
        { header: 'Revenue', width: 18, numeric: true },
        { header: 'Expenses', width: 18, numeric: true },
        { header: 'Net', width: 18, numeric: true },
        { header: 'Margin %', width: 12, numeric: true },
      ],
      rows: b.monthly.map((m) => [
        monthLabel(m.month),
        String(m.currency ?? ''),
        num(m.revenue),
        num(m.expenses),
        num(m.net),
        m.margin_pct == null ? null : Number(Number(m.margin_pct).toFixed(1)),
      ]),
    },
    {
      name: 'Payouts',
      columns: [
        { header: 'Period', width: 16 },
        { header: 'Due', width: 13 },
        { header: 'Paid', width: 13 },
        { header: 'Amount UZS', width: 18, numeric: true },
        { header: 'Status', width: 13 },
      ],
      rows: b.payouts.map((p) => [
        String(p.period_label ?? ''),
        isoDate(p.due_date),
        isoDate(p.paid_at),
        num(p.amount_uzs),
        titleCase(p.status),
      ]),
    },
  ];

  return buildXlsx(sheets);
}

function applicationsXlsx(b: Bundle): Uint8Array {
  return buildXlsx([
    {
      name: 'Applications',
      notes: [
        `Hanguk Consulting — Applications — ${b.season.label} intake`,
        `Prepared for ${b.investorName}. Generated ${b.generatedAt.slice(0, 10)}.`,
        'Passports, transcripts and personal documents are not available in the investor view.',
      ],
      columns: [
        { header: 'Student', width: 26 },
        { header: 'Plan', width: 16 },
        { header: 'University', width: 32 },
        { header: 'Program', width: 18 },
        { header: 'Status', width: 20 },
        { header: 'Submitted', width: 13 },
        { header: 'Last movement', width: 14 },
        { header: 'Days since movement', width: 20, numeric: true },
      ],
      rows: b.applications.map((a) => [
        String(a.student_name ?? ''),
        titleCase(a.plan),
        String(a.university ?? ''),
        titleCase(a.program),
        titleCase(a.status),
        isoDate(a.submitted_at),
        isoDate(a.updated_at),
        a.days_since_movement == null ? null : num(a.days_since_movement),
      ]),
    },
    {
      name: 'Pipeline',
      notes: [
        'Documents Ready, Offer Received and Visa Approved are not recorded in the CRM yet and read zero.',
      ],
      columns: [
        { header: 'Stage', width: 24 },
        { header: 'Students', width: 12, numeric: true },
      ],
      rows: b.funnel.map((f) => [String(f.stage ?? ''), num(f.student_count)]),
    },
  ]);
}

/* --------------------------------------------------------------------- serve */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return fail(401, 'MISSING_AUTH');

  let body: { kind?: string; intakeId?: string | null };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'BAD_BODY');
  }

  const kind = body.kind as Kind;
  if (!KINDS.includes(kind)) return fail(400, 'UNKNOWN_KIND');

  // User-scoped: RLS, not this function, decides what is readable.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) return fail(401, 'INVALID_TOKEN');

  let bundle: Bundle;
  try {
    bundle = await load(client, body.intakeId ?? null);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NO_SEASONS') return fail(403, 'NOT_AN_INVESTOR');
    console.error('[investor-export] load failed:', msg);
    return fail(500, 'LOAD_FAILED');
  }

  // v_investor_position is empty for anyone who is not an investor, because
  // every view self-gates on investor_can_view_intake(). No row, no export.
  if (bundle.position.length === 0 && bundle.equity == null) {
    return fail(403, 'NOT_AN_INVESTOR');
  }

  let bytes: Uint8Array;
  let filename: string;
  let mime: string;

  try {
    switch (kind) {
      case 'pnl-pdf':
        bytes = pnlPdf(bundle);
        filename = `hanguk-pnl-${bundle.slug}.pdf`;
        mime = 'application/pdf';
        break;
      case 'season-report-pdf':
        bytes = seasonReportPdf(bundle);
        filename = `hanguk-season-report-${bundle.slug}.pdf`;
        mime = 'application/pdf';
        break;
      case 'pnl-xlsx':
        bytes = pnlXlsx(bundle);
        filename = `hanguk-pnl-${bundle.slug}.xlsx`;
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'applications-xlsx':
        bytes = applicationsXlsx(bundle);
        filename = `hanguk-applications-${bundle.slug}.xlsx`;
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
    }
  } catch (e) {
    console.error('[investor-export] build failed:', (e as Error).message);
    return fail(500, 'BUILD_FAILED');
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': mime,
      'content-length': String(bytes.length),
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
});
