import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StaffPresenceStatus {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
}

export function useStaffPresence() {
  const { user } = useAuth();
  const [onlineStaff, setOnlineStaff] = useState<StaffPresenceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Update own presence
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('staff_presence')
        .upsert({
          user_id: user.id,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating presence:', error);
      }
    } catch (err) {
      console.error('Failed to update presence:', err);
    }
  }, [user]);

  // Fetch all staff presence
  const fetchPresence = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('staff_presence')
        .select('*');

      if (error) {
        console.error('Error fetching presence:', error);
        return;
      }

      // Filter out stale presences (more than 60 seconds old for faster updates)
      const now = new Date();
      const activePresences = data?.filter(p => {
        const lastSeen = new Date(p.last_seen);
        const diffMs = now.getTime() - lastSeen.getTime();
        return diffMs < 60000; // 60 seconds (reduced from 120s)
      }).map(p => ({
        userId: p.user_id,
        status: p.status as StaffPresenceStatus['status'],
        lastSeen: p.last_seen,
      })) || [];

      setOnlineStaff(activePresences);
    } catch (err) {
      console.error('Failed to fetch presence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up presence tracking
  useEffect(() => {
    if (!user) return;

    // Set online when mounting
    updatePresence('online');
    fetchPresence();

    // Update presence every 20 seconds (reduced from 30s)
    const heartbeatInterval = setInterval(() => {
      updatePresence('online');
    }, 20000);

    // Refresh presence list every 10 seconds (reduced from 15s)
    const refreshInterval = setInterval(() => {
      fetchPresence();
    }, 10000);

    // Subscribe to realtime updates
    const channelId = `staff-presence-changes-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_presence',
        },
        () => {
          fetchPresence();
        }
      )
      .subscribe();

    // Set offline on page unload
    const handleUnload = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/staff_presence?user_id=eq.${user.id}`;
      const body = JSON.stringify({
        status: 'offline',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Prefer': 'return=minimal'
      };
      
      try {
        fetch(url, {
          method: 'PATCH',
          headers,
          body,
          keepalive: true,
        });
      } catch (e) {
        console.error('Failed to dispatch offline status on unload', e);
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(refreshInterval);
      channel.unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updatePresence('offline');
    };
  }, [user, updatePresence, fetchPresence]);

  // Check if a specific user is online
  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineStaff.some(s => s.userId === userId && s.status === 'online');
  }, [onlineStaff]);

  // Get a user's status
  const getUserStatus = useCallback((userId: string): StaffPresenceStatus['status'] => {
    const presence = onlineStaff.find(s => s.userId === userId);
    return presence?.status || 'offline';
  }, [onlineStaff]);

  return {
    onlineStaff,
    loading,
    updatePresence,
    isUserOnline,
    getUserStatus,
    refetch: fetchPresence,
  };
}
