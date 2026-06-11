import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface StaffPresenceStatus {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
}

type PresenceState = StaffPresenceStatus['status'];

interface StaffPresenceContextType {
  onlineStaff: StaffPresenceStatus[];
  loading: boolean;
  updatePresence: (status: PresenceState) => Promise<void>;
  isUserOnline: (userId: string) => boolean;
  getUserStatus: (userId: string) => StaffPresenceStatus['status'];
  refetch: () => Promise<void>;
}

const StaffPresenceContext = createContext<StaffPresenceContextType | undefined>(undefined);

// All clients must join the SAME channel name to see each other's presence.
const PRESENCE_CHANNEL = 'staff-presence';

// Shape of what we broadcast over the presence channel.
type PresenceMeta = {
  user_id: string;
  status: PresenceState;
  online_at: string;
};

/**
 * Presence is driven by Supabase **Realtime Presence** (a live, push-based signal
 * carried over the WebSocket connection), NOT by polling a heartbeat table.
 *
 * Why: the previous implementation upserted `staff_presence` every 20s and treated
 * a user as online only if their row was < 60s old. Browsers throttle background-tab
 * timers (Chrome heavily throttles hidden tabs to ~1/min), so that heartbeat went
 * stale and active users showed as offline — which made every staff card un-clickable.
 * Realtime Presence stays accurate because it's tied to the live connection, and it
 * auto-drops a participant the moment their tab/connection goes away.
 *
 * The `staff_presence` TABLE is still written to, but only as a best-effort record for
 * server-side / diagnostic reads (e.g. the System Health dashboard). The live UI no
 * longer depends on it, so its staleness can never gate "who can I talk to" again.
 */
export function StaffPresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineStaff, setOnlineStaff] = useState<StaffPresenceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<PresenceState>('online');

  // Best-effort persisted write — diagnostics only, never read by the live UI.
  const writePresenceRow = useCallback(async (status: PresenceState) => {
    if (!user) return;
    try {
      await supabase
        .from('staff_presence')
        .upsert(
          {
            user_id: user.id,
            status,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
    } catch (err) {
      // Non-fatal: the live UI relies on Realtime Presence, not this row.
      console.warn('[StaffPresence] table write failed (non-fatal):', err);
    }
  }, [user]);

  // Recompute the online roster from the channel's live presence state.
  const recomputeFromState = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState<PresenceMeta>();
    const next: StaffPresenceStatus[] = [];
    for (const key of Object.keys(state)) {
      const metas = state[key];
      // A user may be present from multiple tabs; take the most recent meta.
      const meta = metas?.[metas.length - 1];
      if (!meta) continue;
      next.push({
        userId: meta.user_id ?? key,
        status: meta.status ?? 'online',
        lastSeen: meta.online_at ?? new Date().toISOString(),
      });
    }
    setOnlineStaff(next);
  }, []);

  const updatePresence = useCallback(async (status: PresenceState) => {
    statusRef.current = status;
    const channel = channelRef.current;
    if (channel && user) {
      try {
        if (status === 'offline') {
          await channel.untrack();
        } else {
          await channel.track({ user_id: user.id, status, online_at: new Date().toISOString() } satisfies PresenceMeta);
        }
      } catch (err) {
        console.warn('[StaffPresence] presence track failed:', err);
      }
    }
    void writePresenceRow(status);
  }, [user, writePresenceRow]);

  useEffect(() => {
    if (!user) {
      setOnlineStaff([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    statusRef.current = 'online';

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        recomputeFromState();
        setLoading(false);
      })
      .on('presence', { event: 'join' }, () => recomputeFromState())
      .on('presence', { event: 'leave' }, () => recomputeFromState())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            status: statusRef.current,
            online_at: new Date().toISOString(),
          } satisfies PresenceMeta);
          void writePresenceRow('online');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Don't leave the UI stuck on a spinner if the channel can't come up.
          setLoading(false);
        }
      });

    // Keep the diagnostic table row warm so the health dashboard still reports a count.
    const tableHeartbeat = setInterval(() => void writePresenceRow(statusRef.current), 30000);

    // Reflect tab focus as online/away (presence membership itself is unaffected).
    const handleVisibilityChange = () => {
      void updatePresence(document.hidden ? 'away' : 'online');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Best-effort offline marker for the diagnostic row on tab close. Realtime Presence
    // drops the live entry automatically; this just keeps the table row tidy sooner.
    const handleUnload = () => {
      try {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/staff_presence?user_id=eq.${user.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            status: 'offline',
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          keepalive: true,
        });
      } catch {
        // ignore — best effort
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(tableHeartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      void writePresenceRow('offline');
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, recomputeFromState, updatePresence, writePresenceRow]);

  // Online = currently present on the channel with an active ('online') status.
  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineStaff.some((s) => s.userId === userId && s.status === 'online');
  }, [onlineStaff]);

  const getUserStatus = useCallback((userId: string): StaffPresenceStatus['status'] => {
    return onlineStaff.find((s) => s.userId === userId)?.status ?? 'offline';
  }, [onlineStaff]);

  // Presence is push-based, so a manual refetch just re-reads the live state.
  const refetch = useCallback(async () => {
    recomputeFromState();
  }, [recomputeFromState]);

  return (
    <StaffPresenceContext.Provider value={{
      onlineStaff,
      loading,
      updatePresence,
      isUserOnline,
      getUserStatus,
      refetch,
    }}>
      {children}
    </StaffPresenceContext.Provider>
  );
}

export function useStaffPresenceContext() {
  const context = useContext(StaffPresenceContext);
  if (context === undefined) {
    throw new Error('useStaffPresenceContext must be used within a StaffPresenceProvider');
  }
  return context;
}
