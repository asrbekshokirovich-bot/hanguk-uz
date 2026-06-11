import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeads, Lead, CreateLeadData } from '@/hooks/useLeads';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { EmptyState } from '@/components/ui/empty-state';
import { useLeadNotes, ContactType, ContactOutcome } from '@/hooks/useLeadNotes';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserPlus, 
  Phone, 
  MessageSquare, 
  Bot, 
  TrendingUp,
  Search,
  MoreVertical,
  Sparkles,
  ArrowRight,
  Gauge,
  PhoneCall,
  Calendar,
  FileText
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
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

const LeadsContent = () => {
  const { t } = useTranslation();
  const { season, year } = useActiveIntake();
  const seasonLabel = season ? t(`intake.season.${season}`) : '';
  const {
    leads, 
    loading, 
    stats, 
    createLead, 
    updateLead, 
    deleteLead, 
    convertToStudent,
    analyzeLead,
    callTodayLeads 
  } = useLeads();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Sync selectedLead when leads array updates
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find(l => l.id === selectedLead.id);
      if (updated) {
        setSelectedLead(updated);
      }
    }
  }, [leads]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .not('full_name', 'is', null);
      setStaff(data || []);
    };
    fetchStaff();
  }, []);

  // callTodayLeads now comes directly from useLeads (memoized)

  // Ready to Contract leads moved to StudentList

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const matchesSearch = 
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.city?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'new' && lead.isAlreadyStudent) return false;
    
    // Hide contracted leads from all views except "contracted" filter
    if (lead.contract_number && statusFilter !== 'contracted') return false;

    const statusMatches = statusFilter === 'all' 
      || (statusFilter === 'call_today' && callTodayLeads.some(l => l.id === lead.id))
      || (statusFilter === 'contracted' && !!lead.contract_number)
      || (statusFilter !== 'call_today' && statusFilter !== 'contracted' && lead.status === statusFilter);
    
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    return matchesSearch && statusMatches && matchesSource;
  }), [leads, searchQuery, statusFilter, sourceFilter, callTodayLeads]);

  // Pagination - show 30 leads at a time
  const [displayCount, setDisplayCount] = useState(30);
  const displayedLeads = useMemo(() => filteredLeads.slice(0, displayCount), [filteredLeads, displayCount]);
  
  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(30);
  }, [searchQuery, statusFilter, sourceFilter]);

  const handleCreateLead = async (
    data: CreateLeadData, 
    initialNote?: { content: string; contactType: ContactType; outcome: ContactOutcome }
  ) => {
    const newLead = await createLead(data);
    
    // If initial note provided, add it
    if (newLead && initialNote) {
      const { addNote } = useLeadNotes(newLead.id);
      await addNote({
        content: initialNote.content,
        contactType: initialNote.contactType,
        outcome: initialNote.outcome,
        contactedAt: new Date().toISOString().split('T')[0],
      });
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

  const getSourceIcon = (source: Lead['source']) => {
    switch (source) {
      case 'telegram': return <MessageSquare className="h-4 w-4" />;
      case 'instagram': return <MessageSquare className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'ai_detected': return <Bot className="h-4 w-4" />;
      default: return <UserPlus className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: Lead['source']) => {
    switch (source) {
      case 'telegram': return 'bg-info/10 text-info';
      case 'instagram': return 'bg-primary/10 text-primary';
      case 'call': return 'bg-success/10 text-success';
      case 'ai_detected': return 'bg-accent/15 text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'new': return 'bg-info/10 text-info';
      case 'contacted': return 'bg-warning/10 text-warning';
      case 'qualified': return 'bg-success/10 text-success';
      case 'converted': return 'bg-success/10 text-success';
      case 'lost': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 70) return 'bg-destructive/10 text-destructive';
    if (score >= 50) return 'bg-warning/10 text-warning';
    return 'bg-info/10 text-info';
  };

  const getPriorityLabel = (score: number | null) => {
    if (!score) return 'Unscored';
    if (score >= 70) return 'Hot';
    if (score >= 50) return 'Warm';
    return 'Cold';
  };

  const getFollowUpStatus = (nextFollowUp: string | null) => {
    if (!nextFollowUp) return null;
    const date = new Date(nextFollowUp);
    if (isToday(date)) return { label: 'Today', color: 'text-destructive' };
    if (isPast(date)) return { label: 'Overdue', color: 'text-destructive font-medium' };
    return { label: formatDistanceToNow(date, { addSuffix: true }), color: 'text-muted-foreground' };
  };

  const STAT_TONE: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };
  const statCards = [
    { icon: Users, value: stats.total, label: 'Total', tone: 'primary' },
    { icon: Sparkles, value: stats.new, label: 'New', tone: 'info' },
    { icon: PhoneCall, value: stats.callToday, label: 'Call Today', tone: 'destructive' },
    { icon: Gauge, value: stats.highPriority, label: 'High Priority', tone: 'warning' },
    { icon: TrendingUp, value: stats.qualified, label: 'Qualified', tone: 'success' },
    { icon: ArrowRight, value: stats.converted, label: 'Converted', tone: 'success' },
    { icon: Bot, value: stats.aiDetected, label: 'AI Detected', tone: 'primary' },
  ];

  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('navigation.leads')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('leads.subtitle', { defaultValue: 'Hanguk AI scores every lead by conversion likelihood' })}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {statCards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', STAT_TONE[card.tone])}>
              <card.icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-extrabold leading-none text-foreground">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.label}</div>
          </Card>
        ))}
      </div>

      {/* AI Leads Intelligence Panel */}
      <LeadsIntelligencePanel leads={leads} stats={stats} />

      {/* Call Today Alert */}
      {callTodayLeads.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <PhoneCall className="h-5 w-5" />
              Call Today ({callTodayLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {callTodayLeads.slice(0, 5).map((lead) => (
                <Badge
                  key={lead.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent px-3 py-1.5"
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsDetailOpen(true);
                  }}
                >
                  <span className="font-medium">{lead.full_name}</span>
                  {lead.priority_score && (
                    <span className="ml-2 text-xs opacity-70">
                      {lead.priority_score}
                    </span>
                  )}
                </Badge>
              ))}
              {callTodayLeads.length > 5 && (
                <Badge variant="secondary">
                  +{callTodayLeads.length - 5} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="call_today">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-3 w-3 text-destructive" />
                  Call Today ({stats.callToday})
                </div>
              </SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="contracted">{t('student.contracted')}</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="ai_detected">AI Detected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleAnalyzeAll}
            disabled={isAnalyzing}
          >
            <Bot className="h-4 w-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'AI Analyze All'}
          </Button>
          <Button onClick={() => setIsAddWizardOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Leads List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Leads ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            leads.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('intake.empty.title', { season: seasonLabel, year: year ?? '' })}
                description={t('intake.empty.description')}
              />
            ) : (
              <EmptyState icon={Users} title={t('intake.noMatches')} />
            )
          ) : (
            <div className="space-y-3">
              {displayedLeads.map((lead) => {
                const followUpStatus = getFollowUpStatus(lead.next_follow_up);
                
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedLead(lead);
                      setIsDetailOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-2 rounded-full ${getSourceColor(lead.source)} flex-shrink-0`}>
                        {getSourceIcon(lead.source)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{lead.full_name}</span>
                          <Badge variant="outline" className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                          {lead.priority_score !== null && (
                            <Badge variant="outline" className={cn(getPriorityColor(lead.priority_score), 'text-xs')}>
                              <Gauge className="h-3 w-3 mr-1" />
                              {lead.priority_score} - {getPriorityLabel(lead.priority_score)}
                            </Badge>
                          )}
                          {lead.source === 'ai_detected' && (
                            <Badge variant="outline" className="bg-accent/15 text-accent-foreground">
                              <Bot className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                          {lead.city && (
                            <span className="flex items-center gap-1">
                              📍 {lead.city}
                            </span>
                          )}
                          {lead.preferred_university && (
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              🎓 {lead.preferred_university}
                            </span>
                          )}
                          {followUpStatus && (
                            <span className={cn('flex items-center gap-1', followUpStatus.color)}>
                              <Calendar className="h-3 w-3" />
                              {followUpStatus.label}
                            </span>
                          )}
                        </div>
                        {lead.ai_summary && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            <Bot className="h-3 w-3 inline mr-1" />
                            {lead.ai_summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedLead(lead);
                            setIsContactDialogOpen(true);
                          }}>
                            <Phone className="h-4 w-4 mr-2" />
                            Smart Contact Log
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => analyzeLead(lead.id)}>
                            <Bot className="h-4 w-4 mr-2" />
                            AI Analyze
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => updateLead(lead.id, { status: 'contacted' })}>
                            Mark as Contacted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead(lead.id, { status: 'qualified' })}>
                            Mark as Qualified
                          </DropdownMenuItem>
                          {lead.contract_number ? (
                            <DropdownMenuItem onClick={async (e) => {
                              e.stopPropagation();
                              await convertToStudent(lead.id);
                            }}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Talabaga aylantirish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              updateLead(lead.id, { status: 'qualified' });
                            }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Shartnomaga o'tkazish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteLead(lead.id)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
              {displayCount < filteredLeads.length && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setDisplayCount(prev => prev + 30)}
                >
                  Ko'proq ko'rsatish ({filteredLeads.length - displayCount} qoldi)
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
        staff={staff}
      />
    </div>
  );
};

export default LeadsContent;
