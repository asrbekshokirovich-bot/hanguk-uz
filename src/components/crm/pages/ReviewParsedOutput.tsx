import type { ReactNode } from 'react';

/**
 * Renders the AI-extracted `parsed_output` for one review-queue item as a clean,
 * labelled layout. Every field defined for a `field_group` is always shown — a
 * missing value renders as "Not specified" so reviewers see the full structure
 * (including fields the backend does not populate yet, e.g. majors, per-track
 * tuition, IELTS bands, application fee).
 *
 * Korean free-text is shown translated (English) when a translation map is
 * supplied, with a "translating…" placeholder in flight and the original Korean
 * when `showKorean` is true.
 *
 * Internal-only fields (extractor_confidence, eligibility_predicate raw,
 * is_correction_notice, source_text_ko, country_specific) are never rendered.
 */

const NS = 'Not specified';
const TRANSLATING = 'translating…';

function text(v: unknown): string {
  if (v === null || v === undefined) return NS;
  const s = String(v).trim();
  return s.length ? s : NS;
}

function humanize(v: unknown): string {
  if (v === null || v === undefined || v === '') return NS;
  const s = String(v).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function yesNo(v: unknown): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return NS;
}

function formatKrw(v: unknown): string {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return NS;
  return `${new Intl.NumberFormat('en-US').format(n)} KRW`;
}

