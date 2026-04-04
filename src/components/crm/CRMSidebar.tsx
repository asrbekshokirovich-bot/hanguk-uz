import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
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
  FileSearch,
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
} from 'lucide-react';
import { SidebarStaffPanel } from '@/components/intercom/SidebarStaffPanel';

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
  activeGroup: string | null;
  onGroupSelect: (groupId: string) => void;
}

export function CRMSidebar({ 
  isOwner, 
  isAdmin, 
  isCallOperator, 
  isDocumentHandler,
  activeGroup,
  onGroupSelect
}: CRMSidebarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  const groups: SidebarGroup[] = [
    {
      id: 'home',
      title: lang === 'uz' ? 'Asosiy' : 'Home',
      icon: Home,
      visible: true,
      items: [
        { title: lang === 'uz' ? 'Dashboard' : t('navigation.dashboard'), url: '/crm', icon: Home, visible: true },
        { title: 'Hanguk AI', url: '/crm/ai', icon: Bot, visible: true, highlight: true },
        { title: t('navigation.students'), url: '/crm/students', icon: Users, visible: true },
        { title: t('navigation.applications'), url: '/crm/applications', icon: GraduationCap, visible: true },
        { title: t('navigation.documents'), url: '/crm/documents', icon: FileText, visible: true },
      ],
    },
    {
      id: 'communication',
      title: lang === 'uz' ? 'Aloqa' : 'Communication',
      icon: Headphones,
      visible: true,
      items: [
        { title: t('navigation.messages'), url: '/crm/messages', icon: MessageSquare, visible: true },
        { title: t('common.phone'), url: '/crm/calls', icon: Phone, visible: true },
        { title: lang === 'uz' ? 'Jonli Qo\'ng\'iroq' : 'Live Call', url: '/crm/communication', icon: Radio, visible: false, highlight: true },
        { title: 'Leads', url: '/crm/leads', icon: UserPlus, visible: true, highlight: true },
      ],
    },
    {
      id: 'management',
      title: lang === 'uz' ? 'Boshqaruv' : 'Management',
      icon: Briefcase,
      visible: true,
      items: [
        { title: t('navigation.tasks'), url: '/crm/tasks', icon: ClipboardList, visible: true },
        { title: t('navigation.calendar'), url: '/crm/calendar', icon: Calendar, visible: true },
        { title: t('navigation.universities'), url: '/crm/universities', icon: GraduationCap, visible: true },
        { title: lang === 'uz' ? 'Ariza Topish' : 'Form Finder', url: '/crm/application-forms', icon: FileSearch, visible: true, highlight: true },
        { title: 'AI Tarjima', url: '/crm/translation', icon: Languages, visible: true, highlight: true },
        { title: 'Kakao Map', url: '/crm/kakao-map', icon: MapPin, visible: true, highlight: true },
      ],
    },
    {
      id: 'finance',
      title: lang === 'uz' ? 'Moliya' : 'Finance',
      icon: DollarSign,
      visible: isOwner,
      items: [
        { title: lang === 'uz' ? 'Umumiy' : 'Overview', url: '/crm/finance', icon: Home, visible: isOwner },
        { title: t('navigation.students'), url: '/crm/finance/students', icon: Users, visible: isOwner },
        { title: lang === 'uz' ? 'Budjetlar' : 'Budgets', url: '/crm/finance/budgets', icon: Wallet, visible: isOwner },
        { title: lang === 'uz' ? 'Oylik' : 'Monthly', url: '/crm/finance/monthly', icon: CalendarClock, visible: isOwner },
        { title: lang === 'uz' ? 'Rejali' : 'Scheduled', url: '/crm/finance/scheduled', icon: Clock, visible: isOwner },
        { title: lang === 'uz' ? 'Tranzaksiyalar' : 'Transactions', url: '/crm/finance/transactions', icon: Receipt, visible: isOwner },
        { title: lang === 'uz' ? 'Taqsimlash' : 'Distribution', url: '/crm/finance/distribution', icon: PieChart, visible: isOwner },
        { title: lang === 'uz' ? 'Bonuslar' : 'Bonuses', url: '/crm/finance/bonuses', icon: Gift, visible: isOwner },
        { title: lang === 'uz' ? 'Hisobotlar' : 'Reports', url: '/crm/finance/reports', icon: FileText, visible: isOwner },
      ],
    },
    {
      id: 'admin',
      title: 'Admin',
      icon: Shield,
      visible: true,
      items: [
        { title: t('navigation.staff'), url: '/crm/staff', icon: Users, visible: true },
        { title: t('navigation.settings'), url: '/crm/settings', icon: Settings, visible: true },
      ],
    },
  ];

  // Determine which group should be active based on current URL
  const getActiveGroupFromUrl = () => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.visible && (location.pathname === item.url || 
            (item.url !== '/crm' && location.pathname.startsWith(item.url)))) {
          return group.id;
        }
      }
    }
    return 'home';
  };

  const currentActiveGroup = activeGroup || getActiveGroupFromUrl();

  const handleGroupClick = (groupId: string) => {
    onGroupSelect(groupId);
    // Navigate to first visible item in group
    const group = groups.find(g => g.id === groupId);
    if (group) {
      const firstVisibleItem = group.items.find(item => item.visible);
      if (firstVisibleItem) {
        navigate(firstVisibleItem.url);
      }
    }
  };

  return (
    <Sidebar collapsible="icon" className="flex flex-col">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Hanguk" className="h-8 w-8 rounded-lg object-cover" />
            {!collapsed && (
              <div>
                <span className="font-bold text-primary">Hanguk</span>
                <p className="text-xs text-muted-foreground">{t('crm.title')}</p>
              </div>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1">
        <SidebarMenu className="px-2 space-y-1">
          {groups.filter(g => g.visible).map((group) => (
            <SidebarMenuItem key={group.id}>
              <SidebarMenuButton
                onClick={() => handleGroupClick(group.id)}
                isActive={currentActiveGroup === group.id}
                className={cn(
                  "w-full justify-start gap-3 h-11 text-base font-medium transition-all",
                  currentActiveGroup === group.id && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <group.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{group.title}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Staff PTT Panel - pushed to bottom */}
      <div className="mt-auto">
        <SidebarStaffPanel />
      </div>

      <SidebarFooter className="p-2">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 Hanguk Consulting
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

// Export groups getter for use in header
export function useSidebarGroups(
  isOwner: boolean,
  isAdmin: boolean,
  isCallOperator: boolean,
  isDocumentHandler: boolean,
  t: (key: string) => string,
  lang: string
): SidebarGroup[] {
  return [
    {
      id: 'home',
      title: lang === 'uz' ? 'Asosiy' : 'Home',
      icon: Home,
      visible: true,
      items: [
        { title: lang === 'uz' ? 'Dashboard' : t('navigation.dashboard'), url: '/crm', icon: Home, visible: true },
        { title: 'Hanguk AI', url: '/crm/ai', icon: Bot, visible: true, highlight: true },
        { title: t('navigation.students'), url: '/crm/students', icon: Users, visible: true },
        { title: t('navigation.applications'), url: '/crm/applications', icon: GraduationCap, visible: true },
        { title: t('navigation.documents'), url: '/crm/documents', icon: FileText, visible: true },
      ],
    },
    {
      id: 'communication',
      title: lang === 'uz' ? 'Aloqa' : 'Communication',
      icon: Headphones,
      visible: true,
      items: [
        { title: t('navigation.messages'), url: '/crm/messages', icon: MessageSquare, visible: true },
        { title: t('common.phone'), url: '/crm/calls', icon: Phone, visible: true },
        { title: lang === 'uz' ? 'Jonli Qo\'ng\'iroq' : 'Live Call', url: '/crm/communication', icon: Radio, visible: false, highlight: true },
        { title: 'Leads', url: '/crm/leads', icon: UserPlus, visible: true, highlight: true },
      ],
    },
    {
      id: 'management',
      title: lang === 'uz' ? 'Boshqaruv' : 'Management',
      icon: Briefcase,
      visible: true,
      items: [
        { title: t('navigation.tasks'), url: '/crm/tasks', icon: ClipboardList, visible: true },
        { title: t('navigation.calendar'), url: '/crm/calendar', icon: Calendar, visible: true },
        { title: t('navigation.universities'), url: '/crm/universities', icon: GraduationCap, visible: true },
        { title: lang === 'uz' ? 'Ariza Topish' : 'Form Finder', url: '/crm/application-forms', icon: FileSearch, visible: true, highlight: true },
        { title: 'AI Tarjima', url: '/crm/translation', icon: Languages, visible: true, highlight: true },
        { title: 'Kakao Map', url: '/crm/kakao-map', icon: MapPin, visible: true, highlight: true },
      ],
    },
    {
      id: 'finance',
      title: lang === 'uz' ? 'Moliya' : 'Finance',
      icon: DollarSign,
      visible: isOwner,
      items: [
        { title: lang === 'uz' ? 'Umumiy' : 'Overview', url: '/crm/finance', icon: Home, visible: isOwner },
        { title: t('navigation.students'), url: '/crm/finance/students', icon: Users, visible: isOwner },
        { title: lang === 'uz' ? 'Budjetlar' : 'Budgets', url: '/crm/finance/budgets', icon: Wallet, visible: isOwner },
        { title: lang === 'uz' ? 'Oylik' : 'Monthly', url: '/crm/finance/monthly', icon: CalendarClock, visible: isOwner },
        { title: lang === 'uz' ? 'Rejali' : 'Scheduled', url: '/crm/finance/scheduled', icon: Clock, visible: isOwner },
        { title: lang === 'uz' ? 'Tranzaksiyalar' : 'Transactions', url: '/crm/finance/transactions', icon: Receipt, visible: isOwner },
        { title: lang === 'uz' ? 'Taqsimlash' : 'Distribution', url: '/crm/finance/distribution', icon: PieChart, visible: isOwner },
        { title: lang === 'uz' ? 'Bonuslar' : 'Bonuses', url: '/crm/finance/bonuses', icon: Gift, visible: isOwner },
        { title: lang === 'uz' ? 'Hisobotlar' : 'Reports', url: '/crm/finance/reports', icon: FileText, visible: isOwner },
      ],
    },
    {
      id: 'admin',
      title: 'Admin',
      icon: Shield,
      visible: true,
      items: [
        { title: t('navigation.staff'), url: '/crm/staff', icon: Users, visible: true },
        { title: t('navigation.settings'), url: '/crm/settings', icon: Settings, visible: true },
      ],
    },
  ];
}
