import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, MessageCircle, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { answerComment, fetchComments } from '../api';
import { ago, clock, whenLabel } from '../time';
import type { SocialComment } from '../types';
import { explainLeadError } from '../lists/labels';
import { useStaffNames } from '../lists/useStaffNames';
import { useLeadSettings } from '../useLeadSettings';
import { postInstagramReply } from './instagramReply';
import { canSendReply, checkReply, MAX_REPLY_LENGTH } from './replyRules';
import { submitCommentReply } from './sendReply';

const COMMENTS_KEY = ['lead-v2', 'comments'] as const;
const WINDOW = 200;

interface CommentsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Izohlar (spec §3.2): the right-hand panel of the desk for comments under our
 * posts. Everybody with staff access, the boss included, answers here: a short
 * public reply, then "DM'da davom etish" to carry on in the lead card.
 *
 * Meta only delivers comments once its permissions are approved; until then
 * the list is simply empty and says so without calling it an error.
 */
export default function CommentsPanel({ open, onOpenChange }: CommentsPanelProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'open' | 'all'>('open');

  const unanswered = useQuery({
    queryKey: [...COMMENTS_KEY, 'open'],
    queryFn: () => fetchComments({ onlyOpen: true, limit: WINDOW }),
    enabled: open,
  });
  const all = useQuery({
    queryKey: [...COMMENTS_KEY, 'all'],
    queryFn: () => fetchComments({ limit: WINDOW }),
    enabled: open,
  });

  // A new comment, or somebody else's reply, shows up without a reload.
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`lead-v2-comments-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_comments' }, () => {
        void qc.invalidateQueries({ queryKey: COMMENTS_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, qc]);

  const openCount = unanswered.data?.length ?? 0;
  const openBadge = openCount >= WINDOW ? `${WINDOW}+` : String(openCount);

  const goToDm = (leadId: string) => {
    onOpenChange(false);
    navigate(`/crm/desk?lead=${encodeURIComponent(leadId)}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="space-y-0.5 border-b px-4 py-3 pr-10 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Izohlar
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Instagram postlar ostidagi izohlar. Ochiq javob narx aytmaydi; narx va shartlar DM'da.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'all')} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 h-9 w-auto justify-start self-start">
            <TabsTrigger value="open" className="flex-none px-4">
              Javobsiz {openBadge}
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-none px-4">
              Hammasi
            </TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <CommentList query={unanswered} onDm={goToDm} emptyTitle="Izohlar yo'q" emptyHint="Javob kutayotgan izoh yo'q." />
          </TabsContent>
          <TabsContent value="all" className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <CommentList
              query={all}
              onDm={goToDm}
              emptyTitle="Izohlar yo'q"
              emptyHint="Instagram izohlari Meta ruxsati tasdiqlangach shu yerda paydo bo'ladi."
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

interface ListQuery {
  data: SocialComment[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

function CommentList({ query, onDm, emptyTitle, emptyHint }: { query: ListQuery; onDm: (leadId: string) => void; emptyTitle: string; emptyHint: string }) {
  if (query.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (query.error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-8 text-center">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <p className="text-sm font-medium">Izohlarni yuklab bo'lmadi</p>
        <p className="text-[13px] text-muted-foreground">{explainLeadError(query.error)}</p>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          Qayta urinish
        </Button>
      </div>
    );
  }
  const items = query.data ?? [];
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
        <MessageCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="max-w-xs text-[13px] text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <CommentItem key={c.id} comment={c} onDm={onDm} />
      ))}
    </ul>
  );
}

