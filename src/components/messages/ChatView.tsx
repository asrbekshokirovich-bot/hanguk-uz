import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/ui/mention-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  MoreVertical,
  Archive,
  User,
  UserPlus,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Message, MessageThread } from '@/hooks/useMessages';

interface ChatViewProps {
  thread: MessageThread;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  onArchive: () => void;
  onBack: () => void;
  hasLead?: boolean;
  converting?: boolean;
  onConvertToLead?: () => void;
  onViewLead?: () => void;
}

const sourceLabels: Record<string, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  manual: 'Manual',
};

export function ChatView({
  thread,
  messages,
  onSendMessage,
  onArchive,
  onBack,
  hasLead = false,
  converting = false,
  onConvertToLead,
  onViewLead,
}: ChatViewProps) {
  const { t } = useTranslation();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    await onSendMessage(newMessage.trim());
    setNewMessage('');
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach((msg) => {
    const dateStr = formatDate(msg.created_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dateStr) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: dateStr, messages: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={thread.sender_avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(thread.sender_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{thread.sender_name || 'Unknown'}</h3>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                {sourceLabels[thread.source] || thread.source}
              </Badge>
              {hasLead && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {t('messages.lead', 'Lead')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasLead ? (
              <DropdownMenuItem onClick={onViewLead}>
                <User className="h-4 w-4 mr-2" />
                {t('messages.viewLead', 'View lead')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onConvertToLead} disabled={converting}>
                {converting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {t('messages.convertToLead', 'Convert to lead')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {t('messages.archive')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center mb-4">
              <Badge variant="secondary" className="text-xs">
                {group.date}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {group.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.direction === 'outgoing'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-[10px] mt-1 ${
                      message.direction === 'outgoing' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <MentionInput
            placeholder={`${t('messages.reply')}... (type @ to mention)`}
            value={newMessage}
            onChange={setNewMessage}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="min-h-10 max-h-32"
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
