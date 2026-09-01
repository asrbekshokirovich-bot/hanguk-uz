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
import { useActiveIntake } from '@/contexts/IntakeContext';
import { User, Phone, Calendar, CreditCard, KeyRound, Copy, CheckCircle, Crown, AlertCircle, GraduationCap, Plus, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ContractUpload } from './ContractUpload';
import { applyDiscount, formatAmount } from '@/hooks/useStudentPlan';

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PhoneEntry {
  phone: string;
  label: string;
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

const PHONE_LABELS = [
  { value: 'own', label: 'Own' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
];

const LANGUAGE_TRACKS = [
  { value: 'korean', label: 'Korean Track (한국어)' },
  { value: 'english', label: 'English Track' },
  { value: 'both', label: 'Both Tracks' },
];

const emptyForm = () => ({
  fullName: '',
  phones: [{ phone: '', label: 'own' }] as PhoneEntry[],
  paymentPlan: '',
  paymentMode: 'one_time',
  discountPercent: '0',
  contractDate: '',
  contractUrl: '',
  isGksApplicant: false,
  languageTrack: 'korean',
});

export function AddStudentDialog({ open, onOpenChange, onSuccess }: AddStudentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeIntakeId } = useActiveIntake();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdMagicCode, setCreatedMagicCode] = useState('');
  const [createdStudentName, setCreatedStudentName] = useState('');
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState(emptyForm());

  const updatePhone = (index: number, patch: Partial<PhoneEntry>) => {
    setFormData((prev) => ({
      ...prev,
      phones: prev.phones.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  const addPhone = () => {
    setFormData((prev) => ({ ...prev, phones: [...prev.phones, { phone: '', label: 'parent' }] }));
  };

  const removePhone = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      phones: prev.phones.length > 1 ? prev.phones.filter((_, i) => i !== index) : prev.phones,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filledPhones = formData.phones
      .map((p) => ({ phone: p.phone.trim(), label: p.label }))
      .filter((p) => p.phone.length > 0);

    // Validation — everything except the GKS flag is mandatory.
    const requireField = (condition: boolean, message: string): boolean => {
      if (!condition) {
        toast({ title: t('common.error'), description: message, variant: 'destructive' });
      }
      return condition;
    };

    if (!requireField(!!formData.fullName.trim(), 'Full name is required')) return;
    if (!requireField(filledPhones.length > 0, 'At least one phone number is required')) return;
    if (!requireField(!!formData.paymentPlan, 'Payment plan is required')) return;
    if (!requireField(!!formData.contractDate, 'Contract date is required')) return;
    if (!requireField(!!formData.contractUrl, 'Contract file is required')) return;

    const discountPercent = Number(formData.discountPercent) || 0;
    if (!requireField(discountPercent >= 0 && discountPercent <= 100, 'Discount must be between 0 and 100')) return;

    setLoading(true);

    try {
      // Call edge function to create student profile (no auth account).
      // Region, birth date and language track are filled automatically later
      // from the student's passport, certificates and conversations.
      const { data: createResponse, error: createError } = await supabase.functions.invoke('create-student', {
        body: {
          fullName: formData.fullName,
          phones: filledPhones.map((p, i) => ({
            phone: p.phone,
            label: p.label || null,
            is_primary: i === 0,
          })),
          paymentPlan: formData.paymentPlan || null,
          paymentMode: formData.paymentMode || 'one_time',
          discountPercent,
          contractDate: formData.contractDate || null,
          contractUrl: formData.contractUrl || null,
          isGksApplicant: formData.isGksApplicant || false,
          languageTrack: formData.languageTrack || 'korean',
          intakeId: activeIntakeId,
        },
      });

      if (createError || createResponse?.error) {
        throw new Error(createResponse?.error || createError?.message || 'Failed to create student');
      }

      // The create-student edge function enrolls the student in the active intake
      // and records the staff bonus server-side (works for any staff role).

      // Show success screen with magic code
      setCreatedMagicCode(createResponse.magicCode);
      setCreatedStudentName(formData.fullName);
      setShowSuccess(true);

      // Reset form
      setFormData(emptyForm());

      onSuccess();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: (error instanceof Error ? error.message : '') || 'Failed to add student',
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
              <DialogTitle className="flex items-center gap-2 text-success">
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
                      <CheckCircle className="h-4 w-4 text-success" />
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

              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-sm text-warning">
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

                {/* Phone numbers — multiple allowed */}
                <div className="space-y-2">
                  <Label>{t('crm.phoneNumbers', 'Phone Numbers')} *</Label>
                  <div className="space-y-2">
                    {formData.phones.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={entry.phone}
                            onChange={(e) => updatePhone(index, { phone: e.target.value })}
                            placeholder="+998 90 123 45 67"
                            className="pl-9"
                            required={index === 0}
                          />
                        </div>
                        <Select
                          value={entry.label}
                          onValueChange={(value) => updatePhone(index, { label: value })}
                        >
                          <SelectTrigger className="w-[110px] flex-shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHONE_LABELS.map((l) => (
                              <SelectItem key={l.value} value={l.value}>
                                {t(`crm.phoneLabels.${l.value}`, l.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removePhone(index)}
                          disabled={formData.phones.length === 1}
                          aria-label="Remove phone number"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addPhone}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('crm.addPhone', 'Add phone number')}
                  </Button>
                </div>

                {/* Language Track Selection */}
                <div className="space-y-2">
                  <Label htmlFor="languageTrack">{t('crm.languageTrack', 'Language Track')} *</Label>
                  <Select
                    value={formData.languageTrack}
                    onValueChange={(value) => setFormData({ ...formData, languageTrack: value })}
                  >
                    <SelectTrigger id="languageTrack">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_TRACKS.map((track) => (
                        <SelectItem key={track.value} value={track.value}>
                          {t(`crm.languageTracks.${track.value}`, track.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-fill notice */}
                <div className="flex items-start gap-2 bg-info/10 border border-info/30 rounded-lg p-3 text-sm text-info">
                  <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {t('crm.autoFillNotice', 'Region and birth date are filled automatically from the student’s passport once uploaded.')}
                  </span>
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
                  <Label>{t('crm.selectPlan')} *</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="discountPercent">Discount (%)</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Sale/discount percentage off the plan price, 0–100. Leave 0 for no discount.</p>
                </div>

                {/* Contract Upload — required */}
                <ContractUpload
                  value={formData.contractUrl}
                  onChange={(url) => setFormData({ ...formData, contractUrl: url })}
                />

                {formData.paymentPlan && (
                  <div className="bg-primary/10 rounded-lg p-3 text-sm">
                    {(() => {
                      const plan = PAYMENT_PLANS.find(p => p.value === formData.paymentPlan);
                      if (!plan) return null;
                      const listPrice = formData.paymentMode === 'installment' ? plan.priceInstallment : plan.priceOneTime;
                      const discountPercent = Math.min(100, Math.max(0, Number(formData.discountPercent) || 0));
                      const finalPrice = applyDiscount(listPrice, discountPercent);
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            {discountPercent > 0 ? (
                              <span>
                                💳 List: {formatAmount(listPrice, plan.currency)} −{discountPercent}% → Total: {formatAmount(finalPrice, plan.currency)}
                                {formData.paymentMode === 'installment' ? ' (2 payments)' : ' (one-time)'}
                              </span>
                            ) : (
                              <span>💳 Total: {formatAmount(finalPrice, plan.currency)}{formData.paymentMode === 'installment' ? ' (2 payments)' : ' (one-time)'}</span>
                            )}
                            {plan.isVIP && <Badge variant="default" className="ml-auto bg-gradient-to-r from-warning to-warning text-white border-0 text-xs">VIP</Badge>}
                          </div>
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
