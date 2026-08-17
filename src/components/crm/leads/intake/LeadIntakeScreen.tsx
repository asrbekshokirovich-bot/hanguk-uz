import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CERTIFICATES,
  CHANNELS,
  CITIES,
  LEVELS,
  SOURCES,
  needsSourceNote,
  semesterOptions,
} from './options';
import {
  EMPTY_FORM,
  type IntakeErrorKey,
  type IntakeForm,
  describeDate,
  hasErrors,
  initialsOf,
  isoDaysFromNow,
  joinName,
  validateIntake,
  validateSavable,
  missingCount,
} from './intakeForm';
import { useRelativeDate } from './useRelativeDate';

interface LeadIntakeScreenProps {
  /** The form to start from — an existing lead's answers, or a blank sheet. */
  initial: IntakeForm;
  /** Whether this is a new record, which changes the heading only. */
  isNew: boolean;
  now: Date;
  busy: boolean;
  onClose: () => void;
  onSave: (form: IntakeForm) => void;
}

/* ── shared field chrome ───────────────────────────────────────────────── */

const fieldClass =
  'h-11 rounded-[10px] border border-input bg-background px-3.5 text-[15px] text-foreground ' +
  'outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/35';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-[14px] border border-border bg-card p-6 sm:p-7">
    <h3 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {title}
    </h3>
    {children}
  </section>
);

const FieldError = ({ show, message }: { show: boolean; message: string }) =>
  show ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null;

/**
 * A pill in a single-choice row.
 *
 * Rendered as a radio rather than a button so the group is announced as a
 * choice and arrow keys move between the options — a row of buttons looks the
 * same and behaves nothing like it.
 */
const ChoicePill = ({
  name,
  value,
  selected,
  onSelect,
  square,
}: {
  name: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
  /** The study-track row uses squared corners in the design; chips are round. */
  square?: boolean;
}) => (
  <label
    className={cn(
      'inline-flex min-h-11 cursor-pointer items-center px-5 text-sm font-semibold transition',
      square ? 'rounded-[10px] px-6' : 'rounded-full',
      'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-card',
      selected
        ? 'border-2 border-primary bg-primary text-primary-foreground'
        : 'border border-input bg-background text-foreground hover:bg-muted',
    )}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={selected}
      onChange={() => onSelect(value)}
      className="sr-only"
    />
    {value}
  </label>
);

const ChoiceRow = ({
  name,
  options,
  value,
  onSelect,
  square,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onSelect: (value: string) => void;
  square?: boolean;
}) => (
  <div className="flex flex-wrap gap-2.5">
    {options.map((option) => (
      <ChoicePill
        key={option}
        name={name}
        value={option}
        selected={value === option}
        onSelect={onSelect}
        square={square}
      />
    ))}
  </div>
);

/* ── the screen ────────────────────────────────────────────────────────── */

/**
 * The full-screen lead intake sheet.
 *
 * Full-screen rather than a drawer because it asks eleven questions across four
 * groups; at drawer width the choice rows wrap into an unreadable stack. The
 * form is local state and is only lifted on save, so an abandoned edit leaves
 * no trace on the record.
 *
 * Errors stay hidden until the first save attempt: flagging a field the
 * operator has not reached yet reads as a failure they caused.
 */
