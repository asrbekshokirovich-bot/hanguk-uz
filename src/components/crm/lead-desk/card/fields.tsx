/**
 * Lead card — the one-tap pickers the card and the call popup share: the 5
 * mandatory fields (§5.1), "Nima to'xtatyapti?", "Boshqa markaz?", "Bizni
 * kimdan eshitdingiz?", Kutish and Yo'qotildi.
 *
 * They are controlled and know nothing about saving: the card saves on change,
 * the popup keeps a draft until "Saqlash".
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CERTIFICATES,
  DECIDER_LABEL,
  GOALS,
  MAX_AGE,
  MIN_AGE,
  MISSING_FIELD_LABEL,
  REFERRAL_TYPE_LABEL,
  REGIONS,
  STUDY_YEARS,
  WAIT_REASON_LABEL,
} from '../copy';
import type { Decider, LostReasonSetting, OfferSetting, ReferralType, WaitReason } from '../types';
import {
  NO_COMPETITOR,
  addDaysKey,
  missingMandatory,
  offerOptions,
  queueName,
  tomorrowKey,
  type MandatoryKey,
  type MandatoryValue,
} from './cardLogic';
import { Chip, ChipGroup, FieldLabel, inputCls, type ChipOption } from './ui';

const toOptions = (list: readonly string[]): ChipOption<string>[] => list.map((v) => ({ value: v, label: v }));

// ---- objection / competitor / referral -------------------------------------------------

interface ObjectionPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  /** lead_settings.objections: the LABEL is what gets stored (reports group on it) */
  options: { key: string; label: string }[];
  invalid?: boolean;
  /** the answer given on an earlier call, shown muted */
  previous?: string | null;
  disabled?: boolean;
}

export function ObjectionPicker({ value, onChange, options, invalid, previous, disabled }: ObjectionPickerProps) {
  const opts = options.map((o) => ({ value: o.label, label: o.label }));
  if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: value });
  return (
    <div>
      <FieldLabel missing={invalid} hint={previous ? `oldingi: ${previous}` : undefined}>
        {MISSING_FIELD_LABEL.objection}
      </FieldLabel>
      <ChipGroup
        label={MISSING_FIELD_LABEL.objection}
        options={opts}
        value={value}
        onChange={onChange}
        invalid={invalid}
        disabled={disabled}
      />
    </div>
  );
}

interface CompetitorPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  competitors: string[];
  invalid?: boolean;
  previous?: string | null;
  disabled?: boolean;
}

const OTHER = 'Boshqa';

export function CompetitorPicker({ value, onChange, competitors, invalid, previous, disabled }: CompetitorPickerProps) {
  const names = [NO_COMPETITOR, ...competitors.filter((c) => c !== OTHER), OTHER];
  const typed = value != null && value !== '' && !names.includes(value);
  const otherChosen = value === OTHER || typed;
  return (
    <div>
      <FieldLabel missing={invalid} hint={previous ? `oldingi: ${previous}` : undefined}>
        {MISSING_FIELD_LABEL.competitor}
      </FieldLabel>
      <div role="group" aria-label={MISSING_FIELD_LABEL.competitor} className="flex flex-wrap gap-1.5">
        {names.map((n) => {
          const selected = n === OTHER ? otherChosen : value === n;
          return (
            <Chip
              key={n}
              selected={selected}
              invalid={invalid}
              disabled={disabled}
              onClick={() => onChange(selected ? null : n)}
            >
              {n}
            </Chip>
          );
        })}
      </div>
      {otherChosen && (
        <input
          aria-label="Boshqa markaz nomi"
          placeholder="Markaz nomi"
          value={typed ? (value ?? '') : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.trim() === '' ? OTHER : e.target.value)}
          className={cn(inputCls, 'mt-1.5 max-w-[240px]')}
        />
      )}
    </div>
  );
}

