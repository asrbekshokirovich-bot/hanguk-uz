import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { button, openTab, queryButton, renderWithProviders } from '../../lists/__tests__/testUtils';
import CommentsPanel from '../CommentsPanel';
import { comment } from './fixtures';

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({
  fetchComments: vi.fn(),
  answerComment: vi.fn(),
  fetchSettings: vi.fn(),
}));
vi.mock('../../api', () => api);

const sb = vi.hoisted(() => ({
  invoke: vi.fn(),
  removeChannel: vi.fn(),
  onChange: null as null | (() => void),
  subscribed: 0,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: sb.invoke },
    channel: () => {
      const ch = {
        on: (_event: string, _filter: unknown, cb: () => void) => {
          sb.onChange = cb;
          return ch;
        },
        subscribe: () => {
          sb.subscribed += 1;
          return ch;
        },
      };
      return ch;
    },
    removeChannel: sb.removeChannel,
  },
}));

vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [{ id: 'p1', user_id: 'u-omina', full_name: 'Omina', username: null, avatar_url: null }],
    loading: false,
    searchStaff: () => [],
  }),
}));

const TEMPLATE_UZ = "Assalomu alaykum! Batafsil ma'lumotni shaxsiy xabarda yozamiz.";

const open1 = comment({ id: 'row-1', comment_id: 'meta-1', author_username: 'malika.r', text: 'Narxi qancha?', lead_id: 'lead-1' });
const open2 = comment({ id: 'row-2', comment_id: 'meta-2', author_username: 'sardor_k', text: 'Qachon boshlanadi?', lead_id: 'lead-2' });
const done = comment({
  id: 'row-3',
  comment_id: 'meta-3',
  author_username: 'bek_uz',
  text: "Farg'onada ofis bormi?",
  post_label: 'post 03.10',
  replied_at: '2026-10-03T06:04:00Z',
  replied_by: 'u-omina',
  reply_text: 'Ha, Farg‘onada ofisimiz bor.',
});

const renderPanel = (open = true) => {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(<CommentsPanel open={open} onOpenChange={onOpenChange} />, { route: '/crm/desk' });
  return { ...view, onOpenChange };
};

const answerBox = (author: string) => screen.getByLabelText(`Ochiq javob: ${author}`);

beforeEach(() => {
  vi.clearAllMocks();
  sb.onChange = null;
  sb.subscribed = 0;
  api.fetchSettings.mockResolvedValue({
    templates: [{ key: 'comment_reply', group: 'izoh', uz: TEMPLATE_UZ, ru: 'Подробности напишем в личные сообщения.' }],
  });
  api.fetchComments.mockImplementation(async (opts: { onlyOpen?: boolean } = {}) => (opts.onlyOpen ? [open1, open2] : [open1, open2, done]));
  api.answerComment.mockResolvedValue(undefined);
  sb.invoke.mockResolvedValue({ data: { ok: true, reply_id: 'ig-reply-1' }, error: null });
});

describe('Izohlar panel', () => {
  it('lists the unanswered comments first, with time, @author, post and text', async () => {
    renderPanel();
    expect(await screen.findByText('Javobsiz 2', { selector: '[role="tab"]' })).toBeInTheDocument();
    const item = (await screen.findByText('Narxi qancha?')).closest('li')!;
    expect(within(item).getByText('@malika.r')).toBeInTheDocument();
    expect(within(item).getByText('reel «TOPIK 2 bilan kollej»')).toBeInTheDocument();
    expect(within(item).getByText('06:30')).toBeInTheDocument(); // 01:30 UTC in Tashkent
    expect(screen.getByText('Qachon boshlanadi?')).toBeInTheDocument();
    expect(screen.queryByText("Farg'onada ofis bormi?")).not.toBeInTheDocument(); // answered: only under Hammasi
    expect(api.fetchComments).toHaveBeenCalledWith({ onlyOpen: true, limit: 200 });
  });

  it('"Hammasi" shows the answered ones with who answered and what', async () => {
    renderPanel();
    await screen.findByText('Narxi qancha?');
    openTab('Hammasi');
    const item = (await screen.findByText("Farg'onada ofis bormi?")).closest('li')!;
    expect(within(item).getByText(/javob berildi · Omina, 11:04/)).toBeInTheDocument();
    expect(within(item).getByText('Ha, Farg‘onada ofisimiz bor.')).toBeInTheDocument();
    expect(queryButton('Javob yozish', item)).not.toBeInTheDocument();
  });

  it('says "Izohlar yo\'q" when there are none (Meta has not approved the permissions yet)', async () => {
    api.fetchComments.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText("Izohlar yo'q")).toBeInTheDocument();
    expect(screen.getByText('Javobsiz 0', { selector: '[role="tab"]' })).toBeInTheDocument();
    openTab('Hammasi');
    expect(await screen.findByText(/Meta ruxsati tasdiqlangach/)).toBeInTheDocument();
  });

  it('shows an error with a retry, not an empty list, when the read fails', async () => {
    api.fetchComments.mockRejectedValueOnce(new Error('not_allowed')).mockRejectedValueOnce(new Error('not_allowed'));
    renderPanel();
    expect(await screen.findByText("Izohlarni yuklab bo'lmadi")).toBeInTheDocument();
    fireEvent.click(button('Qayta urinish'));
    expect(await screen.findByText('Narxi qancha?')).toBeInTheDocument();
  });

  it('reads nothing while it is closed', () => {
    renderPanel(false);
    expect(api.fetchComments).not.toHaveBeenCalled();
    expect(screen.queryByText('Izohlar')).not.toBeInTheDocument();
  });

  it('refreshes when a comment arrives or is answered (realtime on social_comments)', async () => {
    const { unmount } = renderPanel();
    await screen.findByText('Narxi qancha?');
    await waitFor(() => expect(sb.onChange).not.toBeNull());
    const before = api.fetchComments.mock.calls.length;

    api.fetchComments.mockImplementation(async (opts: { onlyOpen?: boolean } = {}) =>
      opts.onlyOpen ? [open1, open2, comment({ id: 'row-9', author_username: 'yangi_izoh', text: 'Yangi izoh' })] : [],
    );
    sb.onChange!();

    expect(await screen.findByText('Yangi izoh')).toBeInTheDocument();
    expect(api.fetchComments.mock.calls.length).toBeGreaterThan(before);
    expect(screen.getByText('Javobsiz 3', { selector: '[role="tab"]' })).toBeInTheDocument();

    unmount();
    expect(sb.removeChannel).toHaveBeenCalled(); // no leaked subscription
  });
});

