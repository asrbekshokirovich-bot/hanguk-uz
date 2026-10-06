import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  fetchLead: vi.fn(),
  fetchTimeline: vi.fn(),
  fetchContacts: vi.fn(),
  fetchDrafts: vi.fn(),
  fetchPromises: vi.fn(),
  fetchMergeSuggestions: vi.fn(),
  fetchLeadBrief: vi.fn(),
  fetchSettings: vi.fn(),
  claimLead: vi.fn(),
  reopenLead: vi.fn(),
  pinLead: vi.fn(),
  saveFields: vi.fn(),
  handleDraft: vi.fn(),
  confirmMerge: vi.fn(),
  dismissMerge: vi.fn(),
  recordCall: vi.fn(),
}));
const ctx = vi.hoisted(() => ({
  role: { isLeadSenior: false, isAdmin: false },
  leads: [{ id: 'lead-1' }] as { id: string }[],
  convertToStudent: vi.fn(),
  sendMessage: vi.fn(),
  copyToClipboard: vi.fn(),
  openTel: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ctx.role }));
vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [
      { id: 'p1', user_id: 'me', full_name: 'Sardor', username: null, avatar_url: null },
      { id: 'p2', user_id: 'op-2', full_name: 'Omina', username: null, avatar_url: null },
    ],
    loading: false,
    searchStaff: () => [],
  }),
}));
vi.mock('@/hooks/useMessages', () => ({ useMessages: () => ({ sendMessage: ctx.sendMessage }) }));
vi.mock('@/hooks/useLeads', () => ({
  useLeads: () => ({ leads: ctx.leads, loading: false, convertToStudent: ctx.convertToStudent }),
}));
vi.mock('../phone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../phone')>()),
  copyToClipboard: ctx.copyToClipboard,
  openTel: ctx.openTel,
}));
vi.mock('../../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api')>()), ...api }));

import { toast } from 'sonner';
import type { LeadDraft, LeadV2, TimelineEntry } from '../../types';
import LeadCard from '../LeadCard';
import { COMPLETE_FIVE, SEED_OFFERS, SEED_TEMPLATES, makeLead, renderWithQuery } from './helpers';
import { channelChain, results, resetSupabaseMock, writes } from './supabaseMock';

// a whole card (10 blocks, ~150 buttons) per test; generous so a loaded machine does not flake
vi.setConfig({ testTimeout: 120_000 });

const mockLead = (over: Partial<LeadV2> = {}) => api.fetchLead.mockResolvedValue(makeLead(over));
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

async function open(over: Partial<LeadV2> | null = {}, props: { startCall?: boolean; onClose?: () => void } = {}) {
  if (over) mockLead(over);
  const utils = renderWithQuery(<LeadCard leadId="lead-1" {...props} />);
  if (over) await screen.findByTestId('lead-card');
  return utils;
}

const header = () => screen.getByTestId('card-header');
const heading = (name: string) => screen.getByRole('heading', { name });

const entry = (over: Partial<TimelineEntry>): TimelineEntry => ({
  at: iso(-3_600_000),
  kind: 'message_in',
  channel: 'instagram',
  direction: 'incoming',
  body: 'Narxi qancha?',
  actor_id: null,
  meta: {},
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseMock();
  ctx.role.isLeadSenior = false;
  ctx.role.isAdmin = false;
  ctx.leads = [{ id: 'lead-1' }];
  ctx.copyToClipboard.mockResolvedValue(true);
  ctx.convertToStudent.mockResolvedValue({ success: true, magicCode: 'AB12' });
  ctx.sendMessage.mockResolvedValue({ error: null, queued: true });
  api.fetchTimeline.mockResolvedValue([]);
  api.fetchContacts.mockResolvedValue([]);
  api.fetchDrafts.mockResolvedValue([]);
  api.fetchPromises.mockResolvedValue([]);
  api.fetchMergeSuggestions.mockResolvedValue([]);
  api.fetchLeadBrief.mockResolvedValue([]);
  api.fetchSettings.mockResolvedValue({ offers: SEED_OFFERS, templates: SEED_TEMPLATES });
  for (const fn of [api.claimLead, api.reopenLead, api.pinLead, api.saveFields, api.handleDraft, api.confirmMerge, api.dismissMerge]) {
    fn.mockResolvedValue(undefined);
  }
  api.recordCall.mockResolvedValue({ ok: true, result: 'talked' });
});

