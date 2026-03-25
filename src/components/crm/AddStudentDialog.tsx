import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStaffBonuses } from '@/hooks/useStaffBonuses';
import { User, Phone, MapPin, Calendar, CreditCard, KeyRound, Copy, CheckCircle, Languages, Crown, AlertCircle, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ContractUpload } from './ContractUpload';

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const UZBEKISTAN_REGIONS = [
  { value: 'tashkent_city', label: "Toshkent shahri" },
  { value: 'tashkent', label: "Toshkent viloyati" },
  { value: 'andijan', label: "Andijon viloyati" },
  { value: 'bukhara', label: "Buxoro viloyati" },
  { value: 'fergana', label: "Farg'ona viloyati" },
  { value: 'jizzakh', label: "Jizzax viloyati" },
  { value: 'khorezm', label: "Xorazm viloyati" },
  { value: 'namangan', label: "Namangan viloyati" },
  { value: 'navoiy', label: "Navoiy viloyati" },
  { value: 'kashkadarya', label: "Qashqadaryo viloyati" },
  { value: 'samarkand', label: "Samarqand viloyati" },
  { value: 'sirdarya', label: "Sirdaryo viloyati" },
  { value: 'surkhandarya', label: "Surxondaryo viloyati" },
  { value: 'karakalpakstan', label: "Qoraqalpog'iston" },
];

const LANGUAGE_TRACKS = [
  { value: 'korean', label: 'Korean Track (한국어)', description: 'Interview and study in Korean' },
  { value: 'english', label: 'English Track', description: 'Interview and study in English' },
  { value: 'both', label: 'Both Tracks', description: 'Student can choose language during interview' },
];

export function AddStudentDialog({ open, onOpenChange, onSuccess }: AddStudentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createBonusForStudent } = useStaffBonuses();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdMagicCode, setCreatedMagicCode] = useState('');
  const [createdStudentName, setCreatedStudentName] = useState('');
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    birthDate: '',
    city: '', // Region/city for analytics
    paymentPlan: '',
    paymentMode: 'one_time',
    contractDate: '',
    contractUrl: '',
    languageTrack: 'korean',
    isGksApplicant: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
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
      // Call edge function to create student profile (no auth account)
      const { data: createResponse, error: createError } = await supabase.functions.invoke('create-student', {
        body: {
          fullName: formData.fullName,
          phone: formData.phone || null,
          birthDate: formData.birthDate || null,
          city: formData.city || null,
          paymentPlan: formData.paymentPlan || null,
          paymentMode: formData.paymentMode || 'one_time',
          contractDate: formData.contractDate || null,
          contractUrl: formData.contractUrl || null,
          languageTrack: formData.languageTrack || 'korean',
          isGksApplicant: formData.isGksApplicant || false,
        },
      });

      if (createError || createResponse?.error) {
        throw new Error(createResponse?.error || createError?.message || 'Failed to create student');
      }

      // Create bonus if student has a payment plan
      if (formData.paymentPlan && createResponse.profileId) {
        await createBonusForStudent(createResponse.profileId, formData.paymentPlan);
      }

      // Show success screen with magic code
      setCreatedMagicCode(createResponse.magicCode);
      setCreatedStudentName(formData.fullName);
      setShowSuccess(true);

      // Reset form
      setFormData({
        fullName: '',
        phone: '',
        birthDate: '',
        city: '',
        paymentPlan: '',
        paymentMode: 'one_time',
        contractDate: '',
        contractUrl: '',
        languageTrack: 'korean',
        isGksApplicant: false,
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to add student',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(createdMagicCode);
      setCopied(true);
      toast({ title: 'Code copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    setCreatedMagicCode('');
    setCreatedStudentName('');
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {showSuccess ? (
          // Success screen with magic code
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Student Created Successfully
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">
                  Student <span className="font-semibold text-foreground">{createdStudentName}</span> has been created.
                </p>
                <p className="text-sm text-muted-foreground">
                  Share this access code with the student for login:
                </p>
              </div>

              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Access Code</span>
                </div>
                <div className="text-3xl font-mono font-bold tracking-widest text-primary mb-4">
                  {createdMagicCode}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopyCode}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ This code will only be shown once. Make sure to save or share it with the student before closing this dialog.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Create student form
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('crm.addStudent')}
              </DialogTitle>
            </DialogHeader>

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
                    <Label htmlFor="city">{t('crm.region', 'Region')}</Label>
                    <Select
                      value={formData.city}
                      onValueChange={(value) => setFormData({ ...formData, city: value })}
                    >
                      <SelectTrigger>
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {UZBEKISTAN_REGIONS.map((region) => (
                          <SelectItem key={region.value} value={region.label}>
                            {region.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
              </div>
            </div>

              {/* GKS Applicant Checkbox */}
              <div className="flex items-center space-x-3 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <Checkbox
                  id="isGksApplicant"
                  checked={formData.isGksApplicant}
                  onCheckedChange={(checked) => setFormData({ ...formData, isGksApplicant: checked === true })}
                />
                <div className="flex-1">
                  <Label htmlFor="isGksApplicant" className="flex items-center gap-2 cursor-pointer">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">GKS Applicant</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Global Korea Scholarship (정부초청장학생) program applicant
                  </p>
                </div>
              </div>

              {/* Language Track Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  {t('crm.languageTrack', 'Language Track')}
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="languageTrack">{t('crm.selectTrack', 'Interview & Study Language')}</Label>
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
                          <div className="flex flex-col">
                            <span>{track.label}</span>
                            <span className="text-xs text-muted-foreground">{track.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.languageTrack === 'both' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    🌐 Student can switch between Korean and English during interview practice
                  </div>
                )}
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
                            {plan.isVIP && <Crown className="h-4 w-4 text-yellow-500" />}
                          </div>
                          <span className="text-sm text-muted-foreground">{plan.price}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-3">
                          {plan.features.map(feature => (
                            <div key={feature} className="text-xs flex items-center gap-1 text-muted-foreground">
                              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                              <span>{t(`student.planFeatures.${feature}`, FEATURE_LABELS[feature])}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className={cn("pl-9", !formData.contractDate && "border-amber-500")}
                        required
                      />
                    </div>
                    {!formData.contractDate && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Due dates are calculated from contract date
                      </p>
                    )}
                  </div>

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
                </div>

                {/* Contract Upload */}
                <ContractUpload
                  value={formData.contractUrl}
                  onChange={(url) => setFormData({ ...formData, contractUrl: url })}
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
                          {plan.isVIP && <Badge variant="default" className="ml-auto bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-xs">VIP</Badge>}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? t('common.loading') : t('crm.addStudent')}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
