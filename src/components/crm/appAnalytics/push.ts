import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Push campaigns to guests (plan v2, stage 5; B3): who can be reached, what
 * went, how many opened (analytics_push_campaigns), and sending
 * (send-guest-push — owner and admin).
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export const PUSH_LANGS = ['uz', 'ru', 'en', 'ko', 'vi'] as const;
export type PushLang = (typeof PUSH_LANGS)[number];
export type PushTexts = Partial<Record<PushLang, string>>;

export interface Campaign {
  campaign: string;
  title: PushTexts;
  body: PushTexts;
  targeted: number;
  delivered: number;
  failed: number;
  opened: number;
  created_at: string;
  sent_at: string | null;
}

export interface PushCampaigns {
  reachable: number;
  campaigns: Campaign[];
}

export function usePushCampaigns() {
  const [data, setData] = useState<PushCampaigns | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    db.rpc('analytics_push_campaigns').then(({ data }: { data: PushCampaigns | null }) => {
      if (alive) setData(data ?? { reachable: 0, campaigns: [] });
    });
    return () => {
      alive = false;
    };
  }, [tick]);
  return { data, reload: useCallback(() => setTick((n) => n + 1), []) };
}

export interface SendResult {
  ok?: boolean;
  error?: string;
  tokens?: number;
  phones?: number;
  by_lang?: Record<string, number>;
  delivered?: number;
  failed?: number;
}

/** The campaign key as the server takes it: latin letters, digits, - and _. */
export function campaignKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export function validKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,39}$/.test(key);
}

export async function sendGuestPush(input: { campaign: string; title: PushTexts; body: PushTexts }, dry: boolean): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke('send-guest-push', { body: { ...input, dry } });
  if (error) {
    // the function's own reason ({ error }) when it answered
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') return (await ctx.json()) as SendResult;
    } catch {
      /* fall through */
    }
    return { error: 'failed' };
  }
  return data as SendResult;
}
