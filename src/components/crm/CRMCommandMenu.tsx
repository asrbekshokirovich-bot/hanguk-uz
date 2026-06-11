import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { SidebarGroup } from '@/components/crm/CRMSidebar';

/**
 * ⌘K command-style search for the CRM header. Renders the header search pill
 * and a command palette populated from the real, role-filtered nav groups —
 * selecting an item navigates to its existing route. No new data or routes;
 * this is a faster way into the same pages. Opens via the pill or ⌘K / Ctrl+K.
 */
export function CRMCommandMenu({ groups }: { groups: SidebarGroup[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-56"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t('common.search', 'Search')}</span>
        <kbd className="ml-auto hidden rounded bg-muted px-1.5 font-mono text-[11px] font-semibold text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t('common.searchPagesPlaceholder', 'Search pages…')} />
        <CommandList>
          <CommandEmpty>{t('common.noResults', 'No results found.')}</CommandEmpty>
          {groups
            .filter((group) => group.visible)
            .map((group) => {
              const items = group.items.filter((item) => item.visible);
              if (items.length === 0) return null;
              return (
                <CommandGroup key={group.id} heading={group.title}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.url + item.title}
                      value={`${group.title} ${item.title}`}
                      onSelect={() => go(item.url)}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default CRMCommandMenu;
