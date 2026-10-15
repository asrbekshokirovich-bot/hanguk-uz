/**
 * The lead card (spec §6): the right-hand pane of the desk, the same in every
 * list. Self-fetching and scrollable; nothing hides behind tabs, long blocks
 * collapse. Top to bottom: header and actions · AI summary · Aloqa · 5
 * mandatory fields · Malaka va taklif · allowed offer and promises · Manba ·
 * drafts · timeline · composer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useStaffMentions } from '@/hooks/useStaffMentions';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { claimLead, handleDraft, pinLead, reopenLead } from '../api';
import { explainError } from '../copy';
import { useLeadSettings } from '../useLeadSettings';
import type { LeadDraft, LeadV2 } from '../types';
import { AiBrief } from './AiBrief';
import { CallDialog } from './CallDialog';
import { CardHeader } from './CardHeader';
import { ContactBlock } from './ContactBlock';
import { DraftsBlock } from './DraftsBlock';
import { Composer, type ComposerHandle } from './Composer';
import { LoseDialog } from './LoseDialog';
import { MandatoryBlock } from './MandatoryBlock';
import { OfferBlock } from './OfferBlock';
import { PromiseDialog } from './PromiseDialog';
import { QualificationBlock } from './QualificationBlock';
import { SourceBlock } from './SourceBlock';
import { SuggestionsBlock } from './SuggestionsBlock';
import { Timeline } from './Timeline';
import { WaitDialog } from './WaitDialog';
import {
  deriveChatChannels,
  findTemplate,
  fillTemplate,
  hasApprovedPromise,
  templateText,
  type ChatSource,
} from './cardLogic';
import { copyToClipboard, isDialable, openTel } from './phone';
import {
  TIMELINE_MAX,
  TIMELINE_PAGE,
  useCardRealtime,
  useChatIdentities,
  useDrafts,
  usePromises,
  useTimeline,
} from './useCardData';
import { invalidateLead, useLead, useLeadWriter } from './useLead';

export interface LeadCardProps {
  leadId: string;
  onClose?: () => void;
  /** open the call dialog as soon as the lead has loaded */
  startCall?: boolean;
  className?: string;
}

/**
 * Keyed by the lead: switching to another lead must not carry the composer's
 * text, open dialogs or half-typed fields over to it (a message written for
 * one person must never go out to the next).
 */
export default function LeadCard(props: LeadCardProps) {
  return <LeadCardBody key={props.leadId} {...props} />;
}

