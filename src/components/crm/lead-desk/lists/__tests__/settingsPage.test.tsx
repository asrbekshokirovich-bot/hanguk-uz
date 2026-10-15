import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import LeadSettingsContent from '@/components/crm/pages/LeadSettingsContent';
import { DEFAULT_SETTINGS } from '../../useLeadSettings';
import type { AlertRecipient, TemplateSetting } from '../../types';
import { button, dialogGone, findDialog, queryButton, renderWithProviders } from './testUtils';

const api = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  saveSetting: vi.fn(),
  fetchRecipients: vi.fn(),
  saveRecipient: vi.fn(),
  deleteRecipient: vi.fn(),
}));
vi.mock('../../api', () => api);

const role = vi.hoisted(() => ({ value: { isAdmin: true, isLeadSenior: true, loading: false } }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role.value }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [
      { id: 'p1', user_id: 'u-omina', full_name: 'Omina', username: null, avatar_url: null },
      { id: 'p2', user_id: 'u-bek', full_name: 'Bekzod', username: null, avatar_url: null },
    ],
    loading: false,
    searchStaff: () => [],
  }),
}));

const templates: TemplateSetting[] = [
  { key: 'greeting', group: 'salom', uz: 'Assalomu alaykum, {ism}!', ru: 'Здравствуйте, {ism}!' },
  { key: 'no_risk_offer', group: 'no_risk', uz: 'NO RISK: {tarif}', ru: 'NO RISK: {tarif}', needs_boss: true },
  { key: 'comment_reply', group: 'izoh', uz: "Batafsil ma'lumotni shaxsiy xabarda yozamiz.", ru: 'Подробности в личные сообщения.' },
];

const recipient: AlertRecipient = {
  chat_id: '111222333',
  label: 'Omina (operator)',
  enabled: true,
  watchdog: false,
  staff_user_id: 'u-omina',
  escalate: true,
  boss_alerts: false,
  reports_daily: false,
  reports_weekly: false,
};

const saved = () => api.saveSetting.mock.calls.map((c) => [c[0], c[1], c[2]]);
// getByRole styles every element it looks at (seconds per query on this page in jsdom): use text / label lookups
const goTo = (title: string) => fireEvent.click(within(screen.getByLabelText("Sozlamalar bo'limlari")).getByText(title));
const sectionOf = async (title: string) => (await screen.findByText(title, { selector: 'h2' })).closest('section') as HTMLElement;
const toggleRow = (sec: HTMLElement, key: string) => fireEvent.click(within(sec).getByText(key, { selector: 'button span' }));

async function openAs(r: typeof role.value) {
  role.value = r;
  const view = renderWithProviders(<LeadSettingsContent />);
  await screen.findByLabelText("Sozlamalar bo'limlari");
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  role.value = { isAdmin: true, isLeadSenior: true, loading: false };
  api.fetchSettings.mockResolvedValue({ templates });
  api.saveSetting.mockResolvedValue(undefined);
  api.fetchRecipients.mockResolvedValue([recipient]);
  api.saveRecipient.mockResolvedValue(undefined);
  api.deleteRecipient.mockResolvedValue(undefined);
});

