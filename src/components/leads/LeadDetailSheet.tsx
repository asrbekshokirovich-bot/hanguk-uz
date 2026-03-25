import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ClickToCall } from '@/components/calls/ClickToCall';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Lead, CreateLeadData } from '@/hooks/useLeads';
import { useLeadNotes, LeadNote, ContactType, ContactOutcome, AddNoteData } from '@/hooks/useLeadNotes';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  User,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Languages,
  BookOpen,
  DollarSign,
  Calendar,
  CalendarPlus,
  Bot,
  Sparkles,
  Save,
  RefreshCw,
  MessageSquare,
  PhoneCall,
  Clock,
  TrendingUp,
  Target,
  History,
  Plus,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Pencil,
  Trash2,
  MoreHorizontal,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Partial<CreateLeadData>) => Promise<void>;
  onAnalyze: (id: string) => Promise<void>;
  onConvert: (id: string) => Promise<{ success: boolean; magicCode?: string }>;
  staff: { user_id: string; full_name: string | null }[];
}

const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School' },
  { value: 'bachelor', label: "Bachelor's Degree" },
  { value: 'master', label: "Master's Degree" },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Other' },
];

const BUDGET_RANGES = [
  { value: 'under_5000', label: 'Under $5,000' },
  { value: '5000_10000', label: '$5,000 - $10,000' },
  { value: '10000_20000', label: '$10,000 - $20,000' },
  { value: '20000_plus', label: '$20,000+' },
  { value: 'scholarship', label: 'Looking for Scholarship' },
];

const START_DATES = [
  { value: 'spring_2025', label: 'Spring 2025' },
  { value: 'fall_2025', label: 'Fall 2025' },
  { value: 'spring_2026', label: 'Spring 2026' },
  { value: 'fall_2026', label: 'Fall 2026' },
  { value: 'undecided', label: 'Undecided' },
];

const PAYMENT_PLANS = [
  { value: 'tekin', label: 'Tekin tarif', desc: 'Bepul' },
  { value: 'tekin_natija', label: 'Tekin tarif (natija to\'lov)', desc: 'Natijaga qarab to\'lov' },
  { value: 'standart', label: 'STANDART', desc: '5 000 000 UZS' },
  { value: 'standart_2', label: 'STANDART 2', desc: '4 mln + 2 mln UZS' },
  { value: 'premium', label: 'PREMIUM', desc: '10 000 000 UZS' },
  { value: 'premium_2', label: 'PREMIUM 2', desc: '7 mln + 6 mln UZS' },
  { value: 'no_risk', label: 'NO RISK', desc: '$5 000' },
  { value: 'no_risk_2', label: 'NO RISK 2', desc: '$3 000 + $2 500' },
];

const CONTACT_TYPES: { value: ContactType; label: string; icon: string }[] = [
  { value: 'call', label: 'Call', icon: '📞' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'message', label: 'SMS', icon: '📱' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'meeting', label: 'Meeting', icon: '🤝' },
];

