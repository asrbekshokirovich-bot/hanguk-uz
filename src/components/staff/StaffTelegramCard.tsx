import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Check, Copy, ExternalLink, Link2, Send, Unlink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  isCodeActive,
  minutesLeft,
  telegramDisplay,
  type LinkCode,
  type StaffTelegramStatus,
} from '@/lib/staffTelegram';

// v_staff_telegram and the two RPCs are not in the generated Database types yet
// (migration 20261031130000_staff_bot_core.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { from: (n: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

interface StaffTelegramCardProps {
  userId: string;
}

/**
 * Xodimning Telegram botga (staff-bot) ulanishi: holat, ulash havolasi, uzish.
 * Owner/admin ko'radi. Havola 15 daqiqa amal qiladi va bir marta ishlaydi;
 * uni xodimga Telegram orqali yuborish kifoya — u ochsa, bot ulab qo'yadi.
 */
export function StaffTelegramCard({ userId }: StaffTelegramCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [status, setStatus] = useState<StaffTelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<LinkCode | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('v_staff_telegram').select('*').eq('user_id', userId).maybeSingle();
    if (error) console.error('v_staff_telegram:', error.message);
    setStatus((data as StaffTelegramStatus | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!isAdmin) return;
    setLink(null);
    setLoading(true);
    load();
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  const createLink = async () => {
    setBusy(true);
    const { data, error } = await sb.rpc('staff_telegram_link_code', { p_user_id: userId });
    setBusy(false);
    if (error) {
      toast({ title: t('crm.staffTelegram.linkFailed'), description: error.message, variant: 'destructive' });
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as LinkCode | undefined;
    if (!row) return;
    setLink(row);
    setCopied(false);
    load();
  };

  const unlink = async () => {
    setBusy(true);
    const { error } = await sb.rpc('staff_telegram_unlink', { p_user_id: userId });
    setBusy(false);
    if (error) {
      toast({ title: t('crm.staffTelegram.unlinkFailed'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('crm.staffTelegram.unlinked') });
    setLink(null);
    load();
  };

  const copy = async () => {
    const text = link?.deep_link ?? link?.code ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t('crm.staffTelegram.copyFailed'), description: text });
    }
  };

  const linked = Boolean(status?.is_linked);
  const pendingActive = isCodeActive(status?.pending_code_expires_at);
  const linkActive = link ? isCodeActive(link.expires_at) : false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Send className="h-4 w-4" />
          {t('crm.staffTelegram.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {linked ? (
              <>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {t('crm.staffTelegram.linked')}
                </Badge>
                <span>{status ? telegramDisplay(status) : ''}</span>
                {status?.linked_at && (
                  <span className="text-muted-foreground">
                    · {format(new Date(status.linked_at), 'dd.MM.yyyy HH:mm')}
                  </span>
                )}
              </>
            ) : (
              <>
                <Badge variant="outline">{t('crm.staffTelegram.notLinked')}</Badge>
                {pendingActive && !link && (
                  <span className="text-muted-foreground">
                    {t('crm.staffTelegram.pending', { minutes: minutesLeft(status?.pending_code_expires_at) })}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t('crm.staffTelegram.hint')}</p>

        {link && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            {link.deep_link ? (
              <code className="block break-all text-xs">{link.deep_link}</code>
            ) : (
              <>
                <code className="block text-sm font-mono">{link.code}</code>
                <p className="text-xs text-amber-700 dark:text-amber-300">{t('crm.staffTelegram.botNotSetUp')}</p>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {linkActive
                ? t('crm.staffTelegram.expiresIn', { minutes: minutesLeft(link.expires_at) })
                : t('crm.staffTelegram.expired')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy} disabled={!linkActive}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? t('crm.staffTelegram.copied') : t('crm.staffTelegram.copy')}
              </Button>
              {link.deep_link && linkActive && (
                <Button size="sm" variant="outline" asChild>
                  <a href={link.deep_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {t('crm.staffTelegram.openInTelegram')}
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={createLink} disabled={busy || loading}>
            <Link2 className="h-4 w-4 mr-1" />
            {linked ? t('crm.staffTelegram.newLink') : t('crm.staffTelegram.createLink')}
          </Button>
          {linked && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy}>
                  <Unlink className="h-4 w-4 mr-1" />
                  {t('crm.staffTelegram.unlink')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('crm.staffTelegram.unlinkTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('crm.staffTelegram.unlinkText')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('crm.staffTelegram.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={unlink}>{t('crm.staffTelegram.unlinkConfirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