export const LeadIntakeScreen = ({
  initial,
  isNew,
  now,
  busy,
  onClose,
  onSave,
}: LeadIntakeScreenProps) => {
  const { t } = useTranslation();
  const relative = useRelativeDate(now);
  const [form, setForm] = useState<IntakeForm>(initial);
  const [showErrors, setShowErrors] = useState(false);

  // Re-seed when the operator opens a different lead without closing first.
  //
  // An EXISTING record that is still missing answers opens with its hints
  // already showing. Hiding them until a save attempt was right when the form
  // refused to save without them — flagging a field nobody had reached yet
  // reads as a failure the operator caused. Now that a half-filled lead saves,
  // reopening one is precisely the act of coming back to finish it, and the
  // whole page exists to answer "whose record is still missing answers": the
  // operator should see WHICH, not just how many. A blank new sheet still
  // starts quiet.
  useEffect(() => {
    setForm(initial);
    setShowErrors(!isNew && hasErrors(validateIntake(initial)));
  }, [initial, isNew]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const errors = useMemo(() => validateIntake(form), [form]);
  const semesters = useMemo(() => semesterOptions(now), [now]);
  const followUp = describeDate(form.followUp, now);

  const set = <K extends keyof IntakeForm>(key: K) => (value: IntakeForm[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  /** Errors are only shown once the operator has tried to save. */
  const errorShown = (key: IntakeErrorKey) => showErrors && Boolean(errors[key]);

  // What blocks the save is only the name — see `validateSavable`. The rest of
  // `errors` still drives the per-field hints, so the operator can see what is
  // outstanding without being stopped by it.
  const blocking = useMemo(() => validateSavable(form), [form]);
  const missing = useMemo(() => missingCount(form), [form]);

  const handleSave = () => {
    if (hasErrors(blocking)) {
      setShowErrors(true);
      return;
    }
    onSave(form);
  };

  const heading = isNew
    ? t('leads.intake.newTitle')
    : joinName(form.firstName, form.lastName) || t('leads.intake.newTitle');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex flex-none items-center gap-3.5 border-b border-border bg-card px-5 py-4 sm:px-7">
        <span
          aria-hidden
          className="grid h-[42px] w-[42px] place-items-center rounded-full bg-muted text-sm font-bold text-primary"
        >
          {initialsOf(joinName(form.firstName, form.lastName))}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold tracking-[-0.01em]">{heading}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t('leads.intake.allRequired')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="grid h-10 w-10 flex-none place-items-center rounded-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-7">
        <div className="mx-auto flex max-w-[840px] flex-col gap-7">
          {/* ── personal ─────────────────────────────────────────────── */}
          <Section title={t('leads.intake.sections.personal')}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="intake-first" className="text-[13px] font-semibold">
                  {t('leads.intake.fields.firstName')}
                </label>
                <input
                  id="intake-first"
                  value={form.firstName}
                  onChange={(event) => set('firstName')(event.target.value)}
                  placeholder={t('leads.intake.placeholders.firstName')}
                  aria-invalid={errorShown('firstName')}
                  className={fieldClass}
                />
                <FieldError
                  show={errorShown('firstName')}
                  message={t('leads.intake.errors.firstName')}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="intake-last" className="text-[13px] font-semibold">
                  {t('leads.intake.fields.lastName')}
                </label>
                <input
                  id="intake-last"
                  value={form.lastName}
                  onChange={(event) => set('lastName')(event.target.value)}
                  placeholder={t('leads.intake.placeholders.lastName')}
                  aria-invalid={errorShown('lastName')}
                  className={fieldClass}
                />
                <FieldError
                  show={errorShown('lastName')}
                  message={t('leads.intake.errors.lastName')}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="intake-phone" className="text-[13px] font-semibold">
                  {t('leads.intake.fields.phone')}
                </label>
                <input
                  id="intake-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => set('phone')(event.target.value)}
                  placeholder={t('leads.intake.placeholders.phone')}
                  aria-invalid={errorShown('phone')}
                  className={cn(fieldClass, 'tabular-nums')}
                />
                <FieldError show={errorShown('phone')} message={t('leads.intake.errors.phone')} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="intake-age" className="text-[13px] font-semibold">
                  {t('leads.intake.fields.age')}
                </label>
                <input
                  id="intake-age"
                  inputMode="numeric"
                  value={form.age}
                  onChange={(event) => set('age')(event.target.value)}
                  placeholder={t('leads.intake.placeholders.age')}
                  aria-invalid={errorShown('age')}
                  className={cn(fieldClass, 'tabular-nums')}
                />
                <FieldError show={errorShown('age')} message={t('leads.intake.errors.age')} />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="intake-city" className="text-[13px] font-semibold">
                  {t('leads.intake.fields.city')}
                </label>
                <select
                  id="intake-city"
                  value={form.city}
                  onChange={(event) => set('city')(event.target.value)}
                  aria-invalid={errorShown('city')}
                  className={cn(fieldClass, 'px-3')}
                >
                  <option value="">{t('leads.intake.placeholders.city')}</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <FieldError show={errorShown('city')} message={t('leads.intake.errors.city')} />
              </div>
            </div>
          </Section>

          {/* ── education ────────────────────────────────────────────── */}
          <Section title={t('leads.intake.sections.education')}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="intake-cert" className="text-[13px] font-semibold">
                  {t('leads.intake.fields.cert')}
                </label>
                <select
                  id="intake-cert"
                  value={form.cert}
                  onChange={(event) => set('cert')(event.target.value)}
                  aria-invalid={errorShown('cert')}
                  className={cn(fieldClass, 'px-3')}
                >
                  <option value="">{t('leads.intake.placeholders.cert')}</option>
                  {CERTIFICATES.map((cert) => (
                    <option key={cert} value={cert}>
                      {cert}
                    </option>
                  ))}
                </select>
                <FieldError show={errorShown('cert')} message={t('leads.intake.errors.cert')} />
              </div>

              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 text-[13px] font-semibold">
                  {t('leads.intake.fields.level')}
                </legend>
                <ChoiceRow
                  name="intake-level"
                  options={LEVELS}
                  value={form.level}
                  onSelect={set('level')}
                  square
                />
                <FieldError show={errorShown('level')} message={t('leads.intake.errors.level')} />
              </fieldset>

              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 text-[13px] font-semibold">
                  {t('leads.intake.fields.semester')}
                </legend>
                <ChoiceRow
                  name="intake-semester"
                  options={semesters}
                  value={form.semester}
                  onSelect={set('semester')}
                />
                <FieldError
                  show={errorShown('semester')}
                  message={t('leads.intake.errors.semester')}
                />
              </fieldset>
            </div>
          </Section>

          {/* ── where they came from ─────────────────────────────────── */}
          <Section title={t('leads.intake.sections.contactSource')}>
            <div className="flex flex-col gap-6">
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 text-[13px] font-semibold">
                  {t('leads.intake.fields.channel')}
                </legend>
                <ChoiceRow
                  name="intake-channel"
                  options={CHANNELS}
                  value={form.channel}
                  onSelect={set('channel')}
                />
                <FieldError
                  show={errorShown('channel')}
                  message={t('leads.intake.errors.channel')}
                />
              </fieldset>

              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 text-[13px] font-semibold">
                  {t('leads.intake.fields.source')}
                </legend>
                <ChoiceRow
                  name="intake-source"
                  options={SOURCES}
                  value={form.source}
                  onSelect={set('source')}
                />
                <FieldError show={errorShown('source')} message={t('leads.intake.errors.source')} />
              </fieldset>

              {needsSourceNote(form.source) && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="intake-source-note" className="text-[13px] font-semibold">
                    {t('leads.intake.fields.sourceNote')}
                  </label>
                  <input
                    id="intake-source-note"
                    value={form.sourceNote}
                    onChange={(event) => set('sourceNote')(event.target.value)}
                    placeholder={t('leads.intake.placeholders.sourceNote')}
                    className={fieldClass}
                  />
                </div>
              )}
            </div>
          </Section>

          {/* ── note and follow-up ───────────────────────────────────── */}
          <Section title={t('leads.intake.sections.note')}>
            <div className="flex flex-col gap-2">
              <label htmlFor="intake-note" className="text-[13px] font-semibold">
                {t('leads.intake.fields.note')}{' '}
                <span className="font-medium text-muted-foreground">
                  {t('leads.intake.optional')}
                </span>
              </label>
              <textarea
                id="intake-note"
                rows={4}
                value={form.note}
                onChange={(event) => set('note')(event.target.value)}
                placeholder={t('leads.intake.placeholders.note')}
                className={cn(fieldClass, 'h-auto resize-y py-3 leading-relaxed')}
              />
              <p className="text-xs text-muted-foreground">{t('leads.intake.noteHint')}</p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <label htmlFor="intake-follow-up" className="text-[13px] font-semibold">
                {t('leads.intake.fields.followUp')}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="intake-follow-up"
                  type="date"
                  value={form.followUp}
                  onChange={(event) => set('followUp')(event.target.value)}
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={() => set('followUp')(isoDaysFromNow(1, now))}
                  className="min-h-11 rounded-[10px] border border-input px-4 text-[13px] font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('leads.intake.quick.tomorrow')}
                </button>
                <button
                  type="button"
                  onClick={() => set('followUp')(isoDaysFromNow(7, now))}
                  className="min-h-11 rounded-[10px] border border-input px-4 text-[13px] font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('leads.intake.quick.inWeek')}
                </button>
              </div>
              {followUp && (
                <p className="text-[13px] text-muted-foreground">
                  {t('leads.intake.scheduled', { when: relative.label(followUp) })}
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>

      <footer className="flex flex-none items-center justify-end gap-5 border-t border-border bg-card px-5 py-4 sm:px-7">
        {showErrors && hasErrors(blocking) ? (
          <p role="status" className="text-[13px] font-medium text-destructive">
            {t('leads.intake.needName')}
          </p>
        ) : missing > 0 ? (
          // Not an error — a note. The lead saves as it is and comes back to
          // the top of the list marked incomplete, which is where the office
          // finds it again.
          <p role="status" className="text-[13px] font-medium text-muted-foreground">
            {t('leads.intake.savePartial', { count: missing })}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="min-h-11 rounded-[10px] bg-primary px-8 text-[15px] font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {busy ? t('leads.intake.saving') : t('leads.intake.save')}
        </button>
      </footer>
    </div>
  );
};
