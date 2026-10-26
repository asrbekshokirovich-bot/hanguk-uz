import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import Segments from '../Segments';
import { segSummary, type Marketing } from '../marketing';
import { buildCsv } from '../marketingExport';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;
const names = { instagram: 'Instagram', telegram: 'Telegram' };
const options = { answers: { topik: [{ band: '0', devices: 2 }, { band: '2', devices: 4 }], route: [{ band: 'bachelor', devices: 3 }] }, regions: [{ value: 'Samarqand', devices: 2 }] };

describe('the cuts row (S4)', () => {
  it('has a select per cut that has values, and picks set the cut', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <Segments seg={{}} onChange={onChange} names={names} options={options} channels={['instagram', 'telegram', 'unknown']} t={t} />
      </I18nextProvider>,
    );
    const labels = screen.getAllByRole('combobox').map((s) => s.getAttribute('aria-label'));
    // no IELTS, bank, income answers seen yet — those are left out
    expect(labels).toEqual(['Mehmon/mijoz', 'Kanal', 'Platforma', 'Yangi/qaytgan', "Yo'nalish", 'TOPIK', 'Viloyat', 'Kim uchun']);
    expect(screen.getByRole('option', { name: 'Kanal: hammasi' })).toBeTruthy();
    expect(screen.getByRole('option', { name: "Kanal: Noma'lum (javobsiz)" })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'TOPIK 2' })).toBeTruthy();
    expect(screen.getByRole('option', { name: "TOPIK: yo'q" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Kanal'), { target: { value: 'instagram' } });
    expect(onChange).toHaveBeenLastCalledWith({ channel: 'instagram' });
  });

  it('clears one cut or all', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <Segments seg={{ platform: 'android', topik: '2' }} onChange={onChange} names={names} options={options} channels={['instagram']} t={t} />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByLabelText('Platforma'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ topik: '2' });
    fireEvent.click(screen.getByRole('button', { name: 'Kesimni tozalash' }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('names the cut in words, and the CSV says which cut it is', () => {
    expect(segSummary({ channel: 'instagram', platform: 'android', topik: '2', for_whom: 'child' }, names, t)).toBe(
      'Kanal: Instagram · Platforma: Android · TOPIK 2 · Kim uchun: Farzandi uchun',
    );
    expect(segSummary({}, names, t)).toBe('');
    const data = {
      from: '2026-10-20', to: '2026-10-26', include_test: false, seg: { who: 'guest' },
      kpi: { new_devices: 1, new_active: 1, requests: 0, requests_form: 0, requests_telegram: 0, new_leads: 0, contracts: 0, app_contracts: 0, test_devices: 0 },
      channels: [], funnel: {}, demand: { filters: [], answers: [], universities: [] },
      stops: { exit_screens: [], language_exits: 0, client_code_seen: 0, client_code_left: 0, locked_tabs: [], lead_form: { opened: 0, field_error: 0, submitted: 0 } },
      returning: { active: 0, new: 0, returning: 0 }, spend: [],
    } as Marketing;
    expect(buildCsv(data, names, t)).toContain('Kesim,Mehmon/mijoz: Mehmon');
  });
});
