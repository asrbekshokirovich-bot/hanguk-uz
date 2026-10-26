import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUserRole } from '@/hooks/useUserRole';
import { PUSH_LANGS, campaignKey, sendGuestPush, usePushCampaigns, validKey, type PushLang, type PushTexts } from './push';

/**
 * «Mehmonlarga push» (plan v2, stage 5; B3 — guests asked for permission):
 * how many guests said yes, a campaign to them — Uzbek required, the other
 * four languages optional (a phone gets its own language where written) —
 * and every campaign sent with its opens. Owner and admin send; everyone
 * sees the list.
 */
export default function GuestPushBlock() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { data, reload } = usePushCampaigns();
  const [key, setKey] = useState('');
  const [title, setTitle] = useState<PushTexts>({});
  const [body, setBody] = useState<PushTexts>({});
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ phones: number; byLang: Record<string, number> } | null>(null);

  const campaign = campaignKey(key);
  const ready = validKey(campaign) && !!title.uz?.trim() && !!body.uz?.trim();
  const input = { campaign, title, body };

  async function check() {
    setBusy(true);
    const r = await sendGuestPush(input, true);
    setBusy(false);
    if (r.ok) setPreview({ phones: r.phones ?? 0, byLang: r.by_lang ?? {} });
    else toast.error(t(`guestPush.errors.${r.error ?? 'failed'}`, { defaultValue: t('guestPush.errors.failed') }));
  }

  async function send() {
    setBusy(true);
    const r = await sendGuestPush(input, false);
    setBusy(false);
    setPreview(null);
    if (r.ok) {
      toast.success(t('guestPush.sent', { delivered: r.delivered ?? 0, phones: r.phones ?? 0 }));
      setKey('');
      setTitle({});
      setBody({});
      reload();
    } else {
      toast.error(t(`guestPush.errors.${r.error ?? 'failed'}`, { defaultValue: t('guestPush.errors.failed') }));
    }
  }

  const langs: PushLang[] = more ? [...PUSH_LANGS] : ['uz'];

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="text-[13px] font-bold text-foreground">{t('guestPush.title')}</h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
        {t('guestPush.howTo', { count: data?.reachable ?? 0 })}
      </p>

      {isAdmin && (
        <div className="mt-3 grid max-w-2xl gap-2">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('guestPush.keyPlaceholder')}
            aria-label={t('guestPush.key')}
            className="h-8 text-[13px]"
          />
          {langs.map((l) => (
            <div key={l} className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">{l}</span>
              <Input
                value={title[l] ?? ''}
                maxLength={80}
                onChange={(e) => setTitle((x) => ({ ...x, [l]: e.target.value }))}
                placeholder={t('guestPush.titlePlaceholder')}
                aria-label={`${t('guestPush.titleLabel')} (${l})`}
                className="h-8 text-[13px]"
              />
              <Textarea
                value={body[l] ?? ''}
                maxLength={240}
                rows={2}
                onChange={(e) => setBody((x) => ({ ...x, [l]: e.target.value }))}
                placeholder={t('guestPush.bodyPlaceholder')}
                aria-label={`${t('guestPush.bodyLabel')} (${l})`}
                className="text-[13px]"
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMore((m) => !m)}>
              {more ? t('guestPush.lessLangs') : t('guestPush.moreLangs')}
            </Button>
            <Button type="button" size="sm" disabled={!ready || busy} onClick={() => void check()}>
              {t('guestPush.check')}
            </Button>
            {key && !validKey(campaign) && <span className="text-[12px] text-destructive">{t('guestPush.badKey')}</span>}
          </div>
        </div>
      )}

      <AlertDialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('guestPush.confirmTitle', { campaign })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('guestPush.confirmBody', { count: preview?.phones ?? 0 })}{' '}
              {preview && Object.keys(preview.byLang).length > 0 &&
                `(${Object.entries(preview.byLang).map(([l, n]) => `${l} ${n}`).join(' · ')})`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('guestPush.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !preview?.phones} onClick={() => void send()}>
              {t('guestPush.send')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {data && data.campaigns.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-medium">{t('guestPush.cols.campaign')}</th>
                <th className="py-1 pr-2 font-medium">{t('guestPush.cols.text')}</th>
                <th className="py-1 pr-2 text-right font-medium">{t('guestPush.cols.delivered')}</th>
                <th className="py-1 pr-2 text-right font-medium">{t('guestPush.cols.opened')}</th>
                <th className="py-1 font-medium">{t('guestPush.cols.when')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.campaigns.map((c) => (
                <tr key={c.campaign}>
                  <td className="py-1 pr-2 font-mono">{c.campaign}</td>
                  <td className="py-1 pr-2">
                    <b className="font-semibold">{c.title.uz}</b> — {c.body.uz}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {c.delivered} / {c.targeted}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {c.opened}
                    {c.delivered > 0 ? ` (${Math.round((c.opened / c.delivered) * 100)}%)` : ''}
                  </td>
                  <td className="py-1 text-muted-foreground">
                    {new Date(c.sent_at ?? c.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-muted-foreground">{t('guestPush.none')}</p>
      )}
    </section>
  );
}
