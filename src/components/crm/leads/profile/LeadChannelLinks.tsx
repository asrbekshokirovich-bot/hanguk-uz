import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CHANNEL_STYLE } from './channelStyle';
import type { ChannelOverview, LeadRecord, LinkResult } from './useLeadProfile';

type LinkChannel = 'telegram' | 'instagram';

interface LeadChannelLinksProps {
  lead: LeadRecord;
  overview: ChannelOverview | null;
  onLink: (channel: LinkChannel, value: string, force?: boolean) => Promise<LinkResult>;
}

/**
 * The bot's @username, asked for once per page load.
 *
 * Kept out of the build so replacing the bot does not mean redeploying the
 * CRM — the webhook reads it from Telegram's getMe.
 */
let botUsernamePromise: Promise<string | null> | null = null;
function fetchBotUsername(): Promise<string | null> {
  if (!botUsernamePromise) {
    botUsernamePromise = supabase.functions
      .invoke('telegram-webhook?action=botinfo', { method: 'GET' })
      .then(({ data }) => (data as { username?: string | null } | null)?.username ?? null)
      .catch(() => null);
  }
  return botUsernamePromise;
}

function displayHandle(value: string | null): string {
  if (!value) return '';
  return /^[0-9]+$/.test(value) ? value : `@${value}`;
}

/** One channel's input + state. Shared by the lead and the student card. */
export function ChannelRow({
  channel,
  saved,
  messageCount,
  onLink,
}: {
  channel: LinkChannel;
  saved: string | null;
  messageCount: number;
  onLink: LeadChannelLinksProps['onLink'];
}) {
  const { t } = useTranslation();
  const style = CHANNEL_STYLE[channel];
  const Icon = style.icon;
  const [value, setValue] = useState(displayHandle(saved));
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<LinkResult['candidates']>([]);

  useEffect(() => setValue(displayHandle(saved)), [saved]);

  const submit = async (raw: string, force = false) => {
    setBusy(true);
    setCandidates([]);
    try {
      const res = await onLink(channel, raw, force);
      switch (res.status) {
        case 'linked':
          toast.success(t('leads.profile.links.linked', { count: res.messages ?? 0 }));
          break;
        case 'pending':
          toast.info(t('leads.profile.links.pending'));
          break;
        case 'not_found':
          toast.info(t('leads.profile.links.notFound'));
          break;
        case 'cleared':
          toast.info(t('leads.profile.links.cleared'));
          break;
        case 'ambiguous':
          setCandidates(res.candidates ?? []);
          toast.warning(t('leads.profile.links.ambiguous'));
          break;
        case 'conflict': {
          const other = res.conflicts?.[0];
          const question = other?.is_student
            ? t('leads.profile.links.conflictStudent', { name: other?.name ?? '—' })
            : t('leads.profile.links.conflictLead', { name: other?.name ?? '—' });
          // Moving a chat off another record is a decision, so it is asked,
          // not assumed.
          if (window.confirm(question)) await submit(raw, true);
          break;
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('leads.profile.links.error'));
    } finally {
      setBusy(false);
    }
  };

  const state = messageCount > 0 ? 'linked' : saved ? 'waiting' : 'none';

  return (
    <div className="py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex w-[150px] shrink-0 items-center gap-2">
          <Icon className={cn('h-4 w-4', style.text)} aria-hidden />
          <span className="text-[13px] font-semibold text-foreground">
            {t(`leads.profile.channels.${channel}`)}
          </span>
        </div>

        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(value);
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t(`leads.profile.links.placeholder.${channel}`)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={busy || value.trim() === displayHandle(saved)}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
            {t('leads.profile.links.save')}
          </button>
        </form>

        <span
          className={cn(
            'shrink-0 text-[11.5px] font-semibold sm:w-[190px] sm:text-right',
            state === 'linked' && 'text-emerald-600',
            state === 'waiting' && 'text-amber-600',
            state === 'none' && 'text-muted-foreground',
          )}
        >
          {state === 'linked'
            ? t('leads.profile.links.stateLinked', { count: messageCount })
            : state === 'waiting'
              ? t('leads.profile.links.stateWaiting')
              : t('leads.profile.links.stateNone')}
        </span>
      </div>

      {candidates && candidates.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50/60 p-2.5 sm:ml-[158px]">
          <p className="text-[11.5px] text-foreground">{t('leads.profile.links.pickOne')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {candidates.map((c) => (
              <button
                key={c.identifier}
                type="button"
                disabled={busy}
                onClick={() => void submit(c.identifier)}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground hover:bg-muted disabled:opacity-50"
              >
                {c.name ?? c.identifier} · {t('leads.profile.links.messages', { count: c.messages })}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tie this lead's Telegram and Instagram to the card on purpose.
 *
 * Two ways, because customers differ: the operator types the username the
 * customer gives on a call, or sends the personal link and lets the customer
 * press it. The link is the stronger of the two — it cannot be mistyped, and
 * one press ties every chat that Telegram account has with us, bot and staff
 * accounts alike, since a Telegram user ID is the same everywhere.
 */
export function LeadChannelLinks({ lead, overview, onLink }: LeadChannelLinksProps) {
  const { t } = useTranslation();
  const [bot, setBot] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchBotUsername().then((u) => alive && setBot(u));
    return () => {
      alive = false;
    };
  }, []);

  const link = bot && lead.link_code ? `https://t.me/${bot}?start=L_${lead.link_code}` : null;
  const firstName = (lead.full_name ?? '').trim().split(/\s+/)[0] ?? '';
  const invite = link ? t('leads.profile.links.inviteText', { name: firstName, link }) : '';

  const copy = async (what: 'link' | 'text') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? (link ?? '') : invite);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error(t('leads.profile.links.copyFailed'));
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-bold text-foreground">{t('leads.profile.links.title')}</h2>
        <p className="hidden text-[11.5px] text-muted-foreground md:block">{t('leads.profile.links.hint')}</p>
      </div>

      <div className="mt-1 divide-y divide-border">
        <ChannelRow
          channel="telegram"
          saved={lead.telegram_handle}
          messageCount={overview?.telegram_messages ?? 0}
          onLink={onLink}
        />
        <ChannelRow
          channel="instagram"
          saved={lead.instagram_handle}
          messageCount={overview?.instagram_messages ?? 0}
          onLink={onLink}
        />

        <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
          <div className="w-[150px] shrink-0 text-[13px] font-semibold text-foreground">
            {t('leads.profile.links.personalLink')}
          </div>
          {link ? (
            <>
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 text-[12px] text-foreground">
                {link}
              </code>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => void copy('link')}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted"
                >
                  {copied === 'link' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {t('leads.profile.links.copyLink')}
                </button>
                <button
                  type="button"
                  onClick={() => void copy('text')}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
                >
                  {copied === 'text' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {t('leads.profile.links.copyText')}
                </button>
              </div>
            </>
          ) : (
            <span className="text-[12px] text-muted-foreground">{t('leads.profile.links.linkUnavailable')}</span>
          )}
        </div>
      </div>
    </section>
  );
}
