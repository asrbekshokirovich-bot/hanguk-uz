import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';

const deleteInstallment = vi.fn(async () => ({ paymentId: 'p1', removedAmount: 1000, newPaidAmount: 3000, receiptsLeft: [] }));
vi.mock('@/lib/recordInstallment', () => ({
  addReceiptsToTransfer: vi.fn(),
  deleteInstallment: (id: string) => deleteInstallment(id),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/payments/SignedReceipt', () => ({ SignedReceiptLink: () => null }));
vi.mock('@/components/payments/MultiReceiptUpload', () => ({ MultiReceiptUpload: () => null }));

import { PaymentTransfers } from '../PaymentTransfers';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });

const transfers = [
  { id: 't1', amount: 1000, payment_method: null, created_at: '2026-10-19T10:00:00Z', paid_on: '2026-10-19' },
  { id: 't4', amount: 1000, payment_method: null, created_at: '2026-11-06T10:00:00Z', paid_on: '2026-11-06' },
];

const setup = (canDelete: boolean) => {
  const onChanged = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <PaymentTransfers transfers={transfers} currency="USD" studentId="s1" canAdd canDelete={canDelete} onAddInstallment={vi.fn()} onChanged={onChanged} />
    </I18nextProvider>,
  );
  return { onChanged };
};

describe('PaymentTransfers delete (2026-11-09)', () => {
  it('shows no delete button without the right', () => {
    setup(false);
    expect(screen.queryAllByLabelText("Bo'lakni o'chirish")).toHaveLength(0);
  });

  it('deletes the chosen transfer after confirmation', async () => {
    const { onChanged } = setup(true);
    const buttons = screen.getAllByLabelText("Bo'lakni o'chirish");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(await screen.findByText(/06\.11\.2026 sanali/)).toBeInTheDocument();
    expect(deleteInstallment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Ha, o'chirish"));
    await waitFor(() => expect(deleteInstallment).toHaveBeenCalledWith('t4'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
