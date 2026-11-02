import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { parseList, toggleDay, toggleId, validate, type BotOverview } from '@/lib/botSettings';

// RPC'lar hali generatsiya qilingan Database turlarida yo'q (migratsiya 20261102190000_staff_bot_settings.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

const EDITABLE = [
  'report_enabled', 'report_time', 'reminder_times', 'digest_time',
  'morning_enabled', 'morning_time', 'workdays', 'digest_user_ids', 'group_ai_mode',
] as const;
const AI_MODES = ['off', 'shadow', 'on'] as const;
const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Xodim boti sozlamalari (faqat owner): vaqtlar, ish kunlari, xulosa oluvchilar, holat. */
export function BotSettingsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState<BotOverview | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d, error } = await sb.rpc('bot_settings_overview');
    if (error) {
      console.error('bot_settings_overview:', error.message);
      toast({ title: t('crm.botSettings.loadFailed'), variant: 'destructive' });
    } else {
      const o = d as BotOverview;
      setData(o);
      setForm(Object.fromEntries(EDITABLE.map((k) => [k, o.settings[k] ?? ''])));
    }
    setLoading(false);
  }, [t, toast]);

  useEffect(() => { void load(); }, [load]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const errors = validate(form);
  const dirty = !!data && EDITABLE.some((k) => (data.settings[k] ?? '') !== (form[k] ?? ''));

  const save = async () => {
    if (errors.length) return;
    setSaving(true);
    const changed = Object.fromEntries(EDITABLE.filter((k) => (data?.settings[k] ?? '') !== form[k]).map((k) => [k, form[k]]));
    const { error } = await sb.rpc('bot_settings_save', { p_values: changed });
    setSaving(false);
    if (error) {
      console.error('bot_settings_save:', error.message);
      toast({ title: t('crm.botSettings.saveFailed'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('crm.botSettings.saved') });
    void load();
  };

  if (loading || !data) {
    return <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;
  }

  const s = data.settings;
  const linked = data.staff.filter((p) => p.is_linked).length;
  const digestIds = parseList(form.digest_user_ids);
  const days = parseList(form.workdays).map(Number);
  const err = (k: string) => errors.includes(k) ? 'border-destructive' : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> {t('crm.botSettings.title')}</CardTitle>
        <CardDescription>{t('crm.botSettings.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Holat */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{s.bot_username ? `@${s.bot_username}` : t('crm.botSettings.notSetUp')}</Badge>
          <Badge variant={linked === data.staff.length ? 'default' : 'secondary'}>
            {t('crm.botSettings.linked', { linked, total: data.staff.length })}
          </Badge>
          <Badge variant={s.group_chat_id ? 'default' : 'secondary'}>
            {s.group_chat_id ? t('crm.botSettings.groupOn') : t('crm.botSettings.groupOff')}
          </Badge>
        </div>

        <Separator />

        {/* Kunlik hisobot */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">{t('crm.botSettings.report')}</Label>
            <Switch checked={form.report_enabled === 'true'} onCheckedChange={(v) => set('report_enabled', String(v))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('crm.botSettings.reportTime')}</Label>
              <Input type="time" min="05:00" value={form.report_time} onChange={(e) => set('report_time', e.target.value)} className={err('report_time')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('crm.botSettings.reminders')}</Label>
              <Input value={form.reminder_times} placeholder="17:30,18:00" onChange={(e) => set('reminder_times', e.target.value)} className={err('reminder_times')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('crm.botSettings.digestTime')}</Label>
              <Input type="time" min="05:00" value={form.digest_time} onChange={(e) => set('digest_time', e.target.value)} className={err('digest_time')} />
            </div>
          </div>
        </div>

        {/* Ertalabki ro'yxat */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">{t('crm.botSettings.morning')}</Label>
            <Switch checked={form.morning_enabled === 'true'} onCheckedChange={(v) => set('morning_enabled', String(v))} />
          </div>
          <div className="max-w-[200px] space-y-1">
            <Label className="text-xs text-muted-foreground">{t('crm.botSettings.morningTime')}</Label>
            <Input type="time" min="05:00" value={form.morning_time} onChange={(e) => set('morning_time', e.target.value)} className={err('morning_time')} />
          </div>
        </div>

        {/* Ish kunlari */}
        <div className="space-y-2">
          <Label className="text-base">{t('crm.botSettings.workdays')}</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <Button key={d} type="button" size="sm" variant={days.includes(d) ? 'default' : 'outline'}
                onClick={() => set('workdays', toggleDay(form.workdays, d))}>
                {t(`crm.botSettings.day${d}`)}
              </Button>
            ))}
          </div>
          {errors.includes('workdays') && <p className="text-xs text-destructive">{t('crm.botSettings.needDay')}</p>}
        </div>

        {/* Ofis TV */}
        {s.tv_key && (
          <div className="space-y-1">
            <Label className="text-base">{t('crm.botSettings.tvTitle')}</Label>
            <p className="text-xs text-muted-foreground">{t('crm.botSettings.tvHint')}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded bg-muted px-2 py-1 break-all">{`https://hanguk.uz/tv#k=${s.tv_key}`}</code>
              <Badge variant="outline">{t('crm.botSettings.tvKey', { key: s.tv_key })}</Badge>
            </div>
          </div>
        )}

        {/* Guruh AI tahlili */}
        <div className="space-y-2">
          <Label className="text-base">{t('crm.botSettings.aiTitle')}</Label>
          <p className="text-xs text-muted-foreground">{t('crm.botSettings.aiHint')}</p>
          <div className="flex flex-wrap gap-2">
            {AI_MODES.map((m) => (
              <Button key={m} type="button" size="sm" variant={(form.group_ai_mode || 'shadow') === m ? 'default' : 'outline'}
                onClick={() => set('group_ai_mode', m)}>
                {t(`crm.botSettings.ai_${m}`)}
              </Button>
            ))}
          </div>
        </div>

        {/* Xulosa oluvchilar */}
        <div className="space-y-2">
          <Label className="text-base">{t('crm.botSettings.digestTo')}</Label>
          <p className="text-xs text-muted-foreground">{t('crm.botSettings.digestHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.staff.map((p) => (
              <label key={p.user_id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={digestIds.includes(p.user_id)} onCheckedChange={() => set('digest_user_ids', toggleId(form.digest_user_ids, p.user_id))} />
                <span>{p.full_name}</span>
                {p.is_owner && <Badge variant="outline" className="text-[10px]">owner</Badge>}
                {!p.is_linked && <span className="text-xs text-muted-foreground">({t('crm.botSettings.notLinked')})</span>}
              </label>
            ))}
          </div>
        </div>

        {errors.length > 0 && <p className="text-sm text-destructive">{t('crm.botSettings.invalid')}</p>}
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving || errors.length > 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('crm.botSettings.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
