import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewQueueRow } from '@/hooks/useReviewQueue';
import {
  NOT_SPECIFIED,
  resolveStatusField,
  classifyTrack,
  mapCalendarEvents,
} from '../reviewLogic';
import {
  fmtKRW,
  fmtDateKST,
  isDocumentFlag,
  isDegreeCheckFlag,
  isDegreeSplitFlag,
} from './reviewGroups';
import {
  applicationLabels,
  isSupplementary,
  partitionByRound,
  waveCount,
} from './rounds';

/**
 * Per-field-group section bodies (design §B): only the decision-critical
 * fields, in the handoff's order; anything absent renders muted italic
 * "Ko'rsatilmagan" — never dropped. Data mapping reuses reviewLogic
 * (mapCalendarEvents, classifyTrack, resolveStatusField) unchanged.
 */

function getArray(parsed: unknown, key: string): Array<Record<string, unknown>> {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const v = (parsed as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
    }
  }
  return [];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function humanize(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const h = s.replace(/_/g, ' ');
  return h.charAt(0).toUpperCase() + h.slice(1);
}

/** Muted italic "Ko'rsatilmagan". */
function Ns({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('font-sans font-normal italic text-muted-foreground/80', className)}>
      {t('uniReview.ns')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// calendar — label/value grid + application-fee inset row.
// ---------------------------------------------------------------------------

/** mapCalendarEvents slot label → uniReview.cal.* key (reviewLogic untouched). */
const SLOT_KEY: Record<string, string> = {
  'Online application opens': 'applyOpen',
  'Online application deadline': 'applyClose',
  'Document deadline': 'docsDeadline',
  'First-stage results': 'firstStage',
  Interview: 'interview',
  'Results announced': 'results',
  'Registration opens': 'regOpen',
  'Registration deadline': 'regClose',
  Orientation: 'orientation',
};

const EMPH_SLOTS = new Set(['applyClose', 'docsDeadline']);

/**
 * One line per dated event — two intake rounds stack instead of colliding.
 * When the extractor tagged an event with round_label (1차/2차/3차/4차 모집,
 * or "1st Round" etc.), that label is prefixed so a reviewer can tell which
 * round each stacked date belongs to instead of guessing from order.
 *
 * 추가합격 waves never reach here — CalendarBody partitions them out first
 * (see ./rounds), because they are numbered 1차–4차 too and stacking them
 * beside the real dates is what made every university look four-round.
 */
function calValueLines(t: TFunction, events: Array<Record<string, unknown>>): string[] {
  return events
    .map((e) => {
      const d = fmtDateKST(e.starts_at);
      if (!d) return null;
      const dated = e.is_tentative ? `${d} ${t('uniReview.cal.tentative')}` : d;
      const round = typeof e.round_label === 'string' ? e.round_label.trim() : '';
      return round ? `${round}: ${dated}` : dated;
    })
    .filter((l): l is string => l !== null);
}

export function CalendarBody({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const allEvents = getArray(row.parsed_output, 'events');
  const allPeriods = getArray(row.parsed_output, 'periods');

  // Replacement waves out of the way first. They are dates a reviewer should
  // still see, but they are not rounds, and mixing them into the date rows is
  // the bug this partition exists for.
  const { main: events, supplementary } = partitionByRound(allEvents);
  const appLabels = applicationLabels(allEvents);
  const periods = allPeriods.filter((p) => !isSupplementary(p, appLabels));

  const { slots } = mapCalendarEvents(events);

  /** Prefix a period-derived value with its round_label, same convention as calValueLines. */
  const roundPrefix = (p: Record<string, unknown>) =>
    typeof p.round_label === 'string' && p.round_label.trim() ? `${p.round_label.trim()}: ` : '';

  const offlineLines = periods
    .map((p) => {
      const start = fmtDateKST(p.offline_application_start);
      const end = fmtDateKST(p.offline_application_end);
      if (!start) return null;
      return `${roundPrefix(p)}${end ? `${start} – ${end}` : start}`;
    })
    .filter((l): l is string => l !== null);

  const feeLines = periods
    .map((p) => {
      const krw = fmtKRW(p.application_fee_krw);
      return krw ? `${roundPrefix(p)}${krw}` : null;
    })
    .filter((l): l is string => l !== null);

  const rows: Array<{ key: string; lines: string[]; emph: boolean }> = [
    ...slots.map((s) => {
      const key = SLOT_KEY[s.label] ?? s.label;
      return { key, lines: calValueLines(t, s.events), emph: EMPH_SLOTS.has(key) };
    }),
    { key: 'offline', lines: offlineLines, emph: false },
  ];

  // One row for the whole 추가합격 block: how many waves and over what dates.
  // A reviewer needs to know it exists; they do not need four date rows for
  // it, and an applicant cannot act on it in advance.
  const suppLines = (() => {
    if (!supplementary.length) return [];
    const dates = supplementary
      .map((e) => fmtDateKST(e.starts_at))
      .filter((d): d is string => Boolean(d))
      .sort();
    const n = waveCount(supplementary);
    const span = dates.length
      ? dates[0] === dates[dates.length - 1]
        ? dates[0]
        : `${dates[0]} – ${dates[dates.length - 1]}`
      : '';
    const waves = t('uniReview.cal.supplementaryWaves', { count: n });
    return [span ? `${span} · ${waves}` : waves];
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* Single column until xl — the detail panel shares the row with the
          318px rail, so two columns collide below full desktop width. */}
      <div className="grid gap-x-7 xl:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-[7px]"
          >
            <span className="shrink-0 text-[13px] text-muted-foreground">
              {t(`uniReview.cal.${r.key}`)}
            </span>
            <span
              className={cn(
                'min-w-0 text-right font-mono text-[12.5px]',
                r.lines.length ? (r.emph ? 'font-bold' : 'font-medium') : '',
              )}
            >
              {r.lines.length ? (
                r.lines.map((line, i) => (
                  <span key={i} className="block break-words">
                    {line}
                  </span>
                ))
              ) : (
                <Ns />
              )}
            </span>
          </div>
        ))}
      </div>
      {suppLines.length > 0 && (
        <div className="flex items-baseline justify-between gap-3 rounded-[10px] border border-border/60 bg-secondary/30 p-2.5 px-3.5">
          <span className="shrink-0 text-[13px] text-muted-foreground">
            {t('uniReview.cal.supplementary')}
          </span>
          <span className="min-w-0 break-words text-right font-mono text-[12.5px] font-medium">
            {suppLines[0]}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border/60 bg-secondary/50 p-2.5 px-3.5">
        <span className="text-[13px] font-semibold">{t('uniReview.cal.fee')}</span>
        <span className="min-w-0 break-words text-right font-mono text-[13px] font-bold">
          {feeLines.length ? (
            feeLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))
          ) : (
            <Ns />
          )}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// requirements — stat tiles per foreign track + collapsed heritage tracks.
// ---------------------------------------------------------------------------

export interface Stat {
  k: string;
  v: string | null;
  /**
   * Why the headline value is what it is, when "Ha" on its own would be a
   * worse answer than the truth. Two cases produce it: the guideline names a
   * test we have no number for (a university's own English paper), and the
   * guideline requires a certificate but states no minimum score. Both used
   * to render as a bare "Ha", which reads as the extractor having given up.
   */
  note?: string | null;
  warn?: boolean;
  show: boolean;
}

/** Localize resolveStatusField's sentinel labels. */
function statusText(t: TFunction, status: unknown, concrete: string | null): string | null {
  const r = resolveStatusField(status, concrete);
  if (r.text === NOT_SPECIFIED) return null;
  if (r.text === 'Not required') return t('uniReview.req.notRequired');
  if (r.text === 'Required') return concrete ?? t('uniReview.req.yes');
  return r.text;
}

function englishValue(t: TFunction, row: Record<string, unknown>): string | null {
  const e = row.english_test;
  if (e && typeof e === 'object' && !Array.isArray(e)) {
    const o = e as Record<string, unknown>;
    if (typeof o.min_score === 'number') {
      const test = typeof o.test === 'string' ? o.test.toUpperCase().replace(/_/g, ' ') : 'IELTS';
      return `${test} ${o.min_score}+`;
    }
    for (const [k, label] of [
      ['ielts', 'IELTS'],
      ['toefl_ibt', 'TOEFL iBT'],
      ['toefl_pbt', 'TOEFL PBT'],
      ['teps', 'TEPS'],
      ['duolingo', 'Duolingo'],
    ] as const) {
      if (typeof o[k] === 'number') return `${label} ${o[k]}+`;
    }
    if (o.deferred === true) return t('uniReview.req.deferred');
    // No number anywhere, but the guideline described the requirement in
    // prose — most often a university's OWN English paper. Labelling that
    // "IELTS: Ha" is not merely vague, it names the wrong exam.
    if (typeof o.other_ko === 'string' && o.other_ko.trim()) {
      return t('uniReview.req.otherTest');
    }
  }
  return null;
}

/**
 * The sentence under a requirement chip.
 *
 * Measured on this database: of 69 rows where English is required, 55 carry a
 * usable number, 5 carry only `other_ko` prose, and 9 carry nothing at all.
 * TOPIK is required on 139 rows, 7 of them with no level. Every one of those
 * 16 rendered as a bare "Ha", which reads as a failed extraction — when in
 * most cases the guideline itself simply never states a threshold, and saying
 * so is the accurate answer.
 */
function englishNote(t: TFunction, row: Record<string, unknown>): string | null {
  const e = row.english_test;
  if (e && typeof e === 'object' && !Array.isArray(e)) {
    const o = e as Record<string, unknown>;
    if (typeof o.other_ko === 'string' && o.other_ko.trim()) return o.other_ko.trim();
  }
  return null;
}

export function trackStats(t: TFunction, r: Record<string, unknown>): Stat[] {
  const topikConcrete =
    typeof r.topik_min_level === 'number'
      ? t('uniReview.req.topikLevel', { n: r.topik_min_level })
      : r.topik_deferred === true
        ? t('uniReview.req.deferred')
        : null;
  const gpaConcrete =
    r.gpa_floor_pct !== null && r.gpa_floor_pct !== undefined
      ? t('uniReview.req.gpaMin', { p: r.gpa_floor_pct })
      : null;
  // "Required, but we have no number" is a real answer and a different one
  // from "required, threshold X". Said out loud it stops a reviewer chasing an
  // extraction bug that is not there; left as a bare "Ha" it looks like one.
  const unstated = t('uniReview.req.noThreshold');
  const topikValue = statusText(t, r.topik_status, topikConcrete);
  const englishConcrete = englishValue(t, r);
  const englishText = statusText(t, r.english_status, englishConcrete);
  const gpaValue = statusText(t, r.gpa_status, gpaConcrete);
  const bare = (value: string | null, concrete: string | null) =>
    value !== null && concrete === null && value === t('uniReview.req.yes');

  return [
    {
      k: t('uniReview.req.topik'),
      v: topikValue,
      note: bare(topikValue, topikConcrete) ? unstated : null,
      show: true,
    },
    {
      k: t('uniReview.req.english'),
      v: englishText,
      note: englishNote(t, r) ?? (bare(englishText, englishConcrete) ? unstated : null),
      show: true,
    },
    {
      k: t('uniReview.req.gpa'),
      v: gpaValue,
      note: bare(gpaValue, gpaConcrete) ? unstated : null,
      show: true,
    },
    {
      k: t('uniReview.req.interview'),
      v:
        r.interview_required === true
          ? t('uniReview.req.yes')
          : r.interview_required === false
            ? t('uniReview.req.no')
            : null,
      show: true,
    },
    {
      k: t('uniReview.req.practical'),
      v: r.practical_exam_required === true ? t('uniReview.req.yes') : null,
      show: r.practical_exam_required === true,
    },
  ];
}

function heritageLine(t: TFunction, r: Record<string, unknown>): string {
  const bits: string[] = [];
  if (typeof r.topik_min_level === 'number') bits.push(`TOPIK ${r.topik_min_level}`);
  if (r.gpa_floor_pct !== null && r.gpa_floor_pct !== undefined) bits.push(`GPA ${r.gpa_floor_pct}%+`);
  const prose = str(r.prose_uz) ?? str(r.prose_ko);
  if (bits.length === 0 && prose) return prose.length > 70 ? `${prose.slice(0, 70)}…` : prose;
  return bits.length ? bits.join(' · ') : t('uniReview.ns');
}

export function RequirementsBody({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const [heritageOpen, setHeritageOpen] = useState(false);
  const rows = getArray(row.parsed_output, 'rows');
  const items = rows.map((r) => ({ r, track: classifyTrack(r) }));
  const foreign = items.filter((it) => it.track !== 'korean_heritage');
  const heritage = items.filter((it) => it.track === 'korean_heritage');

  return (
    <div className="flex flex-col gap-3">
      {foreign.length === 0 && heritage.length === 0 ? <Ns className="text-[13px]" /> : null}
      {foreign.map(({ r, track }, i) => {
        const cat = str(r.applicant_category_uz) ?? str(r.applicant_category);
        const overline =
          track === 'foreign'
            ? t('uniReview.req.foreignTrack', { cat: cat ?? t('uniReview.req.defaultCat') })
            : cat;
        const majorsSrc = r.majors_uz ?? r.majors;
        const majors = Array.isArray(majorsSrc)
          ? (majorsSrc as unknown[]).filter((m) => typeof m === 'string').join(', ')
          : str(majorsSrc);
        const proseUz = str(r.prose_uz);
        const prose = proseUz ?? str(r.prose_ko);
        const proseLang = proseUz ? 'uz' : 'ko';
        return (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground/80">
              {overline ?? <Ns />}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
              {trackStats(t, r)
                .filter((s) => s.show)
                .map((s) => (
                  <div
                    key={s.k}
                    className="flex flex-col gap-0.5 rounded-[10px] border border-border/60 bg-secondary/50 p-2.5 px-3"
                  >
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
                      {s.k}
                    </span>
                    <span className="break-words text-[15px] font-bold">
                      {s.v ?? <Ns className="text-[13px]" />}
                    </span>
                    {s.note ? (
                      // Clamped rather than truncated with an ellipsis: the
                      // Korean source sentences run long, and the tile is
                      // 140px wide. `title` keeps the whole thing reachable.
                      <span
                        title={s.note}
                        className="line-clamp-3 break-words text-[11px] font-normal leading-snug text-muted-foreground"
                      >
                        {s.note}
                      </span>
                    ) : null}
                  </div>
                ))}
            </div>
            <div className="text-[13px]">
              <span className="text-muted-foreground/80">{t('uniReview.req.majors')} </span>
              {majors ? <span className="font-medium">{majors}</span> : <Ns />}
            </div>
            {prose ? (
              <div
                className="rounded-[10px] border border-border/60 bg-secondary/50 p-2.5 px-3.5 text-[12.5px] leading-relaxed text-muted-foreground"
                lang={proseLang}
              >
                {prose}
              </div>
            ) : null}
          </div>
        );
      })}

      {heritage.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setHeritageOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground/80 hover:text-muted-foreground"
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', heritageOpen && 'rotate-180')}
            />
            {heritageOpen
              ? t('uniReview.req.heritageHide', { n: heritage.length })
              : t('uniReview.req.heritageShow', { n: heritage.length })}
          </button>
          {heritageOpen
            ? heritage.map(({ r }, i) => (
                <div
                  key={i}
                  className="flex min-w-0 items-baseline justify-between gap-3 rounded-[10px] border border-dashed border-border bg-secondary/50 px-3.5 py-2"
                >
                  <span className="break-words text-[12.5px] font-medium text-muted-foreground/80">
                    {str(r.applicant_category_uz) ?? str(r.applicant_category) ?? <Ns />}
                  </span>
                  <span className="min-w-0 break-words text-right text-xs text-muted-foreground/80">
                    {heritageLine(t, r)}
                  </span>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// tuition — bordered per-faculty table; consensus-flagged rows get a warning.
// ---------------------------------------------------------------------------

/** The fee a student pays to enrol — the only one this table shows.
 *
 * Korean guidelines quote two figures per faculty, 첫 학기 등록금 and 두 번째 학기
 * 이후 등록금, and the extraction emits both. Rendered as-is that put the same
 * faculty on screen twice at two prices — six faculties reading as twelve rows,
 * looking like an extraction bug rather than the document's own structure.
 *
 * The later figure is not published either (publish_worker._publish_tuition),
 * so showing it here would offer a reviewer a row their approval does not act
 * on.
 *
 * Falls back to the semester number when the model omits the flag, and keeps a
 * row that states neither: most guidelines draw no distinction at all, and
 * dropping those would hide a real fee behind a split their document never
 * made.
 */
export function isEntrySemester(r: Record<string, unknown>): boolean {
  if (typeof r.is_first_semester === 'boolean') return r.is_first_semester;
  const sem = r.semester_number ?? r.semester;
  const n = typeof sem === 'number' ? sem : parseInt(String(sem ?? ''), 10);
  return Number.isNaN(n) ? true : n === 1;
}

export function TuitionBody({ row, noteDetail }: { row: ReviewQueueRow; noteDetail: string | null }) {
  const { t } = useTranslation();
  const rows = getArray(row.parsed_output, 'rows').filter(isEntrySemester);
  if (rows.length === 0) return <Ns className="text-[13px]" />;
  return (
    // Fixed money columns — scroll inside the card on narrow widths instead
    // of colliding with or clipping the faculty column.
    <div className="overflow-x-auto rounded-[10px] border border-border/60">
      <div className="grid min-w-[520px] grid-cols-[minmax(0,1fr)_170px_140px] gap-3 bg-secondary/50 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
        <span>{t('uniReview.tui.faculty')}</span>
        <span className="text-right">{t('uniReview.tui.perSemester')}</span>
        <span className="text-right">{t('uniReview.tui.admissionFee')}</span>
      </div>
      {rows.map((r, i) => {
        // The faculty as the document prints it is the row's identity. The
        // bucket is a filter and is often absent by design — a line covering
        // two faculties reports none rather than guessing one. Older rows
        // predate `faculty_ko`, so the bucket still stands in for them.
        const fac = str(r.faculty_group);
        const facLabel = fac ? t(`uniReview.tui.fac.${fac}`, { defaultValue: fac }) : null;
        const name = str(r.faculty_uz) ?? str(r.faculty_ko) ?? facLabel;
        // Show the bucket beside the name only when it adds something the
        // name does not already say.
        const showGroup = !!facLabel && !!str(r.faculty_ko);
        const warn = !!fac && !!noteDetail && noteDetail.includes(fac);
        const sem = fmtKRW(r.amount_krw);
        const fee = fmtKRW(r.admission_fee_krw ?? r.admission_fee);
        // The line the amount was read from. Without it a reviewer cannot
        // tell two same-looking rows apart, nor check a figure against the PDF.
        const source = str(r.source_text_ko);
        return (
          <div
            key={i}
            className="grid min-w-[520px] grid-cols-[minmax(0,1fr)_170px_140px] items-baseline gap-3 border-t border-border/60 px-3.5 py-[9px]"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                <span className="min-w-0 break-words">{name ?? <Ns />}</span>
                {showGroup ? (
                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium text-muted-foreground/80">
                    {facLabel}
                  </span>
                ) : null}
                {warn ? <AlertTriangle className="h-[13px] w-[13px] shrink-0 text-warning" /> : null}
              </span>
              {source ? (
                <span
                  className="min-w-0 break-words text-[11px] leading-[1.45] text-muted-foreground/70"
                  lang="ko"
                >
                  {source}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                'text-right font-mono text-[13px] font-semibold',
                warn && 'text-warning',
              )}
            >
              {sem ?? <Ns />}
            </span>
            <span className="text-right font-mono text-[12.5px] text-muted-foreground">
              {fee ?? <Ns />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// documents_required — checklist with Majburiy/Ixtiyoriy, Apostil, deadline.
// ---------------------------------------------------------------------------

export function DocumentsBody({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const rows = getArray(row.parsed_output, 'rows');
  if (rows.length === 0) return <Ns className="text-[13px]" />;
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => {
        const optional = r.is_required === false;
        const name =
          str(r.label_uz) ??
          humanize(r.document_type) ??
          str(r.label_ko) ??
          str(r.document_name_ko) ??
          null;
        const noteUz = str(r.notes_uz);
        const note = noteUz ?? str(r.notes_ko);
        const noteLang = noteUz ? 'uz' : 'ko';
        const deadline = fmtDateKST(r.deadline);
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2.5 border-b border-border/60 px-0.5 py-[9px]"
          >
            <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  'break-words text-[13px] font-semibold',
                  optional && 'font-medium text-muted-foreground/80',
                )}
              >
                {name ?? <Ns />}
              </span>
              {note ? (
                <span className="break-words text-[11.5px] text-muted-foreground/80" lang={noteLang}>
                  {note}
                </span>
              ) : null}
            </div>
            {optional ? (
              <span className="inline-flex h-[21px] items-center rounded-full bg-secondary px-2 text-[11px] font-semibold text-muted-foreground/80">
                {t('uniReview.docs.optional')}
              </span>
            ) : (
              <span className="inline-flex h-[21px] items-center rounded-full bg-info/10 px-2 text-[11px] font-semibold text-info">
                {t('uniReview.docs.required')}
              </span>
            )}
            {r.is_apostille_required === true ? (
              <span className="inline-flex h-[21px] items-center rounded-full bg-accent/20 px-2 text-[11px] font-semibold text-accent-foreground">
                {t('uniReview.docs.apostille')}
              </span>
            ) : null}
            <span
              className={cn(
                'min-w-[86px] text-right font-mono text-xs',
                deadline ? 'font-semibold text-muted-foreground' : '',
              )}
            >
              {deadline ?? (
                <span className="italic text-muted-foreground/80">
                  {t('uniReview.docs.noDeadline')}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// scholarships — award pill + tier chips per scholarship.
// ---------------------------------------------------------------------------

function awardLabel(t: TFunction, type: unknown, value: unknown): string | null {
  const ty = typeof type === 'string' ? type : '';
  if (ty === 'tuition_waiver_pct') {
    return value != null ? t('uniReview.sch.waiverPct', { pct: value }) : t('uniReview.sch.waiver');
  }
  if (ty === 'tuition_waiver_krw') {
    const krw = fmtKRW(value);
    return krw ?? t('uniReview.sch.waiver');
  }
  if (ty === 'stipend_monthly') {
    const krw = fmtKRW(value);
    return krw ? t('uniReview.sch.stipendMonthly', { amount: krw }) : t('uniReview.sch.stipend');
  }
  if (ty === 'airfare') return t('uniReview.sch.airfare');
  if (ty) return t(`uniReview.sch.awardType.${ty}`, { defaultValue: humanize(ty) });
  return null;
}

function tierChips(
  t: TFunction,
  table: unknown,
  scoreKey: string,
  scorePrefix: string,
): Array<{ score: string; award: string }> {
  if (!Array.isArray(table)) return [];
  return table
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((tier) => {
      const score = tier[scoreKey];
      const award = awardLabel(t, tier.award_type, tier.award_value);
      if (score == null || !award) return null;
      return { score: `${scorePrefix} ${score}`, award };
    })
    .filter((x): x is { score: string; award: string } => x !== null);
}

export function ScholarshipsBody({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const rows = getArray(row.parsed_output, 'rows');
  if (rows.length === 0) return <Ns className="text-[13px]" />;
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => {
        const name = str(r.name_uz) ?? str(r.name_en) ?? str(r.name_ko);
        const award = awardLabel(t, r.award_type, r.award_value);
        const tiers = [
          ...tierChips(t, r.topik_tier_table, 'topik_level', 'TOPIK'),
          ...tierChips(t, r.ielts_tier_table, 'ielts_min', 'IELTS'),
        ];
        const noteUz = str(r.prose_uz);
        const note = noteUz ?? str(r.prose_ko);
        const noteLang = noteUz ? 'uz' : 'ko';
        return (
          <div key={i} className="flex flex-col gap-2 border-b border-border/60 px-0.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[13.5px] font-semibold">{name ?? <Ns />}</span>
              {award ? (
                <span className="inline-flex h-[22px] items-center rounded-full bg-success/10 px-2.5 text-[11.5px] font-semibold text-success">
                  {award}
                </span>
              ) : null}
            </div>
            {tiers.length > 0 ? (
              <div className="flex flex-wrap gap-[7px]">
                {tiers.map((tier, j) => (
                  <span
                    key={j}
                    className="inline-flex min-h-6 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-0.5 font-mono text-[11.5px] text-muted-foreground"
                  >
                    <span className="whitespace-nowrap font-semibold text-foreground">
                      {tier.score}
                    </span>
                    <span className="min-w-0 break-words">→ {tier.award}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {note ? (
              <span className="text-xs text-muted-foreground/80" lang={noteLang}>
                {note}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// document flag — the card is about the PDF, not about extracted data.
// ---------------------------------------------------------------------------

/**
 * The degree levels the parser found mixed in one document, read out of the
 * note it wrote: `... levels=['bachelor', 'master', 'doctoral'] ...`.
 *
 * Returns [] when the note does not carry them, and the caller then shows the
 * note as-is. Nothing is ever hidden because a pattern failed to match.
 */
function parseDegreeLevels(note: string | null | undefined): string[] {
  const m = /levels=\[([^\]]*)\]/.exec(note ?? '');
  if (!m) return [];
  return Array.from(m[1].matchAll(/'([a-z_]+)'/g), (x) => x[1]);
}

/**
 * Body for a document-level flag.
 *
 * These cards used to fall through the dispatcher's `default:` and render the
 * muted "Ko'rsatilmagan" — a card with a title of "Other section", no content,
 * and an Approve/Reject pair, which no reviewer could act on and which reads
 * as "the AI extracted nothing". The parser's explanation was in the row the
 * whole time; this renders it.
 */
function DocumentFlagBody({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const note = str(row.reviewer_notes);
  const levels = parseDegreeLevels(note);
  // A degree-check card names levels too, so `levels.length` cannot decide the
  // copy: that card exists precisely because no split point was found, and the
  // split wording would tell the reviewer to make a cut the parser ruled out.
  const isCheck = isDegreeCheckFlag(row);
  const isSplit = isDegreeSplitFlag(row);
  const titleKey = isCheck
    ? 'uniReview.docFlag.checkTitle'
    : isSplit
      ? 'uniReview.docFlag.splitTitle'
      : 'uniReview.docFlag.genericTitle';
  const whatKey = isCheck
    ? 'uniReview.docFlag.checkWhat'
    : isSplit
      ? 'uniReview.docFlag.splitWhat'
      : 'uniReview.docFlag.genericWhat';

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2 rounded-[10px] bg-warning/10 p-2.5 px-3.5 text-warning">
        <AlertTriangle className="mt-0.5 h-[15px] w-[15px] shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold leading-normal">
            {t(titleKey)}
          </span>
          <span className="text-[12.5px] font-medium leading-normal text-warning/90">
            {t(whatKey)}
          </span>
        </div>
      </div>

      {levels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="text-[12.5px] text-muted-foreground">
            {t('uniReview.docFlag.levels')}
          </span>
          {levels.map((lvl) => (
            <span
              key={lvl}
              className="inline-flex min-h-6 items-center rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-[11.5px] font-semibold"
            >
              {t(`uniReview.docFlag.level.${lvl}`, { defaultValue: lvl })}
            </span>
          ))}
        </div>
      ) : null}

      <span className="text-[12.5px] leading-normal text-muted-foreground">
        {t(
          isCheck
            ? 'uniReview.docFlag.checkAction'
            : isSplit
              ? 'uniReview.docFlag.splitActionHint'
              : 'uniReview.docFlag.action',
        )}
      </span>

      {/* The parser's raw sentence, kept verbatim: it names the exact signals
          and offsets, and a reviewer chasing a wrong split needs them. */}
      {note ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-[11.5px] font-medium text-muted-foreground/80 hover:text-foreground">
            <ChevronDown className="mr-1 inline h-3 w-3 transition-transform group-open:rotate-180" />
            {t('uniReview.docFlag.rawToggle')}
          </summary>
          <p className="mt-1.5 break-words rounded-[10px] bg-secondary/50 p-2.5 px-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {note}
          </p>
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher.
// ---------------------------------------------------------------------------

export function SectionBody({
  row,
  noteDetail,
}: {
  row: ReviewQueueRow;
  noteDetail: string | null;
}): ReactNode {
  // Document-level flags carry no parsed_output by design — they are about
  // the PDF, not about a field group — so they must not fall through to the
  // "Ko'rsatilmagan" default below.
  if (isDocumentFlag(row)) return <DocumentFlagBody row={row} />;

  switch (row.field_group) {
    case 'calendar':
      return <CalendarBody row={row} />;
    case 'requirements':
      return <RequirementsBody row={row} />;
    case 'tuition':
      return <TuitionBody row={row} noteDetail={noteDetail} />;
    case 'documents_required':
      return <DocumentsBody row={row} />;
    case 'scholarships':
      return <ScholarshipsBody row={row} />;
    default:
      return <Ns className="text-[13px]" />;
  }
}
