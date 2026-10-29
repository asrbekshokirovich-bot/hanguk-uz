import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Phone, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDayMonth, initialsOf } from './queueLogic';
import type { LeadContextVM } from './useLeadContext';
import type { ConversationVM } from './types';

const STATUS_TONE: Record<string, string> = {
  new: 'bg-primary/10 text-primary',
  contacted: 'bg-success/10 text-success',
  qualified: 'bg-success/10 text-success',
  converted: 'bg-accent/25 text-foreground',
  lost: 'bg-destructive/10 text-destructive',
};

/** Rail content for a conversation with a lead (or with nobody yet). */
export function LeadContextCard({
  conversation,
  lead,
  loading,
  onLeadCreated,
}: {
  conversation: ConversationVM;
  lead: LeadContextVM | null;
  loading: boolean;
  onLeadCreated: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const createLead = async () => {
    setCreating(true);
    const { error } = await (supabase.rpc as any)('create_lead_from_thread', { p_thread_id: conversation.threadId });
    setCreating(false);
    if (error) {
      toast({ title: t('common.error'), description: t('messages.rail.createLeadFailed'), variant: 'destructive' });
      return;
    }
    toast({ title: t('messages.rail.leadCreated') });
    onLeadCreated();
  };

  if (!conversation.leadId) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-foreground">{t('messages.rail.noLeadTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('messages.rail.noLeadBody')}</p>
        {conversation.kind === 'lead' && (
          <button
            type="button"
            onClick={() => void createLead()}
            disabled={creating}
            className="mt-1 flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[12.5px] font-bold text-accent-foreground transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <UserPlus className="h-3.5 w-3.5" aria-hidden />}
            {t('messages.rail.createLead')}
          </button>
        )}
      </div>
    );
  }

  if (loading || !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto h-14 w-14 rounded-full" />
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  const name = lead.name || conversation.name;
  const statusLabel = lead.status ? t(`leads.statuses.${lead.status}`, lead.status) : null;
  const rows: [string, string | null][] = [
    [t('messages.rail.leadSource'), lead.source],
    [t('messages.rail.leadCity'), lead.city],
    [t('messages.rail.leadProgram'), lead.program ?? lead.education],
    [t('messages.rail.leadOwner'), lead.assigneeName],
    [t('messages.rail.leadFollowUp'), lead.nextFollowUp ? formatDayMonth(new Date(lead.nextFollowUp), i18n.language) : null],
    [t('messages.rail.leadCreatedAt'), lead.createdAt ? formatDayMonth(new Date(lead.createdAt), i18n.language) : null],
  ];

  return (
    <>
      <div className="flex flex-col items-center gap-2 border-b border-border/60 pb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-[19px] font-bold text-primary">
          {initialsOf(name)}
        </div>
        <p className="text-center text-[15px] font-bold text-foreground">{name}</p>
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="text-xs font-medium text-primary hover:underline">
            {lead.phone}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">{t('messages.rail.noPhone')}</p>
        )}
        {statusLabel && (
          <span
            className={cn(
              'rounded-pill px-2.5 py-1 text-[11px] font-semibold',
              STATUS_TONE[lead.status ?? ''] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {t('messages.rail.leadLabel')} · {statusLabel}
          </span>
        )}
        <div className="mt-1 flex w-full gap-2">
          <button
            type="button"
            onClick={() => navigate(`/crm/leads/${lead.id}`)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[12px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t('messages.rail.openLead')}
          </button>
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {t('messages.rail.call')}
            </a>
          )}
        </div>
      </div>

      <section className="border-b border-border/60 py-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[12.5px]">
          {rows
            .filter(([, v]) => !!v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate text-right font-medium text-foreground/80" title={v ?? undefined}>
                  {v}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      {lead.notes && (
        <section className="py-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {t('messages.rail.leadNotes')}
          </h3>
          <p className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-foreground/75">{lead.notes}</p>
        </section>
      )}
    </>
  );
}
