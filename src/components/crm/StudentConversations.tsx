import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, MessagesSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LeadTimeline } from '@/components/crm/leads/profile/LeadTimeline';
import { ChannelRow } from '@/components/crm/leads/profile/LeadChannelLinks';
import { CHANNEL_STYLE } from '@/components/crm/leads/profile/channelStyle';
import {
  CHANNELS,
  type LinkResult,
  type TimelineEntry,
} from '@/components/crm/leads/profile/useLeadProfile';

/** The new functions are newer than the generated types; see useLeadProfile. */
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

interface AttachResult {
  leads: number;
  identities: number;
  phones: number;
  messages: number;
  calls: number;
  conflicts: number;
}

/**
 * Student card → "Muloqot": everything we said to this person, on every
 * channel, before and after the contract.
 *
 * The history used to stay on the lead when the lead became a student. The
 * button pulls it across — from the lead that was converted into this student
 * and from any lead that shares one of the student's phones — and the two
 * inputs link a Telegram or Instagram account the student uses directly.
 */
export function StudentConversations({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.rpc('student_timeline', {
      p_student_id: studentId,
      p_limit: 500,
    });
    if (error) toast.error(error.message);
    setEntries((data as TimelineEntry[]) ?? []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { phone: 0, telegram: 0, instagram: 0 };
    for (const e of entries) c[e.channel] += 1;
    return c;
  }, [entries]);

  const attach = async () => {
    setAttaching(true);
    try {
      const { data, error } = await db.rpc('attach_student_conversations', {
        p_student_id: studentId,
      });
      if (error) throw error;
      const r = data as AttachResult;
      if (r.messages + r.calls + r.identities === 0) {
        toast.info(t('student.conversations.nothingNew'));
      } else {
        toast.success(
          t('student.conversations.attached', { messages: r.messages, calls: r.calls }),
        );
      }
      if (r.conflicts > 0) {
        toast.warning(t('student.conversations.conflicts', { count: r.conflicts }));
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('student.conversations.error'));
    } finally {
      setAttaching(false);
    }
  };

  const link = useCallback(
    async (channel: 'telegram' | 'instagram', value: string, force = false) => {
      const { data, error } = await db.rpc('link_student_channel', {
        p_student_id: studentId,
        p_channel: channel,
        p_value: value,
        p_force: force,
      });
      if (error) throw error;
      await load();
      return data as LinkResult;
    },
    [studentId, load],
  );

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-bold text-foreground">
              {t('student.conversations.title')}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {t('student.conversations.hint')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {CHANNELS.map((channel) => {
              const Icon = CHANNEL_STYLE[channel].icon;
              return (
                <span
                  key={channel}
                  className={cn(
                    'flex items-center gap-1 text-[12px] font-semibold',
                    counts[channel] > 0 ? CHANNEL_STYLE[channel].text : 'text-muted-foreground',
                  )}
                  title={t(`leads.profile.channels.${channel}`)}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {counts[channel]}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void attach()}
            disabled={attaching}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {attaching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
            )}
            {t('student.conversations.attach')}
          </button>
        </div>

        <div className="mt-2 divide-y divide-border border-t border-border">
          <ChannelRow channel="telegram" saved={null} messageCount={counts.telegram} onLink={link} />
          <ChannelRow channel="instagram" saved={null} messageCount={counts.instagram} onLink={link} />
        </div>
      </section>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <LeadTimeline entries={entries} highlightId={null} />
      )}
    </div>
  );
}
