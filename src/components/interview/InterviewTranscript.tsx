import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'interviewer' | 'student';
  content: string;
  created_at: string;
}

interface InterviewTranscriptProps {
  messages: Message[];
  isProcessing?: boolean;
  className?: string;
}

export function InterviewTranscript({ 
  messages, 
  isProcessing,
  className 
}: InterviewTranscriptProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <p>{t('interview.waitingToStart', 'Interview will begin shortly...')}</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)} ref={scrollRef}>
      <div className="space-y-4 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === 'student' && "flex-row-reverse"
            )}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className={cn(
                message.role === 'interviewer' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary"
              )}>
                {message.role === 'interviewer' ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
            
            <div className={cn(
              "flex flex-col max-w-[80%]",
              message.role === 'student' && "items-end"
            )}>
              <span className="text-xs text-muted-foreground mb-1">
                {message.role === 'interviewer' 
                  ? t('interview.interviewer', '면접관')
                  : t('interview.you', 'You')}
              </span>
              <div className={cn(
                "rounded-2xl px-4 py-2",
                message.role === 'interviewer'
                  ? "bg-muted rounded-tl-sm"
                  : "bg-primary text-primary-foreground rounded-tr-sm"
              )}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {new Date(message.created_at).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground mb-1">
                {t('interview.interviewer', '면접관')}
              </span>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