const OUTCOMES: { value: ContactOutcome; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'answered', label: 'Answered', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-500' },
  { value: 'interested', label: 'Interested', icon: <Sparkles className="h-4 w-4" />, color: 'text-emerald-500' },
  { value: 'callback_requested', label: 'Callback', icon: <PhoneCall className="h-4 w-4" />, color: 'text-blue-500' },
  { value: 'no_answer', label: 'No Answer', icon: <AlertCircle className="h-4 w-4" />, color: 'text-yellow-500' },
  { value: 'busy', label: 'Busy', icon: <Clock className="h-4 w-4" />, color: 'text-orange-500' },
  { value: 'voicemail', label: 'Voicemail', icon: <MessageSquare className="h-4 w-4" />, color: 'text-gray-500' },
  { value: 'not_interested', label: 'Not Interested', icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
];

export const LeadDetailSheet: React.FC<LeadDetailSheetProps> = ({
  lead,
  open,
  onOpenChange,
  onUpdate,
  onAnalyze,
  onConvert,
  staff,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateLeadData>>({});
  const [activeTab, setActiveTab] = useState('profile');

  // Contact logging state
  const [newNote, setNewNote] = useState('');
  const [newContactType, setNewContactType] = useState<ContactType>('call');
  const [newOutcome, setNewOutcome] = useState<ContactOutcome | ''>('');
  const [newDuration, setNewDuration] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState<Date | undefined>(undefined);
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Edit/Delete contact state
  const [editingNote, setEditingNote] = useState<LeadNote | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editContactType, setEditContactType] = useState<ContactType>('call');
  const [editOutcome, setEditOutcome] = useState<ContactOutcome | ''>('');
  const [editDuration, setEditDuration] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contractEnabled, setContractEnabled] = useState(false);
  const [contractEditing, setContractEditing] = useState(false);
  const [contractDeleteOpen, setContractDeleteOpen] = useState(false);
  const [contractEditData, setContractEditData] = useState<{ contract_number: string; contract_date: string; payment_plan: string }>({ contract_number: '', contract_date: '', payment_plan: '' });
  const [studentsList, setStudentsList] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const { notes, loading: notesLoading, fetchNotes, addNote, updateNote, deleteNote, getContactStats } = useLeadNotes(lead?.id || null);

  // Fetch students list for contract section
  useEffect(() => {
    const fetchStudents = async () => {
      const { data: staffRoles } = await supabase.from('user_roles').select('user_id');
      const staffIds = staffRoles?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name', { ascending: true });
      if (profiles) {
        setStudentsList(profiles.filter(p => !staffIds.includes(p.user_id)));
      }
    };
    if (open) fetchStudents();
  }, [open]);

  useEffect(() => {
    if (lead) {
      setFormData({
        full_name: lead.full_name,
        phone: lead.phone || '',
        email: lead.email || '',
        city: lead.city || '',
        source: lead.source,
        status: lead.status,
        interest_level: lead.interest_level,
        education_level: lead.education_level || '',
        english_level: lead.english_level || '',
        korean_level: lead.korean_level || '',
        preferred_university: lead.preferred_university || '',
        preferred_program: lead.preferred_program || '',
        budget_range: lead.budget_range || '',
        preferred_start_date: lead.preferred_start_date || '',
        how_heard: lead.how_heard || '',
        notes: lead.notes || '',
        assigned_to: lead.assigned_to || '',
        contract_number: lead.contract_number || '',
        contract_date: lead.contract_date || '',
        payment_plan: lead.payment_plan || '',
      });
      // Don't auto-enable contract editing - only enable via explicit "Tahrirlash" button
      fetchNotes();
    }
  }, [lead, fetchNotes]);

  const updateField = <K extends keyof CreateLeadData>(field: K, value: CreateLeadData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      const updates = { ...formData };
      // Auto-qualify if contract_number is set and status is new/contacted
      if (updates.contract_number && updates.contract_number.trim() !== '' &&
        (lead.status === 'new' || lead.status === 'contacted')) {
        updates.status = 'qualified';
      }
      await onUpdate(lead.id, updates);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!lead) return;
    setIsAnalyzing(true);
    try {
      await onAnalyze(lead.id);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddNote = async () => {
    // Next follow-up is not required for 'not_interested' outcome
    const requiresFollowUp = newOutcome !== 'not_interested';
    if (!newNote.trim() || !newOutcome || (requiresFollowUp && !nextFollowUp)) return;
    setIsAddingNote(true);
    try {
      const noteData: AddNoteData = {
        content: newNote.trim(),
        contactType: newContactType,
        outcome: newOutcome as ContactOutcome,
        durationMinutes: newDuration ? parseInt(newDuration) : undefined,
        contactedAt: new Date().toISOString().split('T')[0],
      };
      await addNote(noteData);

      // Update lead with next follow-up date and status
      if (lead) {
        const updates: Partial<CreateLeadData> = {
          last_contacted_at: new Date().toISOString(),
        };
        // Only set next_follow_up if it's provided (not required for 'not_interested')
        if (nextFollowUp) {
          updates.next_follow_up = format(nextFollowUp, 'yyyy-MM-dd');
        }
        // Update status to 'contacted' if still 'new'
        if (lead.status === 'new') {
          updates.status = 'contacted';
        }
        // Set interest level if interested
        if (newOutcome === 'interested') {
          updates.interest_level = 'high';
        } else if (newOutcome === 'not_interested') {
          updates.status = 'lost';
          updates.next_follow_up = undefined; // Clear any existing follow-up
        }

        // Shartnoma ma'lumotlarini saqlash
        if (contractEnabled && formData.contract_number?.trim()) {
          updates.contract_number = formData.contract_number.trim();
          updates.contract_date = formData.contract_date || null;
          updates.payment_plan = formData.payment_plan || null;
          // Auto-qualify if status is new or contacted
          if (lead.status === 'new' || lead.status === 'contacted') {
            updates.status = 'qualified';
          }
        }

        await onUpdate(lead.id, updates);
      }

      setNewNote('');
      setNewOutcome('');
      setNewDuration('');
      setNextFollowUp(undefined);
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleEditNote = (note: LeadNote) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditContactType(note.contact_type || 'call');
    setEditOutcome(note.outcome || '');
    setEditDuration(note.duration_minutes?.toString() || '');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateNote(
        editingNote.id,
        editContent.trim(),
        editingNote.contacted_at || undefined,
        editContactType,
        editOutcome as ContactOutcome || undefined,
        editDuration ? parseInt(editDuration) : undefined
      );
      setIsEditDialogOpen(false);
      setEditingNote(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;
    setIsDeleting(true);
    try {
      await deleteNote(deleteNoteId);
      setDeleteNoteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const contactStats = getContactStats();

  const getPriorityColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 70) return 'bg-red-500/10 text-red-500 border-red-500/30';
    if (score >= 50) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
  };

  const getOutcomeDisplay = (outcome: string | null) => {
    const found = OUTCOMES.find(o => o.value === outcome);
    return found || { label: outcome || 'Unknown', icon: <MessageSquare className="h-4 w-4" />, color: 'text-muted-foreground' };
  };

  const getContactTypeIcon = (type: string | null) => {
    const found = CONTACT_TYPES.find(t => t.value === type);
    return found?.icon || '📝';
  };

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{lead.full_name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getPriorityColor(lead.priority_score)}>
                  <Gauge className="h-3 w-3 mr-1" />
                  {lead.priority_score || 0} Priority
                </Badge>
                <Badge variant="outline">
                  {lead.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-1" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-4">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-1" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <History className="h-4 w-4 mr-1" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="insights">
              <Bot className="h-4 w-4 mr-1" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="m-0 mt-4 flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(100dvh-200px)]">
              <div className="space-y-6 pr-4">
                {/* Basic Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Full Name</Label>
                        {isEditing ? (
                          <Input
                            value={formData.full_name || ''}
                            onChange={(e) => updateField('full_name', e.target.value)}
                            maxLength={100}
                          />
                        ) : (
                          <p className="font-medium">{lead.full_name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Phone
                        </Label>
                        {isEditing ? (
                          <Input
                            value={formData.phone || ''}
                            onChange={(e) => updateField('phone', e.target.value)}
                            maxLength={20}
                          />
                        ) : (
                          <div className="font-medium">
                            {lead.phone ? (
                              <ClickToCall phoneNumber={lead.phone} leadId={lead.id} />
                            ) : '-'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> City
                        </Label>
                        {isEditing ? (
                          <Input
                            value={formData.city || ''}
                            onChange={(e) => updateField('city', e.target.value)}
                            maxLength={100}
                          />
                        ) : (
                          <p className="font-medium">{lead.city || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        {isEditing ? (
                          <Select
                            value={formData.status}
                            onValueChange={(v) => updateField('status', v as Lead['status'])}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{lead.status}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Interest Level</Label>
                        {isEditing ? (
                          <Select
                            value={formData.interest_level}
                            onValueChange={(v) => updateField('interest_level', v as Lead['interest_level'])}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">🔵 Low</SelectItem>
                              <SelectItem value="medium">🟡 Medium</SelectItem>
                              <SelectItem value="high">🟢 High</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium capitalize">{lead.interest_level}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Assigned To</Label>
                        {isEditing ? (
                          <Select
                            value={formData.assigned_to || 'unassigned'}
                            onValueChange={(v) => updateField('assigned_to', v === 'unassigned' ? undefined : v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {staff.map((s) => (
                                <SelectItem key={s.user_id} value={s.user_id}>
                                  {s.full_name || 'Unknown'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium">{lead.assignee?.full_name || 'Unassigned'}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shartnoma / Contract */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        📄 Shartnoma qilingan
                      </span>
                      {isEditing && (
                        <Switch
                          checked={contractEnabled}
                          onCheckedChange={(checked) => {
                            setContractEnabled(checked);
                            if (!checked) {
                              updateField('contract_number', '');
                              updateField('contract_date', '');
                              updateField('payment_plan', '');
                            }
                          }}
                        />
                      )}
                      {!isEditing && (
                        <Badge variant={lead.contract_number ? 'default' : 'secondary'}>
                          {lead.contract_number ? 'Ha' : 'Yo\'q'}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      contractEnabled ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Shartnoma raqami</Label>
                              <Input
                                value={formData.contract_number || ''}
                                onChange={(e) => updateField('contract_number', e.target.value)}
                                placeholder="e.g., SH-2026-001"
                                maxLength={50}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Shartnoma sanasi</Label>
                              <Input
                                type="date"
                                value={formData.contract_date || ''}
                                onChange={(e) => updateField('contract_date', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Tarif</Label>
                            <Select
                              value={formData.payment_plan || ''}
                              onValueChange={(v) => updateField('payment_plan', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Tarifni tanlang" />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_PLANS.map((plan) => (
                                  <SelectItem key={plan.value} value={plan.value}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{plan.label}</span>
                                      <span className="text-xs text-muted-foreground">{plan.desc}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Talaba bog'lash</Label>
                            <Select
                              value={lead.converted_to_student_id || ''}
                              onValueChange={async (v) => {
                                if (lead) {
                                  await onUpdate(lead.id, { converted_to_student_id: v || undefined } as any);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Talaba tanlang" />
                              </SelectTrigger>
                              <SelectContent>
                                {studentsList.map((s) => (
                                  <SelectItem key={s.user_id} value={s.user_id}>
                                    {s.full_name || 'Nomsiz'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Shartnoma qilinmagan</p>
                      )
                    ) : (
                      lead.contract_number ? (
                        contractEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Shartnoma raqami</Label>
                                <Input
                                  value={contractEditData.contract_number}
                                  onChange={(e) => setContractEditData(prev => ({ ...prev, contract_number: e.target.value }))}
                                  placeholder="e.g., SH-2026-001"
                                  maxLength={50}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Shartnoma sanasi</Label>
                                <Input
                                  type="date"
                                  value={contractEditData.contract_date}
                                  onChange={(e) => setContractEditData(prev => ({ ...prev, contract_date: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Tarif</Label>
                              <Select
                                value={contractEditData.payment_plan}
                                onValueChange={(v) => setContractEditData(prev => ({ ...prev, payment_plan: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Tarifni tanlang" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_PLANS.map((plan) => (
                                    <SelectItem key={plan.value} value={plan.value}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{plan.label}</span>
                                        <span className="text-xs text-muted-foreground">{plan.desc}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (!lead) return;
                                  await onUpdate(lead.id, {
                                    contract_number: contractEditData.contract_number.trim() || null,
                                    contract_date: contractEditData.contract_date || null,
                                    payment_plan: contractEditData.payment_plan || null,
                                  } as any);
                                  setContractEditing(false);
                                  toast.success("Shartnoma yangilandi");
                                }}
                                disabled={!contractEditData.contract_number?.trim()}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Saqlash
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setContractEditing(false)}
                              >
                                Bekor qilish
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Raqami</p>
                                <p className="font-medium">{lead.contract_number}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Sana</p>
                                <p className="font-medium">
                                  {lead.contract_date ? format(new Date(lead.contract_date), 'dd.MM.yyyy') : '-'}
                                </p>
                              </div>
                            </div>
                            {lead.payment_plan && (
                              <div>
                                <p className="text-xs text-muted-foreground">Tarif</p>
                                <p className="font-medium">
                                  {PAYMENT_PLANS.find(p => p.value === lead.payment_plan)?.label || lead.payment_plan}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({PAYMENT_PLANS.find(p => p.value === lead.payment_plan)?.desc})
                                  </span>
                                </p>
                              </div>
                            )}
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setContractEditData({
                                    contract_number: lead.contract_number || '',
                                    contract_date: lead.contract_date || '',
                                    payment_plan: lead.payment_plan || '',
                                  });
                                  setContractEditing(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Tahrirlash
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setContractDeleteOpen(true)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                O'chirish
                              </Button>
                            </div>

                            <AlertDialog open={contractDeleteOpen} onOpenChange={setContractDeleteOpen}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Shartnomani o'chirish</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Shartnoma ma'lumotlari (raqam, sana, tarif) o'chiriladi. Davom etasizmi?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
                                      if (!lead) return;
                                      await onUpdate(lead.id, {
                                        contract_number: null,
                                        contract_date: null,
                                        payment_plan: null,
                                      } as any);
                                      setContractDeleteOpen(false);
                                      toast.success("Shartnoma o'chirildi");
                                    }}
                                  >
                                    O'chirish
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">Shartnoma qilinmagan</p>
                      )
                    )}
                  </CardContent>
                </Card>

                {/* Education */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Education Level</Label>
                      {isEditing ? (
                        <Select
                          value={formData.education_level || ''}
                          onValueChange={(v) => updateField('education_level', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            {EDUCATION_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium">
                          {EDUCATION_LEVELS.find(l => l.value === lead.education_level)?.label || '-'}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Languages className="h-3 w-3" /> English Level
                        </Label>
                        {isEditing ? (
                          <Input
                            value={formData.english_level || ''}
                            onChange={(e) => updateField('english_level', e.target.value)}
                            placeholder="e.g., IELTS 6.5"
                            maxLength={50}
                          />
                        ) : (
                          <p className="font-medium">{lead.english_level || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Languages className="h-3 w-3" /> Korean Level
                        </Label>
                        {isEditing ? (
                          <Input
                            value={formData.korean_level || ''}
                            onChange={(e) => updateField('korean_level', e.target.value)}
                            placeholder="e.g., TOPIK 3"
                            maxLength={50}
                          />
                        ) : (
                          <p className="font-medium">{lead.korean_level || '-'}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preferences */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> Preferred University
                        </Label>
                        {isEditing ? (
                          <Input
                            value={formData.preferred_university || ''}
                            onChange={(e) => updateField('preferred_university', e.target.value)}
                            maxLength={200}
                          />
                        ) : (
                          <p className="font-medium">{lead.preferred_university || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Preferred Program</Label>
                        {isEditing ? (
                          <Input
                            value={formData.preferred_program || ''}
                            onChange={(e) => updateField('preferred_program', e.target.value)}
                            maxLength={200}
                          />
                        ) : (
                          <p className="font-medium">{lead.preferred_program || '-'}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Budget
                        </Label>
                        {isEditing ? (
                          <Select
                            value={formData.budget_range || ''}
                            onValueChange={(v) => updateField('budget_range', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select budget" />
                            </SelectTrigger>
                            <SelectContent>
                              {BUDGET_RANGES.map((range) => (
                                <SelectItem key={range.value} value={range.value}>
                                  {range.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium">
                            {BUDGET_RANGES.find(b => b.value === lead.budget_range)?.label || '-'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Start Date
                        </Label>
                        {isEditing ? (
                          <Select
                            value={formData.preferred_start_date || ''}
                            onValueChange={(v) => updateField('preferred_start_date', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select date" />
                            </SelectTrigger>
                            <SelectContent>
                              {START_DATES.map((date) => (
                                <SelectItem key={date.value} value={date.value}>
                                  {date.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-medium">
                            {START_DATES.find(d => d.value === lead.preferred_start_date)?.label || '-'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      {isEditing ? (
                        <Textarea
                          value={formData.notes || ''}
                          onChange={(e) => updateField('notes', e.target.value)}
                          rows={3}
                          maxLength={1000}
                        />
                      ) : (
                        <p className="text-sm">{lead.notes || '-'}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    {isAnalyzing ? 'Analyzing...' : 'AI Analyze'}
                  </Button>
                  {lead.contract_number ? (
                    <Button
                      className="flex-1"
                      onClick={() => onConvert(lead.id)}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Talabaga aylantirish
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => {
                        setContractEnabled(true);
                        setIsEditing(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Shartnomaga o'tkazish
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="m-0 mt-4 flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(100dvh-200px)]">
              <div className="space-y-4 pr-4">
                {/* Contact Stats */}
                <div className="grid grid-cols-4 gap-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{contactStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-500">{contactStats.answered}</p>
                      <p className="text-xs text-muted-foreground">Answered</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-500">{contactStats.noAnswer}</p>
                      <p className="text-xs text-muted-foreground">No Answer</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{contactStats.answerRate}%</p>
                      <p className="text-xs text-muted-foreground">Rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Add New Contact */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Log New Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      {CONTACT_TYPES.map((type) => (
                        <Button
                          key={type.value}
                          type="button"
                          size="sm"
                          variant={newContactType === type.value ? 'default' : 'outline'}
                          onClick={() => setNewContactType(type.value)}
                        >
                          {type.icon} {type.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {OUTCOMES.map((outcome) => (
                        <Badge
                          key={outcome.value}
                          variant="outline"
                          className={cn(
                            'cursor-pointer px-3 py-1.5 transition-all',
                            newOutcome === outcome.value && 'ring-2 ring-primary'
                          )}
                          onClick={() => setNewOutcome(outcome.value)}
                        >
                          <span className={outcome.color}>{outcome.icon}</span>
                          <span className="ml-1">{outcome.label}</span>
                        </Badge>
                      ))}
                      {!lead.contract_number && !contractEnabled && (
                        <Button
                          type="button"
                          size="sm"
                          variant={contractEnabled ? 'default' : 'outline'}
                          className={cn(
                            'gap-1.5 transition-all',
                            contractEnabled
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                          )}
                          onClick={() => setContractEnabled(!contractEnabled)}
                        >
                          <FileText className="h-4 w-4" />
                          Ready to Contract
                        </Button>
                      )}
                    </div>
                    {/* Contract section */}
                    {lead.contract_number && !contractEnabled ? (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
                          <FileText className="h-4 w-4" />
                          Shartnoma ma'lumotlari
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">Raqami</span>
                            <p className="font-medium">{lead.contract_number}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Sana</span>
                            <p className="font-medium">{lead.contract_date ? format(new Date(lead.contract_date), 'dd.MM.yyyy') : '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Tarif</span>
                            <p className="font-medium">{lead.payment_plan || '—'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => {
                              setContractEnabled(true);
                              updateField('contract_number', lead.contract_number || '');
                              updateField('contract_date', lead.contract_date || '');
                              updateField('payment_plan', lead.payment_plan || '');
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            Tahrirlash
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => setContractDeleteOpen(true)}
                          >
                            <Trash2 className="h-3 w-3" />
                            O'chirish
                          </Button>
                        </div>
                        <AlertDialog open={contractDeleteOpen} onOpenChange={setContractDeleteOpen}>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Shartnomani o'chirish</AlertDialogTitle>
                              <AlertDialogDescription>
                                Shartnoma ma'lumotlari o'chiriladi. Davom etasizmi?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  if (!lead) return;
                                  await onUpdate(lead.id, {
                                    contract_number: null,
                                    contract_date: null,
                                    payment_plan: null,
                                  });
                                  setContractDeleteOpen(false);
                                  toast.success("Shartnoma o'chirildi");
                                }}
                              >
                                O'chirish
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : contractEnabled ? (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Shartnoma raqami</Label>
                          <Input
                            value={formData.contract_number || ''}
                            onChange={(e) => updateField('contract_number', e.target.value)}
                            placeholder="Masalan: SH-2025-001"
                            className="h-9 mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Shartnoma sanasi</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs h-9 mt-1", !formData.contract_date && "text-muted-foreground")}>
                                  <Calendar className="mr-1 h-3 w-3" />
                                  {formData.contract_date ? format(new Date(formData.contract_date), 'dd.MM.yyyy') : 'Sana tanlang'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={formData.contract_date ? new Date(formData.contract_date) : undefined}
                                  onSelect={(date) => updateField('contract_date', date ? format(date, 'yyyy-MM-dd') : '')}
                                  initialFocus
                                  className="p-3 pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Tarif</Label>
                            <Select value={formData.payment_plan || ''} onValueChange={(v) => updateField('payment_plan', v)}>
                              <SelectTrigger className="h-9 mt-1">
                                <SelectValue placeholder="Tarif tanlang" />
                              </SelectTrigger>
                              <SelectContent className="z-[9999]">
                                {PAYMENT_PLANS.map((plan) => (
                                  <SelectItem key={plan.value} value={plan.value}>
                                    <div className="flex items-center gap-2">
                                      <span>{plan.label}</span>
                                      <span className="text-xs text-muted-foreground">({plan.desc})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={async () => {
                              if (!lead || !formData.contract_number?.trim()) return;
                              try {
                                const updates: any = {
                                  contract_number: formData.contract_number.trim(),
                                  contract_date: formData.contract_date || null,
                                  payment_plan: formData.payment_plan || null,
                                };
                                if (lead.status === 'new' || lead.status === 'contacted') {
                                  updates.status = 'qualified';
                                }
                                await onUpdate(lead.id, updates);
                                toast.success("Shartnoma saqlandi");
                              } finally {
                                setContractEnabled(false);
                              }
                            }}
                            disabled={!formData.contract_number?.trim()}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Shartnomani saqlash
                          </Button>
                          {lead.contract_number && (
                            <Button
                              variant="outline"
                              onClick={() => setContractEnabled(false)}
                            >
                              Bekor qilish
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Duration</Label>
                        <Input
                          type="number"
                          placeholder="min"
                          value={newDuration}
                          onChange={(e) => setNewDuration(e.target.value)}
                          className="w-24"
                          min={0}
                          max={999}
                        />
                      </div>
                      {newOutcome !== 'not_interested' && (
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarPlus className="h-3 w-3" />
                            Next Follow-up <span className="text-red-500">*</span>
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !nextFollowUp && "text-muted-foreground border-red-500/50"
                                )}
                              >
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                {nextFollowUp ? format(nextFollowUp, 'MMM d, yyyy') : 'Select date (required)'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                              <div className="p-2 border-b flex gap-1 flex-wrap">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setNextFollowUp(addDays(new Date(), 1))}
                                >
                                  Tomorrow
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setNextFollowUp(addDays(new Date(), 3))}
                                >
                                  In 3 days
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setNextFollowUp(addDays(new Date(), 7))}
                                >
                                  Next week
                                </Button>
                              </div>
                              <CalendarComponent
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
                      )}
                    </div>
                    <Textarea
                      placeholder="What was discussed? Any important details..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                      maxLength={1000}
                    />
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || !newOutcome || (newOutcome !== 'not_interested' && !nextFollowUp) || isAddingNote}
                      className="w-full"
                      title={newOutcome !== 'not_interested' && !nextFollowUp ? "Please set next follow-up date" : ""}
                    >
                      {isAddingNote ? 'Logging...' : 'Log Contact'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Contact Timeline */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Contact History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {notesLoading ? (
                      <p className="text-center text-muted-foreground py-4">Loading...</p>
                    ) : notes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No contact history yet</p>
                    ) : (
                      <div className="space-y-4">
                        {notes.map((note, index) => {
                          const outcomeDisplay = getOutcomeDisplay(note.outcome);
                          return (
                            <div key={note.id} className="relative group">
                              {index < notes.length - 1 && (
                                <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                              )}
                              <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg">
                                  {getContactTypeIcon(note.contact_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn('flex items-center gap-1', outcomeDisplay.color)}>
                                        {outcomeDisplay.icon}
                                        <span className="font-medium text-sm">{outcomeDisplay.label}</span>
                                      </span>
                                      {note.duration_minutes && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Clock className="h-3 w-3 mr-1" />
                                          {note.duration_minutes} min
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {note.contacted_at
                                          ? format(new Date(note.contacted_at), 'MMM d, yyyy')
                                          : formatDistanceToNow(new Date(note.created_at), { addSuffix: true })
                                        }
                                      </span>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditNote(note)}>
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => setDeleteNoteId(note.id)}
                                          className="text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <p className="text-sm mt-1">{note.content}</p>
                                  {note.ai_analysis && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                      <Bot className="h-3 w-3 inline mr-1" />
                                      {note.ai_analysis}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    by {note.author?.full_name || 'Unknown'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="m-0 mt-4 flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(100dvh-200px)] pr-4">
              <div className="space-y-4 pr-4">
                <Card className={getPriorityColor(lead.priority_score)}>
                  <CardContent className="p-6 text-center">
                    <Gauge className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-4xl font-bold">{lead.priority_score || 0}</p>
                    <p className="text-sm">Priority Score</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lead.ai_summary ? (
                      <p className="text-sm">{lead.ai_summary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No AI analysis yet. Click "AI Analyze" to generate insights.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Lead Quality Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Profile Completeness</span>
                      <Badge variant="outline">
                        {[
                          lead.phone,
                          lead.city,
                          lead.education_level,
                          lead.preferred_university,
                          lead.budget_range,
                        ].filter(Boolean).length}/5 fields
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Contact Attempts</span>
                      <Badge variant="outline">{notes.length} contacts</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Response Rate</span>
                      <Badge variant={contactStats.answerRate >= 50 ? 'default' : 'secondary'}>
                        {contactStats.answerRate}%
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Next Follow-up</span>
                      <span className="text-sm">
                        {lead.next_follow_up
                          ? format(new Date(lead.next_follow_up), 'MMM d, yyyy')
                          : 'Not scheduled'
                        }
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Last Contacted</span>
                      <span className="text-sm text-muted-foreground">
                        {lead.last_contacted_at
                          ? formatDistanceToNow(new Date(lead.last_contacted_at), { addSuffix: true })
                          : 'Never'
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  className="w-full"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  <RefreshCw className={cn('h-4 w-4 mr-2', isAnalyzing && 'animate-spin')} />
                  {isAnalyzing ? 'Analyzing...' : 'Refresh AI Analysis'}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Edit Contact Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Contact Log</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm">Contact Type</Label>
                <div className="flex gap-2 flex-wrap">
                  {CONTACT_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      size="sm"
                      variant={editContactType === type.value ? 'default' : 'outline'}
                      onClick={() => setEditContactType(type.value)}
                    >
                      {type.icon} {type.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Outcome</Label>
                <div className="flex gap-2 flex-wrap">
                  {OUTCOMES.map((outcome) => (
                    <Badge
                      key={outcome.value}
                      variant="outline"
                      className={cn(
                        'cursor-pointer px-3 py-1.5 transition-all',
                        editOutcome === outcome.value && 'ring-2 ring-primary'
                      )}
                      onClick={() => setEditOutcome(outcome.value)}
                    >
                      <span className={outcome.color}>{outcome.icon}</span>
                      <span className="ml-1">{outcome.label}</span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Duration (minutes)</Label>
                <Input
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="Duration in minutes"
                  min={0}
                  max={999}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editContent.trim() || isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact Log</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this contact log? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteNote}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};
