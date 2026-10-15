import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputCls } from './ui';

interface InlineTextProps {
  label: string;
  value: string | null | undefined;
  /** save the new text; resolve false when it was refused (the editor stays closed, the card rolls back) */
  onSave: (next: string) => void | Promise<unknown>;
  placeholder?: string;
  /** shown in front of the value in display mode ("@") */
  prefix?: string;
  /** buttons after the value (copy, call) */
  actions?: ReactNode;
  disabled?: boolean;
  type?: 'text' | 'tel';
  className?: string;
}

/** A label + value that turns into an input on click and saves on Enter / blur. */
export function InlineText({ label, value, onSave, placeholder, prefix, actions, disabled, type = 'text', className }: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const cancelled = useRef(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft.trim() !== (value ?? '').trim()) void onSave(draft);
  };

  return (
    <div className={cn('flex min-h-[1.75rem] items-center gap-2 text-[12.5px]', className)}>
      <span className="w-[6.5rem] shrink-0 font-semibold text-muted-foreground">{label}</span>
      {editing ? (
        <input
          ref={ref}
          type={type}
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              cancelled.current = true;
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(inputCls, 'h-7 flex-1')}
        />
      ) : (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            aria-label={`${label}: ${value ? `${prefix ?? ''}${value}` : 'bo‘sh'} — o'zgartirish`}
            className="group flex min-h-0 min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className={cn('min-w-0 truncate', value ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {value ? `${prefix ?? ''}${value}` : placeholder ?? '—'}
            </span>
            {!disabled && <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />}
          </button>
          {actions}
        </>
      )}
    </div>
  );
}
