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
  FolderOpen,
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
  Building2,
  LogOut,
  Zap,
  UserX,
  BarChart3,
  Archive,
  Settings2,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { isNavItemActive } from '@/components/crm/navActive';
import { useDeskCounts } from '@/components/crm/lead-desk/hooks/useDeskCounts';
import type { DeskCounts } from '@/components/crm/lead-desk/types';

/** A small count pill on the right of a menu item (the lead module's counters). */
export interface SidebarBadge {
  count: number;
  tone: 'red' | 'muted';
  /** blink: something is overdue */
  pulse?: boolean;
  /** show it even at 0 (Ish stoli always shows its HOZIR count) */
  keepZero?: boolean;
}

export interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  highlight?: boolean;
  /** rendered bold, as the lead of its group */
  primary?: boolean;
  badge?: SidebarBadge;
}

export interface SidebarGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  items: SidebarItem[];
}

/** What the sidebar needs to know about the lead module (spec §3). */
export interface LeadNav {
  /** operators, seniors, admins: the "Lidlar" group is theirs */
  canWorkLeads: boolean;
  /** seniors and admins: "Hisobot" */
  isLeadSenior: boolean;
  /** `lead_desk_counts()`; absent until it loads (the badges then read 0) */
  counts?: DeskCounts;
}

interface CRMSidebarProps {
  isOwner: boolean;
  /** The "Moliya" group: owners, plus anyone given finance access. */
  canSeeFinance: boolean;
  isAdmin: boolean;
  isCallOperator: boolean;
  isDocumentHandler: boolean;
  canReviewUniDb?: boolean;
  /** Lead module v2: operators, seniors and admins get the "Lidlar" group. */
  canWorkLeads?: boolean;
  /** Lead module v2: seniors and admins also see "Hisobot". */
  isLeadSenior?: boolean;
  user: User | null;
  onSignOut: () => void;
}

function buildGroups(
  canSeeFinance: boolean,
  isAdmin: boolean,
  isCallOperator: boolean,
  isDocumentHandler: boolean,
  canReviewUniDb: boolean,
  t: (key: string) => string,
  lang: string,
  leads: LeadNav = { canWorkLeads: false, isLeadSenior: false },
): SidebarGroup[] {
  const { canWorkLeads, isLeadSenior, counts } = leads;
  return [
    {
      id: 'home',
      title: lang === 'uz' ? 'Asosiy' : 'Home',
      icon: Home,
      visible: true,
      items: [
        { title: t('navigation.dashboard'), url: '/crm', icon: Home, visible: isAdmin },
        { title: 'Hanguk AI', url: '/crm/ai', icon: Bot, visible: isAdmin, highlight: true },
        { title: t('navigation.students'), url: '/crm/students', icon: Users, visible: true },
        { title: t('navigation.applications'), url: '/crm/applications', icon: GraduationCap, visible: isAdmin },
        { title: t('navigation.documents'), url: '/crm/documents', icon: FolderOpen, visible: isAdmin || isDocumentHandler },
        { title: t('navigation.universities'), url: '/crm/universities', icon: GraduationCap, visible: true },
        { title: 'Application fee', url: '/crm/application-fees', icon: Receipt, visible: isDocumentHandler },
        { title: "So'rovnomalar", url: '/crm/surveys', icon: ClipboardCheck, visible: isCallOperator || isDocumentHandler },
      ],
    },
    // Lead module v2 (spec §3): the desk first and bold, the rest ordinary.
    // The old "Yangi lid" / "Bugungi lidlar" / "Lidlar" items are gone; their
    // routes redirect to the desk.
    {
      id: 'leads',
      title: 'Lidlar',
      icon: UserPlus,
      visible: canWorkLeads,
      items: [
        {
          title: 'Ish stoli',
          url: '/crm/desk',
          icon: Zap,
          visible: canWorkLeads,
          primary: true,
          badge: {
            count: counts?.hozir ?? 0,
            tone: (counts?.hozir ?? 0) > 0 ? 'red' : 'muted',
            pulse: (counts?.breached ?? 0) > 0,
            keepZero: true,
          },
        },
        {
          title: 'Barcha lidlar',
          url: '/crm/leads',
          icon: UserPlus,
          visible: canWorkLeads,
          badge: { count: counts?.barcha ?? 0, tone: 'muted' },
        },
        {
          title: "Yo'qotilgan",
          url: '/crm/leads/lost',
          icon: UserX,
          visible: canWorkLeads,
          badge: { count: counts?.yoqotilgan ?? 0, tone: 'muted' },
        },
        { title: 'Hisobot', url: '/crm/leads/report', icon: BarChart3, visible: isLeadSenior },
        {
          title: 'Baza',
          url: '/crm/leads/baza',
          icon: Archive,
          visible: canWorkLeads,
          badge: { count: counts?.baza ?? 0, tone: 'muted' },
        },
        { title: 'Sozlamalar', url: '/crm/leads/settings', icon: Settings2, visible: isAdmin },
      ],
    },
    {
      id: 'communication',
      title: t('navigation.communication'),
      icon: Headphones,
      visible: true,
      items: [
        { title: t('navigation.messages'), url: '/crm/messages', icon: MessageSquare, visible: true },
        { title: t('common.phone'), url: '/crm/calls', icon: Phone, visible: isAdmin },
        { title: "O'quv markazlar", url: '/crm/learning-centers', icon: Building2, visible: isCallOperator },
      ],
    },
    {
      id: 'management',
      title: t('navigation.management'),
      icon: Briefcase,
      visible: true,
      items: [
        { title: t('navigation.tasks'), url: '/crm/tasks', icon: ClipboardList, visible: true },
        { title: t('navigation.calendar'), url: '/crm/calendar', icon: Calendar, visible: isAdmin },
        { title: t('navigation.aiTranslation'), url: '/crm/translation', icon: Languages, visible: isAdmin, highlight: true },
        { title: t('navigation.kakaoMap'), url: '/crm/kakao-map', icon: MapPin, visible: isAdmin, highlight: true },
      ],
    },
    {
      id: 'finance',
      title: t('navigation.finance'),
      icon: DollarSign,
      visible: canSeeFinance,
      items: [
        { title: t('navigation.overview'), url: '/crm/finance', icon: Home, visible: canSeeFinance },
        { title: t('navigation.students'), url: '/crm/finance/students', icon: Users, visible: canSeeFinance },
        { title: t('navigation.budgets'), url: '/crm/finance/budgets', icon: Wallet, visible: canSeeFinance },
        { title: t('navigation.monthly'), url: '/crm/finance/monthly', icon: CalendarClock, visible: canSeeFinance },
        { title: t('navigation.scheduled'), url: '/crm/finance/scheduled', icon: Clock, visible: canSeeFinance },
        { title: t('navigation.transactions'), url: '/crm/finance/transactions', icon: Receipt, visible: canSeeFinance },
        { title: t('navigation.distribution'), url: '/crm/finance/distribution', icon: PieChart, visible: canSeeFinance },
        { title: t('navigation.bonuses'), url: '/crm/finance/bonuses', icon: Gift, visible: canSeeFinance },
        { title: t('navigation.reports'), url: '/crm/finance/reports', icon: FileText, visible: canSeeFinance },
      ],
    },
    {
      id: 'admin',
      title: t('navigation.admin'),
      icon: Shield,
      visible: isAdmin,
      items: [
        { title: t('navigation.staff'), url: '/crm/staff', icon: Users, visible: isAdmin },
        {
          title: 'Review',
          url: '/crm/admin/uni-db-review',
          icon: ClipboardCheck,
          visible: canReviewUniDb && isAdmin,
          highlight: true,
        },
        // uni_db bazasini boshqarish (hamkor/xarita bayroqlari, PDF guideline).
        // Xodimlar ko'radigan katalog — "Asosiy" guruhidagi Universitetlar.
        { title: 'Institutions (uni_db)', url: '/crm/admin/institutions', icon: Building2, visible: isAdmin },
        { title: t('navigation.settings'), url: '/crm/settings', icon: Settings, visible: isAdmin },
      ],
    },
  ];
}

