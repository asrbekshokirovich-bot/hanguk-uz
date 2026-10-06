/**
 * CSV export of the "Barcha lidlar" list (spec §3.3 "Eksport").
 *
 * Pure functions: the page only fetches, calls `leadsToCsv` and hands the text
 * to `downloadCsv`.
 */
import { STAGE_LABEL } from '../copy';
import type { LeadListRow } from '../api';
import { channelsOf, handleOf, lastActionAt, nextActionText, stamp } from './rowFormat';
import { sourceLabel } from './labels';

/** A cell that is only a phone number / number: harmless to a spreadsheet even with a leading + or -. */
const PLAIN_NUMBER = /^[+-]?[\d\s().-]+$/;

/**
 * A value is quoted when it holds a comma, quote, semicolon or line break, with
 * quotes doubled. A text that starts with = + - @ (or a tab / CR) would run as a
 * formula in Excel, so it is prefixed with an apostrophe ("=HYPERLINK(...)" in
 * somebody's Instagram name must stay text).
 */
export function csvCell(value: unknown): string {
  if (value == null) return '';
  let text = typeof value === 'string' ? value : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header + rows, CRLF separated (what Excel expects). */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export const LEAD_CSV_HEADER = [
  'Ism',
  'Telefon',
  'Username',
  'Kanallar',
  'Manba',
  'Bosqich',
  'Egasi',
  'Sertifikat',
  'Maqsad',
  'Viloyat',
  'Oxirgi harakat',
  'Keyingi harakat',
  'Ball',
  'Kampaniya',
  'Forma',
  'Yaratilgan',
];

export function leadsToCsv(rows: LeadListRow[], opts: { ownerName: (id: string | null) => string | null }): string {
  return toCsv(
    LEAD_CSV_HEADER,
    rows.map((r) => [
      r.full_name,
      r.phone,
      handleOf(r),
      channelsOf(r).join(' + '),
      sourceLabel(r.source),
      STAGE_LABEL[r.stage] ?? r.stage,
      opts.ownerName(r.owner_id) ?? (r.owner_id ? '' : 'Hovuz'),
      r.cert_level,
      r.education_level,
      r.city,
      stamp(lastActionAt(r)),
      nextActionText(r),
      r.priority_score,
      r.campaign_name,
      r.form_name,
      stamp(r.created_at),
    ]),
  );
}

/**
 * Walk every page of a filtered list (the api returns at most one page per
 * call). Stops at `cap` rows and says so, so a runaway filter cannot freeze
 * the tab.
 */
export async function collectAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ rows: T[]; total: number }>,
  opts: { pageSize?: number; cap?: number } = {},
): Promise<{ rows: T[]; total: number; truncated: boolean }> {
  const pageSize = opts.pageSize ?? 1000;
  const cap = opts.cap ?? 20_000;
  const all: T[] = [];
  let total = 0;
  for (let offset = 0; offset < cap; offset += pageSize) {
    const page = await fetchPage(offset, pageSize);
    total = page.total;
    all.push(...page.rows);
    if (page.rows.length < pageSize || all.length >= page.total) break;
  }
  const truncated = all.length < total;
  return { rows: all, total, truncated };
}

/** Hand the CSV to the browser as a file (UTF-8 with a BOM so Excel reads Uzbek letters right). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
