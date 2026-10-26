import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { hasApplicationFeeRole } from '@/lib/applicationFeeAccess';

// application_fee_access is not in the generated Database types yet
// (migration 20261026120000_application_fee_access.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accessTable = () => (supabase as unknown as { from: (n: string) => any }).from('application_fee_access');

interface ApplicationFeeAccessCardProps {
  userId: string;
  roles: readonly string[];
}

/**
 * Owner/admin switch on the staff page: opens the "Application fee" section to
 * one person without giving them the document_handler role (which would also
 * open Documents, University selection and the application pages).
 */
export function ApplicationFeeAccessCard({ userId, roles }: ApplicationFeeAccessCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const viaRole = hasApplicationFeeRole(roles);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    (accessTable()
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle() as Promise<{ data: { user_id: string } | null }>).then(({ data }) => {
      if (cancelled) return;
      setGranted(Boolean(data));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin]);

  if (!isAdmin) return null;

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = next
      ? await accessTable().insert({ user_id: userId })
      : await accessTable().delete().eq('user_id', userId);
    setSaving(false);
    if (error) {
      toast({ title: t('applicationFeeAccess.error'), description: error.message, variant: 'destructive' });
      return;
    }
    setGranted(next);
    toast({ title: next ? t('applicationFeeAccess.granted') : t('applicationFeeAccess.revoked') });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          {t('applicationFeeAccess.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor={`app-fee-access-${userId}`} className="font-medium">
              {t('applicationFeeAccess.label')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {viaRole ? t('applicationFeeAccess.viaRole') : t('applicationFeeAccess.hint')}
            </p>
          </div>
          <Switch
            id={`app-fee-access-${userId}`}
            checked={viaRole || granted}
            disabled={viaRole || loading || saving}
            onCheckedChange={(v) => void toggle(v)}
            aria-label={t('applicationFeeAccess.label')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
