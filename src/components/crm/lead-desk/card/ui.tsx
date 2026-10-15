/**
 * Lead card — the small building blocks every block shares: chips, section
 * frames, labels with the "empty" dot, compact inputs.
 *
 * `index.css` gives every button and link a 44px touch target; the card is a
 * dense desktop surface (spec §2.3), so each of these opts out with
 * `min-h-0 min-w-0`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputCls =
  'h-8 min-h-0 w-full rounded-md border border-input bg-background px-2.5 text-[13px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const textareaCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

interface ChipProps {
  selected?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Chip({ selected, invalid, disabled, onClick, children, title, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected ?? false}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 min-h-0 min-w-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted',
        invalid && !selected && 'border-destructive/60',
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface ChipGroupProps<T extends string> {
  /** accessible name of the group; also how tests find it */
  label: string;
  options: ChipOption<T>[];
  value: T | null | undefined;
  onChange: (next: T | null) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** tapping the selected chip clears it */
  allowClear?: boolean;
  className?: string;
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  invalid,
  disabled,
  allowClear,
  className,
}: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => (
        <Chip
          key={o.value}
          selected={value === o.value}
          invalid={invalid}
          disabled={disabled || o.disabled}
          title={o.hint}
          onClick={() => onChange(value === o.value && allowClear ? null : o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** The red dot for an empty mandatory field. */
export function MissingDot({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="to'ldirilmagan"
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive', className)}
    />
  );
}

interface FieldLabelProps {
  children: ReactNode;
  missing?: boolean;
  hint?: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FieldLabel({ children, missing, hint, className, htmlFor }: FieldLabelProps) {
  return (
    <div className={cn('mb-1 flex items-center gap-1.5', className)}>
      {missing && <MissingDot />}
      <label
        htmlFor={htmlFor}
        className={cn('text-[12px] font-semibold', missing ? 'text-destructive' : 'text-foreground')}
      >
        {children}
      </label>
      {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
    </div>
  );
}

interface SectionProps {
  title: string;
  /** shown on the right of the header (an indicator, a count) */
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** A block of the card. Long ones collapse; nothing hides behind a tab (spec §6). */
export function Section({ title, right, defaultOpen = true, children, className, id }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className={cn('rounded-lg border border-border bg-card', className)}>
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-0 min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <h3 className="text-[12.5px] font-bold text-foreground">{title}</h3>
        </button>
        {right}
      </header>
      {open && <div className="border-t border-border px-3 pb-3 pt-2.5">{children}</div>}
    </section>
  );
}

/** A small tonal badge (stage, status, channel). */
export function Pill({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'lime';
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-muted text-muted-foreground',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
    lime: 'bg-accent/20 text-accent-foreground',
  };
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A compact icon-only button. */
export function IconButton({
  label,
  onClick,
  children,
  disabled,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A destructive action that asks once, inline. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  children,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);
  if (armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className="inline-flex h-7 min-h-0 min-w-0 items-center rounded-md bg-destructive px-2 text-[11px] font-semibold text-destructive-foreground"
      >
        {confirmLabel}
      </button>
    );
  }
  return (
    <IconButton label={label} onClick={() => setArmed(true)} className="hover:text-destructive">
      {children}
    </IconButton>
  );
}
