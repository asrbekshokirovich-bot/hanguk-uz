import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

const api = vi.hoisted(() => ({
  recordCall: vi.fn(),
  fetchContacts: vi.fn(),
  fetchSettings: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  recordCall: api.recordCall,
  fetchContacts: api.fetchContacts,
  fetchSettings: api.fetchSettings,
}));

import { MISSING_FIELD_LABEL } from '../../copy';
import type { RecordCallResult } from '../../types';
import { CallDialog, type CallDialogProps } from '../CallDialog';
import { COMPLETE_FIVE, SEED_OFFERS, makeLead, renderWithQuery } from './helpers';

const DECIDER = MISSING_FIELD_LABEL.decider;

// a dialog with ~60 chips: a few seconds each on a busy CI box
vi.setConfig({ testTimeout: 30_000 });

function setup(over: Partial<CallDialogProps> = {}) {
  const onOpenChange = vi.fn();
  const onDone = vi.fn();
  const onWriteChat = vi.fn();
  const utils = renderWithQuery(
    <CallDialog
      lead={makeLead()}
      open
      onOpenChange={onOpenChange}
      onDone={onDone}
      onWriteChat={onWriteChat}
      {...over}
    />,
  );
  return { onOpenChange, onDone, onWriteChat, ...utils };
}

/** Tap one chip of a labelled group. */
const tap = (group: string, option: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: option }));

const saveButton = () => screen.getByRole('button', { name: /^Saqlash$|Saqlanmoqda/ });
const choose = (result: RegExp) => fireEvent.click(screen.getByRole('button', { name: result }));

/** The five fields + objection + competitor, for a lead that has none of them. */
function fillEverything() {
  tap('Maqsad', 'Bakalavr');
  tap('Sertifikat / daraja', 'TOPIK 3');
  fireEvent.change(screen.getByLabelText('Yosh'), { target: { value: '19' } });
  tap('Viloyat', "Farg'ona");
  tap(DECIDER, 'Ota-ona');
  tap(MISSING_FIELD_LABEL.objection, 'Narx');
  tap(MISSING_FIELD_LABEL.competitor, "Yo'q");
}

const ok = (over: Partial<RecordCallResult> = {}): RecordCallResult => ({ ok: true, result: 'talked', ...over });

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchContacts.mockResolvedValue([]);
  api.fetchSettings.mockResolvedValue({ offers: SEED_OFFERS });
  api.recordCall.mockResolvedValue(ok());
});

describe('CallDialog — it cannot be left without a result', () => {
  it('shows the four result buttons and the number', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: "Qo'ng'iroq natijasi" })).toBeInTheDocument();
    for (const name of [/Gaplashildi/, /Ko.tarmadi/, /Band \/ keyin/, /Nomer xato/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: '+998 94 196 69 89' })).toHaveAttribute('href', 'tel:+998941966989');
  });

  it('ignores Escape, a click outside and has no close button', async () => {
    const { onOpenChange } = setup();
    await screen.findByRole('dialog');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10)); // Radix arms its outside-click listener on the next tick
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yopish' })).not.toBeInTheDocument();
    expect(api.recordCall).not.toHaveBeenCalled();
  });

  it('only "Bekor qilish" gets out — after a confirmation, and without writing anything', async () => {
    const { onOpenChange } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /Bekor qilish \(qo'ng'iroq qilinmadi\)/ }));

    // asked first; nothing is closed yet
    expect(screen.getByText(/Hech narsa saqlanmaydi/)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    // "no" keeps the dialog
    fireEvent.click(screen.getByRole('button', { name: /davom etaman/ }));
    expect(screen.queryByText(/Hech narsa saqlanmaydi/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Bekor qilish \(qo'ng'iroq qilinmadi\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ha, bekor qilish' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.recordCall).not.toHaveBeenCalled();
  });
});

