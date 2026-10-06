/**
 * The call-result popup (spec §7, phase 1: the call is made by hand).
 *
 * Opened by "Qo'ng'iroq". It cannot be dismissed — no Escape, no click outside,
 * no X — until a result is saved; the one way out is "Bekor qilish (qo'ng'iroq
 * qilinmadi)", which asks first and writes nothing. Step 1 is four big buttons;
 * step 2 is the short form for the chosen result, built from the same pickers
 * the card uses. The payload is `RecordCallPayload` (types.ts) and the server's
 * `missing_fields:` answer is shown on the fields it names.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Clock, Copy, MessageSquare, Phone, PhoneMissed, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { recordCall } from '../api';
import { CALL_RESULT_LABEL, explainError, missingFieldsFrom } from '../copy';
import { useLeadSettings } from '../useLeadSettings';
import { fromLocalInput, quickCallbackTimes, whenLabel, clock } from '../time';
import type { CallResult, LeadV2, RecordCallResult } from '../types';
import {
  CALL_STAGE_OPTIONS,
  NO_COMPETITOR,
  buildCallPayload,
  busyProblems,
  initialTalkedForm,
  missingMandatory,
  problemSentence,
  recommendedOfferKeys,
  stageOptionDisabled,
  talkedProblems,
  type CallStage,
  type NextActionMode,
  type TalkedForm,
} from './cardLogic';
import { DialogBody, DialogFoot, DialogFrame } from './DialogFrame';
import {
  CompetitorPicker,
  LostFields,
  MandatoryFieldsEditor,
  ObjectionPicker,
  ProductFitPicker,
  ReferralPicker,
  WaitFields,
} from './fields';
import { copyToClipboard, isDialable, telHref } from './phone';
import { Chip, ChipGroup, FieldLabel, Pill, inputCls, textareaCls } from './ui';
import { invalidateLead } from './useLead';
import { useContacts } from './useCardData';

export interface CallDialogProps {
  lead: LeadV2;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** called as soon as the result is saved */
  onDone?: (result: RecordCallResult) => void;
  /**
   * Open the chat composer with a template ("called", "confirm_phone") filled in.
   * The card passes this; a list page that has no composer leaves it out and the
   * popup tells the operator to open the card.
   */
  onWriteChat?: (templateKey: string) => void;
}

const RESULT_ICON: Record<CallResult, typeof Phone> = {
  talked: Check,
  no_answer: PhoneMissed,
  busy: Clock,
  wrong_number: PhoneOff,
};

const RESULT_HELP: Record<CallResult, string> = {
  talked: 'Suhbat bo‘ldi — maydonlarni to‘ldiring',
  no_answer: 'Zinapoyaning keyingi urinishi o‘zi belgilanadi',
  busy: 'Mijoz aytgan vaqtni kiriting',
  wrong_number: 'Raqam o‘chiriladi',
};

export function CallDialog({ lead, open, onOpenChange, onDone, onWriteChat }: CallDialogProps) {
  const [outcome, setOutcome] = useState<{ result: CallResult; data: RecordCallResult } | null>(null);
  useEffect(() => {
    if (!open) setOutcome(null);
  }, [open]);

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Qo'ng'iroq natijasi"
      description={`${lead.full_name} bilan qo'ng'iroq natijasini saqlang. Natija saqlanmaguncha oyna yopilmaydi.`}
      locked={!outcome}
    >
      {open && (
        <CallBody
          lead={lead}
          outcome={outcome}
          onSaved={(result, data) => {
            setOutcome({ result, data });
            onDone?.(data);
          }}
          close={() => onOpenChange(false)}
          onWriteChat={onWriteChat}
        />
      )}
    </DialogFrame>
  );
}

interface CallBodyProps {
  lead: LeadV2;
  outcome: { result: CallResult; data: RecordCallResult } | null;
  onSaved: (result: CallResult, data: RecordCallResult) => void;
  close: () => void;
  onWriteChat?: (templateKey: string) => void;
}