function formatKst(v: unknown): string {
  if (typeof v !== 'string' || !v) return NS;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return text(v);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} KST`;
}

function formatDate(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) return NS;
  const s = v.trim();
  // Date-only ISO (YYYY-MM-DD) carries no time — show it verbatim rather than
  // shifting it through a timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return formatKst(s);
}

function dateRange(a: unknown, b: unknown): string {
  const sa = formatDate(a);
  const sb = formatDate(b);
  if (sa === NS && sb === NS) return NS;
  if (sa !== NS && sb !== NS) return `${sa} – ${sb}`;
  return sa !== NS ? sa : sb;
}

function list(v: unknown): string {
  if (Array.isArray(v)) {
    const items = v.map((x) => String(x).trim()).filter(Boolean);
    return items.length ? items.join(', ') : NS;
  }
  return text(v);
}

function awardPlain(awardType: unknown, value: unknown): string {
  const t = typeof awardType === 'string' ? awardType : '';
  if (!t && value === null) return NS;
  if (t.includes('tuition_waiver')) return value != null ? `${value}% tuition waiver` : 'Tuition waiver';
  if (t.includes('stipend') || t.includes('monthly')) {
    return value != null ? `${formatKrw(value)} / month` : 'Monthly stipend';
  }
  if (t.includes('pct')) return value != null ? `${value}%` : humanize(t);
  if (!t) return NS;
  return value != null ? `${humanize(t)} (${value})` : humanize(t);
}

function englishRequirement(v: unknown): string {
  if (v === null || v === undefined) return NS;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o.min_score === 'number') {
      const t = typeof o.test === 'string' ? o.test.toUpperCase() : 'English test';
      return `${t} ${o.min_score}`;
    }
    if (o.deferred === true) return 'Deferred';
    return NS;
  }
  return text(v);
}

function getArray(parsed: unknown, key: string): Array<Record<string, unknown>> {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const v = (parsed as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
    }
  }
  return [];
}

/**
 * The Korean free-text values actually displayed for an item, deduplicated.
 * Must stay in sync with the fields run through `trField` in the renderer.
 */
export function collectKoreanTexts(fieldGroup: string | null, parsedOutput: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) out.push(s);
    }
  };

  if (fieldGroup === 'calendar') {
    for (const ev of getArray(parsedOutput, 'events')) push(ev.notes_ko);
  } else {
    for (const r of getArray(parsedOutput, 'rows')) {
      if (fieldGroup === 'requirements') {
        push(r.applicant_category);
        push(r.prose_ko);
      } else if (fieldGroup === 'scholarships') {
        push(r.prose_ko);
        if (!r.name_en) push(r.name_ko);
      } else if (fieldGroup === 'documents_required') {
        push(r.notes_ko);
      }
    }
  }

  return Array.from(new Set(out));
}

function Field({ label, value, full }: { label: string; value: ReactNode; full?: boolean }) {
  const muted = value === NS || value === TRANSLATING;
  return (
    <div className={full ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm whitespace-pre-wrap break-words ${muted ? 'text-muted-foreground italic' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function RowCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

interface TierRow {
  score: string;
  award: string;
  duration: string;
}

// Accepts the current array form [{ <scoreKey>, award_type, award_value, duration }]
// and the legacy object form { "<score>": <value | {award_type,…}> }.
function normalizeTiers(rows: unknown, scoreKey: string): TierRow[] {
  if (Array.isArray(rows)) {
    return rows
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((r) => ({
        score: text(r[scoreKey]),
        award: awardPlain(r.award_type, r.award_value ?? null),
        duration: humanize(r.duration),
      }));
  }
  if (rows && typeof rows === 'object') {
    return Object.entries(rows as Record<string, unknown>).map(([k, v]) => {
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return { score: k, award: awardPlain(o.award_type, o.award_value ?? null), duration: humanize(o.duration) };
      }
      return { score: k, award: typeof v === 'number' ? `${v}%` : text(v), duration: NS };
    });
  }
  return [];
}

function TierTable({
  rows,
  scoreKey,
  scoreLabel,
}: {
  rows: unknown;
  scoreKey: string;
  scoreLabel: string;
}) {
  const tiers = normalizeTiers(rows, scoreKey);
  if (tiers.length === 0) {
    return <span className="text-sm text-muted-foreground italic">{NS}</span>;
  }
  return (
    <div className="rounded-md border divide-y overflow-hidden">
      <div className="grid grid-cols-3 text-xs font-medium bg-muted/50 px-2 py-1">
        <div>{scoreLabel}</div>
        <div>Award</div>
        <div>Duration</div>
      </div>
      {tiers.map((r, i) => (
        <div key={i} className="grid grid-cols-3 text-sm px-2 py-1">
          <div>{r.score}</div>
          <div>{r.award}</div>
          <div>{r.duration}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyRows({ noun }: { noun: string }) {
  return (
    <p className="text-sm text-muted-foreground italic rounded-lg border border-dashed p-3">
      No {noun} extracted for this item.
    </p>
  );
}

// Calendar event_type → human label, in display order (granular dated events).
const TIMELINE_SLOTS: Array<{ label: string; type: string }> = [
  { label: 'Online application opens', type: 'apply_open' },
  { label: 'Online application deadline', type: 'apply_close' },
  { label: 'Document deadline', type: 'documents_deadline' },
  { label: 'Interview', type: 'interview' },
  { label: 'Results announced', type: 'final_results' },
  { label: 'Registration opens', type: 'registration_open' },
];

// A structured admission period (parsed_output.periods[]). Rendered per language
// track; fields fall back to "Not specified" until re-extraction populates them.
function PeriodBlock({ p }: { p: Record<string, unknown> }) {
  const titleBits = [p.language_track, p.program_level]
    .filter((x) => x !== null && x !== undefined && x !== '')
    .map((x) => humanize(x));
  const title = titleBits.length ? titleBits.join(' · ') : 'Admission period';
  const fee =
    [
      p.application_fee_krw != null ? formatKrw(p.application_fee_krw) : null,
      p.application_fee_usd != null ? `$${p.application_fee_usd}` : null,
    ]
      .filter(Boolean)
      .join(' / ') || NS;
  return (
    <RowCard title={title}>
      <Field label="Online application" value={dateRange(p.online_application_start, p.online_application_end)} />
      <Field label="Offline application" value={dateRange(p.offline_application_start, p.offline_application_end)} />
      <Field label="Interview" value={dateRange(p.interview_start, p.interview_end)} />
      <Field label="Application window" value={dateRange(p.application_start, p.application_end)} />
      <Field label="Document deadline" value={formatDate(p.document_deadline)} />
      <Field label="Results announced" value={formatDate(p.result_announcement)} />
      <Field label="Application fee" value={fee} />
    </RowCard>
  );
}

export function ReviewParsedOutput({
  fieldGroup,
  parsedOutput,
  showKorean = false,
  translating = false,
  translations,
}: {
  fieldGroup: string | null;
  parsedOutput: unknown;
  showKorean?: boolean;
  translating?: boolean;
  translations?: Map<string, string>;
}) {
  const trField = (v: unknown): string => {
    if (v === null || v === undefined) return NS;
    const s = String(v).trim();
    if (!s) return NS;
    if (showKorean) return s;
    if (translating) return TRANSLATING;
    return translations?.get(s) ?? s;
  };

  switch (fieldGroup) {
    case 'calendar': {
      const events = getArray(parsedOutput, 'events');
      const periods = getArray(parsedOutput, 'periods');
      const byType = (t: string) => events.filter((e) => e.event_type === t);
      // Always show at least one period block so offline/fee/etc. fields are
      // visible; once re-extraction populates periods[], show one block per track.
      const periodBlocks = periods.length > 0 ? periods : [{}];
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Admission periods</div>
            {periodBlocks.map((p, i) => (
              <PeriodBlock key={i} p={p} />
            ))}
          </div>

          {events.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Dated events</div>
              <RowCard>
                {TIMELINE_SLOTS.map((slot) => {
                  const matches = byType(slot.type);
                  const value =
                    matches.length === 0 ? (
                      NS
                    ) : (
                      <div className="space-y-0.5">
                        {matches.map((e, i) => (
                          <div key={i}>
                            {formatKst(e.starts_at)}
                            {e.is_tentative ? ' (tentative)' : ''}
                            {e.notes_ko ? (
                              <span className="text-muted-foreground"> — {trField(e.notes_ko)}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  return <Field key={slot.label} label={slot.label} value={value} full />;
                })}
              </RowCard>
            </div>
          ) : null}
        </div>
      );
    }

    case 'requirements': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows noun="admission tracks" />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const topik =
              r.topik_min_level !== null && r.topik_min_level !== undefined
                ? `Level ${r.topik_min_level}`
                : r.topik_deferred === true
                  ? 'Deferred'
                  : NS;
            const gpa =
              r.gpa_floor_pct !== null && r.gpa_floor_pct !== undefined
                ? `${r.gpa_floor_pct}%`
                : NS;
            return (
              <RowCard key={i} title={trField(r.applicant_category)}>
                <Field label="Applicant category (track)" value={trField(r.applicant_category)} />
                <Field label="TOPIK requirement" value={topik} />
                <Field label="IELTS / English" value={englishRequirement(r.english_test)} />
                <Field label="GPA floor" value={gpa} />
                <Field label="Interview?" value={yesNo(r.interview_required)} />
                <Field label="Practical exam?" value={yesNo(r.practical_exam_required)} />
                <Field label="Majors / fields" value={list(r.majors)} />
                <Field label="Tuition (this track)" value={formatKrw((r.tuition as Record<string, unknown> | undefined)?.amount_krw)} />
                <Field label="Eligibility" value={trField(r.prose_ko)} full />
              </RowCard>
            );
          })}
        </div>
      );
    }

    case 'tuition': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows noun="tuition rows" />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <RowCard key={i} title={text(r.faculty_group)}>
              <Field label="Faculty group" value={text(r.faculty_group)} />
              <Field label="Academic year" value={text(r.academic_year ?? r.year)} />
              <Field label="Semester" value={text(r.semester_number ?? r.semester)} />
              <Field label="First semester?" value={yesNo(r.is_first_semester)} />
              <Field label="Tuition" value={formatKrw(r.amount_krw)} />
              <Field label="Admission fee" value={formatKrw(r.admission_fee_krw ?? r.admission_fee)} />
            </RowCard>
          ))}
        </div>
      );
    }

    case 'scholarships': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows noun="scholarships" />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const name = r.name_en ? text(r.name_en) : trField(r.name_ko);
            const predicate = r.eligibility_predicate as Record<string, unknown> | undefined;
            const predicateNote =
              predicate && typeof predicate.prose_note === 'string' ? predicate.prose_note : null;
            return (
              <RowCard key={i} title={name !== NS ? name : 'Scholarship'}>
                <Field label="Name" value={name} />
                <Field label="Scope" value={humanize(r.scope)} />
                <Field label="Award" value={awardPlain(r.award_type, r.award_value ?? null)} />
                <Field
                  label="TOPIK score → award"
                  value={<TierTable rows={r.topik_tier_table} scoreKey="topik_level" scoreLabel="TOPIK" />}
                  full
                />
                <Field
                  label="IELTS score → award"
                  value={<TierTable rows={r.ielts_tier_table} scoreKey="ielts_min" scoreLabel="IELTS" />}
                  full
                />
                <Field
                  label="Eligibility"
                  value={predicateNote ? `${trField(r.prose_ko)}\n(${predicateNote})` : trField(r.prose_ko)}
                  full
                />
              </RowCard>
            );
          })}
        </div>
      );
    }

    case 'documents_required': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows noun="required documents" />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <RowCard key={i} title={humanize(r.document_type)}>
              <Field label="Document" value={humanize(r.document_type)} />
              <Field label="Required?" value={yesNo(r.is_required)} />
              <Field label="Apostille?" value={yesNo(r.is_apostille_required)} />
              <Field label="Notes" value={trField(r.notes_ko)} full />
            </RowCard>
          ))}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          {fieldGroup
            ? `No structured view for "${fieldGroup}". Use Advanced / edit JSON to inspect.`
            : 'Section type unknown. Use Advanced / edit JSON to inspect.'}
        </p>
      );
  }
}
