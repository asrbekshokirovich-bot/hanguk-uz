import type { ReactNode } from 'react';
import { NOT_SPECIFIED, resolveStatusField, confidencePct } from './reviewLogic';

/**
 * Renders the AI-extracted `parsed_output` for one review-queue item as a clean,
 * labelled layout. Every field defined for a `field_group` is always shown — a
 * missing value renders as "Not specified" so reviewers see the full structure.
 *
 * Text is rendered deterministically from the stored payload: Korean free-text
 * is shown as-is, except where the backend has joined a precomputed English
 * field (e.g. `prose_en`), in which case the English is shown. No translation
 * happens at render time, so the text a reviewer approves is exactly the text
 * shown.
 *
 * Internal-only fields (eligibility_predicate raw, is_correction_notice,
 * source_text_ko, country_specific) are never rendered.
 */

const NS = NOT_SPECIFIED;

function text(v: unknown): string {
  if (v === null || v === undefined) return NS;
  const s = String(v).trim();
  return s.length ? s : NS;
}

/** Prefer a precomputed English value when present, else the Korean original. */
function tr(koValue: unknown, enValue?: unknown): string {
  if (typeof enValue === 'string' && enValue.trim()) return enValue.trim();
  return text(koValue);
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

/** Document deadlines may be a plain date or a full timestamp. */
function formatDeadline(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) return NS;
  return v.includes('T') ? formatKst(v) : text(v);
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

function Field({
  label,
  value,
  full,
  muted: mutedOverride,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
  muted?: boolean;
}) {
  const muted = mutedOverride ?? value === NS;
  return (
    <div className={full ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm whitespace-pre-wrap break-words ${muted ? 'text-muted-foreground italic' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function ConfidenceTag({ value }: { value: unknown }) {
  const pct = confidencePct(typeof value === 'number' ? value : null);
  if (!pct) return null;
  return (
    <span className="text-xs font-normal rounded-full border px-2 py-0.5 text-muted-foreground" title="Extractor confidence for this row">
      conf {pct}
    </span>
  );
}

function RowCard({
  title,
  headerRight,
  children,
}: {
  title?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      {title || headerRight ? (
        <div className="flex items-center justify-between gap-2">
          {title ? <div className="text-sm font-semibold">{title}</div> : <span />}
          {headerRight}
        </div>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
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
  const list = Array.isArray(rows)
    ? rows.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    : [];
  if (list.length === 0) {
    return <span className="text-sm text-muted-foreground italic">{NS}</span>;
  }
  return (
    <div className="rounded-md border divide-y overflow-hidden">
      <div className="grid grid-cols-3 text-xs font-medium bg-muted/50 px-2 py-1">
        <div>{scoreLabel}</div>
        <div>Award</div>
        <div>Duration</div>
      </div>
      {list.map((r, i) => (
        <div key={i} className="grid grid-cols-3 text-sm px-2 py-1">
          <div>{text(r[scoreKey])}</div>
          <div>{awardPlain(r.award_type, r.award_value ?? null)}</div>
          <div>{humanize(r.duration)}</div>
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

// Calendar event_type → human label, in display order. Online/offline/fee slots
// are shown even when absent (offline + fee are not extracted yet).
const TIMELINE_SLOTS: Array<{ label: string; type: string | null }> = [
  { label: 'Online application opens', type: 'apply_open' },
  { label: 'Online application deadline', type: 'apply_close' },
  { label: 'Offline application', type: null },
  { label: 'Document deadline', type: 'documents_deadline' },
  { label: 'Interview', type: 'interview' },
  { label: 'Results announced', type: 'final_results' },
  { label: 'Registration opens', type: 'registration_open' },
];

export function ReviewParsedOutput({
  fieldGroup,
  parsedOutput,
}: {
  fieldGroup: string | null;
  parsedOutput: unknown;
}) {
  switch (fieldGroup) {
    case 'calendar': {
      const events = getArray(parsedOutput, 'events');
      const byType = (t: string) => events.filter((e) => e.event_type === t);
      return (
        <div className="space-y-3">
          <RowCard>
            {TIMELINE_SLOTS.map((slot) => {
              if (slot.type === null) {
                return <Field key={slot.label} label={slot.label} value={NS} full />;
              }
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
                          <span className="text-muted-foreground"> — {tr(e.notes_ko, e.notes_en)}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              return <Field key={slot.label} label={slot.label} value={value} full />;
            })}
            <Field label="Application fee" value={NS} full />
          </RowCard>
        </div>
      );
    }

    case 'requirements': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows noun="admission tracks" />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const topikConcrete =
              r.topik_min_level !== null && r.topik_min_level !== undefined
                ? `Level ${r.topik_min_level}`
                : r.topik_deferred === true
                  ? 'Deferred'
                  : null;
            const topik = resolveStatusField(r.topik_status, topikConcrete);

            const engStr = englishRequirement(r.english_test);
            const english = resolveStatusField(r.english_status, engStr === NS ? null : engStr);

            const gpaConcrete =
              r.gpa_floor_pct !== null && r.gpa_floor_pct !== undefined
                ? `${r.gpa_floor_pct}%`
                : null;
            const gpa = resolveStatusField(r.gpa_status, gpaConcrete);

            return (
              <RowCard
                key={i}
                title={text(r.applicant_category)}
                headerRight={<ConfidenceTag value={r.extractor_confidence} />}
              >
                <Field label="Applicant category (track)" value={text(r.applicant_category)} />
                <Field label="TOPIK requirement" value={topik.text} muted={topik.muted} />
                <Field label="IELTS / English" value={english.text} muted={english.muted} />
                <Field label="GPA floor" value={gpa.text} muted={gpa.muted} />
                <Field label="Interview?" value={yesNo(r.interview_required)} />
                <Field label="Practical exam?" value={yesNo(r.practical_exam_required)} />
                <Field label="Majors / fields" value={text(r.majors)} />
                <Field
                  label="Tuition (this track)"
                  value={formatKrw((r.tuition as Record<string, unknown> | undefined)?.amount_krw)}
                />
                <Field label="Eligibility" value={tr(r.prose_ko, r.prose_en)} full />
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
            <RowCard
              key={i}
              title={text(r.faculty_group)}
              headerRight={<ConfidenceTag value={r.extractor_confidence} />}
            >
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
            const name = r.name_en ? text(r.name_en) : text(r.name_ko);
            const predicate = r.eligibility_predicate as Record<string, unknown> | undefined;
            const predicateNote =
              predicate && typeof predicate.prose_note === 'string' ? predicate.prose_note : null;
            const eligibility = tr(r.prose_ko, r.prose_en);
            return (
              <RowCard
                key={i}
                title={name !== NS ? name : 'Scholarship'}
                headerRight={<ConfidenceTag value={r.extractor_confidence} />}
              >
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
                  value={predicateNote ? `${eligibility}\n(${predicateNote})` : eligibility}
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
            <RowCard
              key={i}
              title={humanize(r.document_type)}
              headerRight={<ConfidenceTag value={r.extractor_confidence} />}
            >
              <Field label="Document" value={humanize(r.document_type)} />
              <Field label="Required?" value={yesNo(r.is_required)} />
              <Field label="Apostille?" value={yesNo(r.is_apostille_required)} />
              <Field label="Applies to round" value={humanize(r.applies_to_round)} />
              <Field label="Deadline" value={formatDeadline(r.deadline)} />
              <Field label="Notes" value={tr(r.notes_ko, r.notes_en)} full />
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
