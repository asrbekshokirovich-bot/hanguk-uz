import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, MessageSquare, Pencil, Plus, Send, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useDeskDeletePayout,
  useDeskInvestors,
  useDeskMarkRead,
  useDeskMessages,
  useDeskPayouts,
  useDeskSavePayout,
  useDeskSend,
  useDeskThreads,
  type DeskPayout,
} from '@/hooks/useInvestorDesk';
import { parseAmount, payoutError, type PayoutDraft } from '@/lib/investorPayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * CRM "Investor" desk (audit 2026-10-26):
 *  - Xabarlar: the investor writes to a staff member from her portal; that
 *    staff member answers here. The owner sees every thread but, by policy,
 *    can only reply on threads addressed to them.
 *  - Ulush to'lovlari: the owner records distributions; they appear in the
 *    investor's "Distributed to date" and "Payout History".
 */

const fmtSum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');

export default function InvestorDeskContent() {
  const { t } = useTranslation();
  const { isOwner } = useUserRole();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'payouts' && isOwner ? 'payouts' : 'messages';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('crm.investorDesk.title')}</h2>
        <p className="text-muted-foreground">{t('crm.investorDesk.subtitle')}</p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set('tab', v);
          next.delete('thread');
          setParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('crm.investorDesk.messagesTab')}
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="payouts" className="gap-2">
              <Wallet className="h-4 w-4" />
              {t('crm.investorDesk.payoutsTab')}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="messages" className="mt-4">
          <MessagesPanel />
        </TabsContent>
        {isOwner && (
          <TabsContent value="payouts" className="mt-4">
            <PayoutsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------- messages */

function MessagesPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const threads = useDeskThreads();
  const list = threads.data ?? [];
  const selectedId = params.get('thread') ?? list[0]?.thread_id ?? null;
  const selected = list.find((x) => x.thread_id === selectedId) ?? null;
  const messages = useDeskMessages(selected?.thread_id ?? null);
  const send = useDeskSend();
  const markRead = useDeskMarkRead();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const canReply = !!selected && selected.staff_user_id === user?.id;

  // Opening a thread addressed to me clears its unread count.
  useEffect(() => {
    if (selected && canReply && selected.unread > 0) markRead.mutate(selected.thread_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.thread_id, selected?.unread, canReply]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || !selected) return;
    try {
      await send.mutateAsync({ threadId: selected.thread_id, body });
      setDraft('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (threads.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (threads.error) {
    return <p className="text-sm text-destructive">{(threads.error as Error).message}</p>;
  }
  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t('crm.investorDesk.noThreads')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {list.map((th) => (
            <button
              key={th.thread_id}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('thread', th.thread_id);
                setParams(next, { replace: true });
              }}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors hover:bg-muted/50',
                th.thread_id === selected?.thread_id && 'bg-muted',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{th.investor_name}</span>
                {th.unread > 0 && <Badge variant="destructive">{th.unread}</Badge>}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {t('crm.investorDesk.to', { name: th.staff_name ?? '—' })} ·{' '}
                {format(new Date(th.last_message_at), 'dd.MM HH:mm')}
              </div>
              {th.preview && <div className="mt-1 line-clamp-1 text-xs text-foreground/80">{th.preview}</div>}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex min-h-[420px] flex-col">
        {selected && (
          <>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base">
                {selected.investor_name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  → {selected.staff_name ?? '—'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
              {(messages.data ?? []).map((m) => {
                const mine = m.sender_user_id === selected.staff_user_id;
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                        mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                      )}
                    >
                      {m.body}
                      <div className={cn('mt-1 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {format(new Date(m.created_at), 'dd.MM.yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </CardContent>
            <div className="border-t border-border p-3">
              {canReply ? (
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder={t('crm.investorDesk.replyPlaceholder')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
                    }}
                  />
                  <Button onClick={() => void submit()} disabled={!draft.trim() || send.isPending} className="gap-2 self-end">
                    {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t('crm.investorDesk.send')}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('crm.investorDesk.readOnly', { name: selected.staff_name ?? '—' })}
                </p>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- payouts */

const EMPTY: PayoutDraft = { investor_id: '', period_label: '', amount: '', status: 'accruing', due_date: '', paid_at: '' };

function PayoutsPanel() {
  const { t } = useTranslation();
  const investors = useDeskInvestors(true);
  const payouts = useDeskPayouts(true);
  const save = useDeskSavePayout();
  const remove = useDeskDeletePayout();
  const [editing, setEditing] = useState<{ id?: string; draft: PayoutDraft } | null>(null);
  const [deleting, setDeleting] = useState<DeskPayout | null>(null);

  const nameOf = useMemo(() => {
    const m = new Map((investors.data ?? []).map((i) => [i.id, i.full_name]));
    return (id: string) => m.get(id) ?? '—';
  }, [investors.data]);

  const totals = useMemo(() => {
    const rows = payouts.data ?? [];
    return {
      paid: rows.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount_uzs), 0),
      accruing: rows.filter((p) => p.status === 'accruing').reduce((s, p) => s + Number(p.amount_uzs), 0),
    };
  }, [payouts.data]);

  const err = editing ? payoutError(editing.draft) : null;

  const submit = async () => {
    if (!editing || err) return;
    const d = editing.draft;
    try {
      await save.mutateAsync({
        id: editing.id,
        investor_id: d.investor_id,
        period_label: d.period_label,
        amount_uzs: parseAmount(d.amount),
        status: d.status,
        due_date: d.due_date || null,
        paid_at: d.paid_at || null,
      });
      toast.success(t('crm.investorDesk.saved'));
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openNew = () => {
    const only = investors.data?.length === 1 ? investors.data[0].id : '';
    setEditing({ draft: { ...EMPTY, investor_id: only } });
  };

  const set = (patch: Partial<PayoutDraft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-muted-foreground">{t('crm.investorDesk.totalPaid')}</div>
            <div className="text-lg font-bold">{fmtSum(totals.paid)} UZS</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('crm.investorDesk.totalAccruing')}</div>
            <div className="text-lg font-bold">{fmtSum(totals.accruing)} UZS</div>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('crm.investorDesk.addPayout')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {payouts.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (payouts.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{t('crm.investorDesk.noPayouts')}</p>
          ) : (
            <div className="divide-y divide-border">
              {(payouts.data ?? []).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {p.period_label} · {nameOf(p.investor_id)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.status === 'paid'
                        ? t('crm.investorDesk.paidOn', { date: p.paid_at ? format(new Date(p.paid_at), 'dd.MM.yyyy') : '—' })
                        : t('crm.investorDesk.dueOn', { date: p.due_date ? format(new Date(p.due_date), 'dd.MM.yyyy') : '—' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold">{fmtSum(Number(p.amount_uzs))} UZS</span>
                    <Badge variant={p.status === 'paid' ? 'successSoft' : 'warning'}>
                      {p.status === 'paid' ? t('crm.investorDesk.statusPaid') : t('crm.investorDesk.statusAccruing')}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: p.id,
                          draft: {
                            investor_id: p.investor_id,
                            period_label: p.period_label,
                            amount: String(p.amount_uzs),
                            status: p.status,
                            due_date: p.due_date ?? '',
                            paid_at: p.paid_at ?? '',
                          },
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && !save.isPending && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t('crm.investorDesk.editPayout') : t('crm.investorDesk.addPayout')}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('crm.investorDesk.investor')}</Label>
                <Select value={editing.draft.investor_id} onValueChange={(v) => set({ investor_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('crm.investorDesk.pickInvestor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(investors.data ?? []).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.full_name} ({Number(i.equity_percent)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('crm.investorDesk.period')}</Label>
                <Input
                  value={editing.draft.period_label}
                  onChange={(e) => set({ period_label: e.target.value })}
                  placeholder="Q4 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('crm.investorDesk.amount')}</Label>
                <Input
                  inputMode="decimal"
                  value={editing.draft.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('crm.investorDesk.status')}</Label>
                <Select value={editing.draft.status} onValueChange={(v) => set({ status: v as PayoutDraft['status'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accruing">{t('crm.investorDesk.statusAccruing')}</SelectItem>
                    <SelectItem value="paid">{t('crm.investorDesk.statusPaid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('crm.investorDesk.dueDate')}</Label>
                  <Input type="date" value={editing.draft.due_date} onChange={(e) => set({ due_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('crm.investorDesk.paidDate')}</Label>
                  <Input
                    type="date"
                    value={editing.draft.paid_at}
                    disabled={editing.draft.status !== 'paid'}
                    onChange={(e) => set({ paid_at: e.target.value })}
                  />
                </div>
              </div>
              {err && <p className="text-sm text-destructive">{t(err)}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={!!err || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crm.investorDesk.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${deleting.period_label} · ${fmtSum(Number(deleting.amount_uzs))} UZS`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('crm.contractCancel.no')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await remove.mutateAsync(deleting.id);
                  toast.success(t('crm.investorDesk.deleted'));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                }
                setDeleting(null);
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
