import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreateLeadData, Lead } from '@/hooks/useLeads';
import { ContactType, ContactOutcome } from '@/hooks/useLeadNotes';
import { 
  User, 
  GraduationCap, 
  Target, 
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Check,
  Phone,
  MapPin,
  Calendar,
  CalendarIcon,
  DollarSign,
  BookOpen,
  Languages,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddLeadWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateLeadData, initialNote?: { content: string; contactType: ContactType; outcome: ContactOutcome }) => Promise<void>;
  staff: { user_id: string; full_name: string | null }[];
}

interface WizardFormData extends CreateLeadData {
  initialNoteContent?: string;
  initialContactType?: ContactType;
  initialOutcome?: ContactOutcome;
  nextFollowUp?: Date;
}

const STEPS = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'preferences', label: 'Preferences', icon: Target },
  { id: 'contact', label: 'First Contact', icon: MessageSquare },
];

const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School' },
  { value: 'bachelor', label: 'Bachelor\'s Degree' },
  { value: 'master', label: 'Master\'s Degree' },
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

const HOW_HEARD_OPTIONS = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'friend_referral', label: 'Friend Referral' },
  { value: 'search_engine', label: 'Search Engine' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'event', label: 'Event/Fair' },
  { value: 'other', label: 'Other' },
];

const CONTACT_TYPES: { value: ContactType; label: string; icon: string }[] = [
  { value: 'call', label: 'Phone Call', icon: '📞' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'message', label: 'SMS', icon: '📱' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'meeting', label: 'In Person', icon: '🤝' },
];

