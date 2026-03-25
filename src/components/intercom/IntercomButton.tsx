import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, PhoneCall, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStaffPresence } from '@/hooks/useStaffPresence';

interface IntercomButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetUserAvatar?: string;
  isCalling?: boolean;
  isActive?: boolean;
  onStartCall?: () => void;
  onEndCall?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export function IntercomButton({
  targetUserId,
  targetUserName,
  isCalling = false,
  isActive = false,
  onStartCall,
  onEndCall,
  disabled = false,
  size = 'sm',
}: IntercomButtonProps) {
  const { t } = useTranslation();
  const { isUserOnline, getUserStatus } = useStaffPresence();

  const userOnline = isUserOnline(targetUserId);
  const userStatus = getUserStatus(targetUserId);

  const handleClick = () => {
    if (isActive) {
      onEndCall?.();
    } else if (!isCalling) {
      onStartCall?.();
    }
  };

  const getStatusColor = () => {
    switch (userStatus) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getButtonContent = () => {
    if (isCalling) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
        </>
      );
    }
    if (isActive) {
      return <PhoneOff className="h-4 w-4" />;
    }
    return <Phone className="h-4 w-4" />;
  };

  const getTooltipText = () => {
    if (isCalling) {
      return t('intercom.calling', { defaultValue: 'Calling...' });
    }
    if (isActive) {
      return t('intercom.endCall', { defaultValue: 'End Call' });
    }
    if (!userOnline) {
      return t('intercom.offline', { defaultValue: 'Offline' });
    }
    return t('intercom.call', { defaultValue: 'Call' }) + ' ' + targetUserName;
  };

  const isButtonDisabled = disabled || (!userOnline && !isActive && !isCalling);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? 'destructive' : isCalling ? 'secondary' : 'outline'}
            size="icon"
            className={cn(
              'relative transition-all',
              size === 'sm' && 'h-8 w-8',
              size === 'default' && 'h-10 w-10',
              size === 'lg' && 'h-12 w-12',
              isCalling && 'animate-pulse',
              isActive && 'ring-2 ring-green-500 ring-offset-2'
            )}
            onClick={handleClick}
            disabled={isButtonDisabled}
          >
            {getButtonContent()}
            {/* Status indicator */}
            {!isCalling && !isActive && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background',
                  getStatusColor()
                )}
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
