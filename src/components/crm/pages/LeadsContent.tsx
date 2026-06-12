import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadScoreRing } from '@/components/crm/LeadScoreRing';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeads, Lead, CreateLeadData } from '@/hooks/useLeads';
import { ContactType, ContactOutcome } from '@/hooks/useLeadNotes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  UserPlus,
  Phone,
  MessageSquare,
  Bot,
  Search,
  MoreVertical,
  Sparkles,
  ArrowRight,
  PhoneCall,
  Clock,
  Zap,
  CheckCircle2,
  Trophy,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  GraduationCap,
  FileText,
  Send,
} from 'lucide-react';
import { SmartContactDialog } from '@/components/leads/SmartContactDialog';
import { AddLeadWizard } from '@/components/leads/AddLeadWizard';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { LeadsIntelligencePanel } from '@/components/crm/LeadsIntelligencePanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

type TFunc = ReturnType<typeof useTranslation>['t'];

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

type PipelineStatus = 'new' | 'contacted' | 'qualified' | 'converted';

const PIPELINE: { id: PipelineStatus; dot: string }[] = [
  { id: 'new', dot: 'bg-info' },
  { id: 'contacted', dot: 'bg-warning' },
  { id: 'qualified', dot: 'bg-success' },
  { id: 'converted', dot: 'bg-accent' },
];

// Deterministic tonal avatar palette — semantic tokens only.
const AVATAR_TONES = [
  'bg-primary/10 text-primary',
  'bg-info/10 text-info',
  'bg-success/10 text-success',
  'bg-accent/20 text-accent-foreground',
  'bg-warning/10 text-warning',
];