function LeadCardBody({ leadId, onClose, startCall, className }: LeadCardProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isLeadSenior } = useUserRole();
  const { staffList } = useStaffMentions();
  const { settings } = useLeadSettings();
  const { lead, loading, error, refetch } = useLead(leadId);
  const { saveField } = useLeadWriter(leadId);

  const [limit, setLimit] = useState(TIMELINE_PAGE);
  const timeline = useTimeline(leadId, limit);
  const drafts = useDrafts(leadId);
  const promises = usePromises(leadId);
  const identities = useChatIdentities(leadId);

  const composerRef = useRef<ComposerHandle>(null);
  const editingDraft = useRef<string | null>(null);
  const callStarted = useRef(false);

  const [callOpen, setCallOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [loseOpen, setLoseOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const chat = useMemo(() => (lead ? deriveChatChannels(lead, identities.data ?? []) : []), [lead, identities.data]);
  useCardRealtime(leadId, chat.map((c) => c.senderId));

  const nameOf = useCallback(
    (id: string | null | undefined): string | null =>
      id ? (staffList.find((s) => s.user_id === id)?.full_name ?? null) : null,
    [staffList],
  );
  const lostLabel = useCallback(
    (reason: string | null | undefined) => settings.lost_reasons.find((r) => r.key === reason)?.label ?? reason ?? '',
    [settings.lost_reasons],
  );

  // ---- actions -------------------------------------------------------------------------

  const beginCall = useCallback(() => {
    if (!lead || !isDialable(lead.phone)) {
      toast.error("Telefon raqami yo'q");
      return;
    }
    const phone = lead.phone as string;
    // spec §7 phase 1: show / copy the number, hand a tel: link to the phone app, open the result popup
    void copyToClipboard(phone).then((ok) => {
      if (ok) toast.success('Raqam nusxalandi');
    });
    openTel(phone);
    setCallOpen(true);
  }, [lead]);

  useEffect(() => {
    if (!startCall) {
      callStarted.current = false;
      return;
    }
    if (lead && !callStarted.current) {
      callStarted.current = true;
      beginCall();
    }
  }, [startCall, lead, beginCall]);
  useEffect(() => {
    callStarted.current = false;
  }, [leadId]);

  const runAction = useCallback(
    async (job: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await job();
        if (success) toast.success(success);
        invalidateLead(qc, leadId, ['drafts']);
      } catch (e) {
        toast.error(explainError(e instanceof Error ? e.message : String(e)));
      } finally {
        setBusy(false);
      }
    },
    [qc, leadId],
  );

  /**
   * A new phone number may be one the database already knows: it then merges
   * this card into the older one (spec §5). Look again after the save; if this
   * card was merged away, say so and hand the screen back (the desk shows the
   * surviving card).
   */
  const savePhone = useCallback(
    async (patch: { phone: string | null }): Promise<boolean> => {
      const ok = await saveField(patch);
      if (!ok) return false;
      const fresh = await refetch();
      if ((fresh as { data?: LeadV2 | null } | undefined)?.data?.merged_into_id) {
        toast.info('Bu raqam boshqa kartada ham bor — kartalar birlashtirildi');
        invalidateLead(qc, leadId);
        onClose?.();
      }
      return true;
    },
    [saveField, refetch, qc, leadId, onClose],
  );

  /** "Chatga yozish": the composer opens with the template for the lead's language. */
  const writeChat = useCallback(
    (templateKey: string) => {
      const tpl = findTemplate(settings.templates, templateKey);
      if (!lead || !tpl) {
        composerRef.current?.focus();
        return;
      }
      const body = fillTemplate(templateText(tpl, lead.language === 'ru' ? 'ru' : 'uz'), {
        lead,
        offers: settings.offers,
        hanboxDate: settings.hanbox_group_date,
        operatorName: nameOf(user?.id),
        templateKey,
      });
      composerRef.current?.prefill(body);
      // the dialog hands focus back to the button that opened it as it closes
      window.setTimeout(() => composerRef.current?.focus(), 350);
    },
    [lead, nameOf, settings.hanbox_group_date, settings.offers, settings.templates, user?.id],
  );

  const sendDraft = async (d: LeadDraft): Promise<boolean> => {
    const sent = await composerRef.current?.send(d.text, (d.channel as ChatSource | null) ?? undefined);
    if (!sent) return false;
    try {
      await handleDraft(d.id, 'sent', user?.id ?? null);
    } catch (e) {
      toast.error(explainError(e instanceof Error ? e.message : String(e)));
    }
    void qc.invalidateQueries({ queryKey: ['lead-v2', 'drafts', leadId] });
    return true;
  };

  const editDraft = (d: LeadDraft) => {
    editingDraft.current = d.id;
    composerRef.current?.prefill(d.text, (d.channel as ChatSource | null) ?? undefined);
  };

  const skipDraft = async (d: LeadDraft) => {
    try {
      await handleDraft(d.id, 'skipped', user?.id ?? null);
      if (editingDraft.current === d.id) editingDraft.current = null;
      void qc.invalidateQueries({ queryKey: ['lead-v2', 'drafts', leadId] });
      void qc.invalidateQueries({ queryKey: ['lead-v2', 'desk'] });
    } catch (e) {
      toast.error(explainError(e instanceof Error ? e.message : String(e)));
    }
  };

  /** What the operator wrote in the box after "Tahrir": that draft is done. */
  const onComposerSent = () => {
    const id = editingDraft.current;
    if (!id) return;
    editingDraft.current = null;
    void handleDraft(id, 'sent', user?.id ?? null)
      .then(() => qc.invalidateQueries({ queryKey: ['lead-v2', 'drafts', leadId] }))
      .catch(() => undefined);
  };

  // ---- states --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className={cn('flex h-full flex-col gap-3 overflow-hidden p-4', className)} aria-busy="true" aria-label="Lid yuklanmoqda">
        {[28, 16, 64, 96, 120].map((h) => (
          <div key={h} className="animate-pulse rounded-lg bg-muted" style={{ height: h }} />
        ))}
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-3 p-6 text-center', className)}>
        <p className="text-[14px] font-semibold">{error ? 'Lidni yuklab bo‘lmadi' : 'Lid topilmadi yoki unga ruxsat yo‘q'}</p>
        {error && <p className="max-w-xs text-[12px] text-muted-foreground">{explainError(error)}</p>}
        <div className="flex gap-2">
          {error && (
            <Button size="sm" className="min-h-0" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="outline" className="min-h-0" onClick={onClose}>
              Yopish
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- derived (no hooks below this line) ---------------------------------------------
  const userId = user?.id ?? null;
  const entries = timeline.data ?? [];
  const now = Date.now();
  const merged = !!lead.merged_into_id;
  const isStudent = lead.stage === 'student' || !!lead.converted_to_student_id || !!lead.matched_student_id;
  const owner = lead.owner_id;
  const ownedByOther = !!owner && owner !== userId;
  const breached =
    !!lead.due_at && Date.parse(lead.due_at) <= now && (!lead.timer_start_at || Date.parse(lead.timer_start_at) <= now);
  const ownerName = nameOf(owner);
  // an operator may not act on a lead somebody else holds, unless its 10 minutes are gone ("Olish")
  const readOnly = isStudent || merged || (ownedByOther && !breached && !isLeadSenior);
  const canClaim = !isStudent && !merged && lead.stage !== 'lost' && (!owner || (ownedByOther && (breached || isLeadSenior)));

  let banner: string | null = null;
  if (merged) banner = 'Bu karta boshqa kartaga birlashtirilgan';
  else if (isStudent) banner = 'Bu mijoz talaba, lid yopilgan';
  else if (ownedByOther && !breached && !isLeadSenior) banner = `Bu lid ${ownerName ?? 'boshqa operator'}da`;
  else if (ownedByOther && breached) banner = `Bu lid ${ownerName ?? 'boshqa operator'}da, lekin 10 daqiqa buzildi`;

  // a phone lead nobody has tried to call yet (spec §1.4: a chat message does not stop its timer)
  const neverCalled = !!lead.phone && !lead.answered_at && !lead.last_attempt_at;
  const lastIncoming = entries.find((e) => e.kind === 'message_in')?.channel ?? null;

  return (
    <div data-testid="lead-card" className={cn('flex h-full min-h-0 flex-col overflow-y-auto bg-background', className)}>
      <CardHeader
        lead={lead}
        chat={chat}
        ownerName={ownerName}
        isLeadSenior={isLeadSenior}
        readOnly={readOnly}
        banner={banner}
        canClaim={canClaim}
        isStudent={isStudent}
        busy={busy}
        onClose={onClose}
        onCall={beginCall}
        onWrite={() => composerRef.current?.focus()}
        onWait={() => setWaitOpen(true)}
        onLose={() => setLoseOpen(true)}
        onConvert={() => setConvertOpen(true)}
        onReopen={() => void runAction(() => reopenLead(lead.id), 'Lid qayta ochildi')}
        onClaim={() => void runAction(() => claimLead(lead.id), 'Lid sizga biriktirildi')}
        onPin={() => void runAction(() => pinLead(lead.id, !lead.pinned_at))}
      />

      <div className="space-y-2.5 p-3">
        <AiBrief lead={lead} />
        <ContactBlock lead={lead} disabled={readOnly} saveField={saveField} savePhone={savePhone} />
        <MandatoryBlock lead={lead} disabled={readOnly} saveField={saveField} />
        <SuggestionsBlock lead={lead} disabled={readOnly} />
        <QualificationBlock lead={lead} disabled={readOnly} saveField={saveField} />
        <OfferBlock lead={lead} disabled={readOnly} saveField={saveField} onRequestPromise={() => setPromiseOpen(true)} />
        <SourceBlock lead={lead} disabled={readOnly} />
        <DraftsBlock
          drafts={drafts.data ?? []}
          forbiddenWords={settings.forbidden_words}
          hasApproved={hasApprovedPromise(promises.data)}
          disabled={readOnly}
          onSend={sendDraft}
          onEdit={editDraft}
          onSkip={skipDraft}
        />
        <Timeline
          entries={entries}
          loading={timeline.isLoading}
          canLoadOlder={entries.length >= limit && limit < TIMELINE_MAX}
          loadingOlder={timeline.isFetching && timeline.isPlaceholderData}
          onLoadOlder={() => setLimit((n) => Math.min(n + 200, TIMELINE_MAX))}
          lostLabel={lostLabel}
          nameOf={nameOf}
        />
      </div>

      <div className="sticky bottom-0 z-10 mt-auto">
        <Composer
          ref={composerRef}
          lead={lead}
          channels={chat}
          lastIncomingChannel={lastIncoming}
          settings={settings}
          promises={promises.data ?? []}
          neverCalled={neverCalled}
          operatorName={nameOf(userId)}
          disabled={readOnly}
          onNeedPromise={() => setPromiseOpen(true)}
          onSent={onComposerSent}
        />
      </div>

      <CallDialog lead={lead} open={callOpen} onOpenChange={setCallOpen} onWriteChat={writeChat} />
      <WaitDialog leadId={lead.id} open={waitOpen} onOpenChange={setWaitOpen} />
      <LoseDialog leadId={lead.id} open={loseOpen} onOpenChange={setLoseOpen} />
      <PromiseDialog leadId={lead.id} open={promiseOpen} onOpenChange={setPromiseOpen} />
      {convertOpen && <ConvertDialog lead={lead} onClose={() => setConvertOpen(false)} />}
    </div>
  );
}
/**
 * "Talaba": the existing conversion (`convertToStudent` from the leads
 * context: creates the student account and sets the lead's status to
 * 'converted', which the database trigger turns into stage 'student'), behind
 * the same kind of confirmation the old Lidlar page asks.
 */
function ConvertDialog({ lead, onClose }: { lead: LeadV2; onClose: () => void }) {
  const qc = useQueryClient();
  const { leads, loading, convertToStudent } = useLeads();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    // the leads context converts from ITS list (qualified leads of the active intake)
    const known = leads.some((l) => l.id === lead.id);
    setBusy(true);
    try {
      const { success, magicCode } = await convertToStudent(lead.id);
      if (success) {
        toast.success('Talabaga aylantirildi', {
          description: magicCode ? `Kirish kodi: ${magicCode}` : undefined,
          duration: 15_000,
        });
        invalidateLead(qc, lead.id);
        onClose();
      } else if (!known && !loading) {
        toast.error('Talabaga aylantirib bo‘lmadi: bu lid eski Lidlar ro‘yxatida topilmadi (telefon yo‘q yoki boshqa mavsum).');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{lead.full_name} talabaga aylantirilsinmi?</AlertDialogTitle>
          <AlertDialogDescription>
            Talaba hisobi yaratiladi va kirish kodi beriladi; lid «Talaba» bosqichiga o‘tadi va rahbarga xabar ketadi. Bu amalni qaytarib bo‘lmaydi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            {busy ? 'Aylantirilmoqda…' : 'Aylantirish'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

