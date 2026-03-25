import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useChannelMessages, ChannelMessage } from '@/hooks/useChannelMessages';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/ui/mention-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, MessageSquare, ShieldCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface RoomChatProps {
  channelId: string | null;
  isReadOnly?: boolean;
  channelName?: string;
}

export function RoomChat({ channelId, isReadOnly = false, channelName }: RoomChatProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useChannelMessages(channelId);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [staffUserIds, setStaffUserIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Issue D: fetch staff user IDs scoped to this channel's room
  useEffect(() => {
    if (!channelId) return;
    const fetchStaffIds = async () => {
      // Get the room_id for this channel, then find university_staff members
      const { data: channelData } = await supabase
        .from('room_channels')
        .select('room_id')
        .eq('id', channelId)
        .single();
      if (!channelData) return;
      const { data } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', channelData.room_id)
        .eq('role', 'university_staff');
      if (data) {
        setStaffUserIds(new Set(data.map(r => r.user_id)));
      }
    };
    fetchStaffIds();
  }, [channelId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const success = await sendMessage(newMessage);
    if (success) {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return t('room.today', 'Bugun');
    }
    if (isYesterday(date)) {
      return t('room.yesterday', 'Kecha');
    }
    return format(date, 'dd.MM.yyyy');
  };

  const formatMessageTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatMessageDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChannelMessage[]>);

  if (loading) {
    return (
      <div className="flex flex-col h-full p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>{t('room.noMessages', 'Hali xabarlar yo\'q')}</p>
            {!isReadOnly && (
              <p className="text-sm mt-2">{t('room.beFirst', 'Birinchi bo\'lib xabar yuboring!')}</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                    {date}
                  </div>
                </div>
                
                {/* Messages for this date */}
                <div className="space-y-4">
                  {msgs.map((message) => {
                    const isOwnMessage = message.sender_id === user?.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={message.sender?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(message.sender?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-medium">
                              {message.sender?.full_name || 'Unknown'}
                            </span>
                            {staffUserIds.has(message.sender_id) && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                                 <ShieldCheck className="h-2.5 w-2.5" />
                                 {t('navigation.staff', 'Staff')}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(message.created_at)}
                            </span>
                          </div>
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isOwnMessage
                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                : 'bg-muted rounded-tl-none'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      {!isReadOnly && (
        <div className="border-t p-4">
          <div className="flex items-center gap-2">
            <MentionInput
              value={newMessage}
              onChange={setNewMessage}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('room.typeMessage', 'Xabar yozing...')}
              disabled={sending}
              rows={1}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="border-t p-4 bg-muted/50">
          <p className="text-center text-sm text-muted-foreground">
            {t('room.readOnlyChannel', 'Bu kanal faqat o\'qish uchun')}
          </p>
        </div>
      )}
    </div>
  );
}
