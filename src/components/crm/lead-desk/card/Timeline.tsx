/**
 * Block 9 "Vaqt chizig'i" (spec §6): every channel in one stream — messages in
 * and out, call results, system lines (stage changes, Kutish, Yo'qotildi,
 * promises, merges, claims, escalations), Instagram comments and internal
 * notes. Newest at the bottom; opens scrolled to the end.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Clock, MessageCircle, Phone, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clock, dayKey, whenLabel } from '../time';
import type { TimelineEntry } from '../types';
import {
  callResultLabel,
  channelName,
  channelsPresent,
  describeEvent,
  entryChannel,
  filterByChannel,
  isInternalNote,
  mediaLabel,
  type EventContext,
} from './timelineLogic';
import { Chip, Pill, Section } from './ui';

interface TimelineProps extends EventContext {
  /** `lead_timeline_v2` rows, newest first */
  entries: TimelineEntry[];
  loading: boolean;
  /** the server may hold older rows */
  canLoadOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

const RESULT_TONE: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  talked: 'success',
  no_answer: 'warning',
  busy: 'info',
  wrong_number: 'danger',
};

const dayLabel = (iso: string) => whenLabel(iso).replace(/ \d\d:\d\d$/, '');

function Delivery({ status }: { status: unknown }) {
  if (status === 'sending') {
    return <Clock className="h-3 w-3" aria-label="Yuborilmoqda" />;
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        yuborilmadi
      </span>
    );
  }
  return <Check className="h-3 w-3 text-primary" aria-label="Yuborildi" />;
}

function MessageRow({ e, nameOf }: { e: TimelineEntry; nameOf: EventContext['nameOf'] }) {
  const incoming = e.kind === 'message_in';
  const who = incoming ? null : nameOf(e.actor_id);

  if (isInternalNote(e)) {
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-[92%] rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5">
          <p className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-warning">
            <StickyNote className="h-3 w-3" aria-hidden="true" />
            Ichki izoh
            <span className="font-medium normal-case tracking-normal text-muted-foreground">
              {[who, clock(e.at)].filter(Boolean).join(' · ')}
            </span>
          </p>
          <p className="whitespace-pre-wrap break-words text-[12.5px]">{e.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', incoming ? 'justify-start' : 'justify-end')}>
      <div className="max-w-[82%] min-w-0">
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed',
            incoming ? 'border-border bg-muted/50' : 'border-primary/25 bg-primary/5',
            e.meta?.delivery_status === 'failed' && 'border-destructive/50',
          )}
        >
          {e.body ? (
            <p className="whitespace-pre-wrap break-words">{e.body}</p>
          ) : (
            <p className="italic text-muted-foreground">{mediaLabel(e.meta?.message_type)}</p>
          )}
        </div>
        <div className={cn('mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground', incoming ? 'justify-start' : 'justify-end')}>
          <Pill tone="info" className="px-1.5 py-0 text-[10px]">
            {channelName(e.channel)}
          </Pill>
          {who && <span>{who}</span>}
          <span>{clock(e.at)}</span>
          {!incoming && <Delivery status={e.meta?.delivery_status} />}
        </div>
      </div>
    </div>
  );
}