function CallBody({ lead, outcome, onSaved, close, onWriteChat }: CallBodyProps) {
  const qc = useQueryClient();
  const { settings } = useLeadSettings();
  const contacts = useContacts(lead.id);

  // "remember started_at = when it opened"
  const [startedAt] = useState(() => new Date().toISOString());
  const [result, setResult] = useState<CallResult | null>(null);
  const [talked, setTalked] = useState<TalkedForm>(() => initialTalkedForm(lead));
  const [initialOpen] = useState(() => missingMandatory(lead));
  const quick = useMemo(() => quickCallbackTimes(), []);
  const [busy, setBusy] = useState<{ pick: string | null; local: string; note: string }>({ pick: null, local: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const updateTalked = (patch: Partial<TalkedForm>) => {
    setTalked((prev) => ({ ...prev, ...patch }));
    setServerError(null);
    setServerMissing([]);
  };

  const busyIso = busy.local ? fromLocalInput(busy.local) : busy.pick;
  const problems = useMemo(() => {
    if (result === 'talked') return talkedProblems(talked);
    if (result === 'busy') return busyProblems(busyIso);
    return [];
  }, [result, talked, busyIso]);
  const canSave = result != null && problems.length === 0;
  const invalid = (key: string) => problems.includes(key) || serverMissing.includes(key);

  const submit = async () => {
    if (!result || saving || !canSave) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload = buildCallPayload(result, {
        startedAt,
        talked: result === 'talked' ? talked : undefined,
        busyAt: result === 'busy' ? busyIso : undefined,
        note: result === 'busy' ? busy.note : undefined,
      });
      const data = await recordCall(lead.id, result, payload);
      toast.success(`Natija saqlandi: ${CALL_RESULT_LABEL[result]}`);
      invalidateLead(qc, lead.id, ['drafts']);
      onSaved(result, data);
      // a finished talk / a callback time has nothing more to tell: close at once
      if (result === 'talked' || result === 'busy') close();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setServerMissing(missingFieldsFrom(msg));
      setServerError(explainError(msg));
      toast.error(explainError(msg));
    } finally {
      setSaving(false);
    }
  };

  const parent = (contacts.data ?? []).find((c) => c.role !== 'student' && isDialable(c.phone));

  if (outcome) {
    return (
      <>
        <DialogBody>
          <OutcomeView
            lead={lead}
            result={outcome.result}
            data={outcome.data}
            parent={parent ? { name: parent.name, phone: parent.phone as string } : null}
            onWriteChat={
              onWriteChat
                ? (key) => {
                    onWriteChat(key);
                    close();
                  }
                : undefined
            }
          />
        </DialogBody>
        <DialogFoot>
          <div className="flex justify-end">
            <Button onClick={close}>Yopish</Button>
          </div>
        </DialogFoot>
      </>
    );
  }

  return (
    <>
      <DialogBody>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{lead.full_name}</p>
            <p className="text-[12px] text-muted-foreground">
              {lead.phone ? (
                <a href={telHref(lead.phone)} className="min-h-0 min-w-0 font-semibold text-primary hover:underline">
                  {lead.phone}
                </a>
              ) : (
                'Telefon raqami yo‘q'
              )}
              <span> · boshlandi {clock(startedAt)}</span>
            </p>
          </div>
          {lead.phone && (
            <button
              type="button"
              onClick={async () => {
                if (await copyToClipboard(lead.phone as string)) toast.success('Raqam nusxalandi');
                else toast.error('Nusxalab bo‘lmadi');
              }}
              aria-label="Raqamni nusxalash"
              className="inline-flex h-8 min-h-0 min-w-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-semibold hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Nusxa
            </button>
          )}
        </div>

        {!result && (
          <div role="group" aria-label="Qo'ng'iroq natijasi" className="grid grid-cols-2 gap-2.5">
            {(Object.keys(CALL_RESULT_LABEL) as CallResult[]).map((r) => {
              const Icon = RESULT_ICON[r];
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(r)}
                  className={cn(
                    'flex min-h-0 min-w-0 flex-col items-start gap-1 rounded-lg border-2 px-4 py-3.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    r === 'talked' ? 'border-primary/60' : 'border-border',
                  )}
                >
                  <span className="flex items-center gap-2 text-[15px] font-bold">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {CALL_RESULT_LABEL[r]}
                  </span>
                  <span className="text-[11.5px] font-normal text-muted-foreground">{RESULT_HELP[r]}</span>
                </button>
              );
            })}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2">
            <Pill tone={result === 'talked' ? 'success' : 'info'}>{CALL_RESULT_LABEL[result]}</Pill>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setServerError(null);
                setServerMissing([]);
              }}
              className="min-h-0 min-w-0 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Boshqa natija tanlash
            </button>
          </div>
        )}

        {result === 'talked' && (
          <TalkedFormView
            lead={lead}
            talked={talked}
            update={updateTalked}
            initialOpen={initialOpen}
            invalid={invalid}
            serverMissing={serverMissing}
            settings={settings}
          />
        )}

        {result === 'no_answer' && (
          <p className="rounded-md bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
            Hech narsa to‘ldirish shart emas. Saqlangach zinapoyaning keyingi urinishi vaqti ko‘rsatiladi.
          </p>
        )}

        {result === 'wrong_number' && (
          <p className="rounded-md bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
            Saqlasangiz telefon raqami o‘chiriladi va lid telefonsiz lid sifatida qoladi.
          </p>
        )}

        {result === 'busy' && (
          <div className="space-y-2.5">
            <div>
              <FieldLabel missing={problems.length > 0}>Mijoz qachon qo‘ng‘iroq qilishni aytdi?</FieldLabel>
              <div role="group" aria-label="Tez tanlash" className="flex flex-wrap items-center gap-1.5">
                {quick.map((q) => (
                  <Chip
                    key={q.label}
                    selected={!busy.local && busy.pick === q.iso}
                    onClick={() => setBusy({ ...busy, pick: q.iso, local: '' })}
                  >
                    {q.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="busy-custom">Yoki aniq vaqt</FieldLabel>
              <input
                id="busy-custom"
                type="datetime-local"
                aria-label="Aniq vaqt"
                value={busy.local}
                onChange={(e) => setBusy({ ...busy, pick: null, local: e.target.value })}
                className={cn(inputCls, 'w-56')}
              />
              {busyIso && <p className="mt-1 text-[11.5px] text-muted-foreground">Qayta qo‘ng‘iroq: {whenLabel(busyIso)}</p>}
            </div>
            <div>
              <FieldLabel htmlFor="busy-note">Qisqa izoh</FieldLabel>
              <textarea
                id="busy-note"
                rows={2}
                value={busy.note}
                onChange={(e) => setBusy({ ...busy, note: e.target.value })}
                className={textareaCls}
              />
            </div>
          </div>
        )}
      </DialogBody>

      <DialogFoot>
        {result && problems.length > 0 && (
          <p role="status" className="text-[12px] font-medium text-destructive">
            {problemSentence(problems)}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-[12px] font-medium text-destructive">
            {serverError}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="min-h-0 min-w-0 text-left text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Bekor qilish (qo'ng'iroq qilinmadi)
          </button>
          <Button onClick={submit} disabled={!canSave || saving} className="min-h-0 min-w-[7rem]">
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </Button>
        </div>
        {confirmingCancel && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2">
            <span className="min-w-0 flex-1 text-[12px]">Qo‘ng‘iroq qilinmadimi? Hech narsa saqlanmaydi.</span>
            <Button variant="outline" size="sm" className="min-h-0" onClick={() => setConfirmingCancel(false)}>
              Yo‘q, davom etaman
            </Button>
            <Button variant="destructive" size="sm" className="min-h-0" onClick={close}>
              Ha, bekor qilish
            </Button>
          </div>
        )}
      </DialogFoot>
    </>
  );
}

// ---- step 2: "Gaplashildi" -----------------------------------------------------------------

interface TalkedFormViewProps {
  lead: LeadV2;
  talked: TalkedForm;
  update: (patch: Partial<TalkedForm>) => void;
  initialOpen: ReturnType<typeof missingMandatory>;
  invalid: (key: string) => boolean;
  serverMissing: string[];
  settings: ReturnType<typeof useLeadSettings>['settings'];
}

function TalkedFormView({ lead, talked, update, initialOpen, invalid, serverMissing, settings }: TalkedFormViewProps) {
  const left = missingMandatory(talked).length;
  const recommended = recommendedOfferKeys(
    { cert_level: talked.cert_level, study_year: talked.study_year, objection: talked.objection, education_level: talked.education_level },
    settings.objections,
  );

  const pickLostReason = (key: string) => {
    const patch: Partial<TalkedForm> = { lostReason: key };
    const c = talked.competitor;
    if (key === 'other_center' && !talked.lostCompetitor.trim() && c && c !== NO_COMPETITOR && c !== 'Boshqa') {
      patch.lostCompetitor = c;
    }
    update(patch);
  };

  return (
    <div className="space-y-4">
      <section aria-label="5 majburiy maydon" className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12.5px] font-bold">5 majburiy maydon</h4>
          <Pill tone={left === 0 ? 'success' : 'danger'}>{left === 0 ? 'To‘liq' : `${left} ta qoldi`}</Pill>
        </div>
        <MandatoryFieldsEditor
          value={talked}
          onChange={(patch) => update(patch)}
          initialOpen={initialOpen}
          liveAge
          highlight={serverMissing}
        />
      </section>

      <ObjectionPicker
        value={talked.objection}
        onChange={(v) => update({ objection: v })}
        options={settings.objections}
        invalid={invalid('objection')}
        previous={lead.objection}
      />
      <CompetitorPicker
        value={talked.competitor}
        onChange={(v) => update({ competitor: v })}
        competitors={settings.competitors}
        invalid={invalid('competitor')}
        previous={lead.competitor}
      />

      <ReferralPicker
        prominent
        type={talked.referral_type}
        name={talked.referral_name}
        onType={(t) => update({ referral_type: t, referral_name: t ? talked.referral_name : null })}
        onName={(n) => update({ referral_name: n })}
      />

      <div className="space-y-2.5 rounded-md border border-border p-2.5">
        <div>
          <FieldLabel>Bosqich</FieldLabel>
          <ChipGroup<CallStage>
            label="Bosqich"
            options={CALL_STAGE_OPTIONS.map((o) => ({ ...o, disabled: stageOptionDisabled(o.value, lead.stage) }))}
            value={talked.stage}
            onChange={(v) => v && update({ stage: v })}
          />
        </div>

        {talked.stage === 'offer' && (
          <ProductFitPicker
            value={talked.product_fit}
            onChange={(v) => update({ product_fit: v })}
            offers={settings.offers}
            recommended={recommended}
            invalid={invalid('product_fit')}
          />
        )}

        {talked.stage === 'waiting' && (
          <WaitFields
            date={talked.waitUntil}
            onDate={(d) => update({ waitUntil: d })}
            reason={talked.waitReason}
            onReason={(r) => update({ waitReason: r })}
            invalidDate={invalid('wait_until')}
            invalidReason={invalid('wait_reason')}
          />
        )}

        {talked.stage === 'lost' && (
          <LostFields
            reasons={settings.lost_reasons}
            reason={talked.lostReason}
            onReason={pickLostReason}
            competitor={talked.lostCompetitor}
            onCompetitor={(c) => update({ lostCompetitor: c })}
            competitorSuggestions={settings.competitors}
            invalidReason={invalid('lost_reason')}
            invalidCompetitor={invalid('lost_competitor')}
          />
        )}

        {talked.stage !== 'waiting' && talked.stage !== 'lost' && (
          <div>
            <FieldLabel missing={invalid('next_action') || invalid('next_action_past')}>Keyingi harakat</FieldLabel>
            <ChipGroup<NextActionMode>
              label="Keyingi harakat turi"
              options={[
                { value: 'time', label: 'Sana va vaqt' },
                { value: 'followup', label: 'Kuzatuv (1/3/7-kun)' },
              ]}
              value={talked.nextMode}
              onChange={(v) => v && update({ nextMode: v })}
            />
            {talked.nextMode === 'time' ? (
              <input
                type="datetime-local"
                aria-label="Keyingi harakat vaqti"
                value={talked.nextLocal}
                onChange={(e) => update({ nextLocal: e.target.value })}
                className={cn(inputCls, 'mt-1.5 w-56', (invalid('next_action') || invalid('next_action_past')) && 'border-destructive/60')}
              />
            ) : (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Tizim 1, 3 va 7-kun uchun xabar qoralamalarini tayyorlaydi. Hech narsa o‘zi yuborilmaydi.
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <FieldLabel htmlFor="call-note">Qisqa izoh</FieldLabel>
        <textarea
          id="call-note"
          rows={2}
          value={talked.note}
          onChange={(e) => update({ note: e.target.value })}
          className={textareaCls}
        />
      </div>
    </div>
  );
}

// ---- step 3: what the server decided --------------------------------------------------------

interface OutcomeViewProps {
  lead: LeadV2;
  result: CallResult;
  data: RecordCallResult;
  parent: { name: string | null; phone: string } | null;
  onWriteChat?: (templateKey: string) => void;
}

function OutcomeView({ lead, result, data, parent, onWriteChat }: OutcomeViewProps) {
  const template = data.template ?? (result === 'wrong_number' ? 'confirm_phone' : 'called');

  const chatBlock = data.chat_prompt ? (
    <div className="rounded-md border-2 border-primary/60 bg-primary/5 p-3">
      <p className="text-[13px] font-semibold">
        {result === 'wrong_number'
          ? 'Mijozdan raqamni chatda tasdiqlashni so‘rang.'
          : 'Mijozga chatda yozing — taymer shu xabardan keyin to‘xtaydi.'}
      </p>
      {onWriteChat ? (
        <Button className="mt-2 min-h-0" onClick={() => onWriteChat(template)}>
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Chatga yozish
        </Button>
      ) : (
        <p className="mt-1 text-[12px] text-muted-foreground">Kartani oching va chatga yozing.</p>
      )}
    </div>
  ) : null;

  if (result === 'no_answer') {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-[14px] font-bold">
          <PhoneMissed className="h-4 w-4" aria-hidden="true" />
          Ko‘tarmadi — saqlandi
        </p>
        {data.lost ? (
          <p role="status" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
            5 urinish — lid 'aloqa yo'q' sifatida yopildi
          </p>
        ) : (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-[13px]">
            Keyingi urinish: <strong>{whenLabel(data.next_attempt_at)}</strong>
            {data.attempt_no ? <span className="text-muted-foreground"> · {data.attempt_no}-urinish bajarildi (jami 5)</span> : null}
          </p>
        )}
        {chatBlock}
        {parent && (
          <div className="rounded-md border border-border px-3 py-2 text-[12.5px]">
            <p className="font-semibold">Ota-onaga qo‘ng‘iroq?</p>
            <p className="mt-0.5 text-muted-foreground">
              {parent.name ? `${parent.name}: ` : ''}
              <a href={telHref(parent.phone)} className="min-h-0 min-w-0 font-semibold text-primary hover:underline">
                {parent.phone}
              </a>
            </p>
          </div>
        )}
      </div>
    );
  }

  if (result !== 'wrong_number') {
    return (
      <p role="status" className="flex items-center gap-2 text-[14px] font-bold">
        <Check className="h-4 w-4" aria-hidden="true" />
        Natija saqlandi: {CALL_RESULT_LABEL[result]}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <PhoneOff className="h-4 w-4" aria-hidden="true" />
        Nomer xato — saqlandi
      </p>
      <p role="status" className="rounded-md bg-muted px-3 py-2 text-[13px]">
        {lead.phone ? `${lead.phone} raqami o‘chirildi.` : 'Raqam o‘chirildi.'} Lid telefonsiz lid sifatida qoladi.
      </p>
      {data.lost && (
        <p role="status" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
          Chat kanali yo‘q — lid 'aloqa yo'q' sifatida yopildi
        </p>
      )}
      {chatBlock}
    </div>
  );
}