describe('CallDialog — Gaplashildi', () => {
  it('keeps "Saqlash" disabled until the 5 fields, the objection and the other centre are filled', async () => {
    setup();
    choose(/Gaplashildi/);

    expect(saveButton()).toBeDisabled();
    const missing = screen.getByRole('status').textContent ?? '';
    for (const key of ['goal', 'certificate', 'age_grade', 'region', 'decider', 'objection', 'competitor']) {
      expect(missing).toContain(MISSING_FIELD_LABEL[key]);
    }

    tap('Maqsad', 'Bakalavr');
    tap('Sertifikat / daraja', 'TOPIK 3');
    fireEvent.change(screen.getByLabelText('Yosh'), { target: { value: '19' } });
    tap('Viloyat', "Farg'ona");
    tap(DECIDER, 'Ota-ona');
    // the five are in; the two quick questions still hold it back
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status').textContent).toContain(MISSING_FIELD_LABEL.objection);

    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status').textContent).not.toContain(MISSING_FIELD_LABEL.objection);

    tap(MISSING_FIELD_LABEL.competitor, "Yo'q");
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marks the empty mandatory fields with a red dot and only expands what is missing', async () => {
    setup({ lead: makeLead({ education_level: 'Bakalavr', cert_level: 'TOPIK 3' }) });
    choose(/Gaplashildi/);

    // goal / certificate are known: one-line summaries, not chips
    expect(screen.queryByRole('group', { name: 'Maqsad' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Maqsad: Bakalavr/ })).toBeInTheDocument();
    // the others are open and red
    expect(screen.getByRole('group', { name: 'Viloyat' })).toBeInTheDocument();
    const dots = document.querySelectorAll('[data-field] [role="img"][aria-label="to\'ldirilmagan"]');
    expect(dots.length).toBeGreaterThanOrEqual(3); // age/class, region, decider (+ objection / competitor outside the editor)
    // tapping a summary opens it for editing
    fireEvent.click(screen.getByRole('button', { name: /Maqsad: Bakalavr/ }));
    expect(screen.getByRole('group', { name: 'Maqsad' })).toBeInTheDocument();
  });

  it('sends exactly the RecordCallPayload, closes and reports', async () => {
    const { onOpenChange, onDone } = setup();
    choose(/Gaplashildi/);
    fillEverything();
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.recordCall).toHaveBeenCalledTimes(1));
    const [leadId, result, payload] = api.recordCall.mock.calls[0];
    expect(leadId).toBe('lead-1');
    expect(result).toBe('talked');
    expect(payload).toEqual({
      started_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      fields: {
        education_level: 'Bakalavr',
        cert_level: 'TOPIK 3',
        age: 19,
        city: "Farg'ona",
        decider: 'parent',
        objection: 'Narx',
        competitor: "Yo'q",
      },
      stage: 'contacted',
      next_action_kind: 'callback',
      next_action_at: expect.stringMatching(/T05:00:00\.000Z$/), // 10:00 Tashkent, tomorrow by default
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ ok: true, result: 'talked' }));
  });

  it('starts from what the lead already has: only the missing fields are asked, the rest are sent along', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    expect(saveButton()).toBeDisabled(); // objection + competitor are asked on every call
    tap(MISSING_FIELD_LABEL.objection, 'Vaqt');
    tap(MISSING_FIELD_LABEL.competitor, 'ON201');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    expect(api.recordCall.mock.calls[0][2].fields).toMatchObject({
      education_level: 'Bakalavr',
      cert_level: 'TOPIK 3',
      age: 19,
      objection: 'Vaqt',
      competitor: 'ON201',
    });
  });

  it('takes a free-text competitor under "Boshqa"', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    tap(MISSING_FIELD_LABEL.competitor, 'Boshqa');
    fireEvent.change(screen.getByLabelText('Boshqa markaz nomi'), { target: { value: 'Seoul Edu' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    expect(api.recordCall.mock.calls[0][2].fields.competitor).toBe('Seoul Edu');
  });

  it('the 1/3/7-day follow-up is sent as a kind, with no time', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    tap(MISSING_FIELD_LABEL.competitor, "Yo'q");
    tap('Keyingi harakat turi', 'Kuzatuv (1/3/7-kun)');
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    const payload = api.recordCall.mock.calls[0][2];
    expect(payload.next_action_kind).toBe('followup');
    expect(payload).not.toHaveProperty('next_action_at');
  });

  it('refuses a next action in the past', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    tap(MISSING_FIELD_LABEL.competitor, "Yo'q");
    fireEvent.change(screen.getByLabelText('Keyingi harakat vaqti'), { target: { value: '2020-01-01T10:00' } });
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status').textContent).toContain("o'tib ketgan");
  });

  it('needs the Taklif turi for the stage Taklif, and sends it', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    tap(MISSING_FIELD_LABEL.competitor, "Yo'q");
    tap('Bosqich', 'Taklif');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status').textContent).toContain(MISSING_FIELD_LABEL.product_fit);

    await screen.findByRole('button', { name: /Standart/ });
    tap(MISSING_FIELD_LABEL.product_fit, '★ Standart');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    const payload = api.recordCall.mock.calls[0][2];
    expect(payload.stage).toBe('offer');
    expect(payload.fields.product_fit).toBe('standart');
  });

  it('Kutish needs a date from tomorrow and a reason, and sends them instead of a next action', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    tap(MISSING_FIELD_LABEL.competitor, "Yo'q");
    tap('Bosqich', 'Kutish');
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByLabelText('Keyingi harakat vaqti')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+1 hafta' }));
    expect(saveButton()).toBeDisabled(); // the reason is still missing
    tap('Kutish sababi', 'Oila qarori');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    const payload = api.recordCall.mock.calls[0][2];
    expect(payload).toMatchObject({ stage: 'waiting', wait_reason: 'family_decision' });
    expect(payload.wait_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload).not.toHaveProperty('next_action_at');
  });

  it('Yo\'qotildi shows each reason with its queue and asks for the centre on "Boshqa markaz"', async () => {
    setup({ lead: makeLead({ ...COMPLETE_FIVE }) });
    choose(/Gaplashildi/);
    tap(MISSING_FIELD_LABEL.objection, 'Narx');
    tap(MISSING_FIELD_LABEL.competitor, 'ON201');
    tap('Bosqich', "Yo'qotildi");
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('→ Hanbox navbati')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: "Yo'qotish sababi" })).getByRole('button', { name: /^Boshqa markaz/ }));
    // the centre already chosen above is carried over
    expect(screen.getByLabelText('Qaysi markaz?')).toHaveValue('ON201');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    expect(api.recordCall.mock.calls[0][2]).toMatchObject({
      stage: 'lost',
      lost_reason: 'other_center',
      lost_competitor: 'ON201',
    });
  });

  it('shows the server\'s missing_fields on the fields it names, and stays open', async () => {
    api.recordCall.mockRejectedValue(new Error('missing_fields:goal,decider'));
    const { onOpenChange, onDone } = setup();
    choose(/Gaplashildi/);
    fillEverything();
    fireEvent.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(`To‘ldirilmagan: ${MISSING_FIELD_LABEL.goal}, ${DECIDER}`);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    // the two fields are painted red although the form thought they were filled
    for (const key of ['goal', 'decider']) {
      const row = document.querySelector(`[data-field="${key}"]`) as HTMLElement;
      expect(within(row).getByRole('img', { name: "to'ldirilmagan" })).toBeInTheDocument();
    }
    // editing clears the message; Saqlash is usable again
    tap('Maqsad', 'Magistr');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });
});

