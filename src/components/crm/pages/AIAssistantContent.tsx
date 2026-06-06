import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Send,
  User,
  Trash2,
  Loader2,
  Sparkles,
  Users,
  FileText,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  HelpCircle,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useHangukAI } from '@/hooks/useHangukAI';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuickAction {
  icon: React.ElementType;
  label: string;
  message: string;
  color: string;
}

export default function AIAssistantContent() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const [input, setInput] = useState('');
  const { messages, isLoading, error, sendMessage, clearMessages } = useHangukAI('staff', currentLang);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const [indexing, setIndexing] = useState(false);
  const [docRemaining, setDocRemaining] = useState<number | null>(null);

  // Reads the student files (OCR + extraction) so the AI can answer about their
  // contents. Drains the queue in batches; safe to run repeatedly.
  const indexDocuments = async () => {
    if (indexing) return;
    setIndexing(true);
    let processedTotal = 0;
    try {
      for (let i = 0; i < 300; i++) {
        const { data, error: invErr } = await supabase.functions.invoke('request-document-analysis', { body: { limit: 8 } });
        if (invErr) throw new Error(invErr.message);
        processedTotal += data?.processed || 0;
        setDocRemaining(data?.remaining ?? 0);
        if (!data || (data.remaining ?? 0) === 0 || (data.processed ?? 0) === 0) break;
      }
      toast({ title: 'Documents indexed', description: `Read ${processedTotal} file(s). Hanguk AI can now answer about their contents.` });
    } catch (e) {
      toast({ title: 'Indexing stopped', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIndexing(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      icon: TrendingUp,
      label: t('ai.quickDashboard', 'Dashboard Overview'),
      message: 'Show me the current dashboard overview with all key metrics and what needs immediate attention.',
      color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20'
    },
    {
      icon: Users,
      label: t('ai.quickStudents', 'Student Summary'),
      message: 'Give me a summary of all students - how many total, any pending documents, and who needs follow-up.',
      color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
    },
    {
      icon: ClipboardList,
      label: t('ai.quickTasks', 'My Tasks'),
      message: 'Show me all my pending tasks sorted by priority and due date.',
      color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20'
    },
    {
      icon: FileText,
      label: t('ai.quickDocuments', 'Pending Documents'),
      message: 'Which documents are pending review? List them with student names.',
      color: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
    },
    {
      icon: MessageSquare,
      label: t('ai.quickMessages', 'Unread Messages'),
      message: 'Show me all unread messages and who they are from.',
      color: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20'
    },
    {
      icon: Zap,
      label: t('ai.quickUrgent', 'Urgent Items'),
      message: 'What are the most urgent items that need my attention right now? Include overdue payments, urgent tasks, and pending approvals.',
      color: 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
    },
  ];

  const exampleQueries = [
    "Show me info about [Student Name]",
    "What is the status of applications this week?",
    "Which students have overdue payments?",
    "List all accepted applications",
    "Who needs to submit documents?",
    "Show me students from Tashkent office",
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (message: string) => {
    sendMessage(message);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Hanguk AI
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                {t('ai.powered', 'AI Powered')}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('ai.staffDescription', 'Your intelligent CRM assistant with full system access')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearMessages}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {t('ai.clearChat', 'Clear Chat')}
        </Button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {/* Welcome message when no messages */}
                {messages.length === 0 && (
                  <div className="space-y-6">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 bg-muted rounded-lg p-4">
                        <p className="font-medium mb-2">
                          {t('ai.welcomeStaff', "Hello! I'm Hanguk AI, your CRM assistant.")}
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t('ai.staffCapabilities', 'I have access to all student data, applications, documents, payments, and communications. Here\'s what I can help you with:')}
                        </p>
                        <ul className="text-sm space-y-2 text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Look up any student by name and see their complete profile
                          </li>
                          <li className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Get dashboard overview and system statistics
                          </li>
                          <li className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            View and manage your tasks
                          </li>
                          <li className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Check document status and pending reviews
                          </li>
                          <li className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-primary" />
                            Answer questions about students, payments, and applications
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Example queries */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-3 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        {t('ai.tryAsking', 'Try asking:')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {exampleQueries.map((query, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleQuickAction(query)}
                          >
                            {query}
                          </Button>
                        ))}
                      </div>
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
                      "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.role === 'user' ? "bg-secondary" : "bg-primary"
                    )}>
                      {msg.role === 'user' ? (
                        <User className="h-5 w-5 text-secondary-foreground" />
                      ) : (
                        <Bot className="h-5 w-5 text-primary-foreground" />
                      )}
                    </div>
                    <div className={cn(
                      "flex-1 rounded-lg p-4 max-w-[85%]",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    )}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {t('ai.thinking', 'Thinking...')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg">
                    {error}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-3">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('ai.placeholder', 'Type your message... (Press Enter to send, Shift+Enter for new line)')}
                  className="min-h-[56px] max-h-40 resize-none"
                  rows={2}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="lg"
                  className="h-14 w-14 flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Sidebar */}
        <div className="w-72 flex-shrink-0 hidden lg:block">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {t('ai.quickActions', 'Quick Actions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 h-auto py-3 px-3",
                    action.color
                  )}
                  onClick={() => handleQuickAction(action.message)}
                  disabled={isLoading}
                >
                  <action.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{action.label}</span>
                </Button>
              ))}

              <div className="pt-4 border-t mt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-3 px-3 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20"
                  onClick={indexDocuments}
                  disabled={indexing}
                >
                  {indexing ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" /> : <FileText className="h-5 w-5 flex-shrink-0" />}
                  <span className="text-sm font-medium text-left">
                    {indexing
                      ? `Reading files… ${docRemaining ?? ''} left`
                      : t('ai.indexDocuments', 'Read all documents (AI)')}
                  </span>
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1 px-1">
                  Lets the AI answer about what's inside each file. Runs in the background; keep this tab open.
                </p>
              </div>

              <div className="pt-4 border-t mt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  {t('ai.searchTip', 'Search for a student:')}
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground italic">
                    "Show me info about Ali"
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    "Find student Aziza"
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    "Who is Jasur?"
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