export function CRMSidebar({
  isOwner,
  canSeeFinance,
  isAdmin,
  isCallOperator,
  isDocumentHandler,
  canReviewUniDb = false,
  canWorkLeads = false,
  isLeadSenior = false,
  user,
  onSignOut,
}: CRMSidebarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  // The lead counters (HOZIR on Ish stoli, Barcha, Yo'qotilgan, Baza). Realtime +
  // a 30-second poll; not even requested for roles that have no "Lidlar" group.
  const { counts } = useDeskCounts({ enabled: canWorkLeads });

  const groups = buildGroups(canSeeFinance, isAdmin, isCallOperator, isDocumentHandler, canReviewUniDb, t, lang, {
    canWorkLeads,
    isLeadSenior,
    counts,
  });

  const isItemActive = (url: string) => isNavItemActive(location.pathname, url);

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
      : isLeadSenior
        ? t('roles.leadSenior', { defaultValue: 'Senior operator' })
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
                            item.primary && 'font-bold text-sidebar-foreground',
                            active && 'bg-white/10 font-semibold text-white hover:bg-white/10',
                            item.primary && active && 'font-bold',
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
                          {!collapsed && item.badge && <NavBadge badge={item.badge} />}
                        </SidebarMenuButton>
                        {/* Collapsed: the count has no room, so urgent items get a dot. */}
                        {collapsed && item.badge?.tone === 'red' && item.badge.count > 0 && (
                          <span
                            className={cn(
                              'pointer-events-none absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar',
                              item.badge.pulse && 'animate-pulse',
                            )}
                          />
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </UIGroup>
            );
          })}
      </SidebarContent>

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

/**
 * The count pill on the right of a menu item. Hidden at 0 unless the item asks
 * to keep it (Ish stoli); red pills are loud, and blink while something is overdue.
 */
function NavBadge({ badge }: { badge: SidebarBadge }) {
  if (badge.count <= 0 && !badge.keepZero) return null;
  return (
    <span
      className={cn(
        'ml-auto min-w-[1.25rem] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none tabular-nums',
        badge.tone === 'red' ? 'bg-destructive text-white' : 'bg-white/10 text-sidebar-foreground/70',
        badge.pulse && 'animate-pulse',
      )}
    >
      {badge.count}
    </span>
  );
}

// Export groups getter for use in the header command menu (⌘K).
export function useSidebarGroups(
  canSeeFinance: boolean,
  isAdmin: boolean,
  isCallOperator: boolean,
  isDocumentHandler: boolean,
  t: (key: string) => string,
  lang: string,
  canReviewUniDb = false,
  leads: LeadNav = { canWorkLeads: false, isLeadSenior: false },
): SidebarGroup[] {
  return buildGroups(canSeeFinance, isAdmin, isCallOperator, isDocumentHandler, canReviewUniDb, t, lang, leads);
}
