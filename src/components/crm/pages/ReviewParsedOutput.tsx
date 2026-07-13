import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NOT_SPECIFIED,
  resolveStatusField,
  classifyTrack,
  mapCalendarEvents,
  countryRules,
  type TrackRelevance,
} from './reviewLogic';
import {
  reviewLang,
  formatReviewDate,
  formatMoney,
  formatTopik,
  getRowLabel,
  collectOriginalTexts,
} from './reviewFriendly';
import { ConfidenceLight, OriginalTextToggle } from './ReviewFriendly';

/**
 * Renders the AI-extracted `parsed_output` for one review-queue item as a
 * plain-language, localized layout (uz/en via the app i18n). Every field
 * defined for a `field_group` is always shown — a missing value renders as
 * "Not specified" so reviewers see the full structure.
 *
 * Korean free-text is never inlined: rows show a precomputed English field
 * (e.g. `prose_en`) when the backend joined one, or the optional extractor
 * row label (`label_uz` / `label_en`); the Korean originals are collapsed
 * behind an "Show original text" disclosure per row. No translation happens
 * at render time, so the text a reviewer approves is exactly the stored text.
 *
 * Internal-only fields (eligibility_predicate raw, is_correction_notice,
 * country_specific internals) are never rendered.
 */

const NS = NOT_SPECIFIED;

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

function englishRequirement(v: unknown): string {
  if (v === null || v === undefined) return NS;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o.min_score === 'number') {
      const t = typeof o.test === 'string' ? o.test.toUpperCase().replace(/_/g, ' ') : 'English test';
      return `${t} ${o.min_score}`;
    }
    if (o.deferred === true) return '__deferred__';
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
 * Localize the shared value sentinels ("Not specified", yes/no, …). Kept as a
 * hook so the pure helpers above stay sentinel-based and unit-testable.
 */
function useValueText() {
  const { t, i18n } = useTranslation();
  const lang = reviewLang(i18n.language);
  const ns = t('uniReview.values.notSpecified');
  return {
    t,
    lang,
    ns,
    /** Map the NS sentinel (and empty) to the localized "Not specified". */
    v: (s: string): string => (s === NS ? ns : s),
    yesNo: (val: unknown): string =>
      val === true ? t('uniReview.values.yes') : val === false ? t('uniReview.values.no') : ns,
    money: (val: unknown): string => formatMoney(val) ?? ns,
    date: (val: unknown): string => formatReviewDate(val, lang) ?? (typeof val === 'string' && val.trim() ? val : ns),
    status: (statusVal: unknown, concrete: string | null): { text: string; muted: boolean } => {
      const r = resolveStatusField(statusVal, concrete);
      if (r.text === 'Not required') return { text: t('uniReview.values.notRequired'), muted: false };
      if (r.text === 'Required') return { text: t('uniReview.values.required'), muted: false };
      if (r.text === NS) return { text: ns, muted: true };
      return r;
    },
  };
}

