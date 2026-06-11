import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { User, Phone, MapPin, Calendar, CreditCard, Pencil, Languages, Crown, CheckCircle, AlertCircle, GraduationCap } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ContractUpload } from './ContractUpload';

type StudentProfile = Tables<'profiles'>;

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile | null;
  onSuccess: () => void;
}

const PAYMENT_PLANS = [
  { 
    value: 'free', 
    label: 'FREE', 
    price: '0 UZS', 
    currency: 'UZS', 
    priceOneTime: 0, 
    priceInstallment: 0,
    isVIP: false,
    features: ['applications', 'map', 'documents', 'aiChat']
  },
  { 
    value: 'standart', 
    label: 'STANDART', 
    price: '5,000,000 UZS', 
    currency: 'UZS', 
    priceOneTime: 5000000, 
    priceInstallment: 6000000,
    isVIP: false,
    features: ['applications', 'map', 'documents', 'aiChat']
  },
  { 
    value: 'premium', 
    label: 'PREMIUM', 
    price: '10,000,000 UZS', 
    currency: 'UZS', 
    priceOneTime: 10000000, 
    priceInstallment: 13000000,
    isVIP: true,
    features: ['applications', 'map', 'documents', 'aiChat', 'interview', 'studyPlan', 'embassy']
  },
  { 
    value: 'no_risk', 
    label: 'NO RISK', 
    price: '$5,000 USD', 
    currency: 'USD', 
    priceOneTime: 5000, 
    priceInstallment: 5500,
    isVIP: true,
    features: ['applications', 'map', 'documents', 'aiChat', 'interview', 'studyPlan', 'embassy', 'flightApartment']
  },
];

const FEATURE_LABELS: Record<string, string> = {
  applications: 'University Applications',
  map: 'University Map',
  documents: 'Document Uploads',
  aiChat: 'AI Chat Assistant',
  interview: 'AI Interview Practice',
  studyPlan: 'Study Plan Trainer',
  embassy: 'Embassy Documents',
  flightApartment: 'Flight & Apartment',
};

const PAYMENT_MODES = [
  { value: 'one_time', label: 'One-time Payment' },
  { value: 'installment', label: '2 Installments' },
];

const OFFICE_LOCATIONS = [
  'Tashkent',
  'Samarkand',
  'Bukhara',
  'Namangan',
  'Andijan',
  'Fergana',
];

const LANGUAGE_TRACKS = [
  { value: 'english', label: 'English Track' },
  { value: 'korean', label: 'Korean Track' },
  { value: 'both', label: 'Both (English & Korean)' },
];

