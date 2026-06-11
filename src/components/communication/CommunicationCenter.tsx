import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  Radio,
  Volume2,
  LogIn,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommunicationCenter() {
  const { t } = useTranslation();
  
  const {
    isConnected,
    isSpeaking,
    isMuted,
    participants,
    startSpeaking,
    stopSpeaking,
    toggleMute,
    connect,
    disconnect,
  } = useVoiceChannel();

  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const effectiveTargetUserId = useMemo(() => {
    if (targetUserId) return targetUserId;
    return participants[0]?.user_id ?? null;
  }, [participants, targetUserId]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handle push-to-talk with spacebar
  useEffect(() => {
    if (!isConnected || isMuted || !effectiveTargetUserId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startSpeaking(effectiveTargetUserId);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        stopSpeaking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [effectiveTargetUserId, isConnected, isMuted, startSpeaking, stopSpeaking]);

  const handleMouseDown = () => {
    if (isMuted || !effectiveTargetUserId) return;
    startSpeaking(effectiveTargetUserId);
  };

  const handleMouseUp = () => {
    stopSpeaking();
  };

  const handleMouseLeave = () => {
    if (isSpeaking) stopSpeaking();
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Radio className={cn(
                "h-5 w-5",
                isConnected && "text-success animate-pulse"
              )} />
              {t('communication.title', 'Voice Channel')}
            </CardTitle>
            
            {isConnected ? (
              <Button variant="destructive" size="sm" onClick={disconnect}>
                <LogOut className="h-4 w-4 mr-2" />
                {t('communication.leave', 'Leave')}
              </Button>
            ) : (
              <Button size="sm" onClick={connect}>
                <LogIn className="h-4 w-4 mr-2" />
                {t('communication.join', 'Join')}
              </Button>
            )}
          </div>
        </CardHeader>
        
        {isConnected && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-4">
              <Badge variant={isMuted ? "destructive" : "secondary"} className="text-sm">
                {isMuted 
                  ? t('communication.muted', 'Muted') 
                  : t('communication.unmuted', 'Unmuted')}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {isMuted 
                  ? t('communication.unmuteTip', 'Click unmute to enable push-to-talk')
                  : t('communication.speakTip', 'Hold SPACE or the mic button to talk')}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        {/* Participants */}
        <Card className="lg:w-80 shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              {t('communication.inChannel', 'In Channel')} ({participants.length + (isConnected ? 1 : 0)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Current user (you) */}
              {isConnected && (
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all",
                  isSpeaking && "bg-success/10 ring-2 ring-success"
                )}>
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>You</AvatarFallback>
                    </Avatar>
                    {isSpeaking && (
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success animate-pulse flex items-center justify-center">
                        <Mic className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{t('communication.you', 'You')}</p>
                    <p className="text-xs text-muted-foreground">
                      {isSpeaking 
                        ? t('communication.speaking', 'Speaking...') 
                        : isMuted 
                          ? t('communication.muted', 'Muted')
                          : t('communication.listening', 'Listening')}
                    </p>
                  </div>
                </div>
              )}

              {/* Other participants */}
              {participants.map((participant) => (
                <button
                  type="button"
                  key={participant.user_id}
                  className={cn(
                    "w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all",
                    participant.isSpeaking && "bg-success/10 ring-2 ring-success",
                    targetUserId === participant.user_id && "bg-accent ring-1 ring-primary"
                  )}
                  onClick={() => setTargetUserId(participant.user_id)}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={participant.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(participant.full_name)}</AvatarFallback>
                    </Avatar>
                    {participant.isSpeaking && (
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success animate-pulse flex items-center justify-center">
                        <Volume2 className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {participant.full_name || t('communication.unknown', 'Unknown')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {targetUserId === participant.user_id
                        ? t('communication.selected', 'Selected')
                        : participant.isSpeaking
                          ? t('communication.speaking', 'Speaking...')
                          : t('communication.listening', 'Listening')}
                    </p>
                  </div>
                </button>
              ))}

              {!isConnected && participants.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {t('communication.joinPrompt', 'Join the channel to start talking')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Push-to-talk area */}
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 flex flex-col items-center justify-center p-8">
            {!isConnected ? (
              <div className="text-center">
                <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Radio className="h-16 w-16 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  {t('communication.title', 'Voice Channel')}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {t('communication.description', 'Join to instantly talk with other staff members')}
                </p>
                <Button size="lg" onClick={connect}>
                  <LogIn className="h-5 w-5 mr-2" />
                  {t('communication.join', 'Join Channel')}
                </Button>
              </div>
            ) : (
              <div className="text-center w-full max-w-md">
                {/* Large push-to-talk button */}
                <button
                  className={cn(
                    "h-48 w-48 rounded-full mx-auto mb-8 flex items-center justify-center transition-all",
                    "focus:outline-none focus:ring-4 focus:ring-primary/30",
                    isMuted || !effectiveTargetUserId
                      ? "bg-muted cursor-not-allowed"
                      : isSpeaking
                        ? "bg-success scale-110 shadow-lg shadow-green-500/30"
                        : "bg-primary hover:bg-primary/90 active:scale-95"
                  )}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleMouseDown}
                  onTouchEnd={handleMouseUp}
                  disabled={isMuted || !effectiveTargetUserId}
                >
                  {isMuted ? (
                    <MicOff className="h-20 w-20 text-muted-foreground" />
                  ) : (
                    <Mic className={cn(
                      "h-20 w-20",
                      isSpeaking ? "text-white" : "text-primary-foreground"
                    )} />
                  )}
                </button>

                <p className="text-lg font-medium mb-2">
                  {isMuted 
                    ? t('communication.micDisabled', 'Microphone Disabled')
                    : isSpeaking 
                      ? t('communication.speaking', 'Speaking...')
                      : t('communication.pushToTalk', 'Push to Talk')}
                </p>
                
                <p className="text-sm text-muted-foreground mb-8">
                  {isMuted 
                    ? t('communication.unmuteTip', 'Click unmute below to enable talking')
                    : t('communication.speakTip', 'Hold the button or press SPACE to talk')}
                </p>

                {/* Mute toggle */}
                <Button
                  variant={isMuted ? "default" : "outline"}
                  size="lg"
                  onClick={toggleMute}
                  className="min-w-32"
                >
                  {isMuted ? (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      {t('communication.unmute', 'Unmute')}
                    </>
                  ) : (
                    <>
                      <MicOff className="h-5 w-5 mr-2" />
                      {t('communication.mute', 'Mute')}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
