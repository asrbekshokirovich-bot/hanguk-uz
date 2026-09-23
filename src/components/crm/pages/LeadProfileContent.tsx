import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { LeadProfileStats } from '@/components/crm/leads/profile/LeadProfileStats';
import { LeadTimeline } from '@/components/crm/leads/profile/LeadTimeline';
import { LeadAiPanel } from '@/components/crm/leads/profile/LeadAiPanel';
import { LeadChannelLinks } from '@/components/crm/leads/profile/LeadChannelLinks';
import {
  useLeadProfile,
  type Suggestion,
  type TimelineEntry,
} from '@/components/crm/leads/profile/useLeadProfile';

interface LeadProfileContentProps {
  leadId: string;
}

function initials(name: string | null) {
  if (!name) return '—';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Finding the message a proposal was drawn from.
 *
 * The model returns the sentence, not the row id, so the link back into the
 * feed is a text match. It is loose on purpose: the quote may be trimmed, may
 * join two messages, or may carry an emoji the model dropped. A near miss that
 * scrolls to roughly the right place beats an exact matcher that usually finds
 * nothing and leaves the operator scrolling by hand.
 */
function findEvidenceEntry(entries: TimelineEntry[], suggestion: Suggestion): string | null {
  const needle = (suggestion.evidence ?? '').replace(/[“”"]/g, '').trim().toLowerCase();
  if (needle.length < 8) return null;

  const candidates = suggestion.evidence_channel
    ? entries.filter((e) => e.channel === suggestion.evidence_channel)
    : entries;

  const exact = candidates.find((e) => e.body.toLowerCase().includes(needle));
  if (exact) return exact.id;

  // Fall back to the longest fragment the quote and a message share.
  const head = needle.slice(0, 40);
  const partial = candidates.find((e) => e.body.toLowerCase().includes(head));
  return partial?.id ?? null;
}

/**
 * CRM → Leads → one customer.
 *
 * Three questions in order: how has this person behaved with us, what was
 * actually said, and what should the card now say. The page is built so the
 * operator can answer the third without trusting it blindly — every proposal
 * links back into the feed it came from.
 */
export default function LeadProfileContent({ leadId }: LeadProfileContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const {
    lead,
    overview,
    timeline,
    suggestions,
    loading,
    error,
    responseHours,
    accept,
    reject,
    analyze,
    analyzing,
    linkChannel,
  } = useLeadProfile(leadId);

  const showEvidence = useCallback(
    (suggestion: Suggestion) => {
      const id = findEvidenceEntry(timeline, suggestion);
      if (!id) return;
      setHighlightId(id);
      document.getElementById(`tl-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [timeline],
  );

  // The ring is a pointer, not a state: leaving it on would make the feed look
  // permanently annotated.
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  if (loading) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-6">
        <p className="text-[14px] font-bold text-foreground">{t('leads.profile.notFound')}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/crm/leads')}
          className="mt-4 rounded-md border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted"
        >
          {t('leads.profile.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 md:space-y-4 md:p-5">
      <header className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/crm/leads')}
          aria-label={t('leads.profile.back')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <Avatar className="h-11 w-11 shrink-0">
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
            {initials(lead.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold text-foreground">
            {lead.full_name ?? t('leads.profile.noName')}
          </h1>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {[lead.phone, lead.city, lead.preferred_program].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className={cn(
              'flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2',
              'text-[12.5px] font-semibold text-primary-foreground hover:opacity-90',
            )}
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {t('leads.profile.call')}
          </a>
        )}
      </header>

      <LeadProfileStats lead={lead} overview={overview} responseHours={responseHours} />

      <LeadChannelLinks lead={lead} overview={overview} onLink={linkChannel} />

      <LeadTimeline entries={timeline} highlightId={highlightId} />

      <LeadAiPanel
        suggestions={suggestions}
        analyzing={analyzing}
        onAccept={accept}
        onReject={reject}
        onAnalyze={analyze}
        onShowEvidence={showEvidence}
      />
    </div>
  );
}
