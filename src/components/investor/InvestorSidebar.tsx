import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, LayoutGrid, Lock, LogOut, MessageSquare, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup as UIGroup,
  SidebarGroupLabel as UIGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from '@/components/Logo';
import { formatEquity, initials as toInitials } from '@/lib/investorFormat';

const NAV = [
  { title: 'Overview', url: '/crm/investor/overview', icon: LayoutGrid },
  { title: 'Finance', url: '/crm/investor/finance', icon: Wallet },
  { title: 'Applications', url: '/crm/investor/applications', icon: GraduationCap },
  { title: 'Leads', url: '/crm/investor/leads', icon: Users },
  { title: 'Messages', url: '/crm/investor/messages', icon: MessageSquare },
] as const;

interface InvestorSidebarProps {
  displayName: string;
  equityPercent: number | null;
  unreadCount: number;
  onSignOut: () => void;
}

/**
 * Four items, a read-only notice, and her name. Same sidebar primitives, same
 * active treatment as CRMSidebar (translucent fill, 3px lime rail, lime icon)
 * so the two portals feel like one product.
 */
export function InvestorSidebar({
  displayName,
  equityPercent,
  unreadCount,
  onSignOut,
}: InvestorSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-3">
        <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <Logo variant="badge" className="h-9 w-9 shrink-0 rounded-lg" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold leading-tight text-white">Hanguk</div>
              <div className="truncate text-[11px] font-medium text-sidebar-foreground/50">
                Investor Portal
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <UIGroup className="px-2 py-1">
          <UIGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-[0.09em] text-sidebar-foreground/40">
            Your stake
          </UIGroupLabel>
          <SidebarMenu>
            {NAV.map((item) => {
              const active = location.pathname.startsWith(item.url);
              const showCount = item.url.endsWith('/messages') && unreadCount > 0;
              return (
                <SidebarMenuItem key={item.url}>
                  {active && (
                    <span className="pointer-events-none absolute bottom-2 left-0 top-2 z-10 w-[3px] rounded-full bg-sidebar-primary" />
                  )}
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={active}
                    tooltip={item.title}
                    className={cn(
                      'gap-3 text-[14px] font-medium text-sidebar-foreground/70 hover:bg-white/5 hover:text-white',
                      active && 'bg-white/10 font-semibold text-white hover:bg-white/10',
                    )}
                  >
                    <item.icon className={cn('shrink-0', active && 'text-sidebar-primary')} />
                    <span className="flex-1 truncate">{item.title}</span>
                    {showCount && !collapsed && (
                      <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[9px] font-bold leading-none text-sidebar-primary-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </UIGroup>
      </SidebarContent>

      {/* Read-only notice. Sits where SidebarStaffPanel sits in the staff shell -
          the investor has no intercom, and this is the honest thing to put in
          its place: it tells her what she cannot reach before she goes looking. */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.05] p-3">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
              <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-white">
                Read-only access
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-[1.5] text-sidebar-foreground/50">
              You can view and export everything here. Student documents and passports stay with the
              document team.
            </p>
          </div>
        </div>
      )}

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className={cn('flex items-center gap-2.5 px-1', collapsed && 'justify-center px-0')}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-[12px] font-bold text-sidebar-primary-foreground">
              {toInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
                <div className="truncate text-[11px] font-semibold text-sidebar-primary">
                  {equityPercent == null ? 'Investor' : `Investor · ${formatEquity(equityPercent)}%`}
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Log out"
                aria-label="Log out"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
