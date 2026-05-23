import type { ReactNode } from 'react';

/**
 * Renders the AI-extracted `parsed_output` for a review-queue item as a clean,
 * labelled layout instead of raw JSON. The shape depends on `field_group`.
 *
 * Internal-only fields (extractor_confidence, eligibility_predicate,
 * is_correction_notice, source_text_ko, country_specific, topik_tier_table)
 * are intentionally never rendered.
 */

const EMPTY = '—';

function text(v: unknown): string {
  if (v === null || v === undefined) return EMPTY;
  const s = String(v).trim();
  return s.length ? s : EMPTY;
}

function humanize(v: unknown): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  const s = String(v).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function yesNo(v: unknown): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return EMPTY;
}

function formatKrw(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return EMPTY;
  return `${new Intl.NumberFormat('en-US').format(v)} KRW`;
}

function formatKst(v: unknown): string {
  if (typeof v !== 'string' || !v) return EMPTY;
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

function formatAwardValue(awardType: unknown, value: unknown): string {
  if (value === null || value === undefined) return EMPTY;
  const type = typeof awardType === 'string' ? awardType : '';
  if (type.includes('pct')) return `${value}%`;
  if (type.includes('krw') || type.includes('stipend') || type.includes('monthly')) {
    return formatKrw(typeof value === 'number' ? value : Number(value));
  }
  return text(value);
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

function Field({ label, value, full }: { label: string; value: ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap break-words">{value}</div>
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

function EmptyState() {
  return (
    <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
      No data extracted for this section.
    </p>
  );
}

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
      if (events.length === 0) return <EmptyState />;
      return (
        <div className="space-y-3">
          {events.map((ev, i) => (
            <RowCard key={i} title={humanize(ev.event_type)}>
              <Field label="Event type" value={humanize(ev.event_type)} />
              <Field label="Date (KST)" value={formatKst(ev.starts_at)} />
              <Field label="Notes" value={text(ev.notes_ko)} full />
            </RowCard>
          ))}
        </div>
      );
    }

    case 'tuition': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyState />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <RowCard key={i} title={text(r.faculty_group)}>
              <Field label="Faculty group" value={text(r.faculty_group)} />
              <Field label="Year" value={text(r.year)} />
              <Field label="Semester" value={text(r.semester)} />
              <Field label="Amount" value={formatKrw(r.amount_krw)} />
              <Field
                label="Admission fee"
                value={formatKrw(r.admission_fee ?? r.admission_fee_krw)}
              />
            </RowCard>
          ))}
        </div>
      );
    }

    case 'requirements': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyState />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const topik =
              r.topik_min_level !== null && r.topik_min_level !== undefined
                ? `Level ${r.topik_min_level}`
                : r.topik_deferred === true
                  ? 'Deferred'
                  : EMPTY;
            const gpa =
              r.gpa_floor_pct !== null && r.gpa_floor_pct !== undefined
                ? `${r.gpa_floor_pct}%`
                : EMPTY;
            return (
              <RowCard key={i} title={text(r.applicant_category)}>
                <Field label="Applicant category" value={text(r.applicant_category)} />
                <Field label="TOPIK level" value={topik} />
                <Field label="English test" value={text(r.english_test)} />
                <Field label="GPA" value={gpa} />
                <Field label="Interview?" value={yesNo(r.interview_required)} />
                <Field label="Eligibility" value={text(r.prose_ko)} full />
              </RowCard>
            );
          })}
        </div>
      );
    }

    case 'scholarships': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyState />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const name = (r.name_en as ReactNode) || (r.name_ko as ReactNode) || EMPTY;
            return (
              <RowCard key={i} title={typeof name === 'string' ? name : undefined}>
                <Field label="Name" value={name} />
                <Field label="Scope" value={humanize(r.scope)} />
                <Field label="Award type" value={humanize(r.award_type)} />
                <Field label="Value" value={formatAwardValue(r.award_type, r.award_value)} />
                <Field label="Eligibility" value={text(r.prose_ko)} full />
              </RowCard>
            );
          })}
        </div>
      );
    }

    case 'documents_required': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyState />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <RowCard key={i} title={humanize(r.document_type)}>
              <Field label="Document" value={humanize(r.document_type)} />
              <Field label="Required?" value={yesNo(r.is_required)} />
              <Field label="Apostille?" value={yesNo(r.is_apostille_required)} />
              <Field label="Notes" value={text(r.notes_ko)} full />
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
