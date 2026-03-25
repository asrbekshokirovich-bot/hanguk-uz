import { useState, useRef, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Settings2 } from 'lucide-react';
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
        "flex items-center gap-2 p-2 rounded-lg border bg-card transition-all",
        focused && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </div>
      
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('tasks.quickAddPlaceholder', 'Quick add task... (Press Enter)')}
        className="flex-1 border-0 shadow-none focus-visible:ring-0 h-8 px-0"
        disabled={loading || disabled}
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onOpenFullForm}
        title={t('tasks.moreOptions', 'More options')}
      >
        <Settings2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
