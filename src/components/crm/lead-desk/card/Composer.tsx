/**
 * Block 10: the write box under the timeline (spec §6, §10, §11).
 *
 * It sends through the same path the Xabarlar page uses —
 * `useMessages().sendMessage(text, source, senderId)`, which inserts the
 * message row and relays it with the `send-telegram` / `send-instagram` edge
 * functions — so there is no second sending path. What it adds is the guard:
 * a forbidden word is underlined in red and sending stops; a "% chegirma"
 * phrase stops until the lead has an approved promise.
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Phone, Send, ShieldAlert, StickyNote, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { channelLabel } from '../copy';
import type { LeadPromise, LeadSettings, LeadV2 } from '../types';
import {
  GUARD_OK,
  evaluateGuard,
  fillTemplate,
  forbiddenRanges,
  hasApprovedPromise,
  pickDefaultChannel,
  templateText,
  type ChatChannel,
  type ChatSource,
  type TextRange,
} from './cardLogic';
import { Chip, ChipGroup, Pill } from './ui';
import { invalidateLead } from './useLead';

export interface ComposerHandle {
  /** put the caret in the box and bring it into view */
  focus: () => void;
  /** replace the text (a template, a draft being edited) */
  prefill: (text: string, source?: ChatSource) => void;
  /** send this text now (a draft's "Yuborish"); resolves true when it went out */
  send: (text: string, source?: ChatSource) => Promise<boolean>;
}

interface ComposerProps {
  lead: LeadV2;
  channels: ChatChannel[];
  /** the channel the client wrote on last */
  lastIncomingChannel: string | null;
  settings: LeadSettings;
  promises: LeadPromise[];
  /** a lead with a phone that was never called (spec §1.4: chat does not stop the timer) */
  neverCalled: boolean;
  operatorName: string | null;
  disabled?: boolean;
  onNeedPromise: () => void;
  onSent?: (info: { text: string; source: ChatSource }) => void;
}

const TEMPLATE_GROUP_LABEL: Record<string, string> = {
  salom: 'Salom',
  narx: 'Narx / tariflar',
  qongiroq: "Qo'ng'iroq qildik",
  raqam: 'Raqamni tasdiqlang',
  kutish: 'Kutish eslatmasi',
  hanbox: 'Hanbox',
  no_risk: 'NO RISK',
  kuzatuv: 'Kuzatuv',
  qayta: 'Qayta faollashtirish',
  izoh: 'Izohga javob',
};

const groupLabel = (g: string) => TEMPLATE_GROUP_LABEL[g] ?? g;
const channelKey = (c: ChatChannel) => `${c.source}:${c.senderId}`;

