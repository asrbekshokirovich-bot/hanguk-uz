import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UniversityNotices } from '../UniversityNotices';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback: string) => fallback, i18n: { language: 'uz' } }),
}));

const mockHook = vi.fn();
vi.mock('@/hooks/useInstitutionNotices', () => ({
  useInstitutionNotices: () => mockHook(),
}));

describe('UniversityNotices', () => {
  beforeEach(() => mockHook.mockReset());

  it('renders the Uzbek title (from translations) with category and source link', () => {
    mockHook.mockReturnValue({
      notices: [
        { id: 'n1', title_ko: '인하대 입학', url_ko: 'https://inha.example/notice', posted_at: '2026-04-30', category: 'admission' },
      ],
      titles: { get: (_id: string, _f: string, lang: string) => (lang === 'uz' ? 'Inha qabul rejasi' : null), isLoading: false },
      isLoading: false,
    });
    render(<UniversityNotices institutionId="inst-1" />);
    expect(screen.getByText('Inha qabul rejasi')).toBeInTheDocument();
    expect(screen.getByText('admission')).toBeInTheDocument();
    expect(screen.getByText('Open notice')).toBeInTheDocument();
  });

  it('falls back to the Korean title when no translation exists', () => {
    mockHook.mockReturnValue({
      notices: [{ id: 'n1', title_ko: '인하대 입학', url_ko: null, posted_at: null, category: null }],
      titles: { get: () => null, isLoading: false },
      isLoading: false,
    });
    render(<UniversityNotices institutionId="inst-1" />);
    expect(screen.getByText('인하대 입학')).toBeInTheDocument();
  });

  it('shows an empty state when there are no notices', () => {
    mockHook.mockReturnValue({ notices: [], titles: { get: () => null, isLoading: false }, isLoading: false });
    render(<UniversityNotices institutionId="inst-1" />);
    expect(screen.getByText("Hali e'lonlar yo'q")).toBeInTheDocument();
  });
});
