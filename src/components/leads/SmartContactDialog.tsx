import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLeadNotes, LeadNote, ContactType, ContactOutcome } from '@/hooks/useLeadNotes';
import { useLeads, Lead } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { 
  Phone, 
  Send, 
  Pencil, 
  Trash2, 
  Loader2,
  X,
  Check,
  CalendarIcon,
  MessageSquare,
  Video,
  Mail,
  Clock,
  Sparkles,
  CalendarPlus,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  ThumbsUp,
  ThumbsDown,
  Voicemail,
  Timer,
  FileText
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClickToCall } from '@/components/calls/ClickToCall';

const PAYMENT_PLANS = [
  { value: 'tekin', label: 'Tekin tarif', price: 'Bepul' },
  { value: 'tekin_natija', label: 'Tekin tarif (natija to\'lov)', price: 'Natijaga qarab' },
  { value: 'standart', label: 'STANDART', price: '5 000 000 UZS' },
  { value: 'standart_2', label: 'STANDART 2', price: '4 mln + 2 mln UZS' },
  { value: 'premium', label: 'PREMIUM', price: '10 000 000 UZS' },
  { value: 'premium_2', label: 'PREMIUM 2', price: '7 mln + 6 mln UZS' },
  { value: 'no_risk', label: 'NO RISK', price: '$5 000' },
  { value: 'no_risk_2', label: 'NO RISK 2', price: '$3 000 + $2 500' },
];

interface SmartContactDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdate?: () => void;
}

