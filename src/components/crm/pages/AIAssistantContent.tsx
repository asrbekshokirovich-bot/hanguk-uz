import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Send,
  User,
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  History,
  Pin,
  MoreHorizontal,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { AIMessageContent } from '@/components/ai/AIMessageContent';
import { useHangukAI } from '@/hooks/useHangukAI';
import { useAiThreads } from '@/hooks/useAiThreads';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { firstName, threadDayLabel, threadInitials, type AiThread } from '@/lib/aiThreads';

function ThreadCard({
  thread,
  highlighted,
  dayLabel,
  onOpen,
  onPin,
  t,
}: {
  thread: AiThread;
  highlighted: boolean;
  dayLabel: string;
  onOpen: () => void;
  onPin: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className={cn(
        'group flex flex-[1_1_auto] min-w-[200px] flex-col gap-2 rounded-xl border bg-white/[0.03] p-3 text-left transition-colors cursor-pointer',
        'hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        highlighted ? 'border-accent/60' : 'border-border/70',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
            highlighted ? 'bg-accent text-accent-foreground' : 'bg-primary/40 text-white',
          )}
        >
          {threadInitials(thread.title)}
        </span>
        <span className="flex-1 truncate text-sm font-semibold">{thread.title}</span>
        <button
          type="button"
          aria-label={thread.pinned ? t('ai.unpin') : t('ai.pin')}
          title={thread.pinned ? t('ai.unpin') : t('ai.pin')}
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className={cn(
            'shrink-0 rounded p-0.5 transition-opacity',
            thread.pinned ? 'text-accent' : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100',
          )}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* w-0 + min-w-full: the preview wraps to the card instead of widening it */}
      <p className="w-0 min-w-full line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-muted-foreground">
        {thread.last_preview || '—'}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">
          {dayLabel} · {t('ai.messagesCount', { count: thread.message_count })}
        </span>
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-accent">
          {t('ai.continue')} <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

export default function AIAssistantContent() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const { threads, refresh, togglePin } = useAiThreads();
  const { messages, isLoading, error, sendMessage, clearMessages, openThread, threadId } =
    useHangukAI('staff', currentLang, { threads: true, onSaved: refresh });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [docRemaining, setDocRemaining] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [leadRemaining, setLeadRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata?.full_name as string | undefined) || '';
    setStaffName(firstName(meta));
    void supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setStaffName(firstName(data.full_name)); });
  }, [user]);

  // Reads each lead's chats/calls/notes and auto-fills structured fields so the
  // AI can answer questions like "leads taking the exam in May".
  const enrichLeads = async () => {
    if (enriching) return;
    setEnriching(true);
    let total = 0;
    try {
      for (let i = 0; i < 300; i++) {
        const { data, error: invErr } = await supabase.functions.invoke('request-lead-enrichment', { body: { limit: 5 } });
        if (invErr) throw new Error(invErr.message);
        total += data?.processed || 0;
        setLeadRemaining(data?.remaining ?? 0);
        if (!data || (data.remaining ?? 0) === 0 || (data.processed ?? 0) === 0) break;
      }
      toast({ title: t('ai.enrichDoneTitle'), description: t('ai.enrichDone', { count: total }) });
    } catch (e) {
      toast({ title: t('ai.jobStopped'), description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setEnriching(false);
    }
  };

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
      toast({ title: t('ai.indexDoneTitle'), description: t('ai.indexDone', { count: processedTotal }) });
    } catch (e) {
      toast({ title: t('ai.jobStopped'), description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setIndexing(false);
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const el = viewport ?? scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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

  // Recomputed whenever the list changes, so "Bugun" stays right across midnight.
  const now = useMemo(() => new Date(), [threads]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayWords = { today: t('ai.today'), yesterday: t('ai.yesterday') };
  const dayLabel = (iso: string) => threadDayLabel(iso, now, currentLang, dayWords);
  const recent = threads.slice(0, 4);
  const empty = messages.length === 0;

  const open = (id: string) => {
    setHistoryOpen(false);
    if (id !== threadId || empty) void openThread(id);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] min-h-[560px] rounded-3xl border border-border/70 bg-card/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 shrink-0 rounded-full bg-primary/50 ring-1 ring-primary/60 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2">
              Hanguk AI
              <Badge variant="secondary" className="text-[11px] font-semibold">
                <Sparkles className="h-3 w-3 mr-1" />
                {t('ai.powered', 'AI Powered')}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {t('ai.staffDescription', 'Your intelligent CRM assistant with full system access')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" />
            {t('ai.history')}
            <span className="rounded-full bg-accent px-2 text-xs font-bold text-accent-foreground">{threads.length}</span>
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl" onClick={clearMessages}>
            <Trash2 className="h-4 w-4" />
            {t('ai.clearChat', 'Clear Chat')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" aria-label={t('ai.moreActions')}>
                {indexing || enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuItem onClick={indexDocuments} disabled={indexing} className="items-start gap-3 py-2.5">
                {indexing ? <Loader2 className="h-4 w-4 mt-0.5 animate-spin" /> : <FileText className="h-4 w-4 mt-0.5 text-info" />}
                <div>
                  <div className="text-sm font-medium">
                    {indexing ? t('ai.indexing', { count: docRemaining ?? 0 }) : t('ai.indexDocuments')}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('ai.indexDocumentsHint')}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={enrichLeads} disabled={enriching} className="items-start gap-3 py-2.5">
                {enriching ? <Loader2 className="h-4 w-4 mt-0.5 animate-spin" /> : <Sparkles className="h-4 w-4 mt-0.5 text-success" />}
                <div>
                  <div className="text-sm font-medium">
                    {enriching ? t('ai.enriching', { count: leadRemaining ?? 0 }) : t('ai.enrichLeads')}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('ai.enrichLeadsHint')}</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.35),transparent_70%)]"
        />

        <ScrollArea className="relative flex-1" ref={scrollRef}>
          {empty ? (
            <div className="flex min-h-full flex-col items-center px-6 pt-16 pb-6">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-primary/60 bg-primary/40 shadow-[0_0_40px_hsl(var(--primary)/0.45)]">
                <Logo variant="glyph" className="h-14 w-14" alt="" />
              </div>
              <h2 className="mt-6 text-center text-2xl font-bold">
                {staffName ? t('ai.greeting', { name: staffName }) : t('ai.greetingNoName')}
              </h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">{t('ai.greetingHint')}</p>

              {recent.length > 0 && (
                <div className="mt-12 w-full max-w-6xl">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <History className="h-3.5 w-3.5" />
                      {t('ai.recentTitle')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      {t('ai.seeAll', { count: threads.length })} <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap xl:flex-nowrap gap-3">
                    {recent.map((th, i) => (
                      <ThreadCard
                        key={th.id}
                        thread={th}
                        highlighted={th.pinned || (i === 0 && !recent.some((x) => x.pinned))}
                        dayLabel={dayLabel(th.updated_at)}
                        onOpen={() => open(th.id)}
                        onPin={() => void togglePin(th)}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-4 md:p-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
                      msg.role === 'user' ? 'bg-secondary' : 'bg-primary/50 ring-1 ring-primary/60',
                    )}
                  >
                    {msg.role === 'user' ? (
                      <User className="h-4 w-4 text-secondary-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'rounded-xl px-4 py-3 max-w-[85%]',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-white/[0.04] border border-border/70',
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <AIMessageContent
                        content={msg.content}
                        onPick={sendMessage}
                        interactive={idx === messages.length - 1 && !isLoading}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/50 ring-1 ring-primary/60 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-xl border border-border/70 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">{t('ai.thinking', 'Thinking...')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mx-4 mb-4 bg-destructive/10 text-destructive text-sm p-4 rounded-lg">{error}</div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="relative p-4">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('ai.placeholder', 'Type your message... (Press Enter to send, Shift+Enter for new line)')}
              className="min-h-[52px] max-h-40 resize-none rounded-xl bg-white/[0.04] py-[15px] leading-5"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              variant="highlight"
              size="lg"
              className="h-[52px] w-[52px] flex-shrink-0 rounded-xl disabled:opacity-100"
              aria-label={t('ai.send')}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* History */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('ai.historyTitle')}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {threads.length === 0 && <p className="text-sm text-muted-foreground">{t('ai.historyEmpty')}</p>}
            {threads.map((th) => (
              <ThreadCard
                key={th.id}
                thread={th}
                highlighted={th.id === threadId || th.pinned}
                dayLabel={dayLabel(th.updated_at)}
                onOpen={() => open(th.id)}
                onPin={() => void togglePin(th)}
                t={t}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
