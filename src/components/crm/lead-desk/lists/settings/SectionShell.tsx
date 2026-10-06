import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { fieldClass } from '../FilterControls';
import { addTags } from '../settingsModel';
import type { SectionState } from './useSettingsSection';

/** The saved / unsaved line every section ends with. */
export function SaveStatus({ section }: { section: Pick<SectionState<unknown>, 'dirty' | 'saving' | 'error' | 'savedAt'> }) {
  if (section.saving) {
    return (
      <span className="flex items-center gap-1 text-[12px] text-muted-foreground" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Saqlanmoqda…
      </span>
    );
  }
  if (section.error) {
    return (
      <span className="text-[12px] font-medium text-destructive" role="alert">
        Saqlanmadi: {section.error}
      </span>
    );
  }
  if (section.dirty) {
    return (
      <span className="text-[12px] font-medium text-warning" role="status">
        Saqlanmagan o'zgarishlar
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[12px] text-muted-foreground" role="status">
      <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      Saqlangan{section.savedAt ? ` · ${section.savedAt}` : ''}
    </span>
  );
}

interface SectionShellProps {
  id: string;
  title: string;
  description?: ReactNode;
  section: Pick<SectionState<unknown>, 'dirty' | 'saving' | 'error' | 'savedAt' | 'save' | 'revert'>;
  children: ReactNode;
  /** extra buttons next to Saqlash */
  actions?: ReactNode;
}

/** Title, the section's fields, and the Saqlash / Bekor qilish row with the saved state. */
export function SectionShell({ id, title, description, section, children, actions }: SectionShellProps) {
  return (
    <section aria-labelledby={`sec-${id}`} className="space-y-4 rounded-md border bg-background p-4">
      <header>
        <h2 id={`sec-${id}`} className="text-base font-semibold">
          {title}
        </h2>
        {description && <div className="mt-0.5 text-[13px] text-muted-foreground">{description}</div>}
      </header>
      <div className="space-y-3">{children}</div>
      <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" onClick={() => void section.save()} disabled={!section.dirty || section.saving}>
          Saqlash
        </Button>
        <Button size="sm" variant="outline" onClick={section.revert} disabled={!section.dirty || section.saving}>
          Bekor qilish
        </Button>
        {actions}
        <span className="ml-auto">
          <SaveStatus section={section} />
        </span>
      </footer>
    </section>
  );
}

export function FieldLabel({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    // the hint stays outside the <label>, so the label (and the field's accessible name) is just "label"
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        {label}
        {children}
      </label>
      {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  className,
  type = 'text',
  inputClassName,
  inputMode,
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
  inputClassName?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FieldLabel label={label} hint={hint} className={className}>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClass, 'h-9 font-normal', inputClassName)}
      />
    </FieldLabel>
  );
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[12px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />
    </div>
  );
}

/** A list of short words: Enter or comma adds, × removes. */
export function TagEditor({
  label,
  tags,
  onChange,
  placeholder,
  tone = 'neutral',
}: {
  label: string;
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: 'neutral' | 'danger';
}) {
  const [text, setText] = useState('');
  const commit = () => {
    if (!text.trim()) return;
    onChange(addTags(tags, text));
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="list" aria-label={label}>
        {tags.length === 0 && <span className="text-[12px] text-muted-foreground">Ro'yxat bo'sh</span>}
        {tags.map((t) => (
          <span
            key={t}
            role="listitem"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px]',
              tone === 'danger' ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/60',
            )}
          >
            {t}
            <button
              type="button"
              aria-label={`Olib tashlash: ${t}`}
              className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => onChange(tags.filter((x) => x !== t))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          aria-label={`${label}: yangi so'z`}
          value={text}
          placeholder={placeholder ?? "So'z yozing, Enter bosing"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          className={cn(fieldClass, 'h-9 flex-1')}
        />
        <Button type="button" size="sm" variant="outline" className="h-9" onClick={commit} disabled={!text.trim()}>
          Qo'shish
        </Button>
      </div>
    </div>
  );
}
