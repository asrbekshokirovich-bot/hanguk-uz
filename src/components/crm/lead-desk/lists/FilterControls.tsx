import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small, dense filter controls for the list pages. Native <select> / <input>
 * on purpose: they are keyboard friendly, fast with hundreds of options and
 * testable; the look follows ui/input.
 */
export const fieldClass =
  'h-8 rounded-md border border-input bg-background px-2 text-[13px] ring-offset-background placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}

export function SearchBox({ value, onChange, placeholder, label, className }: SearchBoxProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldClass, 'w-full pl-7 pr-7')}
      />
      {value && (
        <button
          type="button"
          aria-label="Qidiruvni tozalash"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** text of the "no filter" option */
  allLabel?: string;
  className?: string;
}

export function FilterSelect({ label, value, onChange, options, allLabel = 'Barchasi', className }: FilterSelectProps) {
  return (
    <label className={cn('flex flex-col gap-0.5 text-[11px] font-medium text-muted-foreground', className)}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass, 'min-w-[7rem] text-foreground')}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function DateField({ label, value, onChange, className }: DateFieldProps) {
  return (
    <label className={cn('flex flex-col gap-0.5 text-[11px] font-medium text-muted-foreground', className)}>
      {label}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass, 'text-foreground')} />
    </label>
  );
}

/** A page header: title, one explanatory line and the actions on the right. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