function CommentItem({ comment: c, onDm }: { comment: SocialComment; onDm: (leadId: string) => void }) {
  const qc = useQueryClient();
  const { settings } = useLeadSettings();
  const { nameOf } = useStaffNames();

  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceOk, setPriceOk] = useState(false);
  // step 1 (Instagram) went through but step 2 (CRM) failed: a retry must not post again
  const [posted, setPosted] = useState(false);

  const answered = c.replied_at != null;
  const check = checkReply(text, settings.forbidden_words);
  const template = settings.templates.find((t) => t.key === 'comment_reply');

  const insertTemplate = () => {
    if (!template) return;
    setText(/[а-яё]/i.test(c.text ?? '') && template.ru ? template.ru : template.uz);
    setPriceOk(false);
  };

  const send = async () => {
    if (!canSendReply(check, priceOk) || sending) return;
    setSending(true);
    setError(null);
    const outcome = await submitCommentReply(
      c,
      text,
      { post: postInstagramReply, record: async (id, reply) => answerComment(id, reply) },
      { alreadyPosted: posted },
    );
    setSending(false);
    if (outcome.status === 'ok') {
      toast.success('Javob yuborildi');
      setReplying(false);
      setText('');
      setPriceOk(false);
      setPosted(false);
      await qc.invalidateQueries({ queryKey: COMMENTS_KEY });
      return;
    }
    if (outcome.status === 'record_failed') {
      setPosted(true);
      setError(`Javob Instagramga yuborildi, lekin CRMga yozilmadi: ${explainLeadError(new Error(outcome.message))}. Qayta bosing — javob ikkinchi marta yuborilmaydi.`);
      return;
    }
    setError(`Yuborilmadi: ${outcome.message}`);
  };

  return (
    <li className={cn('rounded-md border bg-background p-3 text-[13px]', answered && 'bg-muted/30')}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground" title={whenLabel(c.created_at)}>
          {clock(c.created_at)}
        </span>
        <span className="font-medium text-foreground">{c.author_username ? `@${c.author_username.replace(/^@/, '')}` : "Noma'lum"}</span>
        <span className="truncate" title={c.post_label ?? undefined}>
          {c.post_label || 'post'}
        </span>
        <span className="ml-auto">{ago(c.created_at)}</span>
      </div>

      <p className="mt-1 whitespace-pre-wrap text-sm">{c.text || <span className="text-muted-foreground">(matnsiz izoh)</span>}</p>

      {answered ? (
        <div className="mt-2 rounded border bg-background px-2 py-1.5 text-[12px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            javob berildi · {nameOf(c.replied_by) ?? 'xodim'}, {clock(c.replied_at)}
          </div>
          {c.reply_text && <p className="mt-0.5 whitespace-pre-wrap">{c.reply_text}</p>}
        </div>
      ) : (
        !replying && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setReplying(true)}>
              Javob yozish
            </Button>
          </div>
        )
      )}

      {!answered && replying && (
        <div className="mt-2 space-y-1.5">
          <Textarea
            aria-label={`Ochiq javob: ${c.author_username ?? 'izoh'}`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPriceOk(false);
            }}
            rows={3}
            maxLength={MAX_REPLY_LENGTH + 100}
            placeholder="Qisqa ochiq javob (narxsiz)"
            className="min-h-[4.5rem] text-sm"
            aria-invalid={check.forbidden ? true : undefined}
            disabled={sending}
          />

          {check.forbidden && (
            <p role="alert" className="text-[12px] font-medium text-destructive">
              Taqiqlangan so'z: «{check.forbidden}» — yuborib bo'lmaydi.
            </p>
          )}
          {check.price && !check.forbidden && (
            <div role="alert" className="rounded border border-warning/50 bg-warning/10 px-2 py-1.5 text-[12px]">
              <p className="font-medium">Ochiq javobda narx bor: «{check.price}». Narx va shartlar DM'da aytiladi.</p>
              <label className="mt-1 flex items-center gap-1.5">
                <input type="checkbox" checked={priceOk} onChange={(e) => setPriceOk(e.target.checked)} />
                Baribir ochiq yuborish
              </label>
            </div>
          )}
          {check.tooLong && <p className="text-[12px] text-destructive">Matn {MAX_REPLY_LENGTH} belgidan oshmasin.</p>}
          {error && (
            <p role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void send()} disabled={!canSendReply(check, priceOk) || sending}>
              {sending ? 'Yuborilmoqda…' : posted ? 'CRMga yozish' : 'Yuborish'}
            </Button>
            {template && (
              <Button size="sm" variant="outline" onClick={insertTemplate} disabled={sending}>
                Shablon
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={sending}
              onClick={() => {
                setReplying(false);
                setError(null);
              }}
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      <div className="mt-2 border-t pt-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!c.lead_id}
          title={c.lead_id ? undefined : "Bu izoh hali lidga bog'lanmagan"}
          onClick={() => c.lead_id && onDm(c.lead_id)}
        >
          DM'da davom etish
        </Button>
      </div>
    </li>
  );
}
