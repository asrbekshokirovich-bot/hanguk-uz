import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { deviceCode, markTestDevice, TEST_REASONS, unmarkTestDevice, useTestDevices, type TestReason } from './api';
import GuestPushBlock from './GuestPushBlock';

/**
 * "Sozlamalar": test devices (S10). Phones that are staff's, demo accounts' or
 * development builds mark themselves; any other is marked here with the code
 * the app shows. Their visits are left out of every analytics page unless a
 * page is asked to include them. Below, push campaigns to guests (B3).
 */
export default function SettingsTab() {
  const { t } = useTranslation();
  const { devices, names, loading, error, reload } = useTestDevices();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState<TestReason>('manual');
  const [busy, setBusy] = useState(false);

  async function mark() {
    setBusy(true);
    const res = await markTestDevice(code, reason);
    setBusy(false);
    switch (res.status) {
      case 'ok':
        toast.success(t('appAnalytics.settings.marked', { code: deviceCode(res.install_id) }));
        setCode('');
        reload();
        break;
      case 'ambiguous':
        toast.error(t('appAnalytics.settings.ambiguous', { count: res.count }));
        break;
      case 'error':
        toast.error(t('appAnalytics.settings.failed'));
        break;
      default:
        toast.error(t(`appAnalytics.settings.${res.status}`));
    }
  }

  async function unmark(installId: string) {
    if (await unmarkTestDevice(installId)) {
      toast.success(t('appAnalytics.settings.unmarked', { code: deviceCode(installId) }));
      reload();
    } else {
      toast.error(t('appAnalytics.settings.failed'));
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card px-4 py-3">
        <h2 className="text-[13px] font-bold text-foreground">{t('appAnalytics.settings.title')}</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{t('appAnalytics.settings.howTo')}</p>
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && code.trim()) void mark();
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX"
            aria-label={t('appAnalytics.settings.code')}
            className="h-9 w-40 font-mono uppercase"
            maxLength={36}
          />
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as TestReason)}
            aria-label={t('appAnalytics.settings.reason')}
            className="h-9 rounded-md border border-input bg-background px-2 text-[13px]"
          >
            {TEST_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`appAnalytics.settings.reasons.${r}`)}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={busy || !code.trim()}>
            {t('appAnalytics.settings.mark')}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card px-4 py-3">
        <h2 className="text-[13px] font-bold text-foreground">
          {t('appAnalytics.settings.list', { count: devices.length })}
        </h2>
        {loading ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">{t('appActivity.loading')}</p>
        ) : error ? (
          <p className="mt-2 text-[12.5px] text-destructive">{t('appActivity.error')}</p>
        ) : devices.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">{t('appAnalytics.settings.none')}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-2 font-semibold">{t('appAnalytics.settings.code')}</th>
                  <th className="pb-1 pr-2 font-semibold">{t('appAnalytics.settings.device')}</th>
                  <th className="pb-1 pr-2 font-semibold">{t('appAnalytics.settings.reason')}</th>
                  <th className="pb-1 pr-2 font-semibold">{t('appAnalytics.settings.markedBy')}</th>
                  <th className="pb-1 pr-2 font-semibold">{t('appAnalytics.quality.lastSeen')}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((d) => (
                  <tr key={d.install_id}>
                    <td className="py-1 pr-2 font-mono">{deviceCode(d.install_id)}</td>
                    <td className="py-1 pr-2">
                      {[d.model, d.os && `${d.os} ${d.os_version ?? ''}`.trim(), d.app_build && `#${d.app_build}`].filter(Boolean).join(' · ') || d.platform || '—'}
                    </td>
                    <td className="py-1 pr-2">{t(`appAnalytics.settings.reasons.${d.test_reason}`, { defaultValue: d.test_reason })}</td>
                    <td className={cn('py-1 pr-2', !d.test_marked_by && 'text-muted-foreground')}>
                      {d.test_marked_by
                        ? names[d.test_marked_by] || t('appAnalytics.settings.someone')
                        : t('appAnalytics.settings.automatic')}
                      {d.test_marked_at && (
                        <span className="text-muted-foreground">
                          {' · '}
                          {new Date(d.test_marked_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-2 text-muted-foreground">
                      {new Date(d.last_seen_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-1 text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => void unmark(d.install_id)}>
                        {t('appAnalytics.settings.unmark')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <GuestPushBlock />
    </div>
  );
}
