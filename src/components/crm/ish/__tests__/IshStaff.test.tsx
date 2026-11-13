import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { toast } from 'sonner';
import uz from '@/locales/uz.json';
import { IshError, type IshApi } from '@/lib/ish/api';
import type { IshStaffPeople } from '@/lib/ish/types';
import { IshApiProvider } from '../context';
import { IshStaff } from '../IshStaff';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const people: IshStaffPeople = {
  staff: [
    { id: 'u-asrbek', role: 'admin', added_at: '2026-11-11T10:18:14Z', name: 'Asrbek', email: 'asrbek@hanguk.local', me: true },
    { id: 'u-madina', role: 'operator', added_at: '2026-11-13T02:00:00Z', name: 'Madina Rahimova', email: 'madina@hanguk.uz', me: false },
  ],
  candidates: [{ id: 'u-olmos', name: 'Olmos Karimov', email: 'olmos@hanguk.uz', roles: ['admin'] }],
};

function renderStaff(api: Partial<IshApi>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <I18nextProvider i18n={i18n}>
        <IshApiProvider api={api as IshApi}>
          <IshStaff />
        </IshApiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

async function choose(combobox: HTMLElement, option: string) {
  fireEvent.keyDown(combobox, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('CRM → Hanguk Ish → «Xodimlar» (P58)', () => {
  beforeAll(() => {
    // Radix Select asks for these; jsdom has none.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it('who works here, the admin first and marked; nobody changes or removes themselves', async () => {
    renderStaff({ staffPeople: vi.fn(async () => people) });
    const me = within(await screen.findByTestId('ish-staff-u-asrbek'));
    expect(me.getByText('Asrbek')).toBeInTheDocument();
    expect(me.getByText('siz')).toBeInTheDocument();
    expect(me.getByText('asrbek@hanguk.local')).toBeInTheDocument();
    expect(me.getByRole('combobox', { name: 'Roli' })).toBeDisabled();
    expect(me.queryByRole('button', { name: /Olib tashlash/ })).not.toBeInTheDocument();
    const madina = within(screen.getByTestId('ish-staff-u-madina'));
    expect(madina.getByRole('combobox', { name: 'Roli' })).toHaveTextContent('Operator');
    expect(madina.getByRole('button', { name: /Olib tashlash/ })).toBeInTheDocument();
  });

  it('a CRM person is added with the role chosen', async () => {
    const addStaff = vi.fn(async () => 'admin');
    const staffPeople = vi.fn(async () => people);
    renderStaff({ staffPeople, addStaff });
    const add = await screen.findByRole('button', { name: /Qo'shish/ });
    expect(add).toBeDisabled();
    await choose(screen.getByRole('combobox', { name: 'CRM xodimi' }), 'Olmos Karimov — olmos@hanguk.uz');
    await choose(screen.getByRole('combobox', { name: 'Yangi xodimning roli' }), 'Admin');
    fireEvent.click(add);
    await waitFor(() => expect(addStaff).toHaveBeenCalledWith('u-olmos', 'admin'));
    await waitFor(() => expect(staffPeople).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith("Qo'shildi");
  });

  it('a role changes', async () => {
    const setStaffRole = vi.fn(async () => 'admin');
    renderStaff({ staffPeople: vi.fn(async () => people), setStaffRole });
    const madina = within(await screen.findByTestId('ish-staff-u-madina'));
    await choose(madina.getByRole('combobox', { name: 'Roli' }), 'Admin');
    await waitFor(() => expect(setStaffRole).toHaveBeenCalledWith('u-madina', 'admin'));
  });

  it('removing says first what it means, then asks the database', async () => {
    const removeStaff = vi.fn(async () => {});
    renderStaff({ staffPeople: vi.fn(async () => people), removeStaff });
    const madina = within(await screen.findByTestId('ish-staff-u-madina'));
    fireEvent.click(madina.getByRole('button', { name: /Olib tashlash/ }));
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(dialog.getByText("Xodimlar ro'yxatidan olib tashlaysizmi?")).toBeInTheDocument();
    expect(dialog.getByText('Madina Rahimova')).toBeInTheDocument();
    expect(
      dialog.getByText(/CRM'dagi Hanguk Ish bo'limi unga yopiladi; u kiritgan ish beruvchilar va ishlar qoladi\./),
    ).toBeInTheDocument();
    expect(removeStaff).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Olib tashlash' }));
    await waitFor(() => expect(removeStaff).toHaveBeenCalledWith('u-madina'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('a refusal is told in words; nobody left to add is said so', async () => {
    const setStaffRole = vi.fn(async () => {
      throw new IshError('SELF');
    });
    renderStaff({ staffPeople: vi.fn(async () => ({ ...people, candidates: [] })), setStaffRole });
    expect(await screen.findByText("Qo'shish uchun CRM xodimi qolmadi.")).toBeInTheDocument();
    const madina = within(screen.getByTestId('ish-staff-u-madina'));
    await choose(madina.getByRole('combobox', { name: 'Roli' }), 'Admin');
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "O'zingizning rolingizni o'zgartira yoki o'zingizni olib tashlay olmaysiz — buni boshqa admin qiladi.",
      ),
    );
  });

  it('a list the database refuses (not an admin) says so', async () => {
    renderStaff({
      staffPeople: vi.fn(async () => {
        throw new IshError('FORBIDDEN');
      }),
    });
    expect(await screen.findByText('Bu amal faqat Hanguk Ish xodimlariga ruxsat etilgan.')).toBeInTheDocument();
  });
});