function CallRow({ e, nameOf }: { e: TimelineEntry; nameOf: EventContext['nameOf'] }) {
  const result = String(e.meta?.result ?? '');
  const attempt = e.meta?.attempt_no;
  const duration = Number(e.meta?.duration);
  const who = nameOf(e.actor_id);
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[92%] rounded-md border border-border bg-card px-3 py-1.5 text-[12px]">
        <p className="flex flex-wrap items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <strong>Qo'ng'iroq</strong>
          <Pill tone={RESULT_TONE[result] ?? 'neutral'}>{callResultLabel(result)}</Pill>
          {attempt != null && <span className="text-muted-foreground">{String(attempt)}-urinish</span>}
          {Number.isFinite(duration) && duration > 0 && (
            <span className="text-muted-foreground">
              {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
            </span>
          )}
          <span className="ml-auto text-[10.5px] text-muted-foreground">{[who, clock(e.at)].filter(Boolean).join(' · ')}</span>
        </p>
        {e.body && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-foreground/80">{e.body}</p>}
      </div>
    </div>
  );
}

function CommentRow({ e }: { e: TimelineEntry }) {
  const reply = e.meta?.reply ? String(e.meta.reply) : null;
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px]">
        <p className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <MessageCircle className="h-3 w-3" aria-hidden="true" />
          Izoh{e.meta?.post ? ` · ${String(e.meta.post)}` : ''}
          <span className="font-medium normal-case tracking-normal">{clock(e.at)}</span>
        </p>
        <p className="whitespace-pre-wrap break-words">{e.body}</p>
        {reply ? (
          <p className="mt-1 text-[11.5px] text-muted-foreground">Javob: {reply}</p>
        ) : e.meta?.replied_at ? (
          <p className="mt-1 text-[11.5px] text-muted-foreground">Javob berildi</p>
        ) : null}
      </div>
    </div>
  );
}

export function Timeline({ entries, loading, canLoadOlder, loadingOlder, onLoadOlder, lostLabel, nameOf }: TimelineProps) {
  const [filter, setFilter] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const heightBeforeOlder = useRef<number | null>(null);
  // the block can be collapsed and reopened: open at the newest each time it appears
  const mountScroll = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const channels = useMemo(() => channelsPresent(entries), [entries]);
  const chrono = useMemo(() => [...filterByChannel(entries, filter)].reverse(), [entries, filter]);
  const newest = chrono.length ? chrono[chrono.length - 1].at : '';

  // open at the newest; keep the place when older rows are prepended
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (heightBeforeOlder.current != null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chrono.length, newest, filter]);

  const countOf = (c: string) => entries.filter((e) => entryChannel(e) === c).length;

  let lastDay = '';
  return (
    <Section title="Vaqt chizig'i" right={<span className="text-[11px] text-muted-foreground">{entries.length} ta</span>}>
      {channels.length > 0 && (
        <div role="group" aria-label="Kanal filtri" className="mb-2 flex flex-wrap gap-1.5">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
            Hammasi
          </Chip>
          {channels.map((c) => (
            <Chip key={c} selected={filter === c} onClick={() => setFilter(c)}>
              {channelName(c)} <span className="opacity-70">{countOf(c)}</span>
            </Chip>
          ))}
        </div>
      )}

      <div
        ref={mountScroll}
        data-testid="timeline-scroll"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="max-h-[420px] min-h-[96px] space-y-2 overflow-y-auto pr-1"
      >
        {canLoadOlder && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={() => {
                heightBeforeOlder.current = scrollRef.current?.scrollHeight ?? null;
                stick.current = false;
                onLoadOlder();
              }}
              className="min-h-0 min-w-0 rounded-full border border-border px-3 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
            >
              {loadingOlder ? 'Yuklanmoqda…' : 'Eskilarini yuklash'}
            </button>
          </div>
        )}

        {loading && entries.length === 0 && <p className="text-[12px] text-muted-foreground">Yuklanmoqda…</p>}
        {!loading && chrono.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-muted-foreground">Hali yozuv yo'q</p>
        )}

        {chrono.map((e, i) => {
          const day = dayKey(e.at);
          const newDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={`${e.at}-${e.kind}-${i}`} className="space-y-2">
              {newDay && (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{dayLabel(e.at)}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              {e.kind === 'message_in' || e.kind === 'message_out' ? (
                <MessageRow e={e} nameOf={nameOf} />
              ) : e.kind === 'call' ? (
                <CallRow e={e} nameOf={nameOf} />
              ) : e.kind === 'comment' ? (
                <CommentRow e={e} />
              ) : (
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                  <span>{describeEvent(e, { lostLabel, nameOf })}</span>
                  <span className="opacity-70">{clock(e.at)}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
