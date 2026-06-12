import { useState, useRef, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskQuickAddProps {
  onQuickAdd: (title: string) => Promise<void>;
  onOpenFullForm: () => void;
  disabled?: boolean;
}

export function TaskQuickAdd({ onQuickAdd, onOpenFullForm, disabled }: TaskQuickAddProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    try {
      await onQuickAdd(value.trim());
      setValue('');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setValue('');
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 shadow-sm transition-all',
        focused && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground"
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('tasks.quickAddInline')}
        className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        disabled={loading || disabled}
      />

      <Button
        variant="ghost"
        size="sm"
        className="hidden text-muted-foreground sm:inline-flex"
        onClick={onOpenFullForm}
      >
        <User className="mr-1.5 h-4 w-4" />
        {t('tasks.assign')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="hidden text-muted-foreground sm:inline-flex"
        onClick={onOpenFullForm}
      >
        <Calendar className="mr-1.5 h-4 w-4" />
        {t('tasks.dueBtn')}
      </Button>
      <Button variant="secondary" size="sm" onClick={handleSubmit} disabled={!value.trim() || loading}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t('common.add')}
      </Button>
    </div>
  );
}
