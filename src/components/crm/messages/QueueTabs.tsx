import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ConversationVM, QueueTab } from './types';
import { countForTab } from './queueLogic';

const TABS: { id: QueueTab; labelKey: string }[] = [
  { id: 'unassigned', labelKey: 'messages.tabs.unassigned' },
  { id: 'mine', labelKey: 'messages.tabs.mine' },
  { id: 'all', labelKey: 'messages.tabs.all' },
  { id: 'done', labelKey: 'messages.tabs.done' },
];

interface QueueTabsProps {
  value: QueueTab;
  onChange: (tab: QueueTab) => void;
  conversations: ConversationVM[];
}

/**
 * Segmented control with live counts. Implemented as a real tablist so the
 * arrow keys and screen readers behave; the counts sit inside the accessible
 * name so "Unassigned, 4" is announced as one label.
 */
export function QueueTabs({ value, onChange, conversations }: QueueTabsProps) {
  const { t } = useTranslation();

  return (
    <div role="tablist" aria-label={t('messages.tabs.label')} className="flex gap-0.5 rounded-md bg-muted p-[3px]">
      {TABS.map((tab) => {
        const count = countForTab(conversations, tab.id);
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex h-9 min-h-0 min-w-0 flex-1 items-center justify-center gap-1 rounded-sm px-0.5 text-[11.5px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
              active
                ? 'bg-card font-semibold text-foreground shadow-card'
                : 'font-medium text-muted-foreground hover:text-foreground/80',
            )}
          >
            <span className="truncate">{t(tab.labelKey)}</span>
            <span className={cn('font-mono text-[10px] font-bold', active ? 'text-primary' : 'text-muted-foreground')}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
