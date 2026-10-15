import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UniversityCalendar } from '../UniversityCalendar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'uz' },
  }),
}));

// The real (retired) events hook is used on purpose: the Taqvim tab crashed
// because the hook stopped returning the helpers the calendar calls.
describe('UniversityCalendar', () => {
  it('renders the empty calendar without throwing', () => {
    render(<UniversityCalendar roomId="room-1" />);
    expect(screen.getByText("Bu sanada voqealar yo'q")).toBeInTheDocument();
  });
});
