import { useTranslation } from 'react-i18next';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useIntercom } from './IntercomProvider';
import { cn } from '@/lib/utils';

interface CallRecord {
  id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  other_user: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  is_outgoing: boolean;
}

export function CallHistory() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { startCall, callState } = useIntercom();

  const { data: calls, isLoading } = useQuery({
    queryKey: ['call-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch calls where user is caller or callee
      const { data: callsData, error } = await supabase
        .from('intercom_calls')
        .select('*')
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get unique user IDs to fetch profiles
      const otherUserIds = callsData?.map((call) =>
        call.caller_id === user.id ? call.callee_id : call.caller_id
      ) || [];

      const uniqueUserIds = [...new Set(otherUserIds)];

      // Fetch profiles for other users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', uniqueUserIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Combine calls with profile data
      return (callsData || []).map((call) => {
        const isOutgoing = call.caller_id === user.id;
        const otherUserId = isOutgoing ? call.callee_id : call.caller_id;
        return {
          ...call,
          other_user: profileMap.get(otherUserId) || null,
          is_outgoing: isOutgoing,
        };
      }) as CallRecord[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCallIcon = (call: CallRecord) => {
    if (call.status === 'missed') {
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    }
    if (call.is_outgoing) {
      return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
    }
    return <PhoneIncoming className="h-4 w-4 text-green-500" />;
  };

  const getCallDuration = (call: CallRecord) => {
    if (!call.started_at || !call.ended_at) return null;
    const start = new Date(call.started_at).getTime();
    const end = new Date(call.ended_at).getTime();
    const durationMs = end - start;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleCall = (otherUser: CallRecord['other_user']) => {
    if (!otherUser || callState.isActive || callState.isCalling) return;
    startCall({
      userId: otherUser.user_id,
      name: otherUser.full_name || 'Unknown',
      avatar: otherUser.avatar_url || undefined,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('intercom.callHistory', { defaultValue: 'Call History' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t('intercom.callHistory', { defaultValue: 'Call History' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          {!calls || calls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('intercom.noCalls', { defaultValue: 'No calls yet' })}
            </p>
          ) : (
            <div className="space-y-2">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors',
                    call.status === 'missed' && 'bg-destructive/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {getCallIcon(call)}
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={call.other_user?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(call.other_user?.full_name || null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {call.other_user?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                        {getCallDuration(call) && ` • ${getCallDuration(call)}`}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCall(call.other_user)}
                    disabled={callState.isActive || callState.isCalling || !call.other_user}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
