import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { SidebarGroup } from './CRMSidebar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface CRMSubNavigationProps {
  groups: SidebarGroup[];
  activeGroup: string | null;
}

export function CRMSubNavigation({ groups, activeGroup }: CRMSubNavigationProps) {
  const location = useLocation();
  
  const currentGroup = groups.find(g => g.id === activeGroup);
  
  if (!currentGroup) return null;
  
  const visibleItems = currentGroup.items.filter(item => item.visible);
  
  if (visibleItems.length === 0) return null;

  const isActive = (url: string) => {
    if (url === '/crm') {
      return location.pathname === '/crm' || location.pathname === '/crm/';
    }
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  return (
    <div className="border-b bg-muted/30">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1 px-4 py-2">
          {visibleItems.map((item) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === '/crm'}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                  "hover:bg-accent hover:text-accent-foreground",
                  active && "bg-primary text-primary-foreground shadow-sm",
                  !active && item.highlight && "bg-accent/50 border border-primary/20"
                )}
                activeClassName="bg-primary text-primary-foreground shadow-sm"
              >
                <item.icon className={cn(
                  "h-4 w-4",
                  item.highlight && !active && "text-primary"
                )} />
                <span>{item.title}</span>
                {item.highlight && !active && (
                  <Sparkles className="h-3 w-3 text-primary" />
                )}
              </NavLink>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
