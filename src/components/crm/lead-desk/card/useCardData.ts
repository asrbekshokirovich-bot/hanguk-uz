/**
 * The card's side data: contacts, drafts, promises, merge suggestions, the
 * chat identities, the timeline — each its own react-query entry under
 * ['lead-v2', <name>, leadId] — and one realtime channel that keeps them fresh.
 */
import { useEffect, useRef } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchContacts,
  fetchDrafts,
  fetchLeadBrief,
  fetchMergeSuggestions,
  fetchPromises,
  fetchSuggestions,
  fetchTimeline,
} from '../api';
import type { LeadV2, MergeSuggestion } from '../types';
import type { IdentityRow } from './cardLogic';

let channelSeq = 0;

export const TIMELINE_PAGE = 120;
export const TIMELINE_MAX = 1000;

export const useContacts = (leadId: string) =>
  useQuery({ queryKey: ['lead-v2', 'contacts', leadId], queryFn: () => fetchContacts(leadId), enabled: !!leadId });

export const useDrafts = (leadId: string) =>
  useQuery({ queryKey: ['lead-v2', 'drafts', leadId], queryFn: () => fetchDrafts(leadId), enabled: !!leadId });

export const usePromises = (leadId: string) =>
  useQuery({ queryKey: ['lead-v2', 'promises', leadId], queryFn: () => fetchPromises(leadId), enabled: !!leadId });

/** Pending AI field suggestions; the AI writes them in the background, so look again now and then. */
export const useSuggestions = (leadId: string) =>
  useQuery({
    queryKey: ['lead-v2', 'suggestions', leadId],
    queryFn: () => fetchSuggestions(leadId),
    enabled: !!leadId,
    refetchInterval: 60_000,
  });

export interface MergeCandidate {
  suggestion: MergeSuggestion;
  other: Pick<LeadV2, 'id' | 'full_name' | 'phone' | 'source' | 'stage' | 'created_at'> | null;
}

export const useMergeCandidates = (leadId: string) =>
  useQuery({
    queryKey: ['lead-v2', 'merges', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<MergeCandidate[]> => {
      const suggestions = await fetchMergeSuggestions(leadId);
      const ids = [...new Set(suggestions.map((s) => (s.lead_id === leadId ? s.other_id : s.lead_id)))];
      const briefs = await fetchLeadBrief(ids);
      return suggestions.map((s) => {
        const otherId = s.lead_id === leadId ? s.other_id : s.lead_id;
        return { suggestion: s, other: briefs.find((b) => b.id === otherId) ?? null };
      });
    },
  });

/** `lead_timeline_v2`, newest first. Polls every 30 s as well as on realtime. */
export const useTimeline = (leadId: string, limit: number) =>
  useQuery({
    queryKey: ['lead-v2', 'timeline', leadId, limit],
    queryFn: () => fetchTimeline(leadId, limit),
    enabled: !!leadId,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

/** The lead's Telegram / Instagram identities. Unreadable (a role without access) -> []: the card falls back to `source_id`. */
export const useChatIdentities = (leadId: string) =>
  useQuery({
    queryKey: ['lead-v2', 'chat', leadId],
    enabled: !!leadId,
    staleTime: 60_000,
    queryFn: async (): Promise<IdentityRow[]> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as unknown as { from: (t: string) => any };
        const { data, error } = await db
          .from('communication_identities')
          .select('channel, identifier, identifier_label')
          .eq('lead_id', leadId)
          .in('channel', ['telegram', 'instagram']);
        if (error) return [];
        return (data ?? []) as IdentityRow[];
      } catch {
        return [];
      }
    },
  });

/**
 * Realtime for the card: new / updated messages of this lead's conversations
 * (spec: timeline refreshes on `messages` and `lead_events`), plus drafts,
 * promises and comments. Bursts are coalesced into one refetch.
 */
export function useCardRealtime(leadId: string, senderIds: string[]) {
  const qc = useQueryClient();
  const idsRef = useRef<Set<string>>(new Set());
  idsRef.current = new Set(senderIds);

  useEffect(() => {
    if (!leadId) return;
    let timer: number | undefined;
    const refresh = (...keys: string[]) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['lead-v2', 'timeline', leadId] });
        for (const k of keys) void qc.invalidateQueries({ queryKey: ['lead-v2', k, leadId] });
        void qc.invalidateQueries({ queryKey: ['lead-v2', 'lead', leadId] });
      }, 250);
    };
    const byLead = { schema: 'public', filter: `lead_id=eq.${leadId}` } as const;

    const channel = supabase
      .channel(`lead-v2-card-${leadId}-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const row = (payload.new ?? payload.old) as { sender_id?: string } | null;
        if (row?.sender_id && idsRef.current.has(String(row.sender_id))) refresh();
      })
      .on('postgres_changes', { event: '*', table: 'lead_events', ...byLead }, () => refresh('promises', 'merges'))
      .on('postgres_changes', { event: '*', table: 'lead_drafts', ...byLead }, () => refresh('drafts'))
      .on('postgres_changes', { event: '*', table: 'lead_promises', ...byLead }, () => refresh('promises'))
      .on('postgres_changes', { event: '*', table: 'social_comments', ...byLead }, () => refresh())
      // the AI writes field suggestions in the background; a decision elsewhere also lands here
      .on('postgres_changes', { event: '*', table: 'lead_field_suggestions', ...byLead }, () => refresh('suggestions'))
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [leadId, qc]);
}
