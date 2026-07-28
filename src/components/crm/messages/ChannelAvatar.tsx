import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CHANNELS } from './channels';
import type { ChannelId } from './types';

interface ChannelAvatarProps {
  channel: ChannelId;
  initials: string;
  avatarUrl?: string | null;
  /** Avatar diameter in px. The channel dot scales with it. */
  size?: number;
  /** Ring colour behind the channel dot — matches the surface it sits on. */
  ringClassName?: string;
  className?: string;
}

/**
 * Circular avatar with a channel dot in the bottom-right corner.
 *
 * The dot's fill comes from `channels.ts`: Telegram and Instagram carry their
 * own brand colours (the one place literal colour is allowed in this section),
 * the Hanguk App channel uses the royal-blue brand token so it follows the
 * theme.
 */
export function ChannelAvatar({
  channel,
  initials,
  avatarUrl,
  size = 38,
  ringClassName = 'ring-card',
  className,
}: ChannelAvatarProps) {
  const { t } = useTranslation();
  const meta = CHANNELS[channel];
  const Icon = meta.icon;
  const dot = Math.max(15, Math.round(size * 0.45));

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full rounded-full border border-border object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full border border-border bg-primary/10 font-bold text-primary"
          style={{ fontSize: Math.round(size * 0.34) }}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-2',
          ringClassName,
          meta.badgeColor ? null : 'bg-primary',
        )}
        style={{
          width: dot,
          height: dot,
          backgroundColor: meta.badgeColor ?? undefined,
        }}
        title={t(meta.labelKey)}
      >
        <Icon className="text-white" style={{ width: dot * 0.55, height: dot * 0.55 }} strokeWidth={2.4} />
        <span className="sr-only">{t(meta.labelKey)}</span>
      </span>
    </div>
  );
}