interface ReferralPickerProps {
  type: ReferralType | null;
  name: string | null;
  onType: (t: ReferralType | null) => void;
  onName: (n: string) => void;
  /** the card saves the name when the field loses focus */
  onNameBlur?: () => void;
  title?: string;
  disabled?: boolean;
  prominent?: boolean;
}

export function ReferralPicker({ type, name, onType, onName, onNameBlur, title, disabled, prominent }: ReferralPickerProps) {
  const options = (Object.keys(REFERRAL_TYPE_LABEL) as ReferralType[]).map((k) => ({ value: k, label: REFERRAL_TYPE_LABEL[k] }));
  return (
    <div className={cn(prominent && 'rounded-md border border-accent/60 bg-accent/10 p-2.5')}>
      <FieldLabel hint={prominent ? 'ixtiyoriy, lekin muhim — tavsiya birinchi ustuvorlik' : undefined}>
        {title ?? 'Bizni kimdan eshitdingiz?'}
      </FieldLabel>
      <ChipGroup<ReferralType>
        label="Tavsiya turi"
        options={options}
        value={type}
        onChange={onType}
        allowClear
        disabled={disabled}
      />
      {type && (
        <input
          aria-label="Tavsiya qilgan odam ismi"
          placeholder="Kim tavsiya qildi? (ism)"
          value={name ?? ''}
          disabled={disabled}
          onChange={(e) => onName(e.target.value)}
          onBlur={onNameBlur}
          className={cn(inputCls, 'mt-1.5')}
        />
      )}
    </div>
  );
}

interface ProductFitPickerProps {
  value: string | null;
  onChange: (key: string | null) => void;
  offers: Record<string, OfferSetting> | undefined;
  /** offer keys the card recommends for this lead (marked with a star) */
  recommended?: string[];
  invalid?: boolean;
  disabled?: boolean;
}

/** "Taklif turi": writes `product_fit` (the offer's key). Needed before the stage Taklif. */
export function ProductFitPicker({ value, onChange, offers, recommended = [], invalid, disabled }: ProductFitPickerProps) {
  const options = offerOptions(offers).map((o) => ({
    ...o,
    label: recommended.includes(o.value) ? `★ ${o.label}` : o.label,
  }));
  return (
    <div>
      <FieldLabel missing={invalid}>{MISSING_FIELD_LABEL.product_fit}</FieldLabel>
      <ChipGroup
        label={MISSING_FIELD_LABEL.product_fit}
        options={options}
        value={value}
        onChange={onChange}
        invalid={invalid}
        disabled={disabled}
      />
    </div>
  );
}

// ---- the 5 mandatory fields ------------------------------------------------------------

interface MandatoryFieldsEditorProps {
  value: MandatoryValue;
  onChange: (patch: Partial<MandatoryValue>) => void;
  /** which rows start expanded; default: the empty ones. The rest are one-line summaries. */
  initialOpen?: MandatoryKey[];
  /** commit the age on every valid keystroke (the popup keeps a draft); otherwise on blur / Enter */
  liveAge?: boolean;
  /** keys the server reported missing: painted red even if the form thinks they are filled */
  highlight?: string[];
  disabled?: boolean;
}

const LABEL: Record<MandatoryKey, string> = {
  goal: 'Maqsad',
  certificate: 'Sertifikat / daraja',
  age_grade: 'Yosh / sinf',
  region: 'Viloyat',
  decider: 'Kim qaror qiladi / to‘laydi',
};

function ageValid(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_AGE && n <= MAX_AGE;
}

