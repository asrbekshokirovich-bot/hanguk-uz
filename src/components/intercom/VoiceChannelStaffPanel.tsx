import React from 'react';
import { useVoiceChannelContext } from './VoiceChannelProvider';
import { PushToTalkStaffCard } from './PushToTalkStaffCard';
import { useStaffManagement, StaffMember } from '@/hooks/useStaffManagement';
import { useStaffPresence } from '@/hooks/useStaffPresence';
import { useAuth } from '@/contexts/AuthContext';
import { Mic, MicOff, Radio, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface VoiceChannelStaffPanelProps {
  compact?: boolean;
}

export function VoiceChannelStaffPanel({ compact = false }: VoiceChannelStaffPanelProps) {
  const { user } = useAuth();
  const { staff, loading: staffLoading } = useStaffManagement();
  const { isUserOnline, loading: presenceLoading } = useStaffPresence();
  const {
    isConnected,
    isSpeaking,
    isMuted,
    participants,
    startSpeaking,
    stopSpeaking,
    toggleMute,
    ensureConnected,
  } = useVoiceChannelContext();

  // Merge staff list with presence-based online status (not voice channel participation)
  const staffWithOnlineStatus = React.useMemo(() => {
    return staff
      .filter((s) => s.user_id !== user?.id)
      .map((s) => ({
        ...s,
        // Use presence hook for actual CRM activity, not voice channel participation
        isOnline: isUserOnline(s.user_id),
        // Voice channel participant info for speaking indicator
        isSpeakingToMe: participants.find((p) => p.user_id === s.user_id)?.isSpeaking || false,
      }))
      .sort((a, b) => {
        // Online first
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return 0;
      });
  }, [staff, participants, user?.id, isUserOnline]);

  const onlineCount = staffWithOnlineStatus.filter((s) => s.isOnline).length;

  const handlePressStart = React.useCallback(
    async (userId: string) => {
      try {
        await ensureConnected();
        startSpeaking(userId);
      } catch (e) {
        console.error("[VoiceChannelStaffPanel] ensureConnected failed", e);
      }
    },
    [ensureConnected, startSpeaking]
  );

  if (staffLoading || presenceLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-sm">
            <Radio className={cn('h-4 w-4', isConnected ? 'text-success' : 'text-muted-foreground')} />
            <span className="font-medium">
              Online ({onlineCount})
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleMute}
            title={isMuted ? 'Mikrofon yoqish' : 'Mikrofon o\'chirish'}
          >
            {isMuted ? (
              <MicOff className="h-4 w-4 text-destructive" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1 px-1">
            {staffWithOnlineStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Xodimlar topilmadi
              </p>
            ) : (
              staffWithOnlineStatus.map((s) => (
                <PushToTalkStaffCard
                  key={s.user_id}
                  userId={s.user_id}
                  fullName={s.full_name}
                  avatarUrl={s.avatar_url}
                  isOnline={s.isOnline}
                  isSpeakingToMe={s.isSpeakingToMe}
                  onPressStart={handlePressStart}
                  onPressEnd={stopSpeaking}
                  disabled={isMuted || isSpeaking}
                  compact
                />
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />
        
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground px-2">
          {isMuted ? (
            <span className="text-destructive flex items-center gap-1">
              <MicOff className="h-3 w-3" />
              Mikrofon o'chirilgan
            </span>
          ) : isSpeaking ? (
            <span className="text-primary flex items-center gap-1">
              <Mic className="h-3 w-3 animate-pulse" />
              Gaplashyapsiz...
            </span>
          ) : (
            <span>Bosib turing va gaplashing</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className={cn('h-5 w-5', isConnected ? 'text-success' : 'text-muted-foreground')} />
          <div>
            <h3 className="font-semibold">Ovozli kanal</h3>
            <p className="text-xs text-muted-foreground">
              {isConnected ? `${onlineCount} xodim online` : 'Ulanmagan'}
            </p>
          </div>
        </div>
        <Button
          variant={isMuted ? 'destructive' : 'outline'}
          size="sm"
          onClick={toggleMute}
          className="gap-1"
        >
          {isMuted ? (
            <>
              <MicOff className="h-4 w-4" />
              O'chirilgan
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Yoniq
            </>
          )}
        </Button>
      </div>

      <Separator />

      <ScrollArea className="max-h-[400px]">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {staffWithOnlineStatus.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
              Boshqa xodimlar topilmadi
            </p>
          ) : (
            staffWithOnlineStatus.map((s) => (
              <PushToTalkStaffCard
                key={s.user_id}
                userId={s.user_id}
                fullName={s.full_name}
                avatarUrl={s.avatar_url}
                isOnline={s.isOnline}
                isSpeakingToMe={s.isSpeakingToMe}
                onPressStart={handlePressStart}
                onPressEnd={stopSpeaking}
                disabled={isMuted || isSpeaking}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="text-center text-sm text-muted-foreground">
        {isMuted ? (
          <span className="text-destructive flex items-center justify-center gap-1">
            <MicOff className="h-4 w-4" />
            Mikrofon o'chirilgan
          </span>
        ) : isSpeaking ? (
          <span className="text-primary flex items-center justify-center gap-1">
            <Mic className="h-4 w-4 animate-pulse" />
            Gaplashyapsiz...
          </span>
        ) : (
          <span>👆 Xodim ustida bosib turing va gaplashing</span>
        )}
      </div>
    </div>
  );
}
