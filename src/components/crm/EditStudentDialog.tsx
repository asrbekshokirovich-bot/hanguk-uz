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
import { User, Phone, MapPin, Calendar, CreditCard, Pencil, Languages, Crown, CheckCircle, AlertCircle, GraduationCap, Plus, Trash2, Sparkles } from 'lucide-react';
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

interface PhoneEntry {
  id?: string;
  phone: string;
  label: string;
  is_primary: boolean;
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
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg'ona viloyati",
  "Jizzax viloyati",
  "Xorazm viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
  "Qoraqalpog'iston",
];

const LANGUAGE_TRACKS = [
  { value: 'english', label: 'English Track' },
  { value: 'korean', label: 'Korean Track' },
  { value: 'both', label: 'Both (English & Korean)' },
];

const PHONE_LABELS = [
  { value: 'own', label: 'Own' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
];

// Small badge shown next to a field that was auto-filled (not staff-entered).
function AutoBadge({ source }: { source: string | null | undefined }) {
  if (!source || source === 'manual') return null;
  const label = source === 'passport' ? 'from passport'
    : source === 'certificate' ? 'from certificate'
    : source === 'conversation' ? 'from conversations'
    : 'auto';
  return (
    <Badge variant="outline" className="gap-1 text-[10px] text-info border-info/40">
      <Sparkles className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function EditStudentDialog({ open, onOpenChange, student, onSuccess }: EditStudentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    city: '',
    paymentPlan: '',
    paymentMode: 'one_time',
    contractDate: '',
    contractUrl: '',
    languageTrack: '',
    notes: '',
    isGksApplicant: false,
  });
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [removedPhoneIds, setRemovedPhoneIds] = useState<string[]>([]);

  useEffect(() => {
    if (!student) return;
    setFormData({
      fullName: student.full_name || '',
      birthDate: student.birth_date || '',
      city: student.city || '',
      paymentPlan: student.payment_plan || '',
      paymentMode: student.payment_mode || 'one_time',
      contractDate: student.contract_date || '',
      contractUrl: student.contract_url || '',
      languageTrack: student.language_track || '',
      notes: student.notes || '',
      isGksApplicant: student.is_gks_applicant || false,
    });
    setRemovedPhoneIds([]);

    // Load the student's phone numbers.
    (async () => {
      const { data } = await supabase
        .from('student_phones')
        .select('id, phone, label, is_primary')
        .eq('student_id', student.user_id)
        .order('is_primary', { ascending: false });
      if (data && data.length > 0) {
        setPhones(data.map((p) => ({ id: p.id, phone: p.phone, label: p.label || 'other', is_primary: p.is_primary })));
      } else {
        // Fall back to the legacy profile columns.
        const fallback: PhoneEntry[] = [];
        if (student.phone) fallback.push({ phone: student.phone, label: 'own', is_primary: true });
        if (student.additional_phone) fallback.push({ phone: student.additional_phone, label: 'other', is_primary: false });
        setPhones(fallback.length > 0 ? fallback : [{ phone: '', label: 'own', is_primary: true }]);
      }
    })();
  }, [student]);

  const updatePhone = (index: number, patch: Partial<PhoneEntry>) => {
    setPhones((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };
  const addPhone = () => setPhones((prev) => [...prev, { phone: '', label: 'parent', is_primary: prev.length === 0 }]);
  const removePhone = (index: number) => {
    setPhones((prev) => {
      const target = prev[index];
      if (target?.id) setRemovedPhoneIds((ids) => [...ids, target.id!]);
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((p) => p.is_primary)) next[0].is_primary = true;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!student || !formData.fullName.trim()) {
      toast({ title: t('common.error'), description: 'Full name is required', variant: 'destructive' });
      return;
    }

    const filledPhones = phones.map((p) => ({ ...p, phone: p.phone.trim() })).filter((p) => p.phone.length > 0);
    if (filledPhones.length === 0) {
      toast({ title: t('common.error'), description: 'At least one phone number is required', variant: 'destructive' });
      return;
    }
    if (!filledPhones.some((p) => p.is_primary)) filledPhones[0].is_primary = true;

    if (!formData.contractDate) {
      toast({ title: t('common.error'), description: 'Contract date is required to calculate payment due dates', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const primary = filledPhones.find((p) => p.is_primary) ?? filledPhones[0];
      const secondary = filledPhones.find((p) => !p.is_primary);

      // Staff edits are authoritative — stamp the manual source so async
      // auto-fill never overwrites these values.
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName.trim(),
          phone: primary?.phone ?? null,
          additional_phone: secondary?.phone ?? null,
          birth_date: formData.birthDate || null,
          birth_date_source: 'manual',
          city: formData.city || null,
          region_source: 'manual',
          payment_plan: formData.paymentPlan || null,
          payment_mode: formData.paymentMode || 'one_time',
          contract_date: formData.contractDate || null,
          contract_url: formData.contractUrl || null,
          language_track: formData.languageTrack || null,
          language_track_source: 'manual',
          notes: formData.notes || null,
          is_gks_applicant: formData.isGksApplicant || false,
        })
        .eq('id', student.id);

      if (error) throw error;

      // Sync phone numbers: delete removed, upsert the rest.
      if (removedPhoneIds.length > 0) {
        await supabase.from('student_phones').delete().in('id', removedPhoneIds);
      }
      for (const p of filledPhones) {
        if (p.id) {
          await supabase.from('student_phones')
            .update({ phone: p.phone, label: p.label || null, is_primary: p.is_primary })
            .eq('id', p.id);
        } else {
          await supabase.from('student_phones')
            .insert({ student_id: student.user_id, phone: p.phone, label: p.label || null, is_primary: p.is_primary });
        }
      }

      toast({ title: t('common.success'), description: 'Student updated successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({ title: t('common.error'), description: (error instanceof Error ? error.message : '') || 'Failed to update student', variant: 'destructive' });
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
                {phones.map((entry, index) => (
                  <div key={entry.id ?? index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={entry.phone}
                        onChange={(e) => updatePhone(index, { phone: e.target.value })}
                        placeholder="+998 90 123 45 67"
                        className="pl-9"
                      />
                    </div>
                    <Select value={entry.label} onValueChange={(value) => updatePhone(index, { label: value })}>
                      <SelectTrigger className="w-[110px] flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_LABELS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{t(`crm.phoneLabels.${l.value}`, l.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant={entry.is_primary ? 'default' : 'ghost'}
                      size="sm"
                      className="flex-shrink-0 text-xs px-2"
                      onClick={() => setPhones((prev) => prev.map((p, i) => ({ ...p, is_primary: i === index })))}
                      title="Set as primary"
                    >
                      {entry.is_primary ? 'Primary' : 'Set'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePhone(index)}
                      disabled={phones.length === 1}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate" className="flex items-center gap-2">
                  {t('crm.birthDate')}
                  <AutoBadge source={student?.birth_date_source} />
                </Label>
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
                <Label htmlFor="city" className="flex items-center gap-2">
                  {t('crm.region', 'Region')}
                  <AutoBadge source={student?.region_source} />
                </Label>
                <Select value={formData.city} onValueChange={(value) => setFormData({ ...formData, city: value })}>
                  <SelectTrigger>
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {UZBEKISTAN_REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Language Track */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {t('crm.languageTrack') || 'Language Track'}
              <AutoBadge source={student?.language_track_source} />
            </h3>

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
