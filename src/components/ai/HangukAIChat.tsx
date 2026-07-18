import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Bot, User, Trash2, Loader2, Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AIMessageContent } from '@/components/ai/AIMessageContent';
import { useHangukAI } from '@/hooks/useHangukAI';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { toast } from 'sonner';

interface HangukAIChatProps {
  userType: 'student' | 'staff';
  language?: string;
  variant?: 'floating' | 'embedded';
  className?: string;
  isOpenExternal?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function HangukAIChat({ 
  userType, 
  language = 'en', 
  variant = 'floating',
  className,
  isOpenExternal,
  onOpenChange
}: HangukAIChatProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  
  // Use external state if provided, otherwise internal
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : isOpenInternal;
  const setIsOpen = onOpenChange || setIsOpenInternal;
  const [input, setInput] = useState('');
  const { messages, isLoading, error, sendMessage, clearMessages } = useHangukAI(userType, language);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input hook
  const { 
    isListening, 
    isSupported: isVoiceSupported, 
    transcript,
    startListening, 
    stopListening,
    resetTranscript 
  } = useVoiceInput({
    language: currentLang,
    onResult: (text) => {
      setInput(prev => prev + (prev ? ' ' : '') + text);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Update input with transcript while listening
  useEffect(() => {
    if (isListening && transcript) {
      // Show interim transcript in input
    }
  }, [transcript, isListening]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    if (isListening) stopListening();
    sendMessage(input);
    setInput('');
    resetTranscript();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const welcomeMessage = userType === 'student' 
    ? t('ai.welcomeStudent', 'Hello! I\'m Hanguk AI, your personal study abroad assistant. Ask me anything about your applications, documents, universities, or the admission process!')
    : t('ai.welcomeStaff', 'Hello! I\'m Hanguk AI, your CRM assistant. I can help you with student information, tasks, system overview, and more. How can I help you today?');

  // Voice button component
  const VoiceButton = () => {
    if (!isVoiceSupported) return null;
    
    return (
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="icon"
        className={cn(
          "h-11 w-11 flex-shrink-0 transition-all",
          isListening && "animate-pulse"
        )}
        onClick={handleVoiceToggle}
        title={isListening ? 'To\'xtatish' : 'Ovozli kiritish'}
      >
        {isListening ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    );
  };

  // Listening indicator
  const ListeningIndicator = () => {
    if (!isListening) return null;
    
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-lg mb-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-destructive rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-destructive rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-destructive rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>Tinglayapman... ({currentLang === 'uz' ? "O'zbekcha" : currentLang === 'ru' ? 'Ruscha' : 'English'})</span>
      </div>
    );
  };

  if (variant === 'floating') {
    return (
      <>
        {/* Floating Chat Button - Hidden on mobile since it's in the nav */}
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 hidden md:flex"
            size="icon"
          >
            <Bot className="h-6 w-6" />
          </Button>
        )}

        {/* Chat Panel - Fullscreen on mobile, floating on desktop */}
        {isOpen && (
          <div className={cn(
            "fixed z-50 flex flex-col bg-background",
            // Mobile: fullscreen
            "inset-0 md:inset-auto",
            // Desktop: floating panel
            "md:bottom-6 md:right-6 md:w-96 md:h-[600px] md:max-h-[80vh] md:border md:rounded-lg md:shadow-xl",
            className
          )}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground md:rounded-t-lg safe-area-pt">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="font-semibold">Hanguk AI</span>
                {isVoiceSupported && (
                  <Mic className="h-3 w-3 opacity-70" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={clearMessages}
                  title={t('ai.clearChat', 'Clear chat')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {/* Welcome message */}
                {messages.length === 0 && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 bg-muted rounded-lg p-3">
                      <p className="text-sm">{welcomeMessage}</p>
                      {isVoiceSupported && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Mic className="h-3 w-3" />
                          Ovozli kiritish mavjud
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Chat messages */}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3",
                      msg.role === 'user' && "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.role === 'user' ? "bg-secondary" : "bg-primary"
                    )}>
                      {msg.role === 'user' ? (
                        <User className="h-4 w-4 text-secondary-foreground" />
                      ) : (
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      )}
                    </div>
                    <div className={cn(
                      "flex-1 rounded-lg p-3 max-w-[80%]",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    )}>
                      {msg.role === 'assistant' ? (
                        <AIMessageContent
                          content={msg.content}
                          onPick={sendMessage}
                          interactive={idx === messages.length - 1 && !isLoading}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                    {error}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t safe-area-pb">
              <ListeningIndicator />
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? "Gapiring..." : t('ai.placeholder', 'Type your message...')}
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                />
                <VoiceButton />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-11 w-11 flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Embedded variant
  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">Hanguk AI</span>
          {isVoiceSupported && (
            <Mic className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={clearMessages}
          title={t('ai.clearChat', 'Clear chat')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 bg-muted rounded-lg p-3">
                <p className="text-sm">{welcomeMessage}</p>
                {isVoiceSupported && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    Ovozli kiritish mavjud - Mikrofon tugmasini bosing
                  </p>
                )}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3",
                msg.role === 'user' && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === 'user' ? "bg-secondary" : "bg-primary"
              )}>
                {msg.role === 'user' ? (
                  <User className="h-4 w-4 text-secondary-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
              <div className={cn(
                "flex-1 rounded-lg p-3 max-w-[80%]",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground ml-auto" 
                  : "bg-muted"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <ListeningIndicator />
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Gapiring..." : t('ai.placeholder', 'Type your message...')}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <VoiceButton />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
