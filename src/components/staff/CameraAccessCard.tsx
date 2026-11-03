import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cctv } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// camera_access hali generatsiya qilingan Database turlarida yo'q (migratsiya 20261103120000_cameras.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accessTable = () => (supabase as unknown as { from: (n: string) => any }).from('camera_access');

interface CameraAccessCardProps {
  userId: string;
  roles: readonly string[];
}

/** Xodim profilida: kameralarni ko'rish ruxsati. Faqat owner beradi va oladi (has_camera_access). */
export function CameraAccessCard({ userId, roles }: CameraAccessCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isOwner } = useUserRole();
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const viaRole = roles.includes('owner');

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    setLoading(true);
    (accessTable().select('user_id').eq('user_id', userId).maybeSingle() as Promise<{
      data: { user_id: string } | null;
    }>).then(({ data }) => {
      if (cancelled) return;
      setGranted(Boolean(data));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isOwner]);

  if (!isOwner) return null;

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = next
      ? await accessTable().insert({ user_id: userId })
      : await accessTable().delete().eq('user_id', userId);
    setSaving(false);
    if (error) {
      toast({ title: t('cameraAccess.error'), description: error.message, variant: 'destructive' });
      return;
    }
    setGranted(next);
    toast({ title: next ? t('cameraAccess.granted') : t('cameraAccess.revoked') });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Cctv className="h-4 w-4" />
          {t('cameraAccess.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor={`camera-access-${userId}`} className="font-medium">
              {t('cameraAccess.label')}
            </Label>
            <p className="text-xs text-muted-foreground">{viaRole ? t('cameraAccess.viaRole') : t('cameraAccess.hint')}</p>
          </div>
          <Switch
            id={`camera-access-${userId}`}
            checked={viaRole || granted}
            disabled={viaRole || loading || saving}
            onCheckedChange={(v) => void toggle(v)}
            aria-label={t('cameraAccess.label')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
