import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Reusable, on-brand empty / error state (Hanguk Design System, audit C4).
 *
 * Pass already-localized strings (call `t()` at the use site). Use for empty
 * lists, "no results", and recoverable errors (provide an `action` with a
 * localized Retry label). Typography uses the shared type scale.
 */
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="h4">{title}</h3>
      {description && (
        <p className="body-sm mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <Button variant="outline" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
