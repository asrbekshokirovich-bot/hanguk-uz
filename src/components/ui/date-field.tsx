import { forwardRef, useEffect, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * A date field that reads day-month-year.
 *
 * `<input type="date">` renders in the BROWSER's locale, not the page's. On a
 * machine set to US English it shows 02/27/2004 — month first — and no
 * attribute, CSS rule or `lang` on the element changes that in Chrome. Staff
 * here read 27.02.2004, and a field that puts the month where the day belongs
 * is not only awkward to read: 02/03/2004 is a different date depending on who
 * is looking at it, and the ambiguous ones are the dates nobody notices are
 * wrong.
 *
 * So the native control is replaced by a plain text field with an explicit
 * `kk.oo.yyyy` order. The value handed to and taken from the form stays the
 * ISO `YYYY-MM-DD` the database column expects — only the display and typing
 * order change.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TYPED_RE = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/;

/** ISO (YYYY-MM-DD) → what the reviewer reads (DD.MM.YYYY). */
export function isoToDisplay(iso: string | null | undefined): string {
  if (typeof iso !== 'string') return '';
  const m = ISO_RE.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/**
 * What the reviewer typed (DD.MM.YYYY, also tolerating - and /) → ISO, or
 * null when it is not yet a real date.
 *
 * Real dates only: 31.02.2004 parses as day 31 of month 2, which does not
 * exist, and is rejected rather than rolled forward to 02.03 the way
 * `new Date(2004, 1, 31)` would. A silently shifted birthday is worse than an
 * empty field.
 */
export function displayToIso(typed: string): string | null {
  const m = TYPED_RE.exec(typed.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Insert the dots as the digits arrive, so nobody types them. */
function autoFormat(raw: string, previous: string): string {
  // Deleting must never re-add a separator the user just removed.
  const deleting = raw.length < previous.length;
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (deleting && /[.\-/]$/.test(raw)) return raw;
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export interface DateFieldProps {
  /** ISO `YYYY-MM-DD`, or '' for empty. */
  value: string;
  /** Called with ISO `YYYY-MM-DD`, or '' when the field is cleared. */
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Forwarded so the surrounding <form> still enforces the field. */
  required?: boolean;
  name?: string;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  (
    { value, onChange, id, name, className, disabled, required, placeholder = 'kk.oo.yyyy' },
    ref,
  ) => {
    const [text, setText] = useState(() => isoToDisplay(value));

    // Follow the form when it changes underneath us (dialog reopened on a
    // different student, a reset), but never while the user is mid-type: that
    // would rewrite "27.0" into "" on every keystroke.
    useEffect(() => {
      const iso = displayToIso(text);
      if (iso !== value) setText(isoToDisplay(value));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const incomplete = text.length > 0 && displayToIso(text) === null;

    return (
      <div className={cn('relative', className)}>
        <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          id={id}
          name={name}
          required={required}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          value={text}
          aria-invalid={incomplete || undefined}
          className={cn('pl-9', incomplete && 'border-destructive focus-visible:ring-destructive')}
          onChange={(e) => {
            const next = autoFormat(e.target.value, text);
            setText(next);
            const iso = displayToIso(next);
            // '' clears the field; a half-typed date is not yet a change, so
            // the form keeps the last real value until the date is complete.
            if (next === '') onChange('');
            else if (iso) onChange(iso);
          }}
        />
      </div>
    );
  },
);
DateField.displayName = 'DateField';
