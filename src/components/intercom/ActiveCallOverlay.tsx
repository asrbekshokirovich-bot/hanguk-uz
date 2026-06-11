import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveCallOverlayProps {
  isActive: boolean;
  isCalling: boolean;
  isRinging?: boolean;
  userName: string;
  userAvatar?: string;
  startTime: Date | null;
  isMuted: boolean;
  onAcceptCall?: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

export function ActiveCallOverlay({
  isActive,
  isCalling,
  isRinging,
  userName,
  userAvatar,
  startTime,
  isMuted,
  onAcceptCall,
  onEndCall,
  onToggleMute,
}: ActiveCallOverlayProps) {
  const { t } = useTranslation();
  const [minimized, setMinimized] = useState(false);
  const [duration, setDuration] = useState('00:00');

  // Update duration every second
  useEffect(() => {
    if (!startTime) return;

    const updateDuration = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!isActive && !isCalling && !isRinging) return null;

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card
          className={cn(
            'p-3 cursor-pointer hover:shadow-lg transition-all',
            isActive ? 'bg-success/10 border-success' : 'bg-warning/10 border-warning'
          )}
          onClick={() => setMinimized(false)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={userAvatar} />
                <AvatarFallback>{getInitials(userName)}</AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  'absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center',
                  isActive ? 'bg-success' : 'bg-warning'
                )}
              >
                <Phone className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div>
              <p className="font-medium text-sm">{userName}</p>
              <p className="text-xs text-muted-foreground">
                {isRinging ? t('intercom.incoming', { defaultValue: 'Incoming Call...' }) : isActive ? duration : t('intercom.calling', { defaultValue: 'Calling...' })}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="p-4 w-72 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={userAvatar} />
                <AvatarFallback className="text-lg">{getInitials(userName)}</AvatarFallback>
              </Avatar>
              {isActive && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold">{userName}</p>
              <p className={cn(
                'text-sm',
                isActive ? 'text-success' : isRinging ? 'text-info' : 'text-warning'
              )}>
                {isRinging
                  ? t('intercom.incoming', { defaultValue: 'Incoming Call...' })
                  : isActive
                    ? t('intercom.connected', { defaultValue: 'Connected' })
                    : t('intercom.calling', { defaultValue: 'Calling...' })}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMinimized(true)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>

        {isActive && (
          <div className="text-center mb-4">
            <p className="text-2xl font-mono font-semibold">{duration}</p>
            <p className="text-xs text-muted-foreground">
              {t('intercom.duration', { defaultValue: 'Duration' })}
            </p>
          </div>
        )}

        {isCalling && !isActive && (
          <div className="text-center mb-4">
            <div className="flex justify-center gap-1 mb-2">
              <div className="h-2 w-2 rounded-full bg-warning animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-warning animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-warning animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('intercom.waitingForAnswer', { defaultValue: 'Waiting for answer...' })}
            </p>
          </div>
        )}

        {isRinging && !isActive && (
          <div className="text-center mb-4">
            <div className="flex justify-center gap-1 mb-2">
              <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-info animate-pulse delay-150" />
              <div className="h-2 w-2 rounded-full bg-info animate-pulse delay-300" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('intercom.incomingCallDesc', { defaultValue: 'Incoming call from staff' })}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          {isRinging && onAcceptCall && (
            <Button
              variant="default"
              className="h-12 rounded-full px-6 bg-success hover:bg-success"
              onClick={onAcceptCall}
            >
              <Phone className="h-5 w-5 mr-2" />
              {t('intercom.accept', { defaultValue: 'Accept' })}
            </Button>
          )}

          {isActive && (
            <Button
              variant={isMuted ? 'destructive' : 'outline'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={onToggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onEndCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
