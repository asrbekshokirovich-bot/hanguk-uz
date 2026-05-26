import { useEffect, useMemo, useState } from 'react';
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

type FormFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'enum';

interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  options?: string[];
}

const STATUS_OPTIONS = ['required', 'not_required', 'not_stated'];

// Editable fields surfaced per field group. Any keys NOT listed here are
// preserved untouched on the working copy (e.g. source_text_ko, tier tables,
// country_specific), so the structured form never silently drops extractor data.
const FORM_FIELDS: Record<string, FormField[]> = {
  requirements: [
    { key: 'applicant_category', label: 'Applicant category (track)', type: 'text' },
    { key: 'topik_status', label: 'TOPIK status', type: 'enum', options: STATUS_OPTIONS },
    { key: 'topik_min_level', label: 'TOPIK min level', type: 'number' },
    { key: 'english_status', label: 'English status', type: 'enum', options: STATUS_OPTIONS },
    { key: 'gpa_status', label: 'GPA status', type: 'enum', options: STATUS_OPTIONS },
    { key: 'gpa_floor_pct', label: 'GPA floor (%)', type: 'number' },
    { key: 'interview_required', label: 'Interview required?', type: 'boolean' },
    { key: 'practical_exam_required', label: 'Practical exam?', type: 'boolean' },
    { key: 'prose_ko', label: 'Eligibility (Korean)', type: 'textarea' },
  ],
  documents_required: [
    { key: 'document_type', label: 'Document type', type: 'text' },
    { key: 'is_required', label: 'Required?', type: 'boolean' },
    { key: 'is_apostille_required', label: 'Apostille required?', type: 'boolean' },
    { key: 'applies_to_round', label: 'Applies to round', type: 'text' },
    { key: 'deadline', label: 'Deadline', type: 'text' },
    { key: 'notes_ko', label: 'Notes (Korean)', type: 'textarea' },
  ],
  scholarships: [
    { key: 'name_ko', label: 'Name (Korean)', type: 'text' },
    { key: 'name_en', label: 'Name (English)', type: 'text' },
    { key: 'scope', label: 'Scope', type: 'text' },
    { key: 'award_type', label: 'Award type', type: 'text' },
    { key: 'award_value', label: 'Award value', type: 'number' },
    { key: 'prose_ko', label: 'Eligibility (Korean)', type: 'textarea' },
  ],
  tuition: [
    { key: 'faculty_group', label: 'Faculty group', type: 'text' },
    { key: 'academic_year', label: 'Academic year', type: 'text' },
    { key: 'semester_number', label: 'Semester', type: 'text' },
    { key: 'amount_krw', label: 'Tuition (KRW)', type: 'number' },
    { key: 'admission_fee_krw', label: 'Admission fee (KRW)', type: 'number' },
    { key: 'is_first_semester', label: 'First semester?', type: 'boolean' },
  ],
  calendar: [
    { key: 'event_type', label: 'Event type', type: 'text' },
    { key: 'starts_at', label: 'Starts at (ISO)', type: 'text' },
    { key: 'is_tentative', label: 'Tentative?', type: 'boolean' },
    { key: 'notes_ko', label: 'Notes (Korean)', type: 'textarea' },
  ],
};

const UNSET = '— (unset)';

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
}: {
  field: FormField;
  value: unknown;
  disabled?: boolean;
  onChange: (next: unknown) => void;
}) {
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
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
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
          {(field.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
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

function ValidationErrors({ errors }: { errors: ValidationError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-1">
      <p className="text-xs font-medium text-destructive flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Invalid — fix before saving:
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
  const [mode, setMode] = useState<'form' | 'json'>(
    FORM_FIELDS[fieldGroup ?? ''] ? 'form' : 'json',
  );
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

  const updateItem = (index: number, fieldKey: string, next: unknown) => {
    const cloned = structuredClone(value) as Record<string, unknown>;
    const arr = Array.isArray(cloned[key]) ? (cloned[key] as Array<Record<string, unknown>>) : [];
    const row = { ...(arr[index] ?? {}) };
    if (next === undefined) delete row[fieldKey];
    else row[fieldKey] = next;
    arr[index] = row;
    cloned[key] = arr;
    onChange(cloned);
  };

  const addItem = () => {
    const cloned = structuredClone(value) as Record<string, unknown>;
    const arr = Array.isArray(cloned[key]) ? (cloned[key] as Array<Record<string, unknown>>) : [];
    arr.push({});
    cloned[key] = arr;
    onChange(cloned);
  };

  const removeItem = (index: number) => {
    const cloned = structuredClone(value) as Record<string, unknown>;
    const arr = Array.isArray(cloned[key]) ? (cloned[key] as Array<Record<string, unknown>>) : [];
    arr.splice(index, 1);
    cloned[key] = arr;
    onChange(cloned);
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
      onChange(parsed as Record<string, unknown>);
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
              <Code2 className="h-3.5 w-3.5 mr-1.5" /> Raw JSON
            </>
          ) : (
            <>
              <FormInput className="h-3.5 w-3.5 mr-1.5" /> Structured form
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
            <p className="text-xs text-muted-foreground italic rounded-md border border-dashed p-3">
              No {key} yet.
            </p>
          ) : (
            items.map((row, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {key === 'events' ? 'Event' : 'Row'} {idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {fields.map((f) => (
                    <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <FieldInput
                        field={f}
                        value={row[f.key]}
                        disabled={disabled}
                        onChange={(next) => updateItem(idx, f.key, next)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add {key === 'events' ? 'event' : 'row'}
          </Button>
        </div>
      )}

      {!validation.ok ? <ValidationErrors errors={validation.errors} /> : null}
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
            <div className="rounded bg-emerald-500/5 border border-emerald-500/20 px-2 py-1 break-words">
              <span className="text-[10px] uppercase tracking-wide text-emerald-600">after</span>
              <div className="whitespace-pre-wrap break-words">{renderValue(e.after)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