function Field({
  label,
  value,
  full,
  muted: mutedOverride,
  nsText,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
  muted?: boolean;
  /** The localized "Not specified" string, to derive the muted style. */
  nsText?: string;
}) {
  const muted = mutedOverride ?? (nsText !== undefined && value === nsText);
  return (
    <div className={full ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm whitespace-pre-wrap break-words ${muted ? 'text-muted-foreground italic' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function RowCard({
  title,
  headerRight,
  originalTexts,
  children,
}: {
  title?: string;
  headerRight?: ReactNode;
  originalTexts?: string[];
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
      {originalTexts && originalTexts.length ? <OriginalTextToggle texts={originalTexts} /> : null}
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
  const { t, ns, money } = useValueText();
  const list = Array.isArray(rows)
    ? rows.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    : [];
  if (list.length === 0) {
    return <span className="text-sm text-muted-foreground italic">{ns}</span>;
  }
  const award = (awardType: unknown, value: unknown): string => {
    const ty = typeof awardType === 'string' ? awardType : '';
    if (ty.includes('pct') || ty.includes('tuition_waiver')) {
      return value != null
        ? t('uniReview.awards.waiverPct', { pct: value })
        : t('uniReview.awards.waiver');
    }
    if (ty.includes('stipend') || ty.includes('monthly')) {
      return value != null
        ? t('uniReview.awards.stipendMonthly', { amount: money(value) })
        : t('uniReview.awards.stipend');
    }
    if (!ty) return ns;
    return value != null ? `${humanize(ty)} (${value})` : humanize(ty);
  };
  const duration = (d: unknown): string => {
    if (typeof d === 'string' && ['first_semester', 'full_year', 'all_years'].includes(d)) {
      return t(`uniReview.durations.${d}`);
    }
    const h = humanize(d);
    return h === NS ? ns : h;
  };
  return (
    <div className="rounded-md border divide-y overflow-hidden">
      <div className="grid grid-cols-3 text-xs font-medium bg-muted/50 px-2 py-1">
        <div>{scoreLabel}</div>
        <div>{t('uniReview.fields.award')}</div>
        <div>{t('uniReview.fields.duration')}</div>
      </div>
      {list.map((r, i) => (
        <div key={i} className="grid grid-cols-3 text-sm px-2 py-1">
          <div>{r[scoreKey] == null ? ns : String(r[scoreKey])}</div>
          <div>{award(r.award_type, r.award_value ?? null)}</div>
          <div>{duration(r.duration)}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyRows() {
  const { t } = useTranslation();
  return (
    <p className="text-sm text-muted-foreground italic rounded-lg border border-dashed p-3">
      {t('uniReview.emptySection')}
    </p>
  );
}

function RequirementCard({ r, track }: { r: Record<string, unknown>; track?: TrackRelevance }) {
  const { t, lang, ns, v, yesNo, money, status } = useValueText();

  const topikConcrete =
    r.topik_min_level !== null && r.topik_min_level !== undefined
      ? (formatTopik(r.topik_min_level) ?? `TOPIK ${r.topik_min_level}`)
      : r.topik_deferred === true
        ? t('uniReview.values.deferred')
        : null;
  const topik = status(r.topik_status, topikConcrete);

  const engRaw = englishRequirement(r.english_test);
  const engStr = engRaw === '__deferred__' ? t('uniReview.values.deferred') : engRaw;
  const english = status(r.english_status, engStr === NS ? null : engStr);

  const gpaConcrete =
    r.gpa_floor_pct !== null && r.gpa_floor_pct !== undefined ? `${r.gpa_floor_pct}%` : null;
  const gpa = status(r.gpa_status, gpaConcrete);

  const isHeritage = (track ?? classifyTrack(r)) === 'korean_heritage';
  const label = getRowLabel(r, lang);
  const proseEn = typeof r.prose_en === 'string' && r.prose_en.trim() ? r.prose_en.trim() : null;

  return (
    <RowCard
      title={label ?? v(text(r.applicant_category))}
      headerRight={
        <div className="flex items-center gap-1.5">
          {isHeritage ? (
            <span
              className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground"
              title={t('uniReview.heritage.none')}
            >
              {t('uniReview.heritage.badge')}
            </span>
          ) : null}
          <ConfidenceLight score={typeof r.extractor_confidence === 'number' ? r.extractor_confidence : null} />
        </div>
      }
      originalTexts={collectOriginalTexts(r)}
    >
      <Field label={t('uniReview.fields.applicantCategory')} value={v(text(r.applicant_category))} nsText={ns} />
      <Field label={t('uniReview.fields.topik')} value={topik.text} muted={topik.muted} />
      <Field label={t('uniReview.fields.english')} value={english.text} muted={english.muted} />
      <Field label={t('uniReview.fields.gpaFloor')} value={gpa.text} muted={gpa.muted} />
      <Field label={t('uniReview.fields.interview')} value={yesNo(r.interview_required)} nsText={ns} />
      <Field label={t('uniReview.fields.practicalExam')} value={yesNo(r.practical_exam_required)} nsText={ns} />
      <Field label={t('uniReview.fields.majors')} value={v(text(r.majors))} nsText={ns} />
      <Field
        label={t('uniReview.fields.tuitionTrack')}
        value={money((r.tuition as Record<string, unknown> | undefined)?.amount_krw)}
        nsText={ns}
      />
      <Field
        label={t('uniReview.fields.eligibility')}
        value={proseEn ?? (typeof r.prose_ko === 'string' && r.prose_ko.trim() ? t('uniReview.koreanOnly') : ns)}
        muted={!proseEn}
        full
      />
    </RowCard>
  );
}

// Foreign-applicant tracks (외국인전형) render first; Korean-heritage /
// overseas-Korean tracks are collapsed behind a disclosure so they don't drown
// out the relevant data.
// `classifyRows` carries the original Korean rows (when the displayed `rows`
// have been translated to English) so track detection — which keys off Korean
// markers like 외국인전형 / 재외국민 — keeps working. It defaults to `rows`.
function RequirementsCards({
  rows,
  classifyRows,
}: {
  rows: Array<Record<string, unknown>>;
  classifyRows?: Array<Record<string, unknown>>;
}) {
  const { t } = useTranslation();
  const [showHeritage, setShowHeritage] = useState(false);
  const items = rows.map((row, i) => ({
    row,
    track: classifyTrack((classifyRows?.[i] ?? row) as Record<string, unknown>),
  }));
  const relevant = items.filter((it) => it.track !== 'korean_heritage');
  const heritage = items.filter((it) => it.track === 'korean_heritage');
  return (
    <div className="space-y-3">
      {relevant.length === 0 && heritage.length > 0 ? (
        <p className="text-sm text-muted-foreground italic rounded-lg border border-dashed p-3">
          {t('uniReview.heritage.none')}
        </p>
      ) : null}
      {relevant.map((it, i) => (
        <RequirementCard key={i} r={it.row} track={it.track} />
      ))}
      {heritage.length > 0 ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHeritage((v) => !v)}
            className="text-xs text-muted-foreground hover:underline"
          >
            {showHeritage
              ? t('uniReview.heritage.hide', { n: heritage.length })
              : t('uniReview.heritage.show', { n: heritage.length })}
          </button>
          {showHeritage
            ? heritage.map((it, i) => <RequirementCard key={i} r={it.row} track={it.track} />)
            : null}
        </div>
      ) : null}
    </div>
  );
}

function CalendarView({ parsedOutput }: { parsedOutput: unknown }) {
  const { t, ns, date, money } = useValueText();
  const events = getArray(parsedOutput, 'events');
  const { slots, other } = mapCalendarEvents(events);
  const periods = getArray(parsedOutput, 'periods');
  const applicationFee = periods.find((p) => p.application_fee_krw != null)?.application_fee_krw;

  const eventLines = (evts: Array<Record<string, unknown>>): ReactNode => {
    if (evts.length === 0) return ns;
    return (
      <div className="space-y-0.5">
        {evts.map((e, i) => (
          <div key={i}>
            {date(e.starts_at)}
            {e.is_tentative ? ` (${t('uniReview.values.tentative')})` : ''}
            {typeof e.notes_en === 'string' && e.notes_en.trim() ? (
              <span className="text-muted-foreground"> — {e.notes_en.trim()}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <RowCard originalTexts={collectOriginalTexts(parsedOutput)}>
        {slots.map((slot) => (
          <Field
            key={slot.key}
            label={t(`uniReview.slots.${slot.key}`)}
            value={eventLines(slot.events)}
            nsText={ns}
            full
          />
        ))}
        <Field label={t('uniReview.fields.offlineApplication')} value={ns} nsText={ns} full />
        <Field
          label={t('uniReview.fields.applicationFee')}
          value={applicationFee != null ? money(applicationFee) : ns}
          nsText={ns}
          full
        />
      </RowCard>
      {other.length > 0 ? (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-sm font-semibold">
            {t('uniReview.slots.otherDates', { n: other.length })}
          </div>
          <div className="space-y-1">
            {other.map((e, i) => (
              <div key={i} className="text-sm">
                <span className="text-muted-foreground">{humanize(e.event_type)}:</span>{' '}
                {date(e.starts_at)}
                {e.is_tentative ? ` (${t('uniReview.values.tentative')})` : ''}
                {typeof e.notes_en === 'string' && e.notes_en.trim() ? (
                  <span className="text-muted-foreground"> — {e.notes_en.trim()}</span>
                ) : null}
              </div>
            ))}
          </div>
          <OriginalTextToggle texts={collectOriginalTexts(other)} />
        </div>
      ) : null}
    </div>
  );
}

export function ReviewParsedOutput({
  fieldGroup,
  parsedOutput,
  classifyFrom,
}: {
  fieldGroup: string | null;
  /** Payload to display. May be an English translation of the stored Korean. */
  parsedOutput: unknown;
  /**
   * Optional original (Korean) payload to derive track relevance from when
   * `parsedOutput` has been translated. Defaults to `parsedOutput`.
   */
  classifyFrom?: unknown;
}) {
  // A component per field group would be cleaner, but the switch keeps parity
  // with the backend FIELD_GROUP_SCHEMAS in one visible place.
  return (
    <ReviewParsedOutputInner
      fieldGroup={fieldGroup}
      parsedOutput={parsedOutput}
      classifyFrom={classifyFrom}
    />
  );
}

function ReviewParsedOutputInner({
  fieldGroup,
  parsedOutput,
  classifyFrom,
}: {
  fieldGroup: string | null;
  parsedOutput: unknown;
  classifyFrom?: unknown;
}) {
  const { t, lang, ns, v, yesNo, money, date } = useValueText();

  switch (fieldGroup) {
    case 'calendar':
      return <CalendarView parsedOutput={parsedOutput} />;

    case 'requirements': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows />;
      const classifyRows = getArray(classifyFrom ?? parsedOutput, 'rows');
      return <RequirementsCards rows={rows} classifyRows={classifyRows} />;
    }

    case 'tuition': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <RowCard
              key={i}
              title={getRowLabel(r, lang) ?? v(text(r.faculty_group))}
              headerRight={
                <ConfidenceLight
                  score={typeof r.extractor_confidence === 'number' ? r.extractor_confidence : null}
                />
              }
              originalTexts={collectOriginalTexts(r)}
            >
              <Field label={t('uniReview.fields.facultyGroup')} value={v(text(r.faculty_group))} nsText={ns} />
              <Field label={t('uniReview.fields.academicYear')} value={v(text(r.academic_year ?? r.year))} nsText={ns} />
              <Field label={t('uniReview.fields.semester')} value={v(text(r.semester_number ?? r.semester))} nsText={ns} />
              <Field label={t('uniReview.fields.firstSemester')} value={yesNo(r.is_first_semester)} nsText={ns} />
              <Field label={t('uniReview.fields.tuition')} value={money(r.amount_krw)} nsText={ns} />
              <Field
                label={t('uniReview.fields.admissionFee')}
                value={money(r.admission_fee_krw ?? r.admission_fee)}
                nsText={ns}
              />
            </RowCard>
          ))}
        </div>
      );
    }

    case 'scholarships': {
      const rows = getArray(parsedOutput, 'rows');
      if (rows.length === 0) return <EmptyRows />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const name = getRowLabel(r, lang) ?? (r.name_en ? text(r.name_en) : text(r.name_ko));
            const predicate = r.eligibility_predicate as Record<string, unknown> | undefined;
            const predicateNote =
              predicate && typeof predicate.prose_note === 'string' ? predicate.prose_note : null;
            const proseEn = typeof r.prose_en === 'string' && r.prose_en.trim() ? r.prose_en.trim() : null;
            const eligibility =
              proseEn ??
              (typeof r.prose_ko === 'string' && r.prose_ko.trim() ? t('uniReview.koreanOnly') : ns);
            const scope =
              typeof r.scope === 'string' &&
              ['national', 'university', 'department', 'foundation', 'regional'].includes(r.scope)
                ? t(`uniReview.scopes.${r.scope}`)
                : v(humanize(r.scope));
            const awardType = typeof r.award_type === 'string' ? r.award_type : '';
            const award = awardType.includes('pct')
              ? r.award_value != null
                ? t('uniReview.awards.waiverPct', { pct: r.award_value })
                : t('uniReview.awards.waiver')
              : awardType.includes('stipend') || awardType.includes('monthly')
                ? r.award_value != null
                  ? t('uniReview.awards.stipendMonthly', { amount: money(r.award_value) })
                  : t('uniReview.awards.stipend')
                : awardType.includes('tuition_waiver')
                  ? r.award_value != null
                    ? money(r.award_value)
                    : t('uniReview.awards.waiver')
                  : v(humanize(awardType));
            return (
              <RowCard
                key={i}
                title={name !== NS ? name : t('uniReview.section.scholarships')}
                headerRight={
                  <ConfidenceLight
                    score={typeof r.extractor_confidence === 'number' ? r.extractor_confidence : null}
                  />
                }
                originalTexts={collectOriginalTexts(r)}
              >
                <Field label={t('uniReview.fields.name')} value={v(name)} nsText={ns} />
                <Field label={t('uniReview.fields.scope')} value={scope} nsText={ns} />
                <Field label={t('uniReview.fields.award')} value={award} nsText={ns} />
                <Field
                  label={t('uniReview.fields.topikTier')}
                  value={<TierTable rows={r.topik_tier_table} scoreKey="topik_level" scoreLabel="TOPIK" />}
                  full
                />
                <Field
                  label={t('uniReview.fields.ieltsTier')}
                  value={<TierTable rows={r.ielts_tier_table} scoreKey="ielts_min" scoreLabel="IELTS" />}
                  full
                />
                <Field
                  label={t('uniReview.fields.eligibility')}
                  value={predicateNote ? `${eligibility}\n(${predicateNote})` : eligibility}
                  muted={!proseEn}
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
      if (rows.length === 0) return <EmptyRows />;
      return (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const rules = countryRules(r);
            const title = getRowLabel(r, lang) ?? v(humanize(r.document_type));
            const notesEn = typeof r.notes_en === 'string' && r.notes_en.trim() ? r.notes_en.trim() : null;
            return (
              <RowCard
                key={i}
                title={title}
                headerRight={
                  <ConfidenceLight
                    score={typeof r.extractor_confidence === 'number' ? r.extractor_confidence : null}
                  />
                }
                originalTexts={collectOriginalTexts(r)}
              >
                <Field label={t('uniReview.fields.document')} value={title} nsText={ns} />
                <Field label={t('uniReview.fields.required')} value={yesNo(r.is_required)} nsText={ns} />
                <Field label={t('uniReview.fields.apostille')} value={yesNo(r.is_apostille_required)} nsText={ns} />
                <Field label={t('uniReview.fields.appliesToRound')} value={v(humanize(r.applies_to_round))} nsText={ns} />
                <Field label={t('uniReview.fields.deadline')} value={date(r.deadline)} nsText={ns} />
                <Field
                  label={t('uniReview.fields.countryRules')}
                  value={
                    rules.length === 0 ? (
                      ns
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {rules.map((cr) => (
                          <span key={cr.country} className="text-xs rounded-full border px-2 py-0.5">
                            <span className="font-medium">{cr.country}</span>: {cr.rules.map(humanize).join(', ')}
                          </span>
                        ))}
                      </div>
                    )
                  }
                  nsText={ns}
                  full
                />
                <Field
                  label={t('uniReview.fields.notes')}
                  value={notesEn ?? (typeof r.notes_ko === 'string' && r.notes_ko.trim() ? t('uniReview.koreanOnly') : ns)}
                  muted={!notesEn}
                  full
                />
              </RowCard>
            );
          })}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          {t('uniReview.structuredViewMissing')}
          {fieldGroup ? ` (${fieldGroup})` : ''}
        </p>
      );
  }
}