/** An internal note is stored on the conversation but never relayed (same write as the Xabarlar page). */
async function insertInternalNote(via: ChatChannel, content: string, userId: string | null): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (t: string) => any };
  const { error } = await db.from('messages').insert({
    source: via.source,
    sender_id: via.senderId,
    content,
    direction: 'outgoing',
    message_type: 'note',
    status: 'read',
    metadata: { internal: true },
    replied_by: userId,
    replied_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** The text with the offending parts wrapped in <mark>, drawn behind the textarea. */
function Highlighted({ text, ranges }: { text: string; ranges: TextRange[] }) {
  const parts: ReactNode[] = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start > pos) parts.push(text.slice(pos, r.start));
    parts.push(
      <mark
        key={i}
        className="rounded-sm bg-destructive/20 text-transparent underline decoration-destructive decoration-wavy decoration-2 underline-offset-2"
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  // a trailing newline would collapse; keep the heights of box and mirror equal
  return <>{parts}{'\n'}</>;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { lead, channels, lastIncomingChannel, settings, promises, neverCalled, operatorName, disabled, onNeedPromise, onSent },
  ref,
) {
  const { sendMessage } = useMessages();
  const { user } = useAuth();
  const qc = useQueryClient();

  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState('');
  const [note, setNote] = useState(false);
  const [lang, setLang] = useState<'uz' | 'ru'>(lead.language === 'ru' ? 'ru' : 'uz');
  const [picked, setPicked] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [group, setGroup] = useState<string>('all');
  const [sending, setSending] = useState(false);

  const channel =
    channels.find((c) => channelKey(c) === picked) ?? pickDefaultChannel(channels, lastIncomingChannel, lead.preferred_channel);
  const approved = hasApprovedPromise(promises);
  const guard = note ? GUARD_OK : evaluateGuard(text, settings.forbidden_words, approved);
  const ranges = useMemo(
    () => (note ? [] : forbiddenRanges(text, settings.forbidden_words, !approved)),
    [note, text, settings.forbidden_words, approved],
  );

  const deliver = useCallback(
    async (body: string, via: ChatChannel | null, asNote: boolean, notify = true): Promise<boolean> => {
      const content = body.trim();
      if (!content || !via) return false;
      if (asNote) {
        try {
          await insertInternalNote(via, content, user?.id ?? null);
          invalidateLead(qc, lead.id);
          return true;
        } catch (e) {
          toast.error(e instanceof Error ? e.message || 'Izoh saqlanmadi' : 'Izoh saqlanmadi');
          return false;
        }
      }
      const g = evaluateGuard(content, settings.forbidden_words, approved);
      if (!g.ok) {
        toast.error(g.reason ?? 'Xabar yuborilmaydi');
        return false;
      }
      setSending(true);
      try {
        const { error, queued } = await sendMessage(content, via.source, via.senderId);
        if (error && !queued) {
          toast.error(error.message || 'Xabar yuborilmadi');
          return false;
        }
        // queued but not delivered: the row stays in the timeline marked "yuborilmadi"
        if (error) toast.error(error.message || 'Xabar yetkazilmadi');
        invalidateLead(qc, lead.id, ['drafts']);
        // only what was written in the box tells the card a draft may be done;
        // `send()` (a draft's own button) reports through its return value
        if (notify) onSent?.({ text: content, source: via.source });
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message || 'Xabar yuborilmadi' : 'Xabar yuborilmadi');
        return false;
      } finally {
        setSending(false);
      }
    },
    [approved, lead.id, onSent, qc, sendMessage, settings.forbidden_words, user?.id],
  );

  const reveal = () => {
    window.requestAnimationFrame?.(() => {
      areaRef.current?.focus();
      rootRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
    areaRef.current?.focus();
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: reveal,
      prefill: (t, source) => {
        setNote(false);
        setText(t);
        if (source) {
          const c = channels.find((x) => x.source === source);
          if (c) setPicked(channelKey(c));
        }
        reveal();
      },
      send: (t, source) => deliver(t, (source && channels.find((c) => c.source === source)) || channel, false, false),
    }),
    [channels, channel, deliver],
  );

  const canSend = !disabled && !sending && !!channel && text.trim() !== '' && guard.ok;

  const submit = async () => {
    if (!canSend) return;
    const ok = await deliver(text, channel, note);
    if (ok) setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const templates = settings.templates ?? [];
  const groups = [...new Set(templates.map((t) => t.group))];
  const shown = group === 'all' ? templates : templates.filter((t) => t.group === group);
  const fill = (t: (typeof templates)[number]) =>
    fillTemplate(templateText(t, lang), {
      lead,
      offers: settings.offers,
      hanboxDate: settings.hanbox_group_date,
      operatorName,
      templateKey: t.key,
    });

  return (
    <div ref={rootRef} id="lead-composer" className="space-y-2 border-t border-border bg-card px-3 py-2.5">
      {neverCalled && !settings.chat_answers_phone_leads && (
        <p role="note" className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-[12px] font-medium text-warning">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Avval qo'ng'iroq qiling — chat javobi taymerni to'xtatmaydi
        </p>
      )}

      {channels.length === 0 ? (
        <p className="py-2 text-center text-[12.5px] text-muted-foreground">Bu lidda chat kanali yo'q</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="Kanal" className="flex flex-wrap items-center gap-1.5">
              {channels.map((c) => (
                <Chip key={channelKey(c)} selected={!!channel && channelKey(channel) === channelKey(c)} onClick={() => setPicked(channelKey(c))}>
                  {[channelLabel(c.source), c.label].filter(Boolean).join(' ')}
                </Chip>
              ))}
            </div>
            <Chip selected={note} onClick={() => setNote((v) => !v)} title="Mijozga yuborilmaydi">
              <StickyNote className="h-3 w-3" aria-hidden="true" />
              Ichki izoh
            </Chip>
            <Chip selected={tplOpen} onClick={() => setTplOpen((v) => !v)}>
              <Zap className="h-3 w-3" aria-hidden="true" />
              Shablon
            </Chip>
            <ChipGroup<'uz' | 'ru'>
              label="Shablon tili"
              options={[
                { value: 'uz', label: 'UZ' },
                { value: 'ru', label: 'RU' },
              ]}
              value={lang}
              onChange={(v) => v && setLang(v)}
              className="ml-auto"
            />
          </div>

          {tplOpen && (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-2">
              <div role="group" aria-label="Shablon guruhi" className="flex flex-wrap gap-1.5">
                <Chip selected={group === 'all'} onClick={() => setGroup('all')}>
                  Hammasi
                </Chip>
                {groups.map((g) => (
                  <Chip key={g} selected={group === g} onClick={() => setGroup(g)}>
                    {groupLabel(g)}
                  </Chip>
                ))}
              </div>
              {shown.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Shablon yo'q (Sozlamalarda qo'shiladi)</p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {shown.map((t) => {
                    const body = fill(t);
                    return (
                      <li key={t.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${body}` : body));
                            setNote(false);
                            setTplOpen(false);
                            reveal();
                          }}
                          className="w-full min-h-0 min-w-0 rounded-md border border-border bg-card px-2.5 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                            {groupLabel(t.group)}
                            {t.needs_boss && <Pill tone="warning">Rahbar tasdig'i bilan</Pill>}
                          </span>
                          <span className="line-clamp-2 text-[12px] text-muted-foreground">{body}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className={cn('relative rounded-md bg-background', note && 'ring-1 ring-warning')}>
            <div
              ref={mirrorRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-2.5 py-1.5 text-[13px] leading-[1.5] text-transparent"
            >
              <Highlighted text={text} ranges={ranges} />
            </div>
            <textarea
              ref={areaRef}
              rows={2}
              aria-label={note ? 'Ichki izoh' : 'Xabar'}
              aria-invalid={!guard.ok}
              placeholder={note ? 'Ichki izoh (mijozga yuborilmaydi)…' : 'Xabar yozing…  (Enter — yuborish, Shift+Enter — yangi qator)'}
              value={text}
              disabled={disabled}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={(e) => {
                if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              className={cn(
                'relative z-10 block w-full resize-none rounded-md border bg-transparent px-2.5 py-1.5 text-[13px] leading-[1.5] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                !guard.ok ? 'border-destructive' : 'border-input',
              )}
            />
          </div>

          {!guard.ok && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-destructive">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{guard.reason}</span>
              {guard.kind === 'discount' && (
                <Button variant="outline" size="sm" className="h-7 min-h-0 px-2.5" onClick={onNeedPromise}>
                  Chegirma / maxsus shart so'rash
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {note && <span className="mr-auto text-[11.5px] text-warning">Ichki izoh — mijozga yuborilmaydi</span>}
            <Button size="sm" className="h-9 min-h-0" onClick={() => void submit()} disabled={!canSend}>
              <Send aria-hidden="true" />
              {note ? 'Izohni saqlash' : 'Yuborish'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
});
