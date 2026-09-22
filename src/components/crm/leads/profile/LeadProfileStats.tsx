import { useTranslation } from 'react-i18next';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { CHANNEL_STYLE } from './channelStyle';
import { CHANNELS, type ChannelOverview, type LeadRecord } from './useLeadProfile';

interface LeadProfileStatsProps {
  lead: LeadRecord;
  overview: ChannelOverview | null;
  responseHours: number | null;
}

function Tile({
  label,
  value,
  note,
  tone = 'plain',
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: 'plain' | 'warn';
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-[19px] font-bold leading-tight',
          tone === 'warn' ? 'text-amber-600' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/**
 * The strip an operator reads in a glance before deciding anything.
 *
 * Every tile answers a question they would otherwise have to dig for: how long
 * we have known this person, how stale the thread is, where they talk to us,
 * and — the one that is uncomfortable on purpose — how long we take to reply.
 * That last number is the only place in the CRM where our own behaviour is
 * shown next to the customer's.
 */
export function LeadProfileStats({ lead, overview, responseHours }: LeadProfileStatsProps) {
  const { t } = useTranslation();

  const total =
    (overview?.calls ?? 0) + (overview?.telegram_messages ?? 0) + (overview?.instagram_messages ?? 0);

  const active = CHANNELS.filter((channel) => {
    if (!overview) return false;
    if (channel === 'phone') return overview.calls > 0;
    if (channel === 'telegram') return overview.telegram_messages > 0;
    return overview.instagram_messages > 0;
  });

  const lastContact = overview?.last_contact_at ? new Date(overview.last_contact_at) : null;
  // Two weeks without a word is the point where a warm lead has usually gone
  // elsewhere, so the tile changes colour rather than waiting to be read.
  const stale = lastContact ? Date.now() - lastContact.getTime() > 14 * 86_400_000 : false;

  const replyLabel =
    responseHours === null
      ? '—'
      : responseHours < 1
        ? t('leads.profile.stats.underHour')
        : responseHours < 24
          ? t('leads.profile.stats.hours', { hours: Math.round(responseHours) })
          : t('leads.profile.stats.days', { days: Math.round(responseHours / 24) });

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Tile
        label={t('leads.profile.stats.total')}
        value={total}
        note={t('leads.profile.stats.since', {
          age: formatDistanceToNowStrict(new Date(lead.created_at)),
        })}
      />
      <Tile
        label={t('leads.profile.stats.lastContact')}
        tone={stale ? 'warn' : 'plain'}
        value={lastContact ? formatDistanceToNowStrict(lastContact) : '—'}
        note={lastContact ? lastContact.toLocaleDateString() : t('leads.profile.stats.never')}
      />
      <Tile
        label={t('leads.profile.stats.channels')}
        value={
          <span className="flex items-center gap-1.5">
            <span className="text-[19px]">{active.length}</span>
            <span className="text-[13px] font-semibold text-muted-foreground">/ 3</span>
            <span className="ml-1 flex items-center gap-1">
              {active.map((channel) => {
                const Icon = CHANNEL_STYLE[channel].icon;
                return (
                  <Icon
                    key={channel}
                    className={cn('h-3.5 w-3.5', CHANNEL_STYLE[channel].text)}
                    aria-hidden
                  />
                );
              })}
            </span>
          </span>
        }
        note={
          active.length
            ? active.map((c) => t(`leads.profile.channels.${c}`)).join(', ')
            : t('leads.profile.stats.noChannel')
        }
      />
      <Tile
        label={t('leads.profile.stats.replySpeed')}
        value={replyLabel}
        note={t('leads.profile.stats.replyNote')}
      />
      <Tile
        label={t('leads.profile.stats.stage')}
        value={lead.current_stage ? t('leads.profile.stats.stageSet') : '—'}
        note={lead.current_stage ?? t('leads.profile.stats.stageEmpty')}
      />
      <Tile
        label={t('leads.profile.stats.interest')}
        value={
          lead.interest_level ? t(`leads.profile.interest.${lead.interest_level}`, lead.interest_level) : '—'
        }
        note={lead.preferred_program ?? t('leads.profile.stats.interestEmpty')}
      />
    </div>
  );
}
