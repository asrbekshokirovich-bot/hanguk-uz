import React, { useState, useCallback } from 'react';
import { useVoiceChannelContext } from './VoiceChannelProvider';
import { VoiceChannelStaffPanel } from './VoiceChannelStaffPanel';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Radio, Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function VoiceChannelHeader() {
  const {
    isConnected,
    isSpeaking,
    isMuted,
    participants,
    ensureConnected,
    isAutoConnecting,
    connectionError,
  } = useVoiceChannelContext();

  const [popoverOpen, setPopoverOpen] = useState(false);

  // Connect synchronously when popover opens to preserve user gesture context for microphone
  const handleOpenChange = useCallback(async (open: boolean) => {
    setPopoverOpen(open);
    
    // Call immediately in click handler - no useEffect delay
    // This ensures getUserMedia is called in the same stack as user click (Safari requirement)
    if (open && !isConnected && !isAutoConnecting && !connectionError) {
      try {
        await ensureConnected();
      } catch (error) {
        console.error('[VoiceChannelHeader] Failed to connect:', error);
      }
    }
  }, [isConnected, isAutoConnecting, connectionError, ensureConnected]);

  const onlineCount = participants.length;
  const someoneSpeakingToMe = participants.some((p) => p.isSpeaking);

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative',
            isSpeaking && 'text-primary',
            someoneSpeakingToMe && 'text-success animate-pulse',
            connectionError && 'text-destructive'
          )}
        >
          {connectionError ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : isAutoConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isMuted ? (
            <MicOff className="h-4 w-4 text-destructive" />
          ) : isConnected ? (
            <Radio className="h-4 w-4" />
          ) : (
            <Radio className="h-4 w-4 text-muted-foreground" />
          )}
          
          {isConnected && onlineCount > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'absolute -top-1 -right-1 h-4 min-w-[16px] p-0 flex items-center justify-center text-[10px]',
                someoneSpeakingToMe && 'bg-success text-white'
              )}
            >
              {onlineCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <VoiceChannelStaffPanel compact />
      </PopoverContent>
    </Popover>
  );
}