export function MandatoryFieldsEditor({ value, onChange, initialOpen, liveAge, highlight = [], disabled }: MandatoryFieldsEditorProps) {
  const [open, setOpen] = useState<Set<MandatoryKey>>(() => new Set(initialOpen ?? missingMandatory(value)));
  const missing = new Set<string>([...missingMandatory(value), ...highlight]);
  const toggle = (k: MandatoryKey) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });

  const [ageText, setAgeText] = useState(value.age != null ? String(value.age) : '');
  useEffect(() => setAgeText(value.age != null ? String(value.age) : ''), [value.age]);
  const ageBad = ageText.trim() !== '' && !ageValid(Number(ageText));
  const commitAge = () => {
    const t = ageText.trim();
    if (t === '') {
      if (value.age != null) onChange({ age: null });
    } else if (ageValid(Number(t))) {
      if (Number(t) !== value.age) onChange({ age: Number(t) });
    } else {
      setAgeText(value.age != null ? String(value.age) : '');
    }
  };

  const summary: Record<MandatoryKey, string | null> = {
    goal: value.education_level || null,
    certificate: value.cert_level || null,
    age_grade: [value.age != null ? `${value.age} yosh` : '', value.study_year ?? ''].filter(Boolean).join(', ') || null,
    region: value.city || null,
    decider: value.decider ? DECIDER_LABEL[value.decider] : null,
  };

  const row = (key: MandatoryKey, body: ReactNode) => {
    const isMissing = missing.has(key);
    const collapsed = !open.has(key) && summary[key] != null && !isMissing;
    if (collapsed) {
      return (
        <div key={key} data-field={key}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggle(key)}
            aria-label={`${LABEL[key]}: ${summary[key]} — o'zgartirish`}
            className="flex w-full min-h-0 min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left text-[12.5px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="w-[8.5rem] shrink-0 font-semibold text-muted-foreground">{LABEL[key]}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{summary[key]}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      );
    }
    return (
      <div key={key} data-field={key}>
        <FieldLabel missing={isMissing}>{LABEL[key]}</FieldLabel>
        {body}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {row(
        'goal',
        <ChipGroup
          label="Maqsad"
          options={toOptions(GOALS)}
          value={value.education_level}
          onChange={(v) => onChange({ education_level: v })}
          invalid={missing.has('goal')}
          disabled={disabled}
        />,
      )}
      {row(
        'certificate',
        <ChipGroup
          label="Sertifikat / daraja"
          options={toOptions(CERTIFICATES)}
          value={value.cert_level}
          onChange={(v) => onChange({ cert_level: v })}
          invalid={missing.has('certificate')}
          disabled={disabled}
        />,
      )}
      {row(
        'age_grade',
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              aria-label="Yosh"
              placeholder="Yosh"
              min={MIN_AGE}
              max={MAX_AGE}
              value={ageText}
              disabled={disabled}
              onChange={(e) => {
                setAgeText(e.target.value);
                if (liveAge) {
                  const t = e.target.value.trim();
                  if (t === '') onChange({ age: null });
                  else if (ageValid(Number(t))) onChange({ age: Number(t) });
                }
              }}
              onBlur={commitAge}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitAge();
                }
              }}
              className={cn(inputCls, 'w-20', (ageBad || (missing.has('age_grade') && !value.study_year)) && 'border-destructive/60')}
            />
            <span className={cn('text-[11px]', ageBad ? 'text-destructive' : 'text-muted-foreground')}>
              {MIN_AGE}–{MAX_AGE} yosh yoki sinf / kurs
            </span>
          </div>
          <ChipGroup
            label="Sinf / kurs"
            options={toOptions(STUDY_YEARS)}
            value={value.study_year}
            onChange={(v) => onChange({ study_year: v })}
            invalid={missing.has('age_grade') && value.age == null}
            allowClear
            disabled={disabled}
          />
        </div>,
      )}
      {row(
        'region',
        <ChipGroup
          label="Viloyat"
          options={toOptions(REGIONS)}
          value={value.city}
          onChange={(v) => onChange({ city: v })}
          invalid={missing.has('region')}
          disabled={disabled}
        />,
      )}
      {row(
        'decider',
        <ChipGroup<Decider>
          label="Kim qaror qiladi / to‘laydi"
          options={(Object.keys(DECIDER_LABEL) as Decider[]).map((k) => ({ value: k, label: DECIDER_LABEL[k] }))}
          value={value.decider}
          onChange={(v) => onChange({ decider: v })}
          invalid={missing.has('decider')}
          disabled={disabled}
        />,
      )}
    </div>
  );
}

