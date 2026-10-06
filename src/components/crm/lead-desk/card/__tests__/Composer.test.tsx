import { createRef, type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

const messages = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('@/hooks/useMessages', () => ({ useMessages: () => ({ sendMessage: messages.sendMessage }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

import { toast } from 'sonner';
import type { LeadPromise } from '../../types';
import type { ChatChannel } from '../cardLogic';
import { Composer, type ComposerHandle } from '../Composer';
import { resetSupabaseMock, writes } from './supabaseMock';
import { SETTINGS, makeLead, renderWithQuery } from './helpers';

vi.setConfig({ testTimeout: 30_000 });

const IG: ChatChannel = { source: 'instagram', senderId: 'ig-1', label: '@dilnoza_a' };
const TG: ChatChannel = { source: 'telegram', senderId: '555', label: '' };

const approved: LeadPromise = {
  id: 'p1',
  lead_id: 'lead-1',
  operator_id: 'me',
  kind: 'discount',
  text: '10% chegirma',
  reason: null,
  status: 'approved',
  decided_by: 'boss',
  decided_at: '2026-10-05T10:00:00Z',
  created_at: '2026-10-05T09:00:00Z',
};

function setup(props: Partial<ComponentProps<typeof Composer>> = {}) {
  const onNeedPromise = vi.fn();
  const onSent = vi.fn();
  const ref = createRef<ComposerHandle>();
  const utils = renderWithQuery(
    <Composer
      ref={ref}
      lead={makeLead({ full_name: 'Dilnoza Abdullayeva', language: 'uz' })}
      channels={[IG]}
      lastIncomingChannel={null}
      settings={SETTINGS}
      promises={[]}
      neverCalled={false}
      operatorName="Omina"
      onNeedPromise={onNeedPromise}
      onSent={onSent}
      {...props}
    />,
  );
  return { onNeedPromise, onSent, ref, ...utils };
}

const box = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const sendButton = () => screen.getByRole('button', { name: /Yuborish|Izohni saqlash/ });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseMock();
  messages.sendMessage.mockResolvedValue({ error: null, queued: true });
});

describe('Composer — sending', () => {
  it('sends through MessagesContext.sendMessage(text, source, senderId) — the Xabarlar send path', async () => {
    const { onSent } = setup();
    type('Salom, qanday yordam beray?');
    expect(sendButton()).toBeEnabled();
    fireEvent.click(sendButton());

    await waitFor(() => expect(messages.sendMessage).toHaveBeenCalledWith('Salom, qanday yordam beray?', 'instagram', 'ig-1'));
    await waitFor(() => expect(box().value).toBe(''));
    expect(onSent).toHaveBeenCalledWith({ text: 'Salom, qanday yordam beray?', source: 'instagram' });
  });

  it('Enter sends, Shift+Enter does not', async () => {
    setup();
    type('Salom');
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true });
    expect(messages.sendMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(messages.sendMessage).toHaveBeenCalledTimes(1));
  });

  it('addresses the channel the operator picks', async () => {
    setup({ channels: [IG, TG] });
    fireEvent.click(within(screen.getByRole('group', { name: 'Kanal' })).getByRole('button', { name: /TG/ }));
    type('Salom');
    fireEvent.click(sendButton());
    await waitFor(() => expect(messages.sendMessage).toHaveBeenCalledWith('Salom', 'telegram', '555'));
  });

  it('starts on the channel the client wrote on last', async () => {
    setup({ channels: [IG, TG], lastIncomingChannel: 'telegram' });
    type('Salom');
    fireEvent.click(sendButton());
    await waitFor(() => expect(messages.sendMessage).toHaveBeenCalledWith('Salom', 'telegram', '555'));
  });

  it('keeps the text and says why when nothing was saved', async () => {
    messages.sendMessage.mockResolvedValue({ error: new Error('24-hour window expired'), queued: false });
    const { onSent } = setup();
    type('Salom');
    fireEvent.click(sendButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('24-hour window expired'));
    expect(box().value).toBe('Salom');
    expect(onSent).not.toHaveBeenCalled();
  });

  it('says there is no chat when the lead has none, and offers no box', () => {
    setup({ channels: [] });
    expect(screen.getByText("Bu lidda chat kanali yo'q")).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('is read-only on a lead somebody else holds', () => {
    setup({ disabled: true });
    expect(box()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
  });
});

describe('Composer — the forbidden-word guard', () => {
  it('stops a forbidden word: names it, underlines it in red and disables sending', () => {
    setup();
    type('Biz sizga kafolat beramiz');

    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent("'kafolat' so'zi taqiqlangan");
    const mark = screen.getByText('kafolat', { selector: 'mark' });
    expect(mark).toBeInTheDocument();
    expect(mark.className).toContain('decoration-destructive');
    expect(box()).toHaveAttribute('aria-invalid', 'true');

    // Enter does not get it through either
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });

  it('clears the moment the word is removed', () => {
    setup();
    type('kafolat');
    expect(sendButton()).toBeDisabled();
    type('ishonch');
    expect(sendButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('mark')).toBeNull();
  });

  it('matches every word of the list, whatever the case', () => {
    setup();
    for (const [text, word] of [
      ['BEPUL NOUTBUK beramiz', 'bepul noutbuk'],
      ['Bu bitta narx', 'bitta narx'],
      ['100% natija', '100%'],
      ['sertifikatsiz Koreya', 'sertifikatsiz Koreya'],
    ] as const) {
      type(text);
      expect(screen.getByRole('alert')).toHaveTextContent(`'${word}' so'zi taqiqlangan`);
      expect(sendButton()).toBeDisabled();
    }
  });

  it('uses the words from the settings', () => {
    setup({ settings: { ...SETTINGS, forbidden_words: ['arzon'] } });
    type('juda arzon narx');
    expect(screen.getByRole('alert')).toHaveTextContent("'arzon' so'zi taqiqlangan");
    type('kafolat'); // not on this list any more
    expect(sendButton()).toBeEnabled();
  });

  it('a "% chegirma" phrase is blocked, with the hint and a way to ask the boss', () => {
    const { onNeedPromise } = setup();
    type('Sizga 10% chegirma qilib beramiz');

    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent("Avval rahbar tasdig'ini oling");
    expect(screen.getByText('10% chegirma', { selector: 'mark' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Chegirma / maxsus shart so'rash" }));
    expect(onNeedPromise).toHaveBeenCalledTimes(1);
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });

  it('a pending or rejected promise does not unlock the phrase', () => {
    setup({ promises: [{ ...approved, status: 'pending' }, { ...approved, id: 'p2', status: 'rejected' }] });
    type('10% chegirma');
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent("Avval rahbar tasdig'ini oling");
  });

  it('an approved promise unlocks it: no alert, no underline, it sends', async () => {
    setup({ promises: [approved] });
    type('10% chegirma');
    expect(sendButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('mark')).toBeNull();
    fireEvent.click(sendButton());
    await waitFor(() => expect(messages.sendMessage).toHaveBeenCalledWith('10% chegirma', 'instagram', 'ig-1'));
  });

  it('an approved promise still does not allow a forbidden word', () => {
    setup({ promises: [approved] });
    type('10% chegirma, kafolat bilan');
    expect(screen.getByRole('alert')).toHaveTextContent("'kafolat'");
    expect(sendButton()).toBeDisabled();
  });

  it('refuses text with an unfilled {variable}', () => {
    setup();
    type('{ism}, {sana} gacha');
    expect(screen.getByRole('alert')).toHaveTextContent("To'ldirilmagan o'zgaruvchi: {ism}");
    expect(sendButton()).toBeDisabled();
  });

  it('guards a draft sent through the ref too', async () => {
    const { ref } = setup();
    let blocked: boolean | undefined;
    await act(async () => {
      blocked = await ref.current?.send('kafolat beramiz');
    });
    expect(blocked).toBe(false);
    expect(messages.sendMessage).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("'kafolat' so'zi taqiqlangan");

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await ref.current?.send('Salom');
    });
    expect(allowed).toBe(true);
    expect(messages.sendMessage).toHaveBeenCalledWith('Salom', 'instagram', 'ig-1');
  });
});

describe('Composer — internal notes', () => {
  it('are never relayed and skip the guard; they are stored as a note on the conversation', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Ichki izoh/ }));
    type('mijoz kafolat so‘radi');
    expect(sendButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(sendButton());

    await waitFor(() => expect(writes.length).toBe(1));
    expect(messages.sendMessage).not.toHaveBeenCalled();
    expect(writes[0]).toMatchObject({
      table: 'messages',
      op: 'insert',
      row: {
        source: 'instagram',
        sender_id: 'ig-1',
        content: 'mijoz kafolat so‘radi',
        direction: 'outgoing',
        message_type: 'note',
        metadata: { internal: true },
        replied_by: 'me',
      },
    });
  });
});

describe('Composer — templates', () => {
  const openTemplates = () => fireEvent.click(screen.getByRole('button', { name: /Shablon$/ }));

  const templateList = () => within(screen.getByRole('list'));

  it('fills the variables from the lead and puts the text in the box', () => {
    setup();
    openTemplates();
    fireEvent.click(templateList().getByRole('button', { name: /Assalomu alaykum/ }));
    expect(box().value).toBe("Assalomu alaykum, Dilnoza! HANGUK Consulting. Koreyada qaysi yo'nalish qiziqtiradi?");
    expect(sendButton()).toBeEnabled();
  });

  it('filters by group and follows the language switch', () => {
    setup({ lead: makeLead({ full_name: 'Dilnoza Abdullayeva', language: 'ru' }) });
    openTemplates();
    expect(templateList().getAllByRole('button')).toHaveLength(3);
    fireEvent.click(within(screen.getByRole('group', { name: 'Shablon guruhi' })).getByRole('button', { name: 'Kuzatuv' }));
    expect(templateList().getAllByRole('button')).toHaveLength(1);

    // the lead speaks Russian: RU is on; switching to UZ changes the preview
    expect(within(screen.getByRole('group', { name: 'Shablon tili' })).getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'true');
    expect(templateList().getByText(/срок подачи документов/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Shablon tili' })).getByRole('button', { name: 'UZ' }));
    expect(templateList().getByText(/hujjat topshirish muddati/)).toBeInTheDocument();
  });

  it('a template with a variable it cannot know ({sana}) stays blocked until the operator edits it', () => {
    setup();
    openTemplates();
    fireEvent.click(within(screen.getByRole('group', { name: 'Shablon guruhi' })).getByRole('button', { name: 'Kuzatuv' }));
    fireEvent.click(templateList().getByRole('button', { name: /sana/ }));
    expect(box().value).toContain('{sana}');
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('{sana}');
    type(box().value.replace('{sana}', '15.11'));
    expect(sendButton()).toBeEnabled();
  });

  it('appends to what is already typed instead of throwing it away', () => {
    setup();
    type('Avval shuni yozdim');
    openTemplates();
    fireEvent.click(templateList().getByRole('button', { name: /Assalomu alaykum/ }));
    expect(box().value.startsWith('Avval shuni yozdim\n\n')).toBe(true);
  });

  it('prefill() — what "Chatga yozish" and "Tahrir" use — replaces the text and picks the channel', async () => {
    const { ref } = setup({ channels: [IG, TG] });
    act(() => ref.current?.prefill('Salom, bog‘lanmoqchi edik', 'telegram'));
    await waitFor(() => {
      expect(box().value).toBe('Salom, bog‘lanmoqchi edik');
      expect(within(screen.getByRole('group', { name: 'Kanal' })).getByRole('button', { name: /TG/ })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

describe('Composer — the call-first hint (spec §1.4)', () => {
  it('reminds the operator to call a phone lead that was never called', () => {
    setup({ neverCalled: true });
    expect(screen.getByRole('note')).toHaveTextContent("Avval qo'ng'iroq qiling — chat javobi taymerni to'xtatmaydi");
  });

  it('is not shown for a lead that was called, or when the setting lets chat answer phone leads', () => {
    const { unmount } = setup({ neverCalled: false });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    unmount();
    setup({ neverCalled: true, settings: { ...SETTINGS, chat_answers_phone_leads: true } });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