const CONTACT_TYPES: { value: ContactType; label: string; icon: React.ReactNode }[] = [
  { value: 'call', label: 'Phone Call', icon: <Phone className="h-4 w-4" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'telegram', label: 'Telegram', icon: <Send className="h-4 w-4" /> },
  { value: 'meeting', label: 'Meeting', icon: <Video className="h-4 w-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'message', label: 'SMS/Other', icon: <MessageSquare className="h-4 w-4" /> },
];

const CONTACT_OUTCOMES: { value: ContactOutcome; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'answered', label: 'Answered', icon: <PhoneCall className="h-4 w-4" />, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'interested', label: 'Interested', icon: <ThumbsUp className="h-4 w-4" />, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'callback_requested', label: 'Callback Requested', icon: <CalendarPlus className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'no_answer', label: 'No Answer', icon: <PhoneMissed className="h-4 w-4" />, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  { value: 'busy', label: 'Busy', icon: <PhoneOff className="h-4 w-4" />, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { value: 'voicemail', label: 'Voicemail', icon: <Voicemail className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { value: 'not_interested', label: 'Not Interested', icon: <ThumbsDown className="h-4 w-4" />, color: 'bg-red-500/10 text-red-600 border-red-500/20' },
];

const SMART_TEMPLATES = [
  { 
    label: '📞 No answer', 
    text: 'Called but no answer. Will try again later.',
    outcome: 'no_answer' as ContactOutcome,
    type: 'call' as ContactType
  },
  { 
    label: '✅ Very interested', 
    text: 'Spoke with lead. They are very interested in studying in Korea. Requested detailed info about programs and scholarships.',
    outcome: 'interested' as ContactOutcome,
    type: 'call' as ContactType
  },
  { 
    label: '📅 Callback scheduled', 
    text: 'Lead requested callback at a different time. Scheduled follow-up.',
    outcome: 'callback_requested' as ContactOutcome,
    type: 'call' as ContactType
  },
  { 
    label: '📝 Docs discussion', 
    text: 'Discussed requirements in detail. Lead needs to prepare documents. Sent checklist.',
    outcome: 'answered' as ContactOutcome,
    type: 'call' as ContactType
  },
  { 
    label: '❌ Not interested', 
    text: 'Lead is no longer interested in studying abroad. Changed plans.',
    outcome: 'not_interested' as ContactOutcome,
    type: 'call' as ContactType
  },
  { 
    label: '📱 WhatsApp sent', 
    text: 'Sent initial information via WhatsApp. Awaiting response.',
    outcome: 'answered' as ContactOutcome,
    type: 'whatsapp' as ContactType
  },
  { 
    label: '💬 Telegram chat', 
    text: 'Exchanged messages on Telegram. Lead asked questions about the process.',
    outcome: 'answered' as ContactOutcome,
    type: 'telegram' as ContactType
  },
  { 
    label: '🤝 Meeting held', 
    text: 'Had an in-person/video meeting. Discussed university options and timeline.',
    outcome: 'interested' as ContactOutcome,
    type: 'meeting' as ContactType
  },
  { 
    label: '💰 Price inquiry', 
    text: 'Lead asked about tuition fees and total costs. Sent detailed pricing breakdown.',
    outcome: 'answered' as ContactOutcome,
    type: 'call' as ContactType
  },
  { 
    label: '🔊 Left voicemail', 
    text: 'Left voice message with contact details. Waiting for callback.',
    outcome: 'voicemail' as ContactOutcome,
    type: 'call' as ContactType
  },
];

export function SmartContactDialog({ lead, open, onOpenChange, onLeadUpdate }: SmartContactDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notes, loading, fetchNotes, addNote, updateNote, deleteNote, getContactStats } = useLeadNotes(lead?.id || null);
  const { updateLead } = useLeads();
  
  // Form state
  const [newNote, setNewNote] = useState('');
  const [contactDate, setContactDate] = useState<Date | undefined>(new Date());
  const [contactType, setContactType] = useState<ContactType>('call');
  const [outcome, setOutcome] = useState<ContactOutcome | undefined>();
  const [duration, setDuration] = useState<string>('');
  const [nextFollowUp, setNextFollowUp] = useState<Date | undefined>();
  
  // Edit state
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editContactDate, setEditContactDate] = useState<Date | undefined>();
  const [editContactType, setEditContactType] = useState<ContactType>('call');
  const [editOutcome, setEditOutcome] = useState<ContactOutcome | undefined>();
  const [editDuration, setEditDuration] = useState<string>('');
  
  const [submitting, setSubmitting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  
  // Contract state
  const [contractEnabled, setContractEnabled] = useState(false);
  const [contractNumber, setContractNumber] = useState('');
  const [contractDate, setContractDate] = useState<Date | undefined>();
  const [paymentPlan, setPaymentPlan] = useState('');

  useEffect(() => {
    if (open && lead) {
      fetchNotes();
      setContactDate(new Date());
      setContactType('call');
      setOutcome(undefined);
      setDuration('');
      setNextFollowUp(undefined);
      setNewNote('');
      // Init contract state from lead
      setContractEnabled(!!lead.contract_number);
      setContractNumber(lead.contract_number || '');
      setContractDate(lead.contract_date ? new Date(lead.contract_date) : undefined);
      setPaymentPlan(lead.payment_plan || '');
    }
  }, [open, lead, fetchNotes]);

  const handleTemplateClick = (template: typeof SMART_TEMPLATES[0]) => {
    setNewNote(template.text);
    setContactType(template.type);
    setOutcome(template.outcome);
  };

  const generateAISummary = async () => {
    if (!newNote.trim()) return;
    
    setGeneratingAI(true);
    try {
      // Auto-enhance the note with AI-generated insights
      const enhancedNote = `${newNote}\n\n---\n🤖 AI Note: Contact logged successfully. ${
        outcome === 'interested' ? 'High priority follow-up recommended.' :
        outcome === 'callback_requested' ? 'Ensure timely callback as scheduled.' :
        outcome === 'no_answer' ? 'Consider trying different time or contact method.' :
        outcome === 'not_interested' ? 'Lead marked as low priority.' :
        'Continue regular follow-up schedule.'
      }`;
      setNewNote(enhancedNote);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead) return;
    
    setSubmitting(true);
    try {
      await addNote({
        content: newNote.trim(),
        contactedAt: contactDate ? format(contactDate, 'yyyy-MM-dd') : undefined,
        contactType,
        outcome,
        durationMinutes: duration ? parseInt(duration) : undefined,
      });
      
      // Update lead's next follow-up and last contacted if set
      const updates: Record<string, any> = {
        last_contacted_at: contactDate ? format(contactDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      };
      
      if (nextFollowUp) {
        updates.next_follow_up = format(nextFollowUp, 'yyyy-MM-dd');
      }
      
      // Update status to "contacted" for ANY contact attempt (except if already further in pipeline)
      // Only update if current status is "new"
      if (lead.status === 'new') {
        updates.status = 'contacted';
      }
      
      // Set interest level based on outcome
      if (outcome === 'interested') {
        updates.interest_level = 'high';
      } else if (outcome === 'not_interested') {
        updates.status = 'lost';
      }
      
      // Contract update logic
      if (contractEnabled && contractNumber.trim()) {
        updates.contract_number = contractNumber.trim();
        updates.contract_date = contractDate ? format(contractDate, 'yyyy-MM-dd') : null;
        updates.payment_plan = paymentPlan || null;
        updates.status = 'qualified';
      }
      
      await updateLead(lead.id, updates);
      onLeadUpdate?.();
      
      // Reset form
      setNewNote('');
      setContactDate(new Date());
      setContactType('call');
      setOutcome(undefined);
      setDuration('');
      setNextFollowUp(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;
    
    setSubmitting(true);
    try {
      await updateNote(
        noteId, 
        editContent.trim(),
        editContactDate ? format(editContactDate, 'yyyy-MM-dd') : undefined,
        editContactType,
        editOutcome,
        editDuration ? parseInt(editDuration) : undefined
      );
      cancelEditing();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this contact log?')) {
      await deleteNote(noteId);
    }
  };

  const startEditing = (note: LeadNote) => {
    setEditingNote(note.id);
    setEditContent(note.content);
    setEditContactDate(note.contacted_at ? new Date(note.contacted_at) : undefined);
    setEditContactType((note.contact_type as ContactType) || 'call');
    setEditOutcome(note.outcome as ContactOutcome | undefined);
    setEditDuration(note.duration_minutes?.toString() || '');
  };

  const cancelEditing = () => {
    setEditingNote(null);
    setEditContent('');
    setEditContactDate(undefined);
    setEditContactType('call');
    setEditOutcome(undefined);
    setEditDuration('');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getOutcomeInfo = (outcomeValue: string | null) => {
    return CONTACT_OUTCOMES.find(o => o.value === outcomeValue);
  };

  const getContactTypeInfo = (typeValue: string | null) => {
    return CONTACT_TYPES.find(t => t.value === typeValue);
  };

  const stats = getContactStats();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Smart Contact Log - {lead?.full_name}
            {lead?.phone && (
              <ClickToCall phoneNumber={lead.phone} leadId={lead.id} className="ml-auto text-sm" />
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4">
          {/* Contact Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-500/10">
              <div className="text-lg font-bold text-green-600">{stats.answered}</div>
              <div className="text-xs text-muted-foreground">Answered</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-yellow-500/10">
              <div className="text-lg font-bold text-yellow-600">{stats.noAnswer}</div>
              <div className="text-xs text-muted-foreground">No Answer</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-500/10">
              <div className="text-lg font-bold text-blue-600">{stats.totalDuration}m</div>
              <div className="text-xs text-muted-foreground">Talk Time</div>
            </div>
          </div>

          {/* Quick Templates */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SMART_TEMPLATES.map((template) => (
                <Button
                  key={template.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleTemplateClick(template)}
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No contact logs yet</p>
                <p className="text-sm">Log your first contact below</p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {notes.map((note) => (
                  <div key={note.id} className="p-4 rounded-lg border bg-card">
                    {editingNote === note.id ? (
                      <div className="space-y-3">
                        {/* Edit Form - Contact Type & Outcome */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Contact Type
                            </label>
                            <Select value={editContactType} onValueChange={(v) => setEditContactType(v as ContactType)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTACT_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      {type.icon}
                                      {type.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Outcome
                            </label>
                            <Select value={editOutcome || ''} onValueChange={(v) => setEditOutcome(v as ContactOutcome)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select outcome" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTACT_OUTCOMES.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    <div className="flex items-center gap-2">
                                      {o.icon}
                                      {o.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Contact Date
                            </label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editContactDate && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {editContactDate ? format(editContactDate, 'PPP') : 'Select date'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={editContactDate} onSelect={setEditContactDate} initialFocus className="pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>
                          {editContactType === 'call' && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Duration (minutes)
                              </label>
                              <Input
                                type="number"
                                value={editDuration}
                                onChange={(e) => setEditDuration(e.target.value)}
                                placeholder="e.g. 15"
                                min="1"
                              />
                            </div>
                          )}
                        </div>
                        
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} placeholder="Notes about this contact..." />
                        
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={submitting}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleUpdateNote(note.id)} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Note Header with Type & Outcome */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {note.contact_type && (
                            <Badge variant="outline" className="text-xs">
                              {getContactTypeInfo(note.contact_type)?.icon}
                              <span className="ml-1">{getContactTypeInfo(note.contact_type)?.label}</span>
                            </Badge>
                          )}
                          {note.outcome && (
                            <Badge className={cn("text-xs", getOutcomeInfo(note.outcome)?.color)}>
                              {getOutcomeInfo(note.outcome)?.icon}
                              <span className="ml-1">{getOutcomeInfo(note.outcome)?.label}</span>
                            </Badge>
                          )}
                          {note.duration_minutes && (
                            <Badge variant="secondary" className="text-xs">
                              <Timer className="h-3 w-3 mr-1" />
                              {note.duration_minutes}m
                            </Badge>
                          )}
                          {note.contacted_at && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              <CalendarIcon className="h-3 w-3 inline mr-1" />
                              {format(new Date(note.contacted_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        
                        {note.ai_analysis && (
                          <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-1 text-xs text-primary mb-1">
                              <Sparkles className="h-3 w-3" />
                              AI Insight
                            </div>
                            <p className="text-xs text-muted-foreground">{note.ai_analysis}</p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px]">{getInitials(note.author?.full_name)}</AvatarFallback>
                            </Avatar>
                            <span>{note.author?.full_name || 'Unknown'}</span>
                            <span>•</span>
                            <span>{format(new Date(note.created_at), 'MMM d, HH:mm')}</span>
                          </div>
                          {note.created_by === user?.id && (
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(note)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteNote(note.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Add Contact Log Form */}
          <div className="pt-4 border-t mt-auto space-y-3">
            {/* Contact Type & Outcome Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Contact Type
                </label>
                <Select value={contactType} onValueChange={(v) => setContactType(v as ContactType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Outcome
                </label>
                <Select value={outcome || ''} onValueChange={(v) => {
                  setOutcome(v as ContactOutcome);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div className="flex items-center gap-2">
                          {o.icon}
                          {o.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ready to Contract button after outcome */}
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                variant={contractEnabled ? 'default' : 'outline'}
                className={cn(
                  'gap-1.5 w-full transition-all',
                  contractEnabled 
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                )}
                onClick={() => setContractEnabled(!contractEnabled)}
              >
                <FileText className="h-4 w-4" />
                Ready to Contract
                {lead?.contract_number && !contractEnabled && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20 ml-1">Mavjud</Badge>
                )}
              </Button>
            </div>

            {/* Shartnoma form */}
            {contractEnabled && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Shartnoma raqami
                    </label>
                    <Input
                      value={contractNumber}
                      onChange={(e) => setContractNumber(e.target.value)}
                      placeholder="Masalan: SH-2025-001"
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Shartnoma sanasi
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs h-9", !contractDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {contractDate ? format(contractDate, 'dd.MM.yyyy') : 'Sana tanlang'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                          <Calendar
                            mode="single"
                            selected={contractDate}
                            onSelect={setContractDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Tarif tanlash
                      </label>
                      <Select value={paymentPlan} onValueChange={setPaymentPlan}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Tarif tanlang" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {PAYMENT_PLANS.map((plan) => (
                            <SelectItem key={plan.value} value={plan.value}>
                              <div className="flex items-center justify-between gap-2">
                                <span>{plan.label}</span>
                                <span className="text-xs text-muted-foreground">({plan.price})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Date, Duration, Next Follow-up */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Contact Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !contactDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {contactDate ? format(contactDate, 'MMM d') : 'Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                    <Calendar 
                      mode="single" 
                      selected={contactDate} 
                      onSelect={setContactDate} 
                      initialFocus 
                      className="p-3 pointer-events-auto" 
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {contactType === 'call' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Duration (min)
                  </label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="15"
                    min="1"
                    className="h-9"
                  />
                </div>
              )}
              
              <div className={contactType !== 'call' ? 'col-span-2' : ''}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Next Follow-up <span className="text-red-500">*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !nextFollowUp && "text-muted-foreground border-red-500/50")}>
                      <CalendarPlus className="mr-1 h-3 w-3" />
                      {nextFollowUp ? format(nextFollowUp, 'MMM d') : 'Required'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                    <Calendar 
                      mode="single" 
                      selected={nextFollowUp} 
                      onSelect={setNextFollowUp} 
                      initialFocus 
                      className="p-3 pointer-events-auto" 
                      disabled={(date) => date < new Date()} 
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Notes Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Notes about this contact..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAddNote();
                  }
                }}
              />
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={generateAISummary}
                  disabled={!newNote.trim() || generatingAI}
                  title="AI Enhance"
                  className="shrink-0"
                >
                  {generatingAI ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || !nextFollowUp || submitting}
                  className="shrink-0"
                  size="icon"
                  title={!nextFollowUp ? "Please set next follow-up date" : "Submit contact log"}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit • Click ✨ for AI enhancement
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