function hashInt(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}
function toneFor(seed: string) {
  return AVATAR_TONES[hashInt(seed) % AVATAR_TONES.length];
}
function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function sourceIcon(source: Lead['source'], className = 'h-3 w-3') {
  switch (source) {
    case 'telegram': return <Send className={className} />;
    case 'instagram': return <MessageSquare className={className} />;
    case 'call': return <Phone className={className} />;
    case 'ai_detected': return <Bot className={className} />;
    default: return <UserPlus className={className} />;
  }
}
function sourceColor(source: Lead['source']) {
  switch (source) {
    case 'telegram': return 'bg-info/10 text-info';
    case 'instagram': return 'bg-primary/10 text-primary';
    case 'call': return 'bg-success/10 text-success';
    case 'ai_detected': return 'bg-accent/15 text-accent-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}
function statusColor(status: Lead['status']) {
  switch (status) {
    case 'new': return 'bg-info/10 text-info';
    case 'contacted': return 'bg-warning/10 text-warning';
    case 'qualified': return 'bg-success/10 text-success';
    case 'converted': return 'bg-success/10 text-success';
    case 'lost': return 'bg-destructive/10 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}
function priorityColor(score: number | null) {
  if (!score) return 'bg-muted text-muted-foreground';
  if (score >= 70) return 'bg-destructive/10 text-destructive';
  if (score >= 50) return 'bg-warning/10 text-warning';
  return 'bg-info/10 text-info';
}
function priorityLabel(score: number | null, t: TFunc) {
  if (!score) return t('leads.priorities.unscored');
  if (score >= 70) return t('leads.priorities.hot');
  if (score >= 50) return t('leads.priorities.warm');
  return t('leads.priorities.cold');
}

function SourceChip({ source, t }: { source: Lead['source']; t: TFunc }) {
  return (
    <Badge variant="outline" className={cn('gap-1 border-transparent font-medium', sourceColor(source))}>
      {sourceIcon(source)}
      {t(`leads.sources.${source}`)}
    </Badge>
  );
}

function FollowChip({ lead, t }: { lead: Lead; t: TFunc }) {
  if (!lead.next_follow_up) return null;
  const date = new Date(lead.next_follow_up);
  let label: string;
  let urgent = false;
  if (isToday(date)) { label = t('leads.callTodayFilter'); urgent = true; }
  else if (isPast(date)) { label = t('leads.overdue'); urgent = true; }
  else label = formatDistanceToNow(date, { addSuffix: true });
  return (
    <Badge variant={urgent ? 'destructive' : 'neutral'} className="gap-1">
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}

const LeadsContent = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    leads,
    loading,
    stats,
    createLead,
    updateLead,
    deleteLead,
    convertToStudent,
    analyzeLead,
    callTodayLeads,
  } = useLeads();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [students, setStudents] = useState<StaffMember[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Sync selectedLead when leads array updates
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find((l) => l.id === selectedLead.id);
      if (updated) setSelectedLead(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  useEffect(() => {
    const fetchPeople = async () => {
      const [{ data: profiles }, { data: staffRoles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').not('full_name', 'is', null),
        supabase.from('user_roles').select('user_id'),
      ]);
      setStaff(profiles || []);
      // Students = profiles that are NOT staff (have no role in user_roles).
      const staffIds = new Set((staffRoles || []).map((r) => r.user_id));
      setStudents((profiles || []).filter((p) => !staffIds.has(p.user_id)));
    };
    fetchPeople();
  }, []);

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesSearch =
          lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.city?.toLowerCase().includes(searchQuery.toLowerCase());

        if (statusFilter === 'new' && lead.isAlreadyStudent) return false;

        // Hide contracted leads from all views except "contracted" filter
        if (lead.contract_number && statusFilter !== 'contracted') return false;

        const statusMatches =
          statusFilter === 'all' ||
          (statusFilter === 'call_today' && callTodayLeads.some((l) => l.id === lead.id)) ||
          (statusFilter === 'contracted' && !!lead.contract_number) ||
          (statusFilter !== 'call_today' && statusFilter !== 'contracted' && lead.status === statusFilter);

        const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
        return matchesSearch && statusMatches && matchesSource;
      }),
    [leads, searchQuery, statusFilter, sourceFilter, callTodayLeads],
  );

  // Pagination - show 30 leads at a time (list view)
  const [displayCount, setDisplayCount] = useState(30);
  const displayedLeads = useMemo(() => filteredLeads.slice(0, displayCount), [filteredLeads, displayCount]);

  useEffect(() => {
    setDisplayCount(30);
  }, [searchQuery, statusFilter, sourceFilter]);

  const handleCreateLead = async (
    data: CreateLeadData,
    initialNote?: { content: string; contactType: ContactType; outcome: ContactOutcome },
  ) => {
    const newLead = await createLead(data);

    // If an initial note was provided, log it against the new lead.
    if (newLead && initialNote && user) {
      await supabase.from('lead_notes').insert({
        lead_id: newLead.id,
        content: initialNote.content,
        contact_type: initialNote.contactType,
        outcome: initialNote.outcome,
        contacted_at: new Date().toISOString().split('T')[0],
        created_by: user.id,
      });
      // Best-effort AI analysis of the new lead (background task).
      try {
        await supabase.functions.invoke('analyze-lead', { body: { lead_id: newLead.id } });
      } catch (err) {
        console.error('AI analysis failed:', err);
      }
    }
  };

  const handleAnalyzeAll = async () => {
    setIsAnalyzing(true);
    try {
      await analyzeLead();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };
  const openContactLog = (lead: Lead) => {
    setSelectedLead(lead);
    setIsContactDialogOpen(true);
  };

  const statCards = [
    { icon: Users, value: stats.total, label: t('leads.total'), tone: 'bg-primary/10 text-primary' },
    { icon: Zap, value: stats.highPriority, label: t('leads.priorities.hot'), tone: 'bg-destructive/10 text-destructive' },
    { icon: PhoneCall, value: stats.callToday, label: t('leads.callToday'), tone: 'bg-warning/10 text-warning' },
    { icon: CheckCircle2, value: stats.qualified, label: t('leads.statuses.qualified'), tone: 'bg-success/10 text-success' },
    { icon: Trophy, value: stats.converted, label: t('leads.statuses.converted'), tone: 'bg-accent/20 text-accent-foreground' },
    { icon: Sparkles, value: stats.new, label: t('leads.statuses.new'), tone: 'bg-info/10 text-info' },
    { icon: Bot, value: stats.aiDetected, label: t('leads.aiDetected'), tone: 'bg-primary/10 text-primary' },
  ];

  // ---- loading -------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="mb-2 h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-28" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((c) => <Skeleton key={c.id} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('navigation.leads')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('leads.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleAnalyzeAll} disabled={isAnalyzing}>
            <Sparkles className="h-4 w-4" />
            {isAnalyzing ? t('leads.analyzing') : t('leads.aiAnalyzeAll')}
          </Button>
          <Button variant="highlight" className="gap-2" onClick={() => setIsAddWizardOpen(true)}>
            <UserPlus className="h-4 w-4" />
            {t('leads.addLead')}
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {statCards.map((card) => (
          <Card key={card.label} className="flex items-center gap-3 p-4">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', card.tone)}>
              <card.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-none text-foreground">{card.value}</div>
              <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{card.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* AI Call-Today banner */}
      {callTodayLeads.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground shadow-pop">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <PhoneCall className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{t('leads.callTodayTitle', { n: callTodayLeads.length })}</div>
            <div className="mt-0.5 truncate text-xs text-primary-foreground/80">
              {t('leads.callTodaySub', { names: callTodayLeads.slice(0, 3).map((l) => l.full_name.split(' ')[0]).join(', ') })}
            </div>
          </div>
          <div className="flex items-center">
            {callTodayLeads.slice(0, 4).map((l, i) => (
              <Avatar key={l.id} className={cn('h-8 w-8 ring-2 ring-primary', i > 0 && '-ml-2.5')}>
                <AvatarFallback className={cn('text-[11px] font-semibold', toneFor(l.id))}>
                  {getInitials(l.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Button variant="highlight" className="gap-2" onClick={() => openDetail(callTodayLeads[0])}>
            <Phone className="h-4 w-4" />
            {t('leads.startCalling')}
          </Button>
        </div>
      )}

      {/* AI Leads Intelligence Panel (existing) */}
      <LeadsIntelligencePanel leads={leads} stats={stats} onSelectLead={openDetail} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('leads.searchLeads')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leads.allStatuses')}</SelectItem>
              <SelectItem value="call_today">{t('leads.callTodayFilter')} ({stats.callToday})</SelectItem>
              <SelectItem value="new">{t('leads.statuses.new')}</SelectItem>
              <SelectItem value="contacted">{t('leads.statuses.contacted')}</SelectItem>
              <SelectItem value="qualified">{t('leads.statuses.qualified')}</SelectItem>
              <SelectItem value="contracted">{t('student.contracted')}</SelectItem>
              <SelectItem value="converted">{t('leads.statuses.converted')}</SelectItem>
              <SelectItem value="lost">{t('leads.statuses.lost')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leads.allSources')}</SelectItem>
              <SelectItem value="manual">{t('leads.sources.manual')}</SelectItem>
              <SelectItem value="telegram">{t('leads.sources.telegram')}</SelectItem>
              <SelectItem value="instagram">{t('leads.sources.instagram')}</SelectItem>
              <SelectItem value="call">{t('leads.sources.call')}</SelectItem>
              <SelectItem value="ai_detected">{t('leads.sources.ai_detected')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setViewMode('pipeline')}
            className={cn(
              'flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'pipeline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            {t('leads.pipeline')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ListIcon className="h-4 w-4" />
            {t('leads.list')}
          </button>
        </div>
      </div>

      {/* Body */}
      {filteredLeads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('leads.emptyTitle')}
          description={t('leads.emptyDesc')}
          action={{ label: t('leads.addLead'), onClick: () => setIsAddWizardOpen(true) }}
        />
      ) : viewMode === 'pipeline' ? (
        /* -------------------------------------------------------- PIPELINE -- */
        <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-x-visible">
          {PIPELINE.map((col) => {
            const items = filteredLeads
              .filter((l) => l.status === col.id)
              .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
            return (
              <div key={col.id} className="flex w-[85vw] shrink-0 flex-col rounded-xl border border-border bg-muted/40 p-3 sm:w-[320px] lg:w-auto">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-sm', col.dot)} />
                  <span className="text-[13px] font-bold text-foreground">{t(`leads.statuses.${col.id}`)}</span>
                  <span className="ml-auto rounded-full bg-background px-2 text-xs font-semibold text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground/60">—</p>}
                  {items.map((lead) => (
                    <Card
                      key={lead.id}
                      onClick={() => openDetail(lead)}
                      className="cursor-pointer space-y-2.5 p-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn('text-[11px] font-semibold', toneFor(lead.id))}>
                            {getInitials(lead.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-foreground">{lead.full_name}</div>
                          {lead.city && <div className="truncate text-[11px] text-muted-foreground">{lead.city}</div>}
                        </div>
                        <LeadScoreRing score={lead.priority_score} size={38} strokeWidth={4} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <SourceChip source={lead.source} t={t} />
                        <Badge variant="outline" className={cn('border-transparent font-medium', priorityColor(lead.priority_score))}>
                          {priorityLabel(lead.priority_score, t)}
                        </Badge>
                      </div>
                      {lead.ai_summary && (
                        <div className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
                          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent-foreground" />
                          <span className="line-clamp-2">{lead.ai_summary}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <FollowChip lead={lead} t={t} />
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="icon" className="h-7 w-7" title={t('leads.call')} onClick={(e) => { e.stopPropagation(); openContactLog(lead); }}>
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" title={t('leads.message')} onClick={(e) => { e.stopPropagation(); openContactLog(lead); }}>
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* -------------------------------------------------------- LIST ------ */
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">{t('leads.title')}</th>
                  <th className="px-3 py-3">{t('leads.source')}</th>
                  <th className="px-3 py-3">{t('leads.score')}</th>
                  <th className="px-3 py-3">{t('leads.status')}</th>
                  <th className="px-3 py-3">{t('leads.nextFollowUp')}</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => openDetail(lead)}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={cn('text-xs font-semibold', toneFor(lead.id))}>
                            {getInitials(lead.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{lead.full_name}</div>
                          <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                            {lead.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.city}</span>}
                            {lead.preferred_university && (
                              <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" />{lead.preferred_university}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><SourceChip source={lead.source} t={t} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <LeadScoreRing score={lead.priority_score} size={34} strokeWidth={4} />
                        <Badge variant="outline" className={cn('border-transparent font-medium', priorityColor(lead.priority_score))}>
                          {priorityLabel(lead.priority_score, t)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={cn('border-transparent font-medium', statusColor(lead.status))}>
                        {t(`leads.statuses.${lead.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3"><FollowChip lead={lead} t={t} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="icon" className="h-7 w-7" title={t('leads.call')} onClick={() => openContactLog(lead)}>
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openContactLog(lead)}>
                              <Phone className="mr-2 h-4 w-4" />
                              {t('leads.smartContactLog')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => analyzeLead(lead.id)}>
                              <Bot className="mr-2 h-4 w-4" />
                              {t('leads.aiAnalyze')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateLead(lead.id, { status: 'contacted' })}>
                              {t('leads.markContacted')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLead(lead.id, { status: 'qualified' })}>
                              {t('leads.markQualified')}
                            </DropdownMenuItem>
                            {lead.contract_number ? (
                              <DropdownMenuItem onClick={async () => { await convertToStudent(lead.id); }}>
                                <ArrowRight className="mr-2 h-4 w-4" />
                                {t('leads.convert')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateLead(lead.id, { status: 'qualified' })}>
                                <FileText className="mr-2 h-4 w-4" />
                                {t('leads.toContract')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteLead(lead.id)} className="text-destructive">
                              {t('leads.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayCount < filteredLeads.length && (
            <div className="border-t border-border p-3">
              <Button variant="outline" className="w-full" onClick={() => setDisplayCount((p) => p + 30)}>
                {t('leads.showMore', { n: filteredLeads.length - displayCount })}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdate={updateLead}
        onAnalyze={analyzeLead}
        onConvert={convertToStudent}
        staff={staff}
      />

      {/* Smart Contact Dialog */}
      <SmartContactDialog
        lead={selectedLead}
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
        onLeadUpdate={() => {}}
      />

      {/* Add Lead Wizard */}
      <AddLeadWizard
        open={isAddWizardOpen}
        onOpenChange={setIsAddWizardOpen}
        onSubmit={handleCreateLead}
        students={students}
      />
    </div>
  );
};

export default LeadsContent;
