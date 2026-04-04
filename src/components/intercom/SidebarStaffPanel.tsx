import React, { useEffect, useMemo } from 'react';
import { Mic, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStaffManagement } from '@/hooks/useStaffManagement';
import { useStaffPresence } from '@/hooks/useStaffPresence';
import { useTranslation } from 'react-i18next';
import { useVoiceChannelContext } from './VoiceChannelProvider';
import { useAuth } from '@/contexts/AuthContext';
import { PushToTalkStaffCard } from './PushToTalkStaffCard';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

export function SidebarStaffPanel() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { t } = useTranslation();
  const { staff, loading } = useStaffManagement();
  const { isUserOnline, getUserStatus } = useStaffPresence();
  const { user } = useAuth();
  const {
    participants,
    isConnected,
    ensureConnected,
    isAutoConnecting,
    startSpeaking,
    stopSpeaking,
    connectionError,
    isContextReady,
  } = useVoiceChannelContext();

  // NOTE: Removed auto-connect from useEffect to ensure microphone access
  // happens during a user gesture (clicking on a staff member to talk)

  // Combine staff with online status
  const staffWithStatus = useMemo(() => {
    return staff
      .filter((s) => s.user_id !== user?.id) // Exclude self
      .map((s) => {
        const participant = participants.find((p) => p.user_id === s.user_id);
        // Use staff_presence for online status, voice channel for speaking status
        const presenceOnline = isUserOnline(s.user_id);
        return {
          ...s,
          isOnline: presenceOnline,
          isInVoiceChannel: !!participant,
          isSpeakingToMe: participant?.isSpeaking || false,
        };
      })
      .sort((a, b) => {
        // Online first
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
  }, [staff, participants, user?.id, isUserOnline]);

  const onlineCount = staffWithStatus.filter((s) => s.isOnline).length;

  const handlePressStart = async (userId: string) => {
    // Prevent action if context not ready (during HMR)
    if (!isContextReady) {
      console.warn("[SidebarStaffPanel] Context not ready, ignoring press");
      toast.error("Biroz kuting, tizim yuklanmoqda...", { duration: 2000 });
      return;
    }
    
    // ensureConnected is called here during a user gesture (mouse/touch down)
    // This preserves the gesture context for getUserMedia
    try {
      await ensureConnected();
      startSpeaking(userId);
    } catch (e) {
      console.error("[SidebarStaffPanel] ensureConnected failed", e);
      // Don't call startSpeaking if ensureConnected failed
      // ensureConnected already toasts a user-facing error
    }
  };

  const handlePressEnd = () => {
    stopSpeaking();
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className={cn('p-3 border-t', collapsed && 'p-2')}>
        <div className="flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // Collapsed view - vertical stack of avatars
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <div className="border-t py-2 px-1 flex flex-col items-center gap-1">
          {/* Voice status indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  connectionError ? 'text-destructive' : isConnected ? 'text-green-500' : 'text-muted-foreground',
                  isAutoConnecting && 'animate-pulse',
                  'cursor-pointer hover:bg-accent/50'
                )}
                onClick={() => {
                  if (!isContextReady) return;
                  if (!isConnected && !isAutoConnecting) {
                    ensureConnected().catch(() => {});
                  }
                }}
              >
                {connectionError ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {connectionError
                ? connectionError
                : isConnected
                ? `${t('navigation.voiceChat')} (${onlineCount} online)`
                : isAutoConnecting
                ? 'Ulanmoqda...'
                : 'Bosib gaplashing (ulanish uchun bosing)'}
            </TooltipContent>
          </Tooltip>

          {/* Staff avatars - only show first 4 in collapsed mode */}
          {staffWithStatus.slice(0, 4).map((member) => (
            <Tooltip key={member.user_id}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'relative p-0.5 rounded-full transition-all',
                    member.isOnline && 'hover:ring-2 hover:ring-primary/50',
                    member.isSpeakingToMe && 'ring-2 ring-green-500 animate-pulse',
                    !member.isOnline && 'opacity-50 cursor-not-allowed'
                  )}
                  onMouseDown={() => member.isOnline && handlePressStart(member.user_id)}
                  onMouseUp={() => member.isOnline && handlePressEnd()}
                  onMouseLeave={() => member.isOnline && handlePressEnd()}
                  onTouchStart={() => member.isOnline && handlePressStart(member.user_id)}
                  onTouchEnd={() => member.isOnline && handlePressEnd()}
                  disabled={!member.isOnline}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background',
                      member.isOnline ? 'bg-green-500' : 'bg-muted-foreground'
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {member.full_name || 'Unknown'} ({member.isOnline ? 'Online' : 'Offline'})
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Show count if more than 4 */}
          {staffWithStatus.length > 4 && (
            <span className="text-[10px] text-muted-foreground">
              +{staffWithStatus.length - 4}
            </span>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Expanded view
  return (
    <div className="border-t p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connectionError ? (
            <AlertCircle
              className="h-4 w-4 text-destructive cursor-pointer"
              onClick={() => {
                if (!isContextReady) return;
                ensureConnected().catch(() => {});
              }}
            />
          ) : (
            <Mic
              className={cn(
                'h-4 w-4 cursor-pointer',
                isConnected ? 'text-green-500' : 'text-muted-foreground',
                isAutoConnecting && 'animate-pulse'
              )}
              onClick={() => {
                if (!isContextReady) return;
                if (!isConnected && !isAutoConnecting) {
                  ensureConnected().catch(() => {});
                }
              }}
            />
          )}
          <span className="text-sm font-medium">
            {connectionError
              ? 'Xatolik'
              : isConnected
              ? `Online (${onlineCount})`
              : isAutoConnecting
              ? 'Ulanmoqda...'
              : t('navigation.voiceChat')}
          </span>
        </div>
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            connectionError ? 'bg-destructive' : isConnected ? 'bg-green-500' : 'bg-muted-foreground'
          )}
        />
      </div>

      {/* Staff list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-none">
        {staffWithStatus.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Boshqa xodimlar yo'q
          </p>
        ) : (
          staffWithStatus.map((member) => (
            <PushToTalkStaffCard
              key={member.user_id}
              userId={member.user_id}
              fullName={member.full_name}
              avatarUrl={member.avatar_url}
              isOnline={member.isOnline}
              isSpeakingToMe={member.isSpeakingToMe}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              compact
            />
          ))
        )}
      </div>

      {/* Helper text */}
      <p className="text-[10px] text-muted-foreground text-center">
        {connectionError
          ? 'Qayta ulanish uchun mikrofon ikonkasini bosing'
          : isConnected
          ? 'Bosib turing va gaplashing'
          : 'Xodim ustini bosib gaplashni boshlang'}
      </p>
    </div>
  );
}
