import { Mic, MicOff, Radio, Circle, LogIn, LogOut, Volume2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVoiceChannelContext } from '@/components/intercom/VoiceChannelProvider';

export function VoiceChannelPanel() {
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
    targetUserId,
    setTargetUserId,
    ensureConnected,
  } = useVoiceChannelContext();

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUserClick = async (userId: string) => {
    if (isMuted) return;
    await ensureConnected();

    // Toggle talk on click: click user to start, click again to stop.
    if (isSpeaking && targetUserId === userId) {
      stopSpeaking();
      return;
    }

    setTargetUserId(userId);
    startSpeaking(userId);
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radio className={cn('h-4 w-4', isConnected && 'text-green-500 animate-pulse')} />
          Ovozli kanal
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {isConnected ? (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                <Circle className="h-2 w-2 fill-current mr-1 animate-pulse" />
                Ulangan
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={disconnect}
              >
                <LogOut className="h-3 w-3 mr-1" />
                Chiqish
              </Button>
            </div>

            <div className="space-y-2">
              <Button variant={isMuted ? 'secondary' : 'outline'} size="sm" onClick={toggleMute} className="w-full">
                {isMuted ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    Mikrofon o'chiq
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Mikrofon yoqilgan
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                {isMuted
                  ? "Gapirish uchun mikrofonni yoqing."
                  : "Gaplashmoqchi bo'lgan odamni bosing (ratsiya)."}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                <Users className="h-3 w-3" />
                Online ({participants.length})
              </p>

              <ScrollArea className="h-[140px]">
                <div className="space-y-1">
                  {participants.map((participant) => {
                    const selected = targetUserId === participant.user_id;
                    return (
                      <button
                        key={participant.user_id}
                        type="button"
                        className={cn(
                          'w-full text-left flex items-center gap-2 p-2 rounded-md transition-all',
                          selected && 'ring-1 ring-primary bg-accent',
                          selected && isSpeaking && 'ring-2 ring-green-500 bg-green-500/10',
                          !isMuted && 'hover:bg-accent cursor-pointer'
                        )}
                        onClick={() => void handleUserClick(participant.user_id)}
                        disabled={isMuted}
                      >
                        <div className="relative">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={participant.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(participant.full_name)}</AvatarFallback>
                          </Avatar>
                          {(participant.isSpeaking || (selected && isSpeaking)) && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{participant.full_name || 'Unknown'}</span>
                        {(participant.isSpeaking || (selected && isSpeaking)) && (
                          <Volume2 className="h-3 w-3 text-green-500 ml-auto animate-pulse" />
                        )}
                      </button>
                    );
                  })}

                  {participants.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Boshqalar kutilmoqda...</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Radio className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">Gapirish uchun kanalga qo'shiling</p>
            <Button size="sm" className="w-full" onClick={connect}>
              <LogIn className="h-4 w-4 mr-2" />
              Kanalga qo'shilish
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