describe('who sees what', () => {
  it('the boss sees every section', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    const navEl = screen.getByLabelText("Sozlamalar bo'limlari");
    const names = Array.from(navEl.querySelectorAll('button')).map((b) => b.textContent);
    expect(names).toEqual([
      'Ish vaqti',
      'Taymer va eskalatsiya',
      'Zinapoya',
      'Avtojavob matni',
      'Shablonlar',
      "Taqiqlangan so'zlar",
      "Rahbarga darhol so'zlar",
      'Ruxsat etilgan takliflar',
      "Yo'qotish sabablari",
      'Navbat kunlik limiti',
      "Hanbox va NO RISK e'lonlari",
      "Chat javobi telefonli lidni to'xtatadimi",
      "Nazorat chizig'i va TV",
      'Telegram qabul qiluvchilar',
    ]);
  });

  it('a senior gets the templates and nothing else (the database says the same)', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const navEl = screen.getByLabelText("Sozlamalar bo'limlari");
    expect(Array.from(navEl.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Shablonlar']);
    expect(await sectionOf('Shablonlar')).toBeInTheDocument();
    expect(screen.queryByText('Zinapoya', { selector: 'h2' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Taymer (daqiqa)')).not.toBeInTheDocument();
    expect(screen.getByText(/faqat shablonlarni tahrirlay olasiz/)).toBeInTheDocument();
    expect(api.fetchRecipients).not.toHaveBeenCalled(); // the chat ids are the boss's
  });

  it('an operator gets nothing', async () => {
    role.value = { isAdmin: false, isLeadSenior: false, loading: false };
    renderWithProviders(<LeadSettingsContent />);
    expect(screen.getByText('Sozlamalar faqat rahbar (admin) uchun.')).toBeInTheDocument();
    expect(api.fetchSettings).not.toHaveBeenCalled();
  });

  it('does not show editable defaults when the saved settings could not be read', async () => {
    api.fetchSettings.mockRejectedValueOnce(new Error('Failed to fetch'));
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    expect(await screen.findByText("Sozlamalarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(queryButton('Saqlash')).not.toBeInTheDocument();
    fireEvent.click(button('Qayta urinish'));
    expect(await sectionOf('Ish vaqti')).toBeInTheDocument();
  });
});

describe('Zinapoya', () => {
  it('saves the four steps in the shape the database reads', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Zinapoya");
    const sec = await sectionOf('Zinapoya');
    expect(button('Saqlash', sec)).toBeDisabled(); // nothing changed yet
    expect(within(sec).getByText('Saqlangan')).toBeInTheDocument();

    // 2-urinish: +15 daqiqa -> +20 daqiqa; window 7 -> 10; DM after 2 -> 3
    fireEvent.change(within(sec).getAllByLabelText('Daqiqa')[0], { target: { value: '20' } });
    fireEvent.change(within(sec).getByLabelText('Oyna (kun)'), { target: { value: '10' } });
    fireEvent.change(within(sec).getByLabelText('DM qoralamasi: urinishdan keyin'), { target: { value: '3' } });
    expect(within(sec).getByText("Saqlanmagan o'zgarishlar")).toBeInTheDocument();
    expect(within(sec).getByText('+20 daqiqa')).toBeInTheDocument();
    fireEvent.click(button('Saqlash', sec));

    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledTimes(1));
    expect(saved()).toEqual([
      [
        'ladder',
        {
          steps: [
            { kind: 'minutes', value: 20 },
            { kind: 'minutes', value: 120 },
            { kind: 'next_day', at: '10:00' },
            { kind: 'days', value: 2, at: '10:00' },
          ],
          window_days: 10,
          dm_after_attempt: 3,
        },
        'user-1',
      ],
    ]);
    expect(await within(sec).findByText(/^Saqlangan/)).toBeInTheDocument();
    expect(button('Saqlash', sec)).toBeDisabled();
  });

  it('changes the kind of a step and drops the field it no longer has', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Zinapoya");
    const sec = await sectionOf('Zinapoya');
    // 4-urinish "ertasi kuni 10:00" -> "kundan keyin" (days)
    fireEvent.change(within(sec).getByLabelText('4-urinish turi'), { target: { value: 'days' } });
    fireEvent.change(within(sec).getAllByLabelText('Kun')[0], { target: { value: '3' } });
    fireEvent.click(button('Saqlash', sec));

    await waitFor(() => expect(api.saveSetting).toHaveBeenCalled());
    const [, value] = saved()[0] as [string, { steps: unknown[] }];
    expect(value.steps[2]).toEqual({ kind: 'days', value: 3, at: '10:00' });
  });

  it('refuses a bad step before sending anything', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Zinapoya");
    const sec = await sectionOf('Zinapoya');
    fireEvent.change(within(sec).getAllByLabelText('Daqiqa')[0], { target: { value: '' } });
    fireEvent.click(button('Saqlash', sec));

    expect(await within(sec).findByText(/2-urinish \(daqiqa\): 1 dan 1440 gacha/)).toBeInTheDocument();
    expect(api.saveSetting).not.toHaveBeenCalled();
  });

  it('keeps every edit when the save fails, and says why', async () => {
    api.saveSetting.mockRejectedValue(new Error('not_allowed'));
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Zinapoya");
    const sec = await sectionOf('Zinapoya');
    fireEvent.change(within(sec).getAllByLabelText('Daqiqa')[0], { target: { value: '25' } });
    fireEvent.click(button('Saqlash', sec));

    expect(await within(sec).findByText("Saqlanmadi: Bu amalga ruxsat yo'q")).toBeInTheDocument();
    expect(within(sec).getAllByLabelText('Daqiqa')[0]).toHaveValue('25');
    expect(button('Saqlash', sec)).toBeEnabled(); // can try again
    // and a retry sends the same thing
    api.saveSetting.mockResolvedValue(undefined);
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledTimes(2));
    expect(saved()[1][1]).toEqual(saved()[0][1]);
  });

  it('"Bekor qilish" puts the saved values back', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Zinapoya");
    const sec = await sectionOf('Zinapoya');
    fireEvent.change(within(sec).getAllByLabelText('Daqiqa')[0], { target: { value: '99' } });
    fireEvent.click(button('Bekor qilish', sec));
    expect(within(sec).getAllByLabelText('Daqiqa')[0]).toHaveValue('15');
  });
});

