import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup as UIGroup,
  SidebarGroupLabel as UIGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  FileText,
  GraduationCap,
  MessageSquare,
  ClipboardList,
  Calendar,
  Settings,
  Phone,
  DollarSign,
  Home,
  Bot,
  Languages,
  UserPlus,
  Radio,
  Wallet,
  MapPin,
  Gift,
  CalendarClock,
  PieChart,
  Headphones,
  Briefcase,
  Shield,
  Receipt,
  Clock,
  ClipboardCheck,
  LogOut,
  Search,
} from 'lucide-react';
import { SidebarStaffPanel } from '@/components/intercom/SidebarStaffPanel';
import { Logo } from '@/components/Logo';

export interface SidebarGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    highlight?: boolean;
  }[];
}

interface CRMSidebarProps {
  isOwner: boolean;
  isAdmin: boolean;
  isCallOperator: boolean;
  isDocumentHandler: boolean;
  canReviewUniDb?: boolean;
  user: User | null;
  onSignOut: () => void;
}

function buildGroups(
  isOwner: boolean,
  isAdmin: boolean,
  isCallOperator: boolean,
  isDocumentHandler: boolean,
  canReviewUniDb: boolean,
  t: (key: string) => string,
  lang: string,
): SidebarGroup[] {
  return [
    {
      id: 'home',
      title: lang === 'uz' ? 'Asosiy' : 'Home',
      icon: Home,
      visible: true,
      items: [
        { title: t('navigation.dashboard'), url: '/crm', icon: Home, visible: true },
        { title: 'Hanguk AI', url: '/crm/ai', icon: Bot, visible: true, highlight: true },
        { title: t('navigation.students'), url: '/crm/students', icon: Users, visible: true },
        { title: t('navigation.applications'), url: '/crm/applications', icon: GraduationCap, visible: true },
      ],
    },
    {
      id: 'communication',
      title: t('navigation.communication'),
      icon: Headphones,
      visible: true,
      items: [
        { title: t('navigation.messages'), url: '/crm/messages', icon: MessageSquare, visible: true },
        { title: t('common.phone'), url: '/crm/calls', icon: Phone, visible: true },
        { title: t('navigation.liveCall'), url: '/crm/communication', icon: Radio, visible: false, highlight: true },
        { title: t('navigation.leads'), url: '/crm/leads', icon: UserPlus, visible: true, highlight: true },
      ],
    },
    {
      id: 'management',
      title: t('navigation.management'),
      icon: Briefcase,
      visible: true,
      items: [
        { title: t('navigation.tasks'), url: '/crm/tasks', icon: ClipboardList, visible: true },
        { title: t('navigation.calendar'), url: '/crm/calendar', icon: Calendar, visible: true },
        { title: t('navigation.universities'), url: '/crm/universities', icon: GraduationCap, visible: true },
        { title: 'Dastur Qidiruv', url: '/crm/program-finder', icon: Search, visible: true, highlight: true },
        { title: t('navigation.aiTranslation'), url: '/crm/translation', icon: Languages, visible: true, highlight: true },
        { title: t('navigation.kakaoMap'), url: '/crm/kakao-map', icon: MapPin, visible: true, highlight: true },
      ],
    },
    {
      id: 'finance',
      title: t('navigation.finance'),
      icon: DollarSign,
      visible: isOwner,
      items: [
        { title: t('navigation.overview'), url: '/crm/finance', icon: Home, visible: isOwner },
        { title: t('navigation.students'), url: '/crm/finance/students', icon: Users, visible: isOwner },
        { title: t('navigation.budgets'), url: '/crm/finance/budgets', icon: Wallet, visible: isOwner },
        { title: t('navigation.monthly'), url: '/crm/finance/monthly', icon: CalendarClock, visible: isOwner },
        { title: t('navigation.scheduled'), url: '/crm/finance/scheduled', icon: Clock, visible: isOwner },
        { title: t('navigation.transactions'), url: '/crm/finance/transactions', icon: Receipt, visible: isOwner },
        { title: t('navigation.distribution'), url: '/crm/finance/distribution', icon: PieChart, visible: isOwner },
        { title: t('navigation.bonuses'), url: '/crm/finance/bonuses', icon: Gift, visible: isOwner },
        { title: t('navigation.reports'), url: '/crm/finance/reports', icon: FileText, visible: isOwner },
      ],
    },
    {
      id: 'admin',
      title: t('navigation.admin'),
      icon: Shield,
      visible: true,
      items: [
        { title: t('navigation.staff'), url: '/crm/staff', icon: Users, visible: true },
        {
          title: 'Review',
          url: '/crm/admin/uni-db-review',
          icon: ClipboardCheck,
          visible: canReviewUniDb,
          highlight: true,
        },
        { title: t('navigation.settings'), url: '/crm/settings', icon: Settings, visible: true },
      ],
    },
  ];
}