const OUTCOMES: { value: ContactOutcome; label: string; color: string }[] = [
  { value: 'answered', label: 'Answered', color: 'bg-green-500/10 text-green-500' },
  { value: 'interested', label: 'Very Interested', color: 'bg-emerald-500/10 text-emerald-500' },
  { value: 'callback_requested', label: 'Callback Requested', color: 'bg-blue-500/10 text-blue-500' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-yellow-500/10 text-yellow-500' },
  { value: 'busy', label: 'Busy', color: 'bg-orange-500/10 text-orange-500' },
  { value: 'voicemail', label: 'Voicemail', color: 'bg-gray-500/10 text-gray-500' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-red-500/10 text-red-500' },
];

export const AddLeadWizard: React.FC<AddLeadWizardProps> = ({
  open,
  onOpenChange,
  onSubmit,
  staff,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<WizardFormData>({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual',
    interest_level: 'medium',
    status: 'new',
    city: '',
    education_level: '',
    english_level: '',
    korean_level: '',
    preferred_university: '',
    preferred_program: '',
    budget_range: '',
    preferred_start_date: '',
    how_heard: '',
    notes: '',
    assigned_to: '',
    initialNoteContent: '',
    initialContactType: 'call',
    initialOutcome: undefined,
    nextFollowUp: addDays(new Date(), 1), // Default to tomorrow
  });

  const updateField = <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return formData.full_name.trim().length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const leadData: CreateLeadData = {
        full_name: formData.full_name.trim(),
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        source: formData.source,
        interest_level: formData.interest_level,
        status: formData.status,
        city: formData.city?.trim() || undefined,
        education_level: formData.education_level || undefined,
        english_level: formData.english_level?.trim() || undefined,
        korean_level: formData.korean_level?.trim() || undefined,
        preferred_university: formData.preferred_university?.trim() || undefined,
        preferred_program: formData.preferred_program?.trim() || undefined,
        budget_range: formData.budget_range || undefined,
        preferred_start_date: formData.preferred_start_date || undefined,
        how_heard: formData.how_heard || undefined,
        notes: formData.notes?.trim() || undefined,
        assigned_to: formData.assigned_to || undefined,
        // Don't set next follow-up if lead is not interested
        next_follow_up: formData.initialOutcome === 'not_interested' 
          ? undefined 
          : formData.nextFollowUp 
            ? format(formData.nextFollowUp, 'yyyy-MM-dd') 
            : undefined,
      };

      const initialNote = formData.initialNoteContent?.trim() && formData.initialOutcome
        ? {
            content: formData.initialNoteContent.trim(),
            contactType: formData.initialContactType || 'call',
            outcome: formData.initialOutcome,
          }
        : undefined;

      await onSubmit(leadData, initialNote);
      
      // Reset form
      setFormData({
        full_name: '',
        phone: '',
        email: '',
        source: 'manual',
        interest_level: 'medium',
        status: 'new',
        city: '',
        education_level: '',
        english_level: '',
        korean_level: '',
        preferred_university: '',
        preferred_program: '',
        budget_range: '',
        preferred_start_date: '',
        how_heard: '',
        notes: '',
        assigned_to: '',
        initialNoteContent: '',
        initialContactType: 'call',
        initialOutcome: undefined,
        nextFollowUp: addDays(new Date(), 1),
      });
      setCurrentStep(0);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  placeholder="Enter full name"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+998 90 123 45 67"
                  maxLength={20}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  City / Region
                </Label>
                <Input
                  id="city"
                  value={formData.city || ''}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="e.g., Tashkent"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => updateField('source', v as Lead['source'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="call">Incoming Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Interest Level</Label>
                <Select
                  value={formData.interest_level}
                  onValueChange={(v) => updateField('interest_level', v as Lead['interest_level'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🔵 Low Interest</SelectItem>
                    <SelectItem value="medium">🟡 Medium Interest</SelectItem>
                    <SelectItem value="high">🟢 High Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={formData.assigned_to || 'unassigned'}
                  onValueChange={(v) => updateField('assigned_to', v === 'unassigned' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
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
              </div>
            </div>

            <div className="space-y-2">
              <Label>How did they hear about us?</Label>
              <Select
                value={formData.how_heard || ''}
                onValueChange={(v) => updateField('how_heard', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {HOW_HEARD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 1: // Education
        return (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Education details help AI recommend the best universities and programs for this lead.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Current Education Level
              </Label>
              <Select
                value={formData.education_level || ''}
                onValueChange={(v) => updateField('education_level', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select education level" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  English Level
                </Label>
                <Input
                  value={formData.english_level || ''}
                  onChange={(e) => updateField('english_level', e.target.value)}
                  placeholder="e.g., IELTS 6.5, Intermediate"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Korean Level
                </Label>
                <Input
                  value={formData.korean_level || ''}
                  onChange={(e) => updateField('korean_level', e.target.value)}
                  placeholder="e.g., TOPIK 3, Beginner"
                  maxLength={50}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                These fields are optional but help improve lead quality scoring.
              </p>
            </div>
          </div>
        );

      case 2: // Preferences
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Preferred University
                </Label>
                <Input
                  value={formData.preferred_university || ''}
                  onChange={(e) => updateField('preferred_university', e.target.value)}
                  placeholder="e.g., Seoul National University"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Program</Label>
                <Input
                  value={formData.preferred_program || ''}
                  onChange={(e) => updateField('preferred_program', e.target.value)}
                  placeholder="e.g., Computer Science, MBA"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Budget Range
                </Label>
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
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Preferred Start Date
                </Label>
                <Select
                  value={formData.preferred_start_date || ''}
                  onValueChange={(v) => updateField('preferred_start_date', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {START_DATES.map((date) => (
                      <SelectItem key={date.value} value={date.value}>
                        {date.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional information about this lead..."
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        );

      case 3: // First Contact
        return (
          <div className="space-y-4">
            <div className="bg-primary/5 rounded-lg p-4 mb-4 border border-primary/20">
              <p className="text-sm font-medium">Optional: Log your first contact with this lead</p>
              <p className="text-xs text-muted-foreground mt-1">
                This helps track conversion and AI will analyze the response pattern.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Contact Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {CONTACT_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    type="button"
                    variant={formData.initialContactType === type.value ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => updateField('initialContactType', type.value)}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-xs">{type.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Outcome</Label>
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map((outcome) => (
                  <Badge
                    key={outcome.value}
                    variant="outline"
                    className={cn(
                      'cursor-pointer transition-all px-3 py-2',
                      formData.initialOutcome === outcome.value
                        ? outcome.color + ' ring-2 ring-offset-2'
                        : 'hover:bg-accent'
                    )}
                    onClick={() => {
                      updateField('initialOutcome', outcome.value);
                      // Clear next follow-up if not interested
                      if (outcome.value === 'not_interested') {
                        updateField('nextFollowUp', undefined);
                      } else if (!formData.nextFollowUp) {
                        // Set default follow-up if none set
                        updateField('nextFollowUp', addDays(new Date(), 1));
                      }
                    }}
                  >
                    {outcome.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Next Follow-up Date - Only show if not "not_interested" */}
            {formData.initialOutcome !== 'not_interested' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Next Follow-up Date *
                </Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Button
                    type="button"
                    variant={formData.nextFollowUp && format(formData.nextFollowUp, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateField('nextFollowUp', addDays(new Date(), 1))}
                  >
                    Tomorrow
                  </Button>
                  <Button
                    type="button"
                    variant={formData.nextFollowUp && format(formData.nextFollowUp, 'yyyy-MM-dd') === format(addDays(new Date(), 3), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateField('nextFollowUp', addDays(new Date(), 3))}
                  >
                    In 3 days
                  </Button>
                  <Button
                    type="button"
                    variant={formData.nextFollowUp && format(formData.nextFollowUp, 'yyyy-MM-dd') === format(addDays(new Date(), 7), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateField('nextFollowUp', addDays(new Date(), 7))}
                  >
                    Next week
                  </Button>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.nextFollowUp && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.nextFollowUp ? format(formData.nextFollowUp, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.nextFollowUp}
                      onSelect={(date) => updateField('nextFollowUp', date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-2">
              <Label>Contact Notes</Label>
              <Textarea
                value={formData.initialNoteContent || ''}
                onChange={(e) => updateField('initialNoteContent', e.target.value)}
                placeholder="What was discussed? Any important details..."
                rows={4}
                maxLength={1000}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Add New Lead
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2 flex-shrink-0">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <button
                  key={step.id}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-1 text-xs transition-colors',
                    isActive && 'text-primary font-medium',
                    isCompleted && 'text-primary/70',
                    !isActive && !isCompleted && 'text-muted-foreground'
                  )}
                  onClick={() => {
                    if (isCompleted || (index === currentStep + 1 && canProceed())) {
                      setCurrentStep(index);
                    }
                  }}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                    isActive && 'border-primary bg-primary/10',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'border-muted-foreground/30'
                  )}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="hidden sm:block">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content - Scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="py-4 pr-4 min-h-[300px]">
            {renderStepContent()}
          </div>
        </ScrollArea>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
            >
              {isSubmitting ? 'Creating...' : 'Create Lead'}
              <Check className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
