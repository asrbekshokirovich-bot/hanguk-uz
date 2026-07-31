import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InvestorScreenHeader } from '@/components/investor/InvestorScreen';
import {
  EmptyNote,
  InitialsAvatar,
  InvestorCard,
  StatusPill,
} from '@/components/investor/InvestorPrimitives';
import { useAuth } from '@/contexts/AuthContext';
import {
  useInvestorIdentity,
  useInvestorMessages,
  useInvestorStaffDirectory,
  useInvestorThreads,
  useMarkThreadRead,
  useOpenThread,
  useSendInvestorMessage,
  type InvestorMessageRow,
  type InvestorThreadWithPreview,
} from '@/hooks/useInvestor';
import { humanizeLineItem, shortTime } from '@/lib/investorFormat';

/* ---------------------------------------------------------------------------
 * SCREENS.md 4 - Messages. The only writable surface in the portal.
 *
 * The left pane is the staff directory, not the thread list. Every member of
 * the team is reachable whether or not a conversation exists yet; the thread
 * row is created by the database on the first send. That is the difference
 * between "she can message any staff member" and "she can reply to whoever
 * wrote to her first".
 *
 * Send is the one lime action in the whole portal. Lime appears nowhere else on
 * this screen except the unread dot.
 * ------------------------------------------------------------------------ */