export function CRMSidebar({
  isOwner,
  isAdmin,
  isCallOperator,
  isDocumentHandler,
  canReviewUniDb = false,
  user,
  onSignOut,
}: CRMSidebarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  const groups = buildGroups(isOwner, isAdmin, isCallOperator, isDocumentHandler, canReviewUniDb, t, lang);

  // Whether an item's URL matches the current route (most-specific match wins
  // via startsWith; '/crm' only matches exactly so it isn't always active).
  const isItemActive = (url: string) =>
    location.pathname === url || (url !== '/crm' && location.pathname.startsWith(url));

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = isOwner
    ? t('roles.owner', { defaultValue: 'Owner' })
    : isAdmin
      ? t('roles.admin', { defaultValue: 'Admin' })
      : isCallOperator
        ? t('roles.callOperator', { defaultValue: 'Call operator' })
        : isDocumentHandler
          ? t('roles.documentHandler', { defaultValue: 'Document handler' })
          : t('roles.staff', { defaultValue: 'Staff' });

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* Brand */}
      <SidebarHeader className="p-3">
        <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <Logo variant="badge" className="h-9 w-9 shrink-0 rounded-lg" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold leading-tight text-white">Hanguk</div>
              <div className="truncate text-[11px] font-medium text-sidebar-foreground/50">{t('crm.title')}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups
          .filter((group) => group.visible)
          .map((group) => {
            const items = group.items.filter((item) => item.visible);
            if (items.length === 0) return null;
            return (
              <UIGroup key={group.id} className="px-2 py-1">
                <UIGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-[0.09em] text-sidebar-foreground/40">
                  {group.title}
                </UIGroupLabel>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isItemActive(item.url);
                    const isAI = item.url === '/crm/ai';
                    return (
                      <SidebarMenuItem key={item.url + item.title}>
                        {/* Lime active rail */}
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
                          {isAI && !collapsed && (
                            <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[9px] font-bold leading-none text-sidebar-primary-foreground">
                              AI
                            </span>
                          )}
                          {!isAI && item.highlight && !collapsed && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </UIGroup>
            );
          })}
      </SidebarContent>

      {/* Staff PTT panel (intercom) — sits above the account block */}
      <SidebarStaffPanel />

      {/* Account block */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className={cn('flex items-center gap-2.5 px-1', collapsed && 'justify-center px-0')}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-[12px] font-bold text-sidebar-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
                <div className="truncate text-[11px] text-sidebar-foreground/50">{roleLabel}</div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title={t('auth.logout')}
                aria-label={t('auth.logout')}
                className="flex shrink-0 items-center justify-center rounded-md px-2 text-sidebar-foreground/60 transition-colors hover:bg-white/5 hover:text-white"
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

// Export groups getter for use in the header command menu (⌘K).
export function useSidebarGroups(
  isOwner: boolean,
  isAdmin: boolean,
  isCallOperator: boolean,
  isDocumentHandler: boolean,
  t: (key: string) => string,
  lang: string,
  canReviewUniDb = false,
): SidebarGroup[] {
  return buildGroups(isOwner, isAdmin, isCallOperator, isDocumentHandler, canReviewUniDb, t, lang);
}