export function EditStudentDialog({ open, onOpenChange, student, onSuccess }: EditStudentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    birthDate: '',
    officeLocation: '',
    paymentPlan: '',
    paymentMode: 'one_time',
    contractDate: '',
    contractUrl: '',
    languageTrack: '',
    notes: '',
    isGksApplicant: false,
  });

  useEffect(() => {
    if (student) {
      setFormData({
        fullName: student.full_name || '',
        phone: student.phone || '',
        birthDate: student.birth_date || '',
        officeLocation: student.office_location || '',
        paymentPlan: student.payment_plan || '',
        paymentMode: student.payment_mode || 'one_time',
        contractDate: student.contract_date || '',
        contractUrl: (student as any).contract_url || '',
        languageTrack: student.language_track || '',
        notes: student.notes || '',
        isGksApplicant: (student as any).is_gks_applicant || false,
      });
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!student || !formData.fullName.trim()) {
      toast({
        title: t('common.error'),
        description: 'Full name is required',
        variant: 'destructive',
      });
      return;
    }

    // Contract date is required
    if (!formData.contractDate) {
      toast({
        title: t('common.error'),
        description: 'Contract date is required to calculate payment due dates',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName.trim(),
          phone: formData.phone || null,
          birth_date: formData.birthDate || null,
          office_location: formData.officeLocation || null,
          payment_plan: formData.paymentPlan || null,
          payment_mode: formData.paymentMode || 'one_time',
          contract_date: formData.contractDate || null,
          contract_url: formData.contractUrl || null,
          language_track: formData.languageTrack || null,
          notes: formData.notes || null,
          is_gks_applicant: formData.isGksApplicant || false,
        })
        .eq('id', student.id);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: 'Student updated successfully',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to update student',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] min-h-0 flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            {t('crm.editStudent')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('crm.personalInfo')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('common.name')} *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter full name"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('common.phone')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">{t('crm.birthDate')}</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="officeLocation">{t('crm.officeLocation')}</Label>
                <Select
                  value={formData.officeLocation}
                  onValueChange={(value) => setFormData({ ...formData, officeLocation: value })}
                >
                  <SelectTrigger>
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Language Track */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('crm.languageTrack') || 'Language Track'}</h3>

            <div className="space-y-2">
              <Label htmlFor="languageTrack">{t('crm.selectTrack') || 'Select Track'}</Label>
              <Select
                value={formData.languageTrack}
                onValueChange={(value) => setFormData({ ...formData, languageTrack: value })}
              >
                <SelectTrigger>
                  <Languages className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select language track" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_TRACKS.map((track) => (
                    <SelectItem key={track.value} value={track.value}>
                      {track.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines the language used in AI interview practice
              </p>
            </div>
          </div>

          {/* GKS Applicant Checkbox */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg bg-gradient-to-r from-info to-primary dark:from-info/20 dark:to-primary/20">
            <Checkbox
              id="isGksApplicant"
              checked={formData.isGksApplicant}
              onCheckedChange={(checked) => setFormData({ ...formData, isGksApplicant: checked === true })}
            />
            <div className="flex-1">
              <Label htmlFor="isGksApplicant" className="flex items-center gap-2 cursor-pointer">
                <GraduationCap className="h-5 w-5 text-info" />
                <span className="font-medium">GKS Applicant</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Global Korea Scholarship (정부초청장학생) program applicant
              </p>
            </div>
          </div>

          {/* Payment Plan & Contract */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('crm.paymentContract')}</h3>

            {/* Plan Selection Cards */}
            <div className="space-y-2">
              <Label>{t('crm.selectPlan')}</Label>
              <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Payment Plan">
                {PAYMENT_PLANS.map((plan) => (
                  <button 
                    key={plan.value}
                    type="button"
                    role="radio"
                    aria-checked={formData.paymentPlan === plan.value}
                    className={cn(
                      "border rounded-lg p-4 cursor-pointer transition-all text-left w-full",
                      formData.paymentPlan === plan.value 
                        ? "border-primary bg-primary/5 ring-2 ring-primary" 
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                    onClick={() => setFormData({ ...formData, paymentPlan: plan.value })}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{plan.label}</span>
                        {plan.isVIP && <Crown className="h-4 w-4 text-warning" />}
                      </div>
                      <span className="text-sm text-muted-foreground">{plan.price}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-3">
                      {plan.features.map(feature => (
                        <div key={feature} className="text-xs flex items-center gap-1 text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-success flex-shrink-0" />
                          <span>{FEATURE_LABELS[feature]}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMode">Payment Mode</Label>
                <Select
                  value={formData.paymentMode}
                  onValueChange={(value) => setFormData({ ...formData, paymentMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractDate" className="flex items-center gap-1">
                  {t('crm.contractDate')} *
                  <span className="text-xs text-muted-foreground">(required)</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contractDate"
                    type="date"
                    value={formData.contractDate}
                    onChange={(e) => setFormData({ ...formData, contractDate: e.target.value })}
                    className={cn("pl-9", !formData.contractDate && "border-warning")}
                    required
                  />
                </div>
                {!formData.contractDate && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Due dates are calculated from contract date
                  </p>
                )}
              </div>
            </div>

            {/* Contract Upload */}
            <ContractUpload
              value={formData.contractUrl}
              onChange={(url) => setFormData({ ...formData, contractUrl: url })}
              studentId={student?.user_id}
            />

            {formData.paymentPlan && (
              <div className="bg-primary/10 rounded-lg p-3 text-sm">
                {(() => {
                  const plan = PAYMENT_PLANS.find(p => p.value === formData.paymentPlan);
                  if (!plan) return null;
                  const price = formData.paymentMode === 'installment' ? plan.priceInstallment : plan.priceOneTime;
                  const formatted = plan.currency === 'UZS' 
                    ? `${price.toLocaleString()} UZS` 
                    : `$${price.toLocaleString()} USD`;
                  return (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>💳 Total: {formatted}{formData.paymentMode === 'installment' ? ' (2 payments)' : ' (one-time)'}</span>
                      {plan.isVIP && <Badge variant="default" className="ml-auto bg-gradient-to-r from-warning to-warning text-white border-0 text-xs">VIP</Badge>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('common.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add notes about this student..."
              rows={3}
            />
          </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
