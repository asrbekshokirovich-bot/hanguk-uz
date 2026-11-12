import { describe, expect, it, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import i18n from '@/lib/i18n';
import { AIAnswer } from '../AIAnswer';
import { applyEvent, fromSnapshot, stepKeys } from '@/lib/hangukAiAnswer';

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

// The two answers in Asrbek's design (2026-10-29 screenshot).
const muratov = {
  runId: 'run-1',
  steps: ['search_students', 'get_student_card'],
  sources: [
    { kind: 'crm' as const, label: 'Talaba kartasi', url: '/crm/students?student=s1' },
    { kind: 'guideline' as const, label: "Yo'riqnoma: Hanyang University 2027 bahor magistratura", date: '2026-10-05' },
    { kind: 'pdf' as const, label: "Yo'riqnoma PDF: Hanyang University 2027", page: '7-bet', url: 'https://www.hanyang.ac.kr/a.pdf' },
    { kind: 'web' as const, label: 'Hanyang', url: 'https://www.hanyang.ac.kr/admission', date: '2026-10-29' },
  ],
  entity: {
    kind: 'student' as const, id: 's1', name: 'Muratov Shoxrux', initials: 'MS', season: 'spring 2027',
    docsApproved: 8, docsRequired: 8,
    universities: [
      { name: 'Hanyang', status: 'online', tone: 'good' as const },
      { name: 'Ajou', status: 'online', tone: 'good' as const },
    ],
  },
};

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Hanguk AI answer card (CRM design)', () => {
  it('shows steps, text, the student card, sources and feedback as in the design', () => {
    wrap(<AIAnswer content="**Muratov Shoxrux**: hujjatlar 8/8, Hanyang va Ajou'ga onlayn topshirgan." meta={muratov} />);
    expect(screen.getByText('Talabani qidiryapman')).toBeInTheDocument();
    expect(screen.getByText("Kartasini o'qiyapman")).toBeInTheDocument();
    expect(screen.getAllByText('Muratov Shoxrux').length).toBeGreaterThan(0);
    expect(screen.getByText(/Talaba · 2027 bahor · Hujjatlar/)).toBeInTheDocument();
    expect(screen.getByText('8/8')).toBeInTheDocument();
    expect(screen.getByText('Hanyang · Onlayn topshirildi')).toBeInTheDocument();
    expect(screen.getByText('Ajou · Onlayn topshirildi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kartani ochish/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4 manba/ })).toBeInTheDocument();
    expect(screen.getByText('hanyang.ac.kr · 29.10.2026')).toBeInTheDocument();
  });

  it('a plain answer is a bubble with its single source chip and 👍/👎', async () => {
    wrap(
      <AIAnswer
        content="Hali yo'q — Hanyang'dan javob kelmagan."
        meta={{ runId: 'run-2', sources: [{ kind: 'crm', label: 'Talaba kartasi', url: '/crm/students?student=s1' }] }}
      />,
    );
    expect(screen.getByRole('button', { name: 'CRM sahifasi' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yaxshi javob' }));
    expect(rpc).toHaveBeenCalledWith('ai_run_feedback', { p_run: 'run-2', p_value: 1, p_note: null });
  });

  it('a CRM source opens its page; one that would leave the site opens nothing', () => {
    const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
    const chip = (url: string) =>
      render(
        <MemoryRouter initialEntries={['/crm/ai']}>
          <AIAnswer content="Javob." meta={{ runId: 'run-3', sources: [{ kind: 'crm', label: 'Talaba kartasi', url }] }} />
          <Where />
        </MemoryRouter>,
      );

    const bad = chip('/\\evil.example/login');
    fireEvent.click(screen.getByRole('button', { name: 'CRM sahifasi' }));
    expect(screen.getByTestId('where').textContent).toBe('/crm/ai');
    bad.unmount();

    chip('/crm/students?student=s1');
    fireEvent.click(screen.getByRole('button', { name: 'CRM sahifasi' }));
    expect(screen.getByTestId('where').textContent).toBe('/crm/students');
  });

  it('while running shows the steps without the footer', () => {
    wrap(<AIAnswer content="" meta={{ steps: ['search_students'] }} running />);
    expect(screen.getByText('Talabani qidiryapman')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yaxshi javob' })).toBeNull();
  });
});

describe('Answer meta', () => {
  it('folds step and meta events, one chip per kind of step', () => {
    let m = applyEvent({}, { type: 'step', tools: ['search_students'] });
    m = applyEvent(m, { type: 'step', tools: ['search_students', 'get_student_card'] });
    expect(m.steps).toEqual(['search_students', 'get_student_card']);
    m = applyEvent(m, { type: 'meta', run_id: 'r', steps: m.steps, sources: [], entity: null });
    expect(m.runId).toBe('r');
    expect(stepKeys(['uni_search', 'uni_card', 'guideline_text_search', 'web_fetch'])).toEqual(['guideline', 'guidelinePdf', 'web']);
    expect(fromSnapshot(null)).toEqual({});
  });
});