export default function InvestorMessages() {
  const { user } = useAuth();
  const { data: identity } = useInvestorIdentity();
  const staff = useInvestorStaffDirectory();
  const threads = useInvestorThreads();
  const openThread = useOpenThread();
  const markRead = useMarkThreadRead();

  const [query, setQuery] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const threadByStaff = useMemo(() => {
    const map = new Map<string, InvestorThreadWithPreview>();
    for (const t of threads.data ?? []) map.set(t.staff_user_id, t);
    return map;
  }, [threads.data]);

  /** Directory rows, most recently active first, then alphabetical. */
  const people = useMemo(() => {
    const rows = (staff.data ?? []).map((s) => ({ ...s, thread: threadByStaff.get(s.user_id) }));
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (r) =>
            r.full_name.toLowerCase().includes(needle) ||
            r.role.toLowerCase().includes(needle),
        )
      : rows;
    return filtered.sort((a, b) => {
      const at = a.thread?.preview_at ?? '';
      const bt = b.thread?.preview_at ?? '';
      if (at && bt) return bt.localeCompare(at);
      if (at) return -1;
      if (bt) return 1;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [staff.data, threadByStaff, query]);

  // Open the most recent conversation on arrival, or the first person.
  useEffect(() => {
    if (selectedStaffId || people.length === 0) return;
    setSelectedStaffId(people[0].user_id);
  }, [people, selectedStaffId]);

  // Resolved against the full directory, not the filtered list: typing a search
  // term that excludes the open conversation must not blank the right pane.
  const selected =
    (staff.data ?? [])
      .map((r) => ({ ...r, thread: threadByStaff.get(r.user_id) }))
      .find((p) => p.user_id === selectedStaffId) ?? null;
  const threadId = selected?.thread?.id ?? null;
  const messages = useInvestorMessages(threadId);
  const send = useSendInvestorMessage();

  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data?.length, threadId]);

  useEffect(() => {
    if (threadId && (selected?.thread?.unread ?? 0) > 0) markRead.mutate(threadId);
    // markRead is stable enough for this; re-running on every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, selected?.thread?.unread]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !selected || !identity) return;
    setDraft('');
    try {
      // Writing to someone for the first time creates the thread; the database
      // will only allow it against a real staff member.
      const id =
        threadId ??
        (await openThread.mutateAsync({
          staffUserId: selected.user_id,
          investorId: identity.investor_id,
        }));
      send.mutate({ threadId: id, body }, { onError: () => setDraft(body) });
      if (!threadId) await threads.refetch();
    } catch {
      setDraft(body);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <InvestorScreenHeader
        title="Messages"
        subtitle="Every person on the Hanguk team is one message away."
      />

      <div className="grid min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[330px_1fr]">
        {/* ------------------------------------------------------- left pane */}
        <InvestorCard className="flex flex-col overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the team"
                className="h-11 min-h-[44px] rounded-md border-0 bg-muted pl-9 text-[13px]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {staff.isLoading ? (
              <EmptyNote>Loading the team…</EmptyNote>
            ) : people.length === 0 ? (
              <EmptyNote>No one matches that search.</EmptyNote>
            ) : (
              people.map((p) => {
                const isSelected = p.user_id === selectedStaffId;
                return (
                  <button
                    key={p.user_id}
                    type="button"
                    onClick={() => setSelectedStaffId(p.user_id)}
                    className={`flex w-full items-start gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-l-primary bg-tint-blue'
                        : 'border-l-transparent hover:bg-muted'
                    }`}
                  >
                    <InitialsAvatar name={p.full_name} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-foreground">
                          {p.full_name}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {p.thread?.preview_at ? shortTime(p.thread.preview_at) : ''}
                        </span>
                      </div>
                      <div
                        className={`truncate text-[11px] font-medium ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {humanizeLineItem(p.role)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                          {p.thread?.preview ?? 'No messages yet'}
                        </span>
                        {(p.thread?.unread ?? 0) > 0 && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-pill bg-accent"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </InvestorCard>

        {/* ------------------------------------------------------ right pane */}
        <InvestorCard className="flex min-h-[520px] flex-col overflow-hidden">
          {!selected ? (
            <EmptyNote className="my-auto">
              Choose someone on the left to start a conversation.
            </EmptyNote>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <InitialsAvatar name={selected.full_name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-foreground">
                    {selected.full_name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span
                      className={`h-1.5 w-1.5 rounded-pill ${
                        selected.presence_status === 'online' ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                    {humanizeLineItem(selected.role)}
                  </div>
                </div>
                <StatusPill tone="neutral">Direct message</StatusPill>
              </div>

              <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto bg-background px-6 py-5">
                {(messages.data ?? []).length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-muted-foreground">
                    No messages yet. Anything you send here goes straight to {selected.full_name}.
                  </p>
                ) : (
                  groupByDay(messages.data ?? []).map((group) => (
                    <div key={group.label} className="space-y-4">
                      <div className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        {group.label}
                      </div>
                      {group.messages.map((m) => (
                        <Bubble
                          key={m.id}
                          message={m}
                          mine={m.sender_user_id === user?.id}
                          senderName={selected.full_name}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-border p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={`Message ${selected.full_name}…`}
                  className="h-11 min-h-[44px] flex-1 rounded-md text-[14px]"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || send.isPending || openThread.isPending}
                  className="inline-flex h-11 min-h-[44px] items-center gap-2 rounded-md bg-accent px-4 text-[14px] font-bold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </>
          )}
        </InvestorCard>
      </div>
    </div>
  );
}

function Bubble({
  message,
  mine,
  senderName,
}: {
  message: InvestorMessageRow;
  mine: boolean;
  senderName: string;
}) {
  const pending = message.id.startsWith('pending-');
  return (
    <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <InitialsAvatar name={senderName} size={30} />}
      <div className={`max-w-[74%] ${mine ? 'text-right' : 'text-left'}`}>
        <div
          className={`inline-block px-3.5 py-2.5 text-[13px] leading-relaxed ${
            mine
              ? 'rounded-[14px] rounded-br-[4px] bg-primary text-primary-foreground'
              : 'rounded-[14px] rounded-bl-[4px] border border-border bg-card text-foreground'
          } ${pending ? 'opacity-60' : ''}`}
        >
          {message.body}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {pending
            ? 'Sending…'
            : [shortTime(message.created_at), mine && message.read_at ? 'Read' : null]
                .filter(Boolean)
                .join(' · ')}
        </div>
      </div>
    </div>
  );
}

function groupByDay(messages: InvestorMessageRow[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const groups: { label: string; messages: InvestorMessageRow[] }[] = [];

  for (const m of messages) {
    const day = new Date(m.created_at).toDateString();
    const label =
      day === today
        ? 'Today'
        : day === yesterday
          ? 'Yesterday'
          : new Date(m.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
            });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(m);
    else groups.push({ label, messages: [m] });
  }
  return groups;
}
