import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plane, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * "Viza tasdiqlandi" and "Jo'nab ketdi" dates for the student's active season
 * (student_intakes.visa_approved_at / departed_at, migration 20261026180000).
 * They feed the investor pipeline's Visa Approved and Departed stages.
 */

type Field = 'visa_approved_at' | 'departed_at';

// The two columns are newer than the generated types.
const db = supabase as unknown as { from: (t: string) => any };

interface Props {
  studentId: string;
  intakeId: string | null;
}

export function VisaDepartureCard({ studentId, intakeId }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<Field, string>>({ visa_approved_at: '', departed_at: '' });
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState<Field | null>(null);

  useEffect(() => {
    if (!intakeId) return;
    let cancelled = false;
    db.from('student_intakes')
      .select('visa_approved_at, departed_at')
      .eq('student_id', studentId)
      .eq('intake_id', intakeId)
      .maybeSingle()
      .then(({ data, error }: { data: Record<Field, string | null> | null; error: unknown }) => {
        if (cancelled) return;
        // Before the migration the columns do not exist: show nothing.
        if (error || !data) {
          setAvailable(false);
          return;
        }
        setAvailable(true);
        setValues({ visa_approved_at: data.visa_approved_at ?? '', departed_at: data.departed_at ?? '' });
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, intakeId]);

  const save = async (field: Field, value: string) => {
    if (!intakeId) return;
    const previous = values[field];
    setValues((v) => ({ ...v, [field]: value }));
    setSaving(field);
    const { error } = await db
      .from('student_intakes')
      .update({ [field]: value || null })
      .eq('student_id', studentId)
      .eq('intake_id', intakeId);
    setSaving(null);
    if (error) {
      setValues((v) => ({ ...v, [field]: previous }));
      toast.error(error.message);
      return;
    }
    toast.success(t('crm.visaDeparture.saved'));
  };

  if (!available) return null;

  const fields: { key: Field; label: string; icon: typeof Plane }[] = [
    { key: 'visa_approved_at', label: t('crm.visaDeparture.visaApproved'), icon: ShieldCheck },
    { key: 'departed_at', label: t('crm.visaDeparture.departed'), icon: Plane },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('crm.visaDeparture.title')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, icon: Icon }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`vd-${key}`} className="flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
              {saving === key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </Label>
            <Input
              id={`vd-${key}`}
              type="date"
              value={values[key]}
              disabled={saving !== null}
              onChange={(e) => void save(key, e.target.value)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground sm:col-span-2">{t('crm.visaDeparture.hint')}</p>
      </CardContent>
    </Card>
  );
}