describe('the other sections', () => {
  it('the left list marks a section with unsaved edits, and edits survive switching sections', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Taymer va eskalatsiya");
    const sec = await sectionOf('Taymer va eskalatsiya');
    fireEvent.change(within(sec).getByLabelText('Taymer (daqiqa)'), { target: { value: '12' } });
    expect(within(screen.getByLabelText("Sozlamalar bo'limlari")).getByLabelText("Saqlanmagan o'zgarishlar")).toBeInTheDocument();

    goTo("Zinapoya");
    expect(screen.getByText('Taymer va eskalatsiya', { selector: 'h2' }).closest('[hidden]')).not.toBeNull(); // hidden, not gone
    goTo("Taymer va eskalatsiya");
    expect(within(await sectionOf('Taymer va eskalatsiya')).getByLabelText('Taymer (daqiqa)')).toHaveValue('12');
  });

  it('saves only the keys that changed (taymer, not the repeat)', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Taymer va eskalatsiya");
    const sec = await sectionOf('Taymer va eskalatsiya');
    fireEvent.change(within(sec).getByLabelText('Taymer (daqiqa)'), { target: { value: '12' } });
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledTimes(1));
    expect(saved()).toEqual([['timer_minutes', 12, 'user-1']]);
  });

  it('work hours: the days and times are written as the SQL reads them', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    const sec = await sectionOf('Ish vaqti');
    fireEvent.click(button('Ya', sec)); // Sunday (off by default since 2026-10-14) back on
    fireEvent.change(within(sec).getByLabelText('Tugash'), { target: { value: '21:30' } });
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(api.saveSetting).toHaveBeenCalled());
    expect(saved()).toEqual([['work_hours', { start: '09:00', end: '21:30', days: [1, 2, 3, 4, 5, 6, 7] }, 'user-1']]);
  });

  it('work hours: an end before the start is refused', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    const sec = await sectionOf('Ish vaqti');
    fireEvent.change(within(sec).getByLabelText('Tugash'), { target: { value: '08:00' } });
    fireEvent.click(button('Saqlash', sec));
    expect(await within(sec).findByText(/Tugash vaqti boshlanishdan keyin/)).toBeInTheDocument();
    expect(api.saveSetting).not.toHaveBeenCalled();
  });

  it('forbidden words: add and remove tags, saved as a clean list', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Taqiqlangan so'zlar");
    const sec = await sectionOf("Taqiqlangan so'zlar");
    const box = within(sec).getByLabelText("Taqiqlangan so'zlar: yangi so'z");
    fireEvent.change(box, { target: { value: 'eng arzon' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.change(box, { target: { value: 'KAFOLAT' } }); // a repeat, any case
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(within(sec).getByLabelText('Olib tashlash: 100%'));
    fireEvent.click(button('Saqlash', sec));

    await waitFor(() => expect(api.saveSetting).toHaveBeenCalled());
    expect(saved()).toEqual([
      ['forbidden_words', ['kafolat', 'bepul noutbuk', 'bitta narx', 'sertifikatsiz Koreya', 'eng arzon'], 'user-1'],
    ]);
  });

  it('queue limit, announcements and the switches each save their own keys', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });

    goTo("Navbat kunlik limiti");
    let sec = await sectionOf('Navbat kunlik limiti');
    fireEvent.change(within(sec).getByLabelText('Kuniga lidlar soni'), { target: { value: '25' } });
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(saved()).toContainEqual(['queue_daily_limit', 25, 'user-1']));

    goTo("Hanbox va NO RISK e'lonlari");
    sec = await sectionOf("Hanbox va NO RISK e'lonlari");
    fireEvent.click(within(sec).getByLabelText("NO RISK sharti e'lon qilingan"));
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(saved()).toContainEqual(['no_risk_announced', true, 'user-1']));
    expect(saved().filter((c) => c[0] === 'hanbox_group_date')).toHaveLength(0); // unchanged keys are not rewritten

    goTo("Nazorat chizig'i va TV");
    sec = await sectionOf("Nazorat chizig'i va TV ogohlantirish");
    fireEvent.click(within(sec).getByLabelText("Nazorat chizig'i"));
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(saved()).toContainEqual(['control_line_10min', false, 'user-1']));
  });

  it('auto reply must have both languages', async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Avtojavob matni");
    const sec = await sectionOf('Avtojavob matni');
    expect(within(sec).getByText(/bir suhbatga bir marta/)).toBeInTheDocument();
    expect(within(sec).getByText(/«javob berildi» hisoblanmaydi/)).toBeInTheDocument();
    const [uz, ru] = Array.from(sec.querySelectorAll('textarea'));
    fireEvent.change(uz, { target: { value: 'Salom' } });
    fireEvent.change(ru, { target: { value: '   ' } });
    fireEvent.click(button('Saqlash', sec));
    expect(await within(sec).findByText(/uz va ru tilida/)).toBeInTheDocument();
    expect(api.saveSetting).not.toHaveBeenCalled();
  });

  it('lost reasons and offers validate their keys', async () => {
    api.fetchSettings.mockResolvedValue({ templates, offers: { kasbiy: { title: 'Kasbiy ta’lim', text: 'Narx — rahbardan', needs_boss: true } } });
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Yo'qotish sabablari");
    let sec = await sectionOf("Yo'qotish sabablari");
    fireEvent.click(button('Yangi sabab', sec));
    fireEvent.click(button('Saqlash', sec));
    expect(await within(sec).findByText(/kalit kichik lotin harflari/)).toBeInTheDocument();
    expect(api.saveSetting).not.toHaveBeenCalled();

    goTo("Ruxsat etilgan takliflar");
    sec = await sectionOf('Ruxsat etilgan takliflar');
    expect(within(sec).getAllByText(/Narx — rahbardan/).length).toBeGreaterThan(0);
  });
});

