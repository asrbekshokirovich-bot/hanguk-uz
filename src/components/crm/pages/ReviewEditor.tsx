import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Code2, FormInput, Plus, Trash2 } from 'lucide-react';
import {
  itemsKey,
  validateParsedOutput,
  type DiffEntry,
  type ValidationError,
} from './reviewLogic';

type FormFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'enum' | 'datetime';

interface FormField {
  key: string;
  /** i18n key under `uniReview.edit.f.` — the reviewer is not an engineer. */
  label: string;
  type: FormFieldType;
  options?: string[];
  /** Human labels for an enum, keyed under `uniReview.edit.o.`. */
  optionLabels?: boolean;
}

/**
 * Event types a reviewer will actually meet. The extractor may emit others
 * (the schema has a long tail plus an `other` catch-all); an unrecognised
 * value is preserved and shown as-is rather than silently rewritten.
 */
const EVENT_TYPE_OPTIONS = [
  'apply_open',
  'apply_close',
  'document_submission_deadline',
  'first_stage_results',
  'interview',
  'practical_exam',
  'final_results',
  'additional_admit',
  'registration_open',
  'registration_close',
  'orientation',
  'semester_start',
  'other',
];

const ROUND_KIND_OPTIONS = ['application', 'supplementary', 'season', 'term'];

const STATUS_OPTIONS = ['required', 'not_required', 'not_stated'];

// Editable fields surfaced per field group. Any keys NOT listed here are
// preserved untouched on the working copy (e.g. source_text_ko, tier tables,
// country_specific), so the structured form never silently drops extractor data.
const FORM_FIELDS: Record<string, FormField[]> = {
  requirements: [
    { key: 'applicant_category', label: 'applicantCategory', type: 'text' },
    { key: 'topik_status', label: 'topikStatus', type: 'enum', options: STATUS_OPTIONS, optionLabels: true },
    { key: 'topik_min_level', label: 'topikMinLevel', type: 'number' },
    { key: 'english_status', label: 'englishStatus', type: 'enum', options: STATUS_OPTIONS, optionLabels: true },
    { key: 'gpa_status', label: 'gpaStatus', type: 'enum', options: STATUS_OPTIONS, optionLabels: true },
    { key: 'gpa_floor_pct', label: 'gpaFloorPct', type: 'number' },
    { key: 'interview_required', label: 'interviewRequired', type: 'boolean' },
    { key: 'practical_exam_required', label: 'practicalExamRequired', type: 'boolean' },
    { key: 'prose_ko', label: 'proseKo', type: 'textarea' },
  ],
  documents_required: [
    { key: 'document_type', label: 'documentType', type: 'text' },
    { key: 'is_required', label: 'isRequired', type: 'boolean' },
    { key: 'is_apostille_required', label: 'apostilleRequired', type: 'boolean' },
    { key: 'applies_to_round', label: 'appliesToRound', type: 'text' },
    { key: 'deadline', label: 'deadline', type: 'text' },
    { key: 'notes_ko', label: 'notesKo', type: 'textarea' },
  ],
  scholarships: [
    { key: 'name_ko', label: 'nameKo', type: 'text' },
    { key: 'name_en', label: 'nameEn', type: 'text' },
    { key: 'scope', label: 'scope', type: 'text' },
    { key: 'award_type', label: 'awardType', type: 'text' },
    { key: 'award_value', label: 'awardValue', type: 'number' },
    { key: 'prose_ko', label: 'proseKo', type: 'textarea' },
  ],
  tuition: [
    { key: 'faculty_group', label: 'facultyGroup', type: 'text' },
    { key: 'academic_year', label: 'academicYear', type: 'text' },
    { key: 'semester_number', label: 'semesterNumber', type: 'text' },
    { key: 'amount_krw', label: 'amountKrw', type: 'number' },
    { key: 'admission_fee_krw', label: 'admissionFeeKrw', type: 'number' },
    { key: 'is_first_semester', label: 'isFirstSemester', type: 'boolean' },
  ],
  calendar: [
    { key: 'event_type', label: 'eventType', type: 'enum', options: EVENT_TYPE_OPTIONS, optionLabels: true },
    { key: 'starts_at', label: 'startsAt', type: 'datetime' },
    { key: 'ends_at', label: 'endsAt', type: 'datetime' },
    { key: 'is_tentative', label: 'isTentative', type: 'boolean' },
    { key: 'round_label', label: 'roundLabel', type: 'text' },
    { key: 'round_kind', label: 'roundKind', type: 'enum', options: ROUND_KIND_OPTIONS, optionLabels: true },
    { key: 'notes_ko', label: 'notesKo', type: 'textarea' },
  ],
};

const UNSET = '\u2014';

