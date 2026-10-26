import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';

const paths = {
  from: '2026-09-27', to: '2026-10-26', depth: 4, sessions: 3,
  nodes: [
    { step: 1, screen: '/language', sessions: 3 },
    { step: 2, screen: '/guest', sessions: 2 },
    { step: 3, screen: '/university/:id', sessions: 1 },
  ],
  links: [
    { step: 1, from: '/language', to: '/guest', sessions: 2 },
    { step: 1, from: '/language', to: '__exit__', sessions: 1 },
    { step: 2, from: '/guest', to: '/university/:id', sessions: 1 },
    { step: 2, from: '/guest', to: '__exit__', sessions: 1 },
  ],
};
const rpc = vi.fn(async (fn: string, args: { p_steps?: string[] }) => {
  if (fn === 'analytics_paths') return { data: paths, error: null };
  if (fn === 'analytics_funnel_custom') return { data: { from: '', to: '', steps: (args.p_steps ?? []).map((key, i) => ({ key, devices: 10 - i * 3 })) }, error: null };
  if (fn === 'analytics_segment_options') return { data: { answers: {}, regions: [] }, error: null };
  return { data: null, error: null };
});
const rows: Record<string, unknown[]> = {
  app_event_types: [{ event: 'report_view', description_uz: "Hisobotni ko'rdi" }, { event: 'lead_submit', description_uz: 'Konsultantga so\'rov yubordi' }, { event: 'university_open', description_uz: 'Universitetni ochdi' }],
  lead_how_heard: [{ key: 'instagram', label_uz: 'Instagram', sort: 1 }],
};
const chain = (table: string) => {
  const result = Promise.resolve({ data: rows[table] ?? [] });
  const c: Record<string, unknown> = { select: () => c, order: () => result, then: result.then.bind(result) };
  return c;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (fn: string, args: { p_steps?: string[] }) => rpc(fn, args), from: (t: string) => chain(t) },
}));

import FlowTab from '../FlowTab';
import { layoutFlow } from '../flow';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });

describe('«Oqim»', () => {
  it('lays the paths out a column per step, an exit in the column after its step', () => {
    const f = layoutFlow(paths, 600, 300, { nodeWidth: 10, pad: 10, labelSpace: 100 });
    expect(f.nodes.map((n) => `${n.step}|${n.screen}|${n.sessions}|x${Math.round(n.x)}`)).toEqual([
      '1|/language|3|x0', '2|/guest|2|x245', '2|__exit__|1|x245', '3|/university/:id|1|x490', '3|__exit__|1|x490',
    ]);
    // a node is as tall as the bands leaving it; the bands stack inside it
    const fromLanguage = f.links.filter((l) => l.from.screen === '/language');
    expect(fromLanguage.reduce((a, l) => a + l.h, 0)).toBeCloseTo(f.nodes[0].h);
    expect(fromLanguage.map((l) => l.to.screen)).toEqual(['/guest', '__exit__']);
    expect(fromLanguage[1].y0).toBeCloseTo(fromLanguage[0].y0 + fromLanguage[0].h);
    expect(f.links.every((l) => l.y1 >= l.to.y - 0.001 && l.y1 + l.h <= l.to.y + l.to.h + 0.001)).toBe(true);
  });

  it('counts visits, and the funnel follows the steps picked', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <FlowTab />
      </I18nextProvider>,
    );
    await waitFor(() => expect(screen.getByText('3 tashrif')).toBeTruthy());
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('analytics_funnel_custom', expect.objectContaining({
      p_steps: ['screen:/guest', 'university_open', 'report_view', 'lead_submit'], p_seg: {},
    })));
    expect(screen.getAllByRole('combobox', { name: /-qadam$/ }).length).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: '4-qadamni olib tashlash' }));
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('analytics_funnel_custom', expect.objectContaining({
      p_steps: ['screen:/guest', 'university_open', 'report_view'],
    })));
    expect(screen.getAllByRole('option', { name: 'Ekran: Universitet sahifasi' }).length).toBe(3);
  });
});
