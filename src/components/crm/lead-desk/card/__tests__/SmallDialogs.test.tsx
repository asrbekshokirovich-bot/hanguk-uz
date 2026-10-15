import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

const api = vi.hoisted(() => ({
  waitLead: vi.fn(),
  loseLead: vi.fn(),
  requestPromise: vi.fn(),
  createManualLead: vi.fn(),
  fetchSettings: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api')>()), ...api }));

import { toast } from 'sonner';
import { tomorrowKey } from '../cardLogic';
import { LoseDialog } from '../LoseDialog';
import ManualLeadDialog from '../ManualLeadDialog';
import { PromiseDialog } from '../PromiseDialog';
import { WaitDialog } from '../WaitDialog';
import { renderWithQuery } from './helpers';

vi.setConfig({ testTimeout: 30_000 });

const tap = (group: string, option: string | RegExp) =>
  fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: option }));

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  for (const fn of [api.waitLead, api.loseLead, api.requestPromise]) fn.mockResolvedValue(undefined);
  api.createManualLead.mockResolvedValue('new-lead-id');
});

describe('WaitDialog (Kutish)', () => {
  const setup = () => {
    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    renderWithQuery(<WaitDialog leadId="lead-1" open onOpenChange={onOpenChange} onDone={onDone} />);
    return { onOpenChange, onDone };
  };

  it('needs a date from tomorrow on and a reason before it saves', async () => {
    setup();
    const save = await screen.findByRole('button', { name: /Kutishga qo.yish/ });
    expect(save).toBeDisabled();

    const date = screen.getByLabelText('Qachongacha kutamiz?') as HTMLInputElement;
    expect(date.min).toBe(tomorrowKey());
    fireEvent.change(date, { target: { value: '2020-01-01' } }); // in the past
    tap('Kutish sababi', 'Imtihon natijasi');
    expect(save).toBeDisabled();
    expect(screen.getByRole('status').textContent).toContain('Kutish sanasi');

    fireEvent.change(date, { target: { value: '2999-01-01' } });
    expect(save).toBeEnabled();
  });

  it('calls waitLead(lead, date, reason), tells the card and closes', async () => {
    const { onOpenChange, onDone } = setup();
    fireEvent.click(await screen.findByRole('button', { name: '+1 hafta' }));
    tap('Kutish sababi', 'Oila qarori');
    fireEvent.click(screen.getByRole('button', { name: /Kutishga qo.yish/ }));

    await waitFor(() => expect(api.waitLead).toHaveBeenCalledWith('lead-1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'family_decision'));
    expect(api.waitLead.mock.calls[0][1] > tomorrowKey()).toBe(true);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows the database\'s refusal ("avval mijoz bilan gaplashing") and stays open', async () => {
    api.waitLead.mockRejectedValue(new Error('not_answered_yet'));
    const { onOpenChange } = setup();
    fireEvent.click(await screen.findByRole('button', { name: '+3 kun' }));
    tap('Kutish sababi', 'Pul');
    fireEvent.click(screen.getByRole('button', { name: /Kutishga qo.yish/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Avval mijoz bilan gaplashing, keyin Kutish');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('LoseDialog (Yo\'qotildi)', () => {
  const setup = () => {
    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    renderWithQuery(<LoseDialog leadId="lead-1" open onOpenChange={onOpenChange} onDone={onDone} />);
    return { onOpenChange, onDone };
  };

  it('lists the reasons with the queue each one joins', async () => {
    setup();
    const group = await screen.findByRole('group', { name: "Yo'qotish sababi" });
    expect(within(group).getByText("→ Hanbox navbati")).toBeInTheDocument(); // sertifikat yo'q
    expect(within(group).getByText('→ NO RISK navbati')).toBeInTheDocument(); // hujjat / moliya
    expect(within(group).getAllByText('navbatga tushmaydi').length).toBeGreaterThanOrEqual(2); // spam, mos emas...
    expect(screen.getByRole('button', { name: "Yo'qotildi" })).toBeDisabled();
  });

  it('saves a plain reason with the note', async () => {
    const { onOpenChange, onDone } = setup();
    tap("Yo'qotish sababi", /^Narx/);
    fireEvent.change(screen.getByLabelText('Izoh (ixtiyoriy)'), { target: { value: '  qimmat dedi ' } });
    fireEvent.click(screen.getByRole('button', { name: "Yo'qotildi" }));
    await waitFor(() => expect(api.loseLead).toHaveBeenCalledWith('lead-1', 'price', null, 'qimmat dedi'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onDone).toHaveBeenCalled();
  });

  it('asks which centre when the reason is "Boshqa markaz"', async () => {
    setup();
    tap("Yo'qotish sababi", /^Boshqa markaz/);
    const save = screen.getByRole('button', { name: "Yo'qotildi" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' })); // a suggestion from the settings
    expect(screen.getByLabelText('Qaysi markaz?')).toHaveValue('Forward');
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(api.loseLead).toHaveBeenCalledWith('lead-1', 'other_center', 'Forward', null));
  });

  it('shows a refusal', async () => {
    api.loseLead.mockRejectedValue(new Error('owned_by_other'));
    setup();
    tap("Yo'qotish sababi", /^Narx/);
    fireEvent.click(screen.getByRole('button', { name: "Yo'qotildi" }));
    expect((await screen.findByRole('alert')).textContent).toBe('Bu lid boshqa operatorda');
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('PromiseDialog (Chegirma / maxsus shart)', () => {
  it('requests a promise with its kind, text and reason', async () => {
    const onDone = vi.fn();
    renderWithQuery(<PromiseDialog leadId="lead-1" open onOpenChange={vi.fn()} onDone={onDone} />);
    const send = await screen.findByRole('button', { name: "So'rov yuborish" });
    expect(send).toBeDisabled();

    tap("So'rov turi", "Bo'lib to'lash");
    fireEvent.change(screen.getByLabelText(/Nima so.rayapsiz/), { target: { value: ' 3 oyga bo‘lib to‘lash ' } });
    fireEvent.change(screen.getByLabelText('Sabab (ixtiyoriy)'), { target: { value: 'Ikki aka-uka' } });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => expect(api.requestPromise).toHaveBeenCalledWith('lead-1', 'installment', '3 oyga bo‘lib to‘lash', 'Ikki aka-uka'));
    expect(onDone).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("So'rov rahbarga yuborildi");
  });

  it('defaults to a discount and leaves the reason out when empty', async () => {
    renderWithQuery(<PromiseDialog leadId="lead-1" open onOpenChange={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText(/Nima so.rayapsiz/), { target: { value: '10% chegirma' } });
    fireEvent.click(screen.getByRole('button', { name: "So'rov yuborish" }));
    await waitFor(() => expect(api.requestPromise).toHaveBeenCalledWith('lead-1', 'discount', '10% chegirma', undefined));
  });
});

describe('ManualLeadDialog (+ Lid)', () => {
  const setup = () => {
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    renderWithQuery(<ManualLeadDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);
    return { onOpenChange, onCreated };
  };
  const fillBasics = () => {
    fireEvent.change(screen.getByLabelText('Ism'), { target: { value: ' Aziz Karimov ' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '+998 90 123 45 67' } });
  };

  it('needs a name and a phone with enough digits', async () => {
    setup();
    const add = await screen.findByRole('button', { name: "Lid qo'shish" });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Ism'), { target: { value: 'Aziz' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '123' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '90 123 45 67' } });
    expect(add).toBeEnabled();
  });

  it('creates an office lead and reports the new id', async () => {
    const { onCreated, onOpenChange } = setup();
    await screen.findByRole('button', { name: "Lid qo'shish" });
    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: "Lid qo'shish" }));

    await waitFor(() =>
      expect(api.createManualLead).toHaveBeenCalledWith({
        name: 'Aziz Karimov',
        phone: '+998 90 123 45 67',
        origin: 'office',
        referralType: null,
        referralName: null,
        fields: {},
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-lead-id'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a referral needs who referred (type and name), and sends them', async () => {
    setup();
    await screen.findByRole('button', { name: "Lid qo'shish" });
    fillBasics();
    tap('Manba', 'Tavsiya');
    const add = screen.getByRole('button', { name: "Lid qo'shish" });
    expect(add).toBeDisabled();

    tap('Tavsiya turi', 'Talaba');
    expect(add).toBeDisabled(); // the name is still missing
    fireEvent.change(screen.getByLabelText('Tavsiya qilgan odam ismi'), { target: { value: 'Bobur' } });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    await waitFor(() =>
      expect(api.createManualLead).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'referral', referralType: 'student', referralName: 'Bobur' }),
      ),
    );
  });

  it('sends the optional goal, certificate and region when they are given', async () => {
    setup();
    await screen.findByRole('button', { name: "Lid qo'shish" });
    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: /Qo'shimcha maydonlar/ }));
    tap('Maqsad', 'Magistr');
    tap('Sertifikat / daraja', 'TOPIK 4');
    tap('Viloyat', 'Samarqand');
    fireEvent.click(screen.getByRole('button', { name: "Lid qo'shish" }));
    await waitFor(() =>
      expect(api.createManualLead).toHaveBeenCalledWith(
        expect.objectContaining({ fields: { education_level: 'Magistr', cert_level: 'TOPIK 4', city: 'Samarqand' } }),
      ),
    );
  });

  it('shows the server\'s refusal and keeps the form', async () => {
    api.createManualLead.mockRejectedValue(new Error('phone_required'));
    const { onCreated } = setup();
    await screen.findByRole('button', { name: "Lid qo'shish" });
    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: "Lid qo'shish" }));
    expect((await screen.findByRole('alert')).textContent).toBe('Telefon raqamini kiriting');
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Ism')).toHaveValue(' Aziz Karimov ');
  });

  it("logs a phone call the operator took: «Qo'ng'iroq keldi»", async () => {
    const { onCreated } = setup();
    await screen.findByRole('button', { name: "Lid qo'shish" });
    fillBasics();
    tap('Manba', "Qo'ng'iroq keldi");
    fireEvent.click(screen.getByRole('button', { name: "Lid qo'shish" }));
    await waitFor(() =>
      expect(api.createManualLead).toHaveBeenCalledWith(expect.objectContaining({ origin: 'call', phone: '+998 90 123 45 67' })),
    );
    expect(onCreated).toHaveBeenCalledWith('new-lead-id');
  });

  it("logs a missed call with just the number: «O'tkazib yuborilgan»", async () => {
    setup();
    const add = await screen.findByRole('button', { name: "Lid qo'shish" });
    tap('Manba', "O'tkazib yuborilgan");
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '+998 91 555 66 77' } });
    expect(add).toBeEnabled(); // no name needed
    fireEvent.click(add);
    await waitFor(() =>
      expect(api.createManualLead).toHaveBeenCalledWith(expect.objectContaining({ origin: 'missed', name: '', phone: '+998 91 555 66 77' })),
    );
  });
});