describe("CallDialog — Ko'tarmadi", () => {
  it('has nothing to fill; saves at once and shows the next ladder step', async () => {
    api.recordCall.mockResolvedValue(
      ok({ result: 'no_answer', attempt_no: 1, next_attempt_at: '2026-10-05T10:15:00Z', chat_prompt: false }),
    );
    const { onDone, onOpenChange } = setup();
    choose(/Ko.tarmadi/);
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    expect(api.recordCall).toHaveBeenCalledWith('lead-1', 'no_answer', { started_at: expect.any(String) });
    // 10:15 UTC = 15:15 in Tashkent (the day word depends on today's date)
    expect(await screen.findByText(/Keyingi urinish:/)).toHaveTextContent(/Keyingi urinish: .*15:15/);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled(); // the outcome is read first
    expect(screen.queryByRole('button', { name: 'Chatga yozish' })).not.toBeInTheDocument();

    // once saved the dialog may be closed
    expect(screen.getAllByRole('button', { name: 'Yopish' }).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Yopish' })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('prompts "Chatga yozish" when the timer is still running, and hands the "called" template over', async () => {
    api.recordCall.mockResolvedValue(
      ok({ result: 'no_answer', attempt_no: 1, next_attempt_at: '2026-10-05T10:15:00Z', chat_prompt: true, chat_available: true }),
    );
    const { onWriteChat, onOpenChange } = setup();
    choose(/Ko.tarmadi/);
    fireEvent.click(saveButton());

    const button = await screen.findByRole('button', { name: /Chatga yozish/ });
    expect(screen.getByText(/taymer shu xabardan keyin to.xtaydi/)).toBeInTheDocument();
    fireEvent.click(button);
    expect(onWriteChat).toHaveBeenCalledWith('called');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('without a composer (a list page) it says where to write instead of offering a dead button', async () => {
    api.recordCall.mockResolvedValue(ok({ result: 'no_answer', next_attempt_at: '2026-10-05T10:15:00Z', chat_prompt: true }));
    setup({ onWriteChat: undefined });
    choose(/Ko.tarmadi/);
    fireEvent.click(saveButton());
    expect(await screen.findByText(/Kartani oching va chatga yozing/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chatga yozish/ })).not.toBeInTheDocument();
  });

  it("says so when the fifth try closed the lead as 'aloqa yo'q'", async () => {
    api.recordCall.mockResolvedValue(ok({ result: 'no_answer', attempt_no: 5, lost: true }));
    setup();
    choose(/Ko.tarmadi/);
    fireEvent.click(saveButton());
    expect(await screen.findByText("5 urinish — lid 'aloqa yo'q' sifatida yopildi")).toBeInTheDocument();
    expect(screen.queryByText(/Keyingi urinish/)).not.toBeInTheDocument();
  });

  it('offers to call the parent when there is a parent number', async () => {
    api.fetchContacts.mockResolvedValue([
      { id: 'c1', lead_id: 'lead-1', role: 'parent', name: 'Ona', phone: '+998 90 111 22 33', relation: 'ona', preferred_time: null, is_decider: true },
    ]);
    api.recordCall.mockResolvedValue(ok({ result: 'no_answer', next_attempt_at: '2026-10-05T10:15:00Z' }));
    setup();
    choose(/Ko.tarmadi/);
    fireEvent.click(saveButton());
    expect(await screen.findByText(/Ota-onaga qo.ng.iroq\?/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: '+998 90 111 22 33' })).toHaveAttribute('href', 'tel:+998901112233'));
  });

  it('shows what the server refused', async () => {
    api.recordCall.mockRejectedValue(new Error('not_allowed'));
    setup();
    choose(/Ko.tarmadi/);
    fireEvent.click(saveButton());
    expect((await screen.findByRole('alert')).textContent).toBe("Bu amalga ruxsat yo'q");
  });
});

