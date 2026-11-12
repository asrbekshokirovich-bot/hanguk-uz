import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/lib/i18n';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    loading: false,
    tasks: [
      { id: 't1', title: 'Hujjatlarni tekshirish', due_date: day(0), priority: 'urgent', status: 'in_progress', assigned_to: 'u1' },
    ],
  }),
}));
vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    loading: false,
    payments: [
      { id: 'p1', due_date: day(0), status: 'pending', amount: 5000000, currency: 'UZS', student: { full_name: 'Ali Valiyev' } },
      { id: 'p2', due_date: day(0), status: 'partial', amount: 1000, currency: 'USD', student: null },
    ],
  }),
}));

import CalendarContent from '../CalendarContent';

const ENGLISH = [
  'View tasks and payment deadlines', 'Today', 'Sun', 'Mon', 'Urgent', 'High', 'Normal', 'Payment',
  'Assigned', 'Active Tasks', 'Urgent Tasks', 'Pending Payments', 'Due This Week', 'Payment: Ali Valiyev',
  'urgent', 'in_progress', 'pending', 'partial', 'Unknown',
];

describe('Taqvim — in the page\'s language', () => {
  it('Uzbek: nothing on the page is left in English', async () => {
    await i18n.changeLanguage('uz');
    render(<CalendarContent />);
    for (const text of ENGLISH) expect(screen.queryByText(text, { exact: true })).toBeNull();

    expect(screen.getByText('Vazifalar va to‘lov muddatlari')).toBeTruthy();
    expect(screen.getByText('Bugun')).toBeTruthy();
    expect(screen.getByText('Faol vazifalar')).toBeTruthy();
    expect(screen.getByText('Kutilayotgan to‘lovlar')).toBeTruthy();
    // Today's events, as the day panel lists them.
    expect(screen.getAllByText('To‘lov: Ali Valiyev').length).toBeGreaterThan(0);
    expect(screen.getAllByText('To‘lov: Noma’lum').length).toBeGreaterThan(0);
    expect(screen.getByText('Biriktirilgan')).toBeTruthy();
  });

  it('English keeps the words it had', async () => {
    await i18n.changeLanguage('en');
    render(<CalendarContent />);
    for (const text of ['View tasks and payment deadlines', 'Today', 'Sun', 'Sat', 'Active Tasks', 'Due This Week', 'Assigned']) {
      expect(screen.getAllByText(text, { exact: true }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Payment: Ali Valiyev').length).toBeGreaterThan(0);
    await i18n.changeLanguage('uz');
  });
});