describe('LeadCard — the header (block 1)', () => {
  it('shows name, stage, old-CRM badge, timer, owner, score and the action buttons', async () => {
    await open({
      stage: 'interested',
      crm_generation: 'old',
      owner_id: 'me',
      priority_score: 82,
      timer_kind: 'first',
      timer_start_at: iso(-60_000),
      due_at: iso(252_000),
      contact_channel: 'Instagram',
    });
    const h = within(header());
    expect(h.getByRole('heading', { name: 'Dilnoza Abdullayeva' })).toBeInTheDocument();
    expect(h.getByText('Qiziqdi')).toBeInTheDocument();
    expect(h.getByText('Eski CRM')).toBeInTheDocument();
    expect(h.getByText('Ball 82')).toBeInTheDocument();
    expect(h.getByText('Sardor')).toBeInTheDocument(); // "Egasi: Sardor"
    expect(h.getByText('HOZIR')).toBeInTheDocument();
    expect(h.getByText('Yangi lid', { exact: false })).toBeInTheDocument();
    expect(h.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument(); // the live countdown
    expect(h.getByText('IG')).toBeInTheDocument();
    expect(h.getByText('Tel')).toBeInTheDocument();

    for (const name of [/Qo'ng'iroq\s*\+998/, 'Yozish', 'Kutish', "Yo'qotildi", 'Talaba']) {
      expect(h.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('counts a missed-call ladder as "zinapoya N/5" and shows an overdue timer in red', async () => {
    await open({
      stage: 'contacted',
      owner_id: 'me',
      timer_kind: 'ladder',
      ladder_state: 'running',
      attempt_no: 2,
      timer_start_at: iso(-700_000),
      due_at: iso(-160_000),
    });
    const h = within(header());
    expect(h.getByText('KECHIKDI')).toBeInTheDocument();
    expect(h.getByText(/zinapoya 3\/5/)).toBeInTheDocument();
    expect(h.getByText(/^−\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('has no Talaba button before the lead is interested', async () => {
    await open({ stage: 'contacted', owner_id: 'me' });
    expect(within(header()).queryByRole('button', { name: 'Talaba' })).not.toBeInTheDocument();
  });

  it('closes through onClose', async () => {
    const onClose = vi.fn();
    await open({ owner_id: 'me' }, { onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Kartani yopish' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows every block, top to bottom, with nothing behind tabs', async () => {
    await open({
      owner_id: 'me',
      ai_summary: 'Kim: talaba, 19, Farg‘ona.',
      ai_brief_at: iso(-180_000),
    });
    const titles = ['AI qisqacha', 'Aloqa', '5 majburiy maydon', 'Malaka va taklif', 'Ruxsat etilgan taklif', 'Manba', "Vaqt chizig'i"];
    for (let i = 1; i < titles.length; i++) {
      // each block comes after the previous one
      expect(heading(titles[i - 1]).compareDocumentPosition(heading(titles[i])) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Kim: talaba, 19, Farg‘ona.')).toBeInTheDocument();
    expect(screen.getByText('yangilangan 3 daq. oldin')).toBeInTheDocument();
  });

  it('says so when there is no AI summary yet', async () => {
    await open({ owner_id: 'me' });
    expect(screen.getByText("AI qisqacha hali yo'q")).toBeInTheDocument();
  });

  it('says "not found" when the lead is not visible', async () => {
    api.fetchLead.mockResolvedValue(null);
    await open(null);
    expect(await screen.findByText(/Lid topilmadi yoki unga ruxsat yo.q/)).toBeInTheDocument();
  });
});

describe('LeadCard — ownership (spec §2.4, §4)', () => {
  it('a lead somebody else holds is read-only: banner, no action buttons, no composer', async () => {
    await open({ owner_id: 'op-2', stage: 'contacted', source: 'instagram', source_id: 'ig-1' });
    expect(screen.getByRole('status')).toHaveTextContent('Bu lid Ominada');
    const h = within(header());
    for (const name of [/Qo'ng'iroq/, 'Yozish', 'Kutish', "Yo'qotildi", 'Olish']) {
      expect(h.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('textbox')).toBeDisabled();
    // the 5 fields cannot be edited either
    expect(within(screen.getByRole('group', { name: 'Maqsad' })).getByRole('button', { name: 'Bakalavr' })).toBeDisabled();
  });

  it('...unless its 10 minutes are gone: then anyone may take it with Olish', async () => {
    await open({ owner_id: 'op-2', timer_kind: 'first', timer_start_at: iso(-900_000), due_at: iso(-300_000) });
    expect(screen.getByRole('status')).toHaveTextContent('10 daqiqa buzildi');
    fireEvent.click(within(header()).getByRole('button', { name: 'Olish' }));
    await waitFor(() => expect(api.claimLead).toHaveBeenCalledWith('lead-1'));
  });

  it('a pool lead is marked "Hovuz" and has an Olish button', async () => {
    await open({ owner_id: null });
    const h = within(header());
    expect(h.getByText('Hovuz')).toBeInTheDocument();
    fireEvent.click(h.getByRole('button', { name: 'Olish' }));
    await waitFor(() => expect(api.claimLead).toHaveBeenCalledWith('lead-1'));
  });

  it('a senior may work any lead, and pins it', async () => {
    ctx.role.isLeadSenior = true;
    await open({ owner_id: 'op-2' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: /Qo'ng'iroq/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pin qilish' }));
    await waitFor(() => expect(api.pinLead).toHaveBeenCalledWith('lead-1', true));
  });

  it('an operator gets no Pin button', async () => {
    await open({ owner_id: 'me' });
    expect(screen.queryByRole('button', { name: /Pin/ })).not.toBeInTheDocument();
  });

  it('a student is closed: banner and no actions', async () => {
    await open({ owner_id: 'me', stage: 'student' });
    expect(screen.getByRole('status')).toHaveTextContent('talaba');
    expect(within(header()).queryByRole('button', { name: /Qo'ng'iroq/ })).not.toBeInTheDocument();
  });

  it('a lost lead offers Qayta ochish instead of the work buttons', async () => {
    await open({ owner_id: 'me', stage: 'lost', lost_reason: 'price' });
    const h = within(header());
    expect(h.queryByRole('button', { name: /Qo'ng'iroq/ })).not.toBeInTheDocument();
    fireEvent.click(h.getByRole('button', { name: /Qayta ochish/ }));
    await waitFor(() => expect(api.reopenLead).toHaveBeenCalledWith('lead-1'));
  });
});

describe('LeadCard — Qo\'ng\'iroq (spec §7)', () => {
  it('copies the number, hands a tel: link to the phone and opens the result popup', async () => {
    await open({ owner_id: 'me' });
    fireEvent.click(within(header()).getByRole('button', { name: /Qo'ng'iroq/ }));
    expect(ctx.copyToClipboard).toHaveBeenCalledWith('+998 94 196 69 89');
    expect(ctx.openTel).toHaveBeenCalledWith('+998 94 196 69 89');
    expect(await screen.findByRole('heading', { name: "Qo'ng'iroq natijasi" })).toBeInTheDocument();
  });

  it('startCall opens the popup as soon as the lead has loaded — once', async () => {
    await open({ owner_id: 'me' }, { startCall: true });
    expect(await screen.findByRole('heading', { name: "Qo'ng'iroq natijasi" })).toBeInTheDocument();
    expect(ctx.openTel).toHaveBeenCalledTimes(1);
  });

  it('no button for a lead without a phone', async () => {
    await open({ owner_id: 'me', phone: null });
    expect(within(header()).getByRole('button', { name: /Qo'ng'iroq/ })).toBeDisabled();
  });

  it('"Chatga yozish" after a missed call fills the composer with the "called" template', async () => {
    api.recordCall.mockResolvedValue({
      ok: true,
      result: 'no_answer',
      attempt_no: 1,
      next_attempt_at: iso(900_000),
      chat_prompt: true,
      chat_available: true,
    });
    await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1' }, { startCall: true });
    await screen.findByRole('heading', { name: "Qo'ng'iroq natijasi" });
    fireEvent.click(screen.getByRole('button', { name: /Ko.tarmadi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    fireEvent.click(await screen.findByRole('button', { name: /Chatga yozish/ }));

    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        "Dilnoza, siz bilan bog'lanmoqchi bo'ldik, lekin ko'tarmadingiz. Qachon qo'ng'iroq qilsak qulay?",
      ),
    );
  });
});

describe('LeadCard — Talaba (the existing conversion)', () => {
  it('asks first, then calls convertToStudent from the leads context', async () => {
    await open({ owner_id: 'me', stage: 'offer' });
    fireEvent.click(within(header()).getByRole('button', { name: 'Talaba' }));
    expect(ctx.convertToStudent).not.toHaveBeenCalled();
    expect(await screen.findByText(/talabaga aylantirilsinmi\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aylantirish' }));
    await waitFor(() => expect(ctx.convertToStudent).toHaveBeenCalledWith('lead-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Talabaga aylantirildi', expect.objectContaining({ description: 'Kirish kodi: AB12' })));
  });

  it('cancelling converts nothing', async () => {
    await open({ owner_id: 'me', stage: 'contract' });
    fireEvent.click(within(header()).getByRole('button', { name: 'Talaba' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bekor qilish' }));
    expect(ctx.convertToStudent).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/talabaga aylantirilsinmi\?/)).not.toBeInTheDocument());
  });

  it('explains when the old leads list cannot see the lead (the context converts from its own list)', async () => {
    ctx.leads = [];
    ctx.convertToStudent.mockResolvedValue({ success: false });
    await open({ owner_id: 'me', stage: 'interested' });
    fireEvent.click(within(header()).getByRole('button', { name: 'Talaba' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aylantirish' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Lidlar ro.yxatida topilmadi/)));
  });
});

describe('LeadCard — fields', () => {
  it('saves a mandatory field on change (lead_save_fields) and shows how many are left', async () => {
    // a database that keeps what is saved, so the refetch after the save agrees with the screen
    let row = makeLead({ owner_id: 'me' });
    api.fetchLead.mockImplementation(async () => ({ ...row }));
    api.saveFields.mockImplementation(async (_id: string, patch: Partial<LeadV2>) => {
      row = { ...row, ...patch };
    });
    await open(null);
    await screen.findByTestId('lead-card');
    expect(screen.getByText('5 ta qoldi')).toBeInTheDocument();
    const goal = screen.getByRole('group', { name: 'Maqsad' });
    fireEvent.click(within(goal).getByRole('button', { name: 'Bakalavr' }));
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { education_level: 'Bakalavr' }));
    // optimistic: the chip is selected before the refetch
    expect(within(screen.getByRole('group', { name: 'Maqsad' })).getByRole('button', { name: 'Bakalavr' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('4 ta qoldi')).toBeInTheDocument();
  });

  it('rolls back and explains when the database refuses', async () => {
    api.saveFields.mockRejectedValue(new Error('not_allowed'));
    await open({ owner_id: 'me' });
    fireEvent.click(within(screen.getByRole('group', { name: 'Maqsad' })).getByRole('button', { name: 'Bakalavr' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bu amalga ruxsat yo'q"));
    await waitFor(() =>
      expect(within(screen.getByRole('group', { name: 'Maqsad' })).getByRole('button', { name: 'Bakalavr' })).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  it('reads "To\'liq" and collapses the five into summaries once complete', async () => {
    await open({ owner_id: 'me', ...COMPLETE_FIVE });
    expect(screen.getByText("To'liq")).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Maqsad' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Maqsad: Bakalavr/ })).toBeInTheDocument();
  });

  it('saves the other-centre and objection taps with their stored text', async () => {
    await open({ owner_id: 'me' });
    fireEvent.click(within(screen.getByRole('group', { name: "Nima to'xtatyapti?" })).getByRole('button', { name: 'Hujjat / moliya' }));
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { objection: 'Hujjat / moliya' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Boshqa markaz?' })).getByRole('button', { name: 'ON201' }));
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { competitor: 'ON201' }));
  });

  const editPhone = (value: string) => {
    fireEvent.click(screen.getByRole('button', { name: /^Telefon: .*o'zgartirish/ }));
    const input = screen.getByRole('textbox', { name: 'Telefon' });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  };

  it('saves the phone through lead_save_fields like every other field (no table update)', async () => {
    await open({ owner_id: 'me' });
    editPhone(' +998 90 123 45 67 ');
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { phone: '+998 90 123 45 67' }));
    expect(writes.filter((w) => w.table === 'leads')).toHaveLength(0);
  });

  it('clearing the phone sends null', async () => {
    await open({ owner_id: 'me' });
    editPhone('   ');
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { phone: null }));
  });

  it('shows the database\'s phone_invalid and puts the old number back', async () => {
    api.saveFields.mockRejectedValue(new Error('phone_invalid'));
    await open({ owner_id: 'me' });
    editPhone('123');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Telefon raqami noto'g'ri (kamida 9 raqam)"));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Telefon: \+998 94 196 69 89/ })).toBeInTheDocument());
  });

  it('saves the @handle through lead_save_fields, without the @ and in lower case', async () => {
    await open({ owner_id: 'me' });
    fireEvent.click(screen.getByRole('button', { name: /^Instagram: .*o'zgartirish/ }));
    const input = screen.getByRole('textbox', { name: 'Instagram' });
    fireEvent.change(input, { target: { value: '@Dilnoza_A' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { instagram_handle: 'dilnoza_a' }));

    fireEvent.click(screen.getByRole('button', { name: /^Telegram: .*o'zgartirish/ }));
    const tg = screen.getByRole('textbox', { name: 'Telegram' });
    fireEvent.change(tg, { target: { value: '@dilnoza_t' } });
    fireEvent.blur(tg);
    await waitFor(() => expect(api.saveFields).toHaveBeenCalledWith('lead-1', { telegram_handle: 'dilnoza_t' }));
    expect(writes.filter((w) => w.table === 'leads')).toHaveLength(0);
  });

  it('a phone that exists on an older card merges this one: toast and onClose', async () => {
    // the database merges this card into the older one inside the save
    let row = makeLead({ owner_id: 'me' });
    api.fetchLead.mockImplementation(async () => ({ ...row }));
    api.saveFields.mockImplementation(async (_id: string, patch: Partial<LeadV2>) => {
      row = { ...row, ...patch, merged_into_id: 'lead-old' };
    });
    const onClose = vi.fn();
    await open(null, { onClose });
    await screen.findByTestId('lead-card');

    editPhone('+998 90 123 45 67');
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Bu raqam boshqa kartada ham bor — kartalar birlashtirildi'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an ordinary phone change closes nothing', async () => {
    const onClose = vi.fn();
    await open({ owner_id: 'me' }, { onClose });
    editPhone('+998 90 123 45 67');
    await waitFor(() => expect(api.saveFields).toHaveBeenCalled());
    // the lead is refetched after the save; it has not been merged
    await waitFor(() => expect(api.fetchLead.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(toast.info).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a refused phone does not look for a merge', async () => {
    api.saveFields.mockRejectedValue(new Error('phone_invalid'));
    const onClose = vi.fn();
    await open({ owner_id: 'me' }, { onClose });
    editPhone('123');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.info).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('LeadCard — the timeline (block 9)', () => {
  const stream = (): TimelineEntry[] => [
    entry({ at: iso(-60_000), kind: 'event', channel: null, direction: null, body: null, meta: { kind: 'stage', from: 'contacted', to: 'interested' } }),
    entry({ at: iso(-120_000), kind: 'call', channel: 'phone', direction: 'outgoing', body: 'ota-onasi bilan', actor_id: 'op-2', meta: { result: 'no_answer', attempt_no: 1 } }),
    entry({ at: iso(-180_000), kind: 'message_out', channel: 'telegram', direction: 'outgoing', body: 'Salom! Bu javob', actor_id: 'op-2', meta: { delivery_status: 'sent' } }),
    entry({ at: iso(-240_000), kind: 'message_out', channel: 'instagram', direction: 'outgoing', body: 'ichki fikr', meta: { internal: 'true', message_type: 'note' } }),
    entry({ at: iso(-300_000), kind: 'message_in', channel: 'instagram', body: 'Narxi qancha?' }),
    entry({ at: iso(-360_000), kind: 'event', channel: null, direction: null, body: null, meta: { kind: 'lost', reason: 'price', competitor: 'ON201' } }),
    entry({ at: iso(-420_000), kind: 'comment', channel: 'instagram', body: 'Farg‘onada ofis bormi?', meta: { post: 'reel TOPIK 2' } }),
  ];

  it('shows every kind in one stream: bubbles, delivery, a call chip, system lines, a note, a comment', async () => {
    api.fetchTimeline.mockResolvedValue(stream());
    await open({ owner_id: 'me' });
    expect(await screen.findByText('Narxi qancha?')).toBeInTheDocument();
    expect(screen.getByText('Salom! Bu javob')).toBeInTheDocument();
    expect(screen.getByLabelText('Yuborildi')).toBeInTheDocument();
    expect(screen.getByText(/^Ko.tarmadi$/)).toBeInTheDocument(); // the call's result chip
    expect(screen.getByText('1-urinish')).toBeInTheDocument();
    expect(screen.getByText('ota-onasi bilan')).toBeInTheDocument();
    expect(screen.getByText(/Bosqich: Aloqada → Qiziqdi/)).toBeInTheDocument();
    expect(screen.getByText(/Yo'qotildi: Narx · ON201/)).toBeInTheDocument();
    // an internal note is styled as a note (the composer has an "Ichki izoh" chip of its own)
    expect(within(screen.getByTestId('timeline-scroll')).getByText('Ichki izoh')).toBeInTheDocument();
    expect(screen.getByText('ichki fikr')).toBeInTheDocument();
    expect(screen.getByText('Farg‘onada ofis bormi?')).toBeInTheDocument();
  });

  it('puts the newest at the bottom', async () => {
    api.fetchTimeline.mockResolvedValue(stream());
    await open({ owner_id: 'me' });
    const scroll = await screen.findByTestId('timeline-scroll');
    const text = scroll.textContent ?? '';
    expect(text.indexOf('Farg‘onada ofis bormi?')).toBeLessThan(text.indexOf('Narxi qancha?'));
    expect(text.indexOf('Narxi qancha?')).toBeLessThan(text.indexOf('Bosqich: Aloqada'));
  });

  it('filters by channel with chips', async () => {
    api.fetchTimeline.mockResolvedValue(stream());
    await open({ owner_id: 'me' });
    await screen.findByText('Narxi qancha?');
    const chips = within(screen.getByRole('group', { name: 'Kanal filtri' }));
    for (const name of [/Hammasi/, /IG/, /TG/, /Tel/]) expect(chips.getByRole('button', { name })).toBeInTheDocument();

    fireEvent.click(chips.getByRole('button', { name: /TG/ }));
    expect(screen.queryByText('Narxi qancha?')).not.toBeInTheDocument();
    expect(screen.getByText('Salom! Bu javob')).toBeInTheDocument();
    fireEvent.click(chips.getByRole('button', { name: /Tel/ }));
    expect(screen.getByText('ota-onasi bilan')).toBeInTheDocument();
    expect(screen.queryByText('Salom! Bu javob')).not.toBeInTheDocument();
    fireEvent.click(chips.getByRole('button', { name: /Hammasi/ }));
    expect(screen.getByText('Narxi qancha?')).toBeInTheDocument();
  });

  it('loads older rows on request', async () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => entry({ at: iso(-i * 60_000 - 1000), body: `xabar ${i}`, meta: {} }));
    api.fetchTimeline.mockImplementation((_id: string, limit: number) => Promise.resolve(many(Math.min(limit, 400))));
    await open({ owner_id: 'me' });
    const more = await screen.findByRole('button', { name: 'Eskilarini yuklash' });
    expect(api.fetchTimeline).toHaveBeenCalledWith('lead-1', 120);
    fireEvent.click(more);
    await waitFor(() => expect(api.fetchTimeline).toHaveBeenCalledWith('lead-1', 320));
  });

  it('says it is empty when there is nothing yet', async () => {
    await open({ owner_id: 'me' });
    expect(await screen.findByText("Hali yozuv yo'q")).toBeInTheDocument();
  });
});

describe('LeadCard — the composer in the card', () => {
  it('reminds to call first for a phone lead that was never called (last_attempt_at is empty)', async () => {
    await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1', last_attempt_at: null });
    expect(await screen.findByRole('note')).toHaveTextContent("Avval qo'ng'iroq qiling — chat javobi taymerni to'xtatmaydi");
  });

  it('does not nag once a call was tried (last_attempt_at is set)', async () => {
    await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1', last_attempt_at: iso(-3_600_000) });
    await screen.findByRole('textbox');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('does not nag a lead that was already answered, or one without a phone', async () => {
    const answered = await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1', answered_at: iso(-60_000) });
    await screen.findByRole('textbox');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    answered.unmount();
    await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1', phone: null });
    await screen.findByRole('textbox');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('a lead with no chat channel says so', async () => {
    await open({ owner_id: 'me', source: 'meta_form', source_id: 'leadgen-1' });
    expect(screen.getByText("Bu lidda chat kanali yo'q")).toBeInTheDocument();
  });

  it('uses the lead\'s chat identities for the channel list', async () => {
    results.communication_identities = [{ channel: 'telegram', identifier: '555', identifier_label: 'dilnoza_t' }];
    await open({ owner_id: 'me', source: 'meta_form', source_id: 'leadgen-1' });
    const group = await screen.findByRole('group', { name: 'Kanal' });
    expect(within(group).getByRole('button', { name: 'TG @dilnoza_t' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Salom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() => expect(ctx.sendMessage).toHaveBeenCalledWith('Salom', 'telegram', '555'));
  });

  it('"Yozish" puts the caret in the box', async () => {
    await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1' });
    fireEvent.click(within(header()).getByRole('button', { name: 'Yozish' }));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});

describe('LeadCard — drafts (block 8)', () => {
  const draft = (over: Partial<LeadDraft> = {}): LeadDraft => ({
    id: 'd1',
    lead_id: 'lead-1',
    kind: 'followup_d1',
    channel: 'instagram',
    text: 'Dilnoza, savolingizga to‘liq javob beramiz.',
    due_at: iso(-60_000),
    status: 'pending',
    ...over,
  });
  const card = (kind: string) => within(document.querySelector(`[data-draft="${kind}"]`) as HTMLElement);

  const openWithDrafts = async (drafts: LeadDraft[]) => {
    api.fetchDrafts.mockResolvedValue(drafts);
    await open({ owner_id: 'me', source: 'instagram', source_id: 'ig-1' });
    await screen.findByRole('heading', { name: 'Qoralamalar' });
  };

  it('"Yuborish" sends it through the composer and marks it sent', async () => {
    await openWithDrafts([draft()]);
    expect(card('followup_d1').getByText('Kuzatuv · 1-kun')).toBeInTheDocument();
    fireEvent.click(card('followup_d1').getByRole('button', { name: 'Yuborish' }));
    await waitFor(() => expect(ctx.sendMessage).toHaveBeenCalledWith('Dilnoza, savolingizga to‘liq javob beramiz.', 'instagram', 'ig-1'));
    await waitFor(() => expect(api.handleDraft).toHaveBeenCalledWith('d1', 'sent', 'me'));
  });

  it('nothing is sent without a click', async () => {
    await openWithDrafts([draft()]);
    expect(ctx.sendMessage).not.toHaveBeenCalled();
    expect(api.handleDraft).not.toHaveBeenCalled();
  });

  it('"Tahrir" moves the text into the composer; sending it from there completes the draft', async () => {
    await openWithDrafts([draft()]);
    fireEvent.click(card('followup_d1').getByRole('button', { name: 'Tahrir' }));
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toBe('Dilnoza, savolingizga to‘liq javob beramiz.'));
    expect(ctx.sendMessage).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: 'Dilnoza, qisqartirilgan javob.' } });
    // the draft's own "Yuborish" comes first in the page, the composer's is the last one
    fireEvent.click(screen.getAllByRole('button', { name: 'Yuborish' }).pop() as HTMLElement);
    await waitFor(() => expect(ctx.sendMessage).toHaveBeenCalledWith('Dilnoza, qisqartirilgan javob.', 'instagram', 'ig-1'));
    await waitFor(() => expect(api.handleDraft).toHaveBeenCalledWith('d1', 'sent', 'me'));
  });

  it('"O\'tkazib yuborish" skips it without sending', async () => {
    await openWithDrafts([draft()]);
    fireEvent.click(card('followup_d1').getByRole('button', { name: "O'tkazib yuborish" }));
    await waitFor(() => expect(api.handleDraft).toHaveBeenCalledWith('d1', 'skipped', 'me'));
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  it('a draft with a forbidden word cannot be sent as it stands', async () => {
    await openWithDrafts([draft({ id: 'd2', kind: 'ai_reply', text: 'Kafolat beramiz, 10% chegirma bilan' })]);
    const c = card('ai_reply');
    expect(c.getByRole('alert')).toHaveTextContent("'kafolat' so'zi taqiqlangan");
    expect(c.getByRole('button', { name: 'Yuborish' })).toBeDisabled();
    expect(c.getByRole('button', { name: 'Tahrir' })).toBeEnabled(); // fix it in the composer
  });

  it('has no block when there is no draft', async () => {
    await open({ owner_id: 'me' });
    await screen.findByTestId('lead-card');
    expect(screen.queryByRole('heading', { name: 'Qoralamalar' })).not.toBeInTheDocument();
  });
});

describe('LeadCard — merge suggestions (block 7)', () => {
  beforeEach(() => {
    api.fetchMergeSuggestions.mockResolvedValue([
      { id: 'm1', lead_id: 'lead-1', other_id: 'lead-2', reason: 'same_name', status: 'pending' },
    ]);
    api.fetchLeadBrief.mockResolvedValue([
      { id: 'lead-2', full_name: 'Dilnoza A.', phone: '+998 90 111 22 33', source: 'telegram', stage: 'contacted', created_at: '2026-10-01T09:00:00Z' },
    ]);
  });

  it('shows "Bu odam bo\'lishi mumkin" with the other card and lets the operator merge', async () => {
    await open({ owner_id: 'me' });
    expect(await screen.findByText("Bu odam bo'lishi mumkin")).toBeInTheDocument();
    expect(screen.getByText('Dilnoza A.')).toBeInTheDocument();
    expect(screen.getByText(/Ismi bir xil/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Birlashtirish' }));
    await waitFor(() => expect(api.confirmMerge).toHaveBeenCalledWith('m1'));
  });

  it('...or dismiss it', async () => {
    await open({ owner_id: 'me' });
    fireEvent.click(await screen.findByRole('button', { name: 'Rad etish' }));
    await waitFor(() => expect(api.dismissMerge).toHaveBeenCalledWith('m1'));
  });
});

describe('LeadCard — AI field suggestions', () => {
  it('shows pending suggestions for empty fields between the 5 fields and "Malaka va taklif"', async () => {
    results.lead_field_suggestions = [
      { id: 's1', lead_id: 'lead-1', field: 'cert_level', suggested_value: 'TOPIK 3', confidence: 0.9, evidence: 'TOPIK 3 oldim', evidence_channel: 'instagram', status: 'pending' },
      { id: 's2', lead_id: 'lead-1', field: 'education_level', suggested_value: 'Magistr', confidence: 0.7, evidence: null, evidence_channel: null, status: 'pending' },
    ];
    await open({ owner_id: 'me', education_level: 'Bakalavr' }); // goal is known: only the certificate is offered
    const block = await screen.findByRole('heading', { name: 'AI taklif qilgan maydonlar' });
    expect(document.querySelector('[data-suggestion="cert_level"]')).not.toBeNull();
    expect(document.querySelector('[data-suggestion="education_level"]')).toBeNull();
    expect(heading('5 majburiy maydon').compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block.compareDocumentPosition(heading('Malaka va taklif')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is absent when there are none', async () => {
    await open({ owner_id: 'me' });
    await screen.findByTestId('lead-card');
    expect(screen.queryByRole('heading', { name: 'AI taklif qilgan maydonlar' })).not.toBeInTheDocument();
  });

  it('listens to lead_field_suggestions of this lead on the card\'s realtime channel', async () => {
    await open({ owner_id: 'me' });
    await screen.findByTestId('lead-card');
    const tables = channelChain.on.mock.calls.map((c: unknown[]) => c[1] as { table?: string; filter?: string });
    expect(tables).toContainEqual(expect.objectContaining({ table: 'lead_field_suggestions', filter: 'lead_id=eq.lead-1' }));
    expect(tables).toContainEqual(expect.objectContaining({ table: 'lead_events', filter: 'lead_id=eq.lead-1' }));
    expect(tables).toContainEqual(expect.objectContaining({ table: 'leads', filter: 'id=eq.lead-1' }));
  });
});

describe('LeadCard — switching to another lead', () => {
  it('does not carry the composer text over: a message written for one person must not go to the next', async () => {
    api.fetchLead.mockImplementation(async (id: string) => makeLead({ id, owner_id: 'me', source: 'instagram', source_id: `ig-${id}` }));
    const { qc, rerender } = renderWithQuery(<LeadCard leadId="lead-1" />);
    await screen.findByTestId('lead-card');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'faqat Dilnozaga' } });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('faqat Dilnozaga');

    rerender(
      <QueryClientProvider client={qc}>
        <LeadCard leadId="lead-2" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(api.fetchLead).toHaveBeenCalledWith('lead-2'));
    await screen.findByTestId('lead-card');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('LeadCard — Kutish, Yo\'qotildi and the promise dialog open from the card', () => {
  it('opens Kutish, Yo\'qotildi and the promise request', async () => {
    await open({ owner_id: 'me', answered_at: iso(-3_600_000) });
    fireEvent.click(within(header()).getByRole('button', { name: 'Kutish' }));
    expect(await screen.findByRole('heading', { name: 'Kutish' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(within(header()).getByRole('button', { name: "Yo'qotildi" }));
    expect(await screen.findByRole('heading', { name: "Yo'qotildi" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: "Chegirma / maxsus shart so'rash" }));
    expect(await screen.findByRole('heading', { name: "Chegirma / maxsus shart so'rash" })).toBeInTheDocument();
  });
});