describe('CallDialog — Band / keyin', () => {
  it('needs a callback time; quick picks or a custom time', async () => {
    const { onOpenChange } = setup();
    choose(/Band \/ keyin/);
    expect(saveButton()).toBeDisabled();

    tap('Tez tanlash', '+1 soat');
    expect(saveButton()).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Aniq vaqt'), { target: { value: '2030-01-02T15:30' } });
    expect(saveButton()).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Qisqa izoh'), { target: { value: 'ish joyida' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    expect(api.recordCall).toHaveBeenCalledWith('lead-1', 'busy', {
      started_at: expect.any(String),
      next_action_at: '2030-01-02T10:30:00.000Z', // 15:30 Tashkent
      note: 'ish joyida',
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('a quick pick is about an hour from now', async () => {
    setup();
    choose(/Band \/ keyin/);
    tap('Tez tanlash', '+1 soat');
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.recordCall).toHaveBeenCalled());
    const at = Date.parse(api.recordCall.mock.calls[0][2].next_action_at);
    expect(Math.abs(at - (Date.now() + 3_600_000))).toBeLessThan(60_000);
  });
});

describe('CallDialog — Nomer xato', () => {
  it('saves with nothing to fill and offers the confirm_phone template in the chat', async () => {
    api.recordCall.mockResolvedValue(ok({ result: 'wrong_number', chat_prompt: true, template: 'confirm_phone' }));
    const { onWriteChat, onOpenChange } = setup();
    choose(/Nomer xato/);
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.recordCall).toHaveBeenCalledWith('lead-1', 'wrong_number', { started_at: expect.any(String) }));
    expect(await screen.findByText(/raqami .*o.chirildi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Chatga yozish/ }));
    expect(onWriteChat).toHaveBeenCalledWith('confirm_phone');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("explains that a lead with no chat channel was closed as 'aloqa yo'q'", async () => {
    api.recordCall.mockResolvedValue(ok({ result: 'wrong_number', lost: true }));
    setup();
    choose(/Nomer xato/);
    fireEvent.click(saveButton());
    expect(await screen.findByText(/Chat kanali yo.q — lid 'aloqa yo'q' sifatida yopildi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chatga yozish/ })).not.toBeInTheDocument();
  });
});