describe('Shablonlar', () => {
  const openGreeting = async () => {
    const sec = await sectionOf('Shablonlar');
    toggleRow(sec, 'greeting');
    return sec;
  };

  it('lists the templates grouped, with the variables documented', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await sectionOf('Shablonlar');
    expect(within(sec).getByText('Salom')).toBeInTheDocument(); // group heading
    expect(within(sec).getByText('NO RISK', { selector: 'h3' })).toBeInTheDocument();
    expect(within(sec).getByText("Rahbar tasdig'i")).toBeInTheDocument(); // needs_boss badge
    for (const v of ['{ism}', '{tarif}', '{narx}', '{sana}', '{operator}']) {
      expect(button(v, sec)).toBeInTheDocument();
    }
  });

  it("a senior edits a template's text; the payload carries every template, without UI fields", async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await openGreeting();
    fireEvent.change(within(sec).getByLabelText("greeting o'zbekcha matn"), { target: { value: 'Salom, {ism}! Men {operator}man.' } });
    fireEvent.click(button('Saqlash', sec));

    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledTimes(1));
    expect(saved()).toEqual([
      [
        'templates',
        [
          { key: 'greeting', group: 'salom', uz: 'Salom, {ism}! Men {operator}man.', ru: 'Здравствуйте, {ism}!' },
          { key: 'no_risk_offer', group: 'no_risk', uz: 'NO RISK: {tarif}', ru: 'NO RISK: {tarif}', needs_boss: true },
          { key: 'comment_reply', group: 'izoh', uz: "Batafsil ma'lumotni shaxsiy xabarda yozamiz.", ru: 'Подробности в личные сообщения.' },
        ],
        'user-1',
      ],
    ]);
  });

  it('refuses a variable that would reach a client as typed', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await openGreeting();
    fireEvent.change(within(sec).getByLabelText("greeting o'zbekcha matn"), { target: { value: 'Salom, {ismi}!' } });
    expect(within(sec).getByText("noma'lum o'zgaruvchi")).toBeInTheDocument();
    fireEvent.click(button('Saqlash', sec));

    expect(await within(sec).findByText(/«greeting»: Noma'lum o'zgaruvchi: \{ismi\}/)).toBeInTheDocument();
    expect(api.saveSetting).not.toHaveBeenCalled();
  });

  it('inserts a variable where the cursor was', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await openGreeting();
    const uz = within(sec).getByLabelText("greeting o'zbekcha matn") as HTMLTextAreaElement;
    fireEvent.focus(uz);
    uz.setSelectionRange(0, 0);
    fireEvent.click(button('{sana}', sec));
    expect(uz.value.startsWith('{sana}Assalomu')).toBe(true);
  });

  it('adds a new template and saves it with needs_boss only when it is on', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await sectionOf('Shablonlar');
    fireEvent.click(button('Yangi shablon', sec));
    // the texts first: their labels carry the key, which is typed last
    fireEvent.change(within(sec).getByLabelText('yangi ruscha matn'), { target: { value: 'Документы: {ism}' } });
    fireEvent.change(within(sec).getByLabelText("yangi o'zbekcha matn"), { target: { value: 'Hujjatlar: {ism}' } });
    fireEvent.change(within(sec).getByLabelText('Guruh'), { target: { value: 'hujjat' } });
    fireEvent.change(within(sec).getByLabelText('Kalit'), { target: { value: 'Docs_List' } }); // normalised to lower case
    fireEvent.click(button('Saqlash', sec));

    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledTimes(1));
    const list = saved()[0][1] as TemplateSetting[];
    expect(list).toHaveLength(4);
    expect(list[3]).toEqual({ key: 'docs_list', group: 'hujjat', uz: 'Hujjatlar: {ism}', ru: 'Документы: {ism}' });
  });

  it('deletes a template, but not one the system looks up by key', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await sectionOf('Shablonlar');

    toggleRow(sec, 'comment_reply');
    expect(button("O'chirish", sec)).toBeDisabled();

    toggleRow(sec, 'no_risk_offer');
    const deletes = within(sec).getAllByText("O'chirish", { selector: 'button' });
    const removable = deletes.find((b) => !(b as HTMLButtonElement).disabled)!;
    fireEvent.click(removable);
    fireEvent.click(button('Saqlash', sec));

    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledTimes(1));
    expect((saved()[0][1] as TemplateSetting[]).map((t) => t.key)).toEqual(['greeting', 'comment_reply']);
  });

  it('a template the senior may not save in this section is not offered elsewhere (only the templates key is written)', async () => {
    await openAs({ isAdmin: false, isLeadSenior: true, loading: false });
    const sec = await openGreeting();
    fireEvent.change(within(sec).getByLabelText("greeting o'zbekcha matn"), { target: { value: 'Yangi matn {ism}' } });
    fireEvent.click(button('Saqlash', sec));
    await waitFor(() => expect(api.saveSetting).toHaveBeenCalled());
    expect(new Set(saved().map((c) => c[0]))).toEqual(new Set(['templates']));
  });
});