// ---- Kutish / Yo'qotildi ------------------------------------------------------------------

const WAIT_QUICK: { label: string; days: number }[] = [
  { label: '+3 kun', days: 3 },
  { label: '+1 hafta', days: 7 },
  { label: '+2 hafta', days: 14 },
  { label: '+1 oy', days: 30 },
];

interface WaitFieldsProps {
  date: string;
  onDate: (d: string) => void;
  reason: WaitReason | null;
  onReason: (r: WaitReason | null) => void;
  invalidDate?: boolean;
  invalidReason?: boolean;
}

export function WaitFields({ date, onDate, reason, onReason, invalidDate, invalidReason }: WaitFieldsProps) {
  return (
    <div className="space-y-2.5">
      <div>
        <FieldLabel missing={invalidDate} htmlFor="wait-until">
          Qachongacha kutamiz?
        </FieldLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            id="wait-until"
            type="date"
            min={tomorrowKey()}
            value={date}
            onChange={(e) => onDate(e.target.value)}
            className={cn(inputCls, 'w-40', invalidDate && 'border-destructive/60')}
          />
          {WAIT_QUICK.map((q) => (
            <Chip key={q.label} selected={date === addDaysKey(q.days)} onClick={() => onDate(addDaysKey(q.days))}>
              {q.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel missing={invalidReason}>Kutish sababi</FieldLabel>
        <ChipGroup<WaitReason>
          label="Kutish sababi"
          options={(Object.keys(WAIT_REASON_LABEL) as WaitReason[]).map((k) => ({ value: k, label: WAIT_REASON_LABEL[k] }))}
          value={reason}
          onChange={onReason}
          invalid={invalidReason}
        />
      </div>
    </div>
  );
}

interface LostFieldsProps {
  reasons: LostReasonSetting[];
  reason: string | null;
  onReason: (key: string) => void;
  competitor: string;
  onCompetitor: (c: string) => void;
  competitorSuggestions: string[];
  invalidReason?: boolean;
  invalidCompetitor?: boolean;
}

export function LostFields({
  reasons,
  reason,
  onReason,
  competitor,
  onCompetitor,
  competitorSuggestions,
  invalidReason,
  invalidCompetitor,
}: LostFieldsProps) {
  return (
    <div className="space-y-2.5">
      <div>
        <FieldLabel missing={invalidReason}>Yo'qotish sababi</FieldLabel>
        <div role="group" aria-label="Yo'qotish sababi" className="grid grid-cols-2 gap-1.5">
          {reasons.map((r) => {
            const queue = queueName(r.queue);
            const selected = reason === r.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onReason(r.key)}
                className={cn(
                  'flex min-h-0 min-w-0 flex-col items-start rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
                  invalidReason && !selected && 'border-destructive/60',
                )}
              >
                <span className="font-medium">{r.label}</span>
                <span className={cn('text-[10.5px]', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {queue ? `→ ${queue} navbati` : 'navbatga tushmaydi'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {reason === 'other_center' && (
        <div>
          <FieldLabel missing={invalidCompetitor} htmlFor="lost-competitor">
            Qaysi markaz?
          </FieldLabel>
          <input
            id="lost-competitor"
            value={competitor}
            onChange={(e) => onCompetitor(e.target.value)}
            placeholder="Markaz nomi"
            className={cn(inputCls, invalidCompetitor && 'border-destructive/60')}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {competitorSuggestions
              .filter((c) => c !== OTHER)
              .map((c) => (
                <Chip key={c} selected={competitor === c} onClick={() => onCompetitor(c)}>
                  {c}
                </Chip>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