/**
 * Every stored timestamp is KST-anchored (`YYYY-MM-DDTHH:MM:SS+09:00`), which
 * is what the extraction prompt guarantees. The reviewer sees a date/time
 * picker showing exactly those Korean wall-clock digits.
 *
 * The conversion is deliberately string surgery rather than `new Date(...)`:
 * routing through a Date would render the value in the BROWSER's timezone, so
 * a reviewer in Tashkent (UTC+5) would open a 09:00 KST deadline, see 05:00,
 * and "correct" it — silently moving a real deadline by four hours. Slicing
 * the offset off and putting it back keeps the stored value byte-identical
 * unless the reviewer actually edits it.
 */
export function isoToLocalInput(v: unknown): string {
  if (typeof v !== 'string') return '';
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v);
  return m ? `${m[1]}T${m[2]}` : '';
}

export function localInputToIso(input: string, previous: unknown): string | null {
  if (!input) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(input);
  if (!m) return null;
  // Preserve whatever offset the extractor stored; default to KST, which is
  // what the prompt emits and what every guideline states its dates in.
  const prev = typeof previous === 'string' ? previous : '';
  const offset = /([+-]\d{2}:\d{2}|Z)$/.exec(prev)?.[1] ?? '+09:00';
  return `${m[1]}T${m[2]}:00${offset}`;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function getItems(value: unknown, key: 'rows' | 'events'): Array<Record<string, unknown>> {
  const arr = asRecord(value)[key];
  return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
  t,
}: {
  field: FormField;
  value: unknown;
  disabled?: boolean;
  onChange: (next: unknown) => void;
  t: TFunction;
}) {
  if (field.type === 'datetime') {
    return (
      <Input
        type="datetime-local"
        disabled={disabled}
        value={isoToLocalInput(value)}
        onChange={(e) => onChange(localInputToIso(e.target.value, value))}
      />
    );
  }
  if (field.type === 'textarea') {
    return (
      <Textarea
        rows={3}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <Input
        type="number"
        disabled={disabled}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === '') return onChange(null);
          const n = Number(t);
          onChange(Number.isFinite(n) ? n : t); // non-numeric kept verbatim so validation flags it
        }}
      />
    );
  }
  if (field.type === 'boolean') {
    const current = value === true ? 'true' : value === false ? 'false' : UNSET;
    return (
      <Select
        value={current}
        disabled={disabled}
        onValueChange={(v) => onChange(v === 'true' ? true : v === 'false' ? false : null)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('uniReview.edit.yes')}</SelectItem>
          <SelectItem value="false">{t('uniReview.edit.no')}</SelectItem>
          <SelectItem value={UNSET}>{UNSET}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field.type === 'enum') {
    const current = typeof value === 'string' && value ? value : UNSET;
    return (
      <Select
        value={current}
        disabled={disabled}
        onValueChange={(v) => onChange(v === UNSET ? undefined : v)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* An extractor value outside the list stays selectable, so
              opening the form never rewrites data the reviewer did not touch. */}
          {[...new Set([...(field.options ?? []), ...(current !== UNSET ? [current] : [])])].map(
            (o) => (
              <SelectItem key={o} value={o}>
                {field.optionLabels ? t(`uniReview.edit.o.${o}`, { defaultValue: o }) : o}
              </SelectItem>
            ),
          )}
          <SelectItem value={UNSET}>{UNSET}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      disabled={disabled}
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    />
  );
}

function ValidationErrors({ errors, label }: { errors: ValidationError[]; label: string }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-1">
      <p className="text-xs font-medium text-destructive flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {label}
      </p>
      <ul className="text-xs text-destructive/90 list-disc pl-5 space-y-0.5">
        {errors.slice(0, 8).map((e, i) => (
          <li key={i}>
            <code>{e.path}</code>: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Structured, labelled editor for a field group's `parsed_output`, with a
 * raw-JSON power-user fallback. Owns presentation only — the parent validates
 * (also via `validateParsedOutput`), diffs, and commits.
 */
export function StructuredReviewEditor({
  fieldGroup,
  value,
  onChange,
  disabled,
}: {
  fieldGroup: string | null;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'form' | 'json'>(
    FORM_FIELDS[fieldGroup ?? ''] ? 'form' : 'json',
  );
  // An extraction that produced nothing opens this editor with an empty
  // payload, and the schema rightly says `events: Required`. Showing that as a
  // red error before the reviewer has typed anything reads as "you have done
  // something wrong" when they have not even started — and six cards in the
  // queue are in exactly that state. Errors appear once there is something to
  // be wrong about: the reviewer edited, or the payload already has items.
  const [touched, setTouched] = useState(false);
  const [rawText, setRawText] = useState(() => JSON.stringify(value, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);

  // Re-seed the JSON textarea when entering JSON mode or when the item changes.
  useEffect(() => {
    if (mode === 'json') {
      setRawText(JSON.stringify(value, null, 2));
      setRawError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fields = fieldGroup ? FORM_FIELDS[fieldGroup] : undefined;
  const key = itemsKey(fieldGroup);
  const items = getItems(value, key);
  const validation = useMemo(() => validateParsedOutput(fieldGroup, value), [fieldGroup, value]);

  const change = (next: Record<string, unknown>) => {
    setTouched(true);
    onChange(next);
  };

  const updateItem = (index: number, fieldKey: string, next: unknown) => {
    const cloned = structuredClone(value) as Record<string, unknown>;
    const arr = Array.isArray(cloned[key]) ? (cloned[key] as Array<Record<string, unknown>>) : [];
    const row = { ...(arr[index] ?? {}) };
    if (next === undefined) delete row[fieldKey];
    else row[fieldKey] = next;
    arr[index] = row;
    cloned[key] = arr;
    change(cloned);
  };

  const addItem = () => {
    const cloned = structuredClone(value) as Record<string, unknown>;
    const arr = Array.isArray(cloned[key]) ? (cloned[key] as Array<Record<string, unknown>>) : [];
    arr.push({});
    cloned[key] = arr;
    change(cloned);
  };

  const removeItem = (index: number) => {
    const cloned = structuredClone(value) as Record<string, unknown>;
    const arr = Array.isArray(cloned[key]) ? (cloned[key] as Array<Record<string, unknown>>) : [];
    arr.splice(index, 1);
    cloned[key] = arr;
    change(cloned);
  };

  const onRawChange = (t: string) => {
    setRawText(t);
    try {
      const parsed = JSON.parse(t);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setRawError('Top level must be a JSON object');
        return;
      }
      setRawError(null);
      change(parsed as Record<string, unknown>);
    } catch (err) {
      setRawError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setMode((m) => (m === 'form' ? 'json' : 'form'))}
          disabled={disabled || !fields}
          title={!fields ? 'No structured form for this field group' : undefined}
        >
          {mode === 'form' ? (
            <>
              <Code2 className="h-3.5 w-3.5 mr-1.5" /> {t('uniReview.edit.rawJson')}
            </>
          ) : (
            <>
              <FormInput className="h-3.5 w-3.5 mr-1.5" /> {t('uniReview.edit.form')}
            </>
          )}
        </Button>
      </div>

      {mode === 'json' || !fields ? (
        <>
          <Textarea
            className="font-mono text-xs"
            rows={16}
            value={rawText}
            onChange={(e) => onRawChange(e.target.value)}
            disabled={disabled}
          />
          {rawError ? (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {rawError}
            </p>
          ) : null}
        </>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-xs italic text-muted-foreground">
              {t('uniReview.edit.emptyHint')}
            </p>
          ) : (
            items.map((row, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t(key === 'events' ? 'uniReview.edit.event' : 'uniReview.edit.row')} {idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('uniReview.edit.remove')}
                  </Button>
                </div>
                {typeof row.source_text_ko === 'string' && row.source_text_ko.trim() ? (
                  // The verbatim Korean line this row came from. A reviewer
                  // correcting a date needs to see what the PDF actually said,
                  // and it is the audit anchor — never editable here.
                  <p className="rounded bg-muted/60 px-2 py-1.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                    {row.source_text_ko as string}
                  </p>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {fields.map((f) => (
                    <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <Label className="text-xs text-muted-foreground">
                        {t(`uniReview.edit.f.${f.label}`, { defaultValue: f.label })}
                      </Label>
                      <FieldInput
                        field={f}
                        value={row[f.key]}
                        disabled={disabled}
                        onChange={(next) => updateItem(idx, f.key, next)}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />{' '}
            {t(key === 'events' ? 'uniReview.edit.addEvent' : 'uniReview.edit.addRow')}
          </Button>
        </div>
      )}

      {!validation.ok && (touched || items.length > 0) ? (
        <ValidationErrors errors={validation.errors} label={t('uniReview.edit.invalid')} />
      ) : null}
    </div>
  );
}

function renderValue(v: unknown): string {
  if (v === undefined) return '∅';
  if (v === null) return 'null';
  if (typeof v === 'string') return v === '' ? '""' : v;
  return JSON.stringify(v);
}

export function DiffList({ entries }: { entries: DiffEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No fields changed.</p>;
  }
  return (
    <div className="rounded-md border divide-y max-h-72 overflow-auto">
      {entries.map((e, i) => (
        <div key={i} className="px-3 py-2 space-y-1 text-sm">
          <div className="font-mono text-xs text-muted-foreground">{e.path}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded bg-destructive/5 border border-destructive/20 px-2 py-1 break-words">
              <span className="text-[10px] uppercase tracking-wide text-destructive/70">before</span>
              <div className="whitespace-pre-wrap break-words">{renderValue(e.before)}</div>
            </div>
            <div className="rounded bg-success/5 border border-success/20 px-2 py-1 break-words">
              <span className="text-[10px] uppercase tracking-wide text-success">after</span>
              <div className="whitespace-pre-wrap break-words">{renderValue(e.after)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