describe('Telegram qabul qiluvchilar', () => {
  const open = async () => {
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Telegram qabul qiluvchilar");
    return sectionOf('Telegram qabul qiluvchilar');
  };

  it('explains how a person gets on the list, and lists who is on it', async () => {
    const sec = await open();
    expect(within(sec).getByText('Start')).toBeInTheDocument();
    expect(within(sec).getByText(/chat ID sini shu yerga qo'shasiz/)).toBeInTheDocument();
    const row = (await within(sec).findByText('Omina (operator)')).closest('tr')!;
    expect(within(row).getByText('111222333')).toBeInTheDocument();
    expect(within(row).getByText('Omina')).toBeInTheDocument(); // the linked staff member
  });

  it('adds a recipient with exactly the columns the form owns', async () => {
    const sec = await open();
    await within(sec).findByText('Omina (operator)');
    fireEvent.click(button("Qo'shish", sec));
    const dialog = await findDialog();
    fireEvent.change(within(dialog).getByLabelText('Chat ID'), { target: { value: ' 987654321 ' } });
    fireEvent.change(within(dialog).getByLabelText('Nomi'), { target: { value: 'Rahbar' } });
    fireEvent.change(within(dialog).getByLabelText('Xodim (ixtiyoriy)'), { target: { value: 'u-bek' } });
    fireEvent.click(within(dialog).getByLabelText('Rahbar xabarlari'));
    fireEvent.click(within(dialog).getByLabelText('Kunlik hisobot'));
    fireEvent.click(within(dialog).getByLabelText('Haftalik hisobot'));
    fireEvent.click(button('Saqlash', dialog));

    await waitFor(() => expect(api.saveRecipient).toHaveBeenCalledTimes(1));
    expect(api.saveRecipient).toHaveBeenCalledWith({
      chat_id: '987654321',
      label: 'Rahbar',
      staff_user_id: 'u-bek',
      escalate: true,
      boss_alerts: true,
      reports_daily: true,
      reports_weekly: true,
      enabled: true,
    });
    await dialogGone();
  });

  it('refuses a chat id that is not a number, a missing name and a repeat', async () => {
    const sec = await open();
    await within(sec).findByText('Omina (operator)');
    fireEvent.click(button("Qo'shish", sec));
    const dialog = await findDialog();

    fireEvent.change(within(dialog).getByLabelText('Chat ID'), { target: { value: '@omina' } });
    fireEvent.change(within(dialog).getByLabelText('Nomi'), { target: { value: 'Omina' } });
    fireEvent.click(button('Saqlash', dialog));
    expect(await within(dialog).findByText(/Chat ID raqamlardan iborat/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Chat ID'), { target: { value: '111222333' } });
    fireEvent.click(button('Saqlash', dialog));
    expect(await within(dialog).findByText(/allaqachon qo'shilgan/)).toBeInTheDocument();
    expect(api.saveRecipient).not.toHaveBeenCalled();
  });

  it('keeps the dialog and the typing when the database refuses', async () => {
    api.saveRecipient.mockRejectedValue(new Error('not_allowed'));
    const sec = await open();
    await within(sec).findByText('Omina (operator)');
    fireEvent.click(button("Qo'shish", sec));
    const dialog = await findDialog();
    fireEvent.change(within(dialog).getByLabelText('Chat ID'), { target: { value: '555666777' } });
    fireEvent.change(within(dialog).getByLabelText('Nomi'), { target: { value: 'Yangi' } });
    fireEvent.click(button('Saqlash', dialog));

    expect(await within(dialog).findByText("Bu amalga ruxsat yo'q")).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nomi')).toHaveValue('Yangi');
  });

  it('edits a recipient: the chat id is fixed, the switches are saved', async () => {
    const sec = await open();
    await within(sec).findByText('Omina (operator)');
    fireEvent.click(within(sec).getByLabelText('Tahrirlash: Omina (operator)'));
    const dialog = await findDialog();
    expect(within(dialog).getByLabelText('Chat ID')).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText('Eskalatsiya')); // off
    fireEvent.click(within(dialog).getByLabelText('Yoqilgan')); // off
    fireEvent.click(button('Saqlash', dialog));

    await waitFor(() => expect(api.saveRecipient).toHaveBeenCalledTimes(1));
    expect(api.saveRecipient).toHaveBeenCalledWith({
      chat_id: '111222333',
      label: 'Omina (operator)',
      staff_user_id: 'u-omina',
      escalate: false,
      boss_alerts: false,
      reports_daily: false,
      reports_weekly: false,
      enabled: false,
    });
  });

  it('deletes only after the confirmation', async () => {
    const sec = await open();
    await within(sec).findByText('Omina (operator)');
    fireEvent.click(within(sec).getByLabelText("O'chirish: Omina (operator)"));
    expect(api.deleteRecipient).not.toHaveBeenCalled();
    const dialog = await findDialog();
    fireEvent.click(button("O'chirish", dialog));
    await waitFor(() => expect(api.deleteRecipient).toHaveBeenCalledWith('111222333'));
  });

  it('says so when nobody is on the list yet', async () => {
    api.fetchRecipients.mockResolvedValue([]);
    const sec = await open();
    expect(await within(sec).findByText(/Hali hech kim qo'shilmagan/)).toBeInTheDocument();
  });
});

describe('defaults', () => {
  it('renders against an empty settings table without crashing (the seed is the fallback)', async () => {
    api.fetchSettings.mockResolvedValue({});
    await openAs({ isAdmin: true, isLeadSenior: true, loading: false });
    goTo("Zinapoya");
    const sec = await sectionOf('Zinapoya');
    expect(within(sec).getAllByLabelText('Daqiqa')[0]).toHaveValue(String(DEFAULT_SETTINGS.ladder.steps[0].value));
  });
});