describe('answering a comment', () => {
  const startReply = async (text = 'Narxi qancha?') => {
    renderPanel();
    const item = (await screen.findByText(text)).closest('li')!;
    fireEvent.click(button('Javob yozish', item));
    return item;
  };

  it('Yuborish posts on Instagram with the Meta comment id, THEN records the answer', async () => {
    const order: string[] = [];
    sb.invoke.mockImplementation(async () => {
      order.push('instagram-send');
      return { data: { ok: true }, error: null };
    });
    api.answerComment.mockImplementation(async () => {
      order.push('answerComment');
    });
    const item = await startReply();

    fireEvent.change(answerBox('malika.r'), { target: { value: "Assalomu alaykum! Batafsil DM'da yozamiz." } });
    fireEvent.click(button('Yuborish', item));

    await waitFor(() => expect(api.answerComment).toHaveBeenCalledTimes(1));
    expect(sb.invoke).toHaveBeenCalledWith('instagram-send', {
      body: { action: 'reply_comment', comment_id: 'meta-1', text: "Assalomu alaykum! Batafsil DM'da yozamiz." },
    });
    // our row id, not the Meta id
    expect(api.answerComment).toHaveBeenCalledWith('row-1', "Assalomu alaykum! Batafsil DM'da yozamiz.");
    expect(order).toEqual(['instagram-send', 'answerComment']);
    // the list is read again
    await waitFor(() => expect(api.fetchComments.mock.calls.length).toBeGreaterThan(2));
  });

  it('the template button fills in the comment_reply template from the settings', async () => {
    const item = await startReply();
    const shablon = await within(item).findByText('Shablon', { selector: 'button' });
    fireEvent.click(shablon);
    expect(answerBox('malika.r')).toHaveValue(TEMPLATE_UZ);
  });

  it('uses the Russian template for a Russian comment', async () => {
    api.fetchComments.mockImplementation(async (opts: { onlyOpen?: boolean } = {}) =>
      opts.onlyOpen ? [comment({ id: 'row-ru', comment_id: 'meta-ru', author_username: 'ivan', text: 'Сколько стоит?' })] : [],
    );
    const item = await startReply('Сколько стоит?');
    fireEvent.click(await within(item).findByText('Shablon', { selector: 'button' }));
    expect(answerBox('ivan')).toHaveValue('Подробности напишем в личные сообщения.');
  });

  it('does not touch the CRM when Instagram refuses, and shows why', async () => {
    sb.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: 'Forbidden: staff role required' }), { status: 403 }) },
    });
    const item = await startReply();
    fireEvent.change(answerBox('malika.r'), { target: { value: 'Salom' } });
    fireEvent.click(button('Yuborish', item));

    expect(await within(item).findByText('Yuborilmadi: Forbidden: staff role required')).toBeInTheDocument();
    expect(api.answerComment).not.toHaveBeenCalled();
    expect(answerBox('malika.r')).toHaveValue('Salom'); // the typing is kept
  });

  it('if the CRM cannot record it after Instagram took it, the retry does not post a second time', async () => {
    api.answerComment.mockRejectedValueOnce(new Error('not_allowed')).mockResolvedValueOnce(undefined);
    const item = await startReply();
    fireEvent.change(answerBox('malika.r'), { target: { value: 'Salom' } });
    fireEvent.click(button('Yuborish', item));

    expect(await within(item).findByText(/Instagramga yuborildi, lekin CRMga yozilmadi/)).toBeInTheDocument();
    expect(sb.invoke).toHaveBeenCalledTimes(1);

    fireEvent.click(button('CRMga yozish', item));
    await waitFor(() => expect(api.answerComment).toHaveBeenCalledTimes(2));
    expect(sb.invoke).toHaveBeenCalledTimes(1); // still the one post
  });

  it('a forbidden word is flagged and cannot be sent', async () => {
    const item = await startReply();
    fireEvent.change(answerBox('malika.r'), { target: { value: 'Biz kafolat beramiz' } });

    expect(within(item).getByText(/Taqiqlangan so'z: «kafolat»/)).toBeInTheDocument();
    expect(button('Yuborish', item)).toBeDisabled();
    fireEvent.click(button('Yuborish', item));
    expect(sb.invoke).not.toHaveBeenCalled();
    expect(api.answerComment).not.toHaveBeenCalled();
  });

  it('"% chegirma" is blocked too', async () => {
    const item = await startReply();
    fireEvent.change(answerBox('malika.r'), { target: { value: '10% chegirma bor' } });
    expect(within(item).getByText(/Taqiqlangan so'z: «% chegirma»/)).toBeInTheDocument();
    expect(button('Yuborish', item)).toBeDisabled();
  });

  it('a price in the public reply warns, and goes out only after the person confirms', async () => {
    const item = await startReply();
    fireEvent.change(answerBox('malika.r'), { target: { value: "Narxi 2 000 000 so'm" } });

    expect(within(item).getByText(/Ochiq javobda narx bor: «2 000 000 so'm»/)).toBeInTheDocument();
    expect(button('Yuborish', item)).toBeDisabled();

    fireEvent.click(within(item).getByLabelText('Baribir ochiq yuborish'));
    expect(button('Yuborish', item)).toBeEnabled();
    fireEvent.click(button('Yuborish', item));

    await waitFor(() => expect(api.answerComment).toHaveBeenCalledWith('row-1', "Narxi 2 000 000 so'm"));
    expect(sb.invoke).toHaveBeenCalledTimes(1);
  });

  it('a dollar price warns as well, and editing the text takes the confirmation back', async () => {
    const item = await startReply();
    fireEvent.change(answerBox('malika.r'), { target: { value: 'Faqat $400' } });
    fireEvent.click(within(item).getByLabelText('Baribir ochiq yuborish'));
    expect(button('Yuborish', item)).toBeEnabled();

    fireEvent.change(answerBox('malika.r'), { target: { value: 'Faqat $450' } });
    expect(within(item).getByLabelText('Baribir ochiq yuborish')).not.toBeChecked();
    expect(button('Yuborish', item)).toBeDisabled();
  });

  it('cannot send an empty reply', async () => {
    const item = await startReply();
    expect(button('Yuborish', item)).toBeDisabled();
    fireEvent.change(answerBox('malika.r'), { target: { value: '   ' } });
    expect(button('Yuborish', item)).toBeDisabled();
  });

  it('cannot answer a comment that has no Instagram id', async () => {
    api.fetchComments.mockImplementation(async (opts: { onlyOpen?: boolean } = {}) =>
      opts.onlyOpen ? [comment({ id: 'row-x', comment_id: null, author_username: 'x_user', text: 'Salom izoh' })] : [],
    );
    const item = await startReply('Salom izoh');
    fireEvent.change(answerBox('x_user'), { target: { value: 'Salom' } });
    fireEvent.click(button('Yuborish', item));
    expect(await within(item).findByText(/identifikatori yo'q/)).toBeInTheDocument();
    expect(sb.invoke).not.toHaveBeenCalled();
    expect(api.answerComment).not.toHaveBeenCalled();
  });
});

describe("DM'da davom etish", () => {
  it("opens the lead on the desk (?lead=<lead_id>) and closes the panel", async () => {
    const { onOpenChange } = renderPanel();
    const item = (await screen.findByText('Narxi qancha?')).closest('li')!;
    fireEvent.click(button("DM'da davom etish", item));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/crm/desk?lead=lead-1');
  });

  it('is off for a comment that is not linked to a lead yet', async () => {
    api.fetchComments.mockImplementation(async (opts: { onlyOpen?: boolean } = {}) =>
      opts.onlyOpen ? [comment({ id: 'row-n', author_username: 'no_lead', text: 'Bog‘lanmagan', lead_id: null })] : [],
    );
    renderPanel();
    const item = (await screen.findByText('Bog‘lanmagan')).closest('li')!;
    expect(button("DM'da davom etish", item)).toBeDisabled();
  });
});
