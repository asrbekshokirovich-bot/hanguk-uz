import React, { useCallback, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';

interface PushToTalkStaffCardProps {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  isSpeakingToMe?: boolean;
  onPressStart: (userId: string) => void;
  onPressEnd: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function PushToTalkStaffCard({
  userId,
  fullName,
  avatarUrl,
  isOnline,
  isSpeakingToMe = false,
  onPressStart,
  onPressEnd,
  disabled = false,
  compact = false,
}: PushToTalkStaffCardProps) {
  const [isPressing, setIsPressing] = useState(false);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handlePressStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (disabled || !isOnline) return;
      setIsPressing(true);
      onPressStart(userId);
    },
    [disabled, isOnline, onPressStart, userId]
  );

  const handlePressEnd = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      e?.preventDefault();
      if (isPressing) {
        setIsPressing(false);
        onPressEnd();
      }
    },
    [isPressing, onPressEnd]
  );

  // Prevent context menu on long press (mobile)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  if (compact) {
    return (
      <button
        className={cn(
          'relative flex items-center gap-2 p-2 rounded-lg transition-all select-none touch-none',
          'hover:bg-accent/50',
          isPressing && 'ring-2 ring-primary bg-primary/10 scale-[1.02]',
          isSpeakingToMe && 'ring-2 ring-success bg-success/10 animate-pulse',
          disabled && 'opacity-50 cursor-not-allowed',
          !isOnline && 'opacity-50'
        )}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onContextMenu={handleContextMenu}
        disabled={disabled || !isOnline}
      >
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
              isOnline ? 'bg-success' : 'bg-muted-foreground'
            )}
          />
        </div>
        <span className="text-sm font-medium truncate max-w-[100px]">
          {fullName || 'Unknown'}
        </span>
        {isPressing && (
          <Mic className="h-4 w-4 text-primary animate-pulse ml-auto" />
        )}
        {isSpeakingToMe && !isPressing && (
          <Mic className="h-4 w-4 text-success animate-pulse ml-auto" />
        )}
      </button>
    );
  }

  return (
    <button
      className={cn(
        'relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all select-none touch-none',
        'border border-border hover:border-primary/50 hover:bg-accent/50',
        isPressing && 'ring-2 ring-primary border-primary bg-primary/10 shadow-lg scale-[1.02]',
        isSpeakingToMe && 'ring-2 ring-success border-success bg-success/10 animate-pulse',
        disabled && 'opacity-50 cursor-not-allowed',
        !isOnline && 'opacity-50 cursor-not-allowed'
      )}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onContextMenu={handleContextMenu}
      disabled={disabled || !isOnline}
    >
      <div className="relative">
        <Avatar className="h-14 w-14">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background',
            isOnline ? 'bg-success' : 'bg-muted-foreground'
          )}
        />
      </div>
      
      <div className="text-center">
        <p className="font-medium text-sm truncate max-w-[100px]">
          {fullName || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground">
          {isPressing ? (
            <span className="text-primary flex items-center justify-center gap-1">
              <Mic className="h-3 w-3 animate-pulse" />
              Gaplashyapti...
            </span>
          ) : isSpeakingToMe ? (
            <span className="text-success flex items-center justify-center gap-1">
              <Mic className="h-3 w-3 animate-pulse" />
              Sizga gaplashyapti
            </span>
          ) : isOnline ? (
            'Bosib turing'
          ) : (
            'Offline'
          )}
        </p>
      </div>
    </button>
  );
}
