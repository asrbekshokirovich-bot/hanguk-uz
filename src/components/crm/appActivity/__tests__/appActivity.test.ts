import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import { describeEvent, pickedUniversities, screenLabel, sessionsOf } from '../describe';
import { institutionIds, type AppEvent } from '../useAppActivity';

const i18n = createInstance();
i18n.init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;

let id = 0;
const ev = (event: string, at: string, props: Record<string, unknown> = {}, screen: string | null = null): AppEvent => ({
  id: ++id,
  install_id: 'i1',
  user_id: null,
  event,
  screen,
  props,
  occurred_at: at,
});

describe('app activity', () => {
  it('names screens and events in Uzbek', () => {
    expect(screenLabel('/guest/filter', t)).toBe('Filtr');
    expect(screenLabel('/something/new', t)).toBe('/something/new');
    const names = { u1: 'Kongju National University' };
    expect(describeEvent(ev('university_save', '2026-10-14T10:00:00Z', { institution_id: 'u1' }), t, names)).toBe(
      'Saqladi: Kongju National University',
    );
    expect(describeEvent(ev('slot_set', '2026-10-14T10:00:00Z', { institution_id: 'u1', slot: 2 }), t, names)).toBe(
      '2-o\'ringa qo\'ydi: Kongju National University',
    );
    expect(describeEvent(ev('screen_view', '2026-10-14T10:00:00Z', {}, '/assess'), t, names)).toBe(
      'Ochdi: Imkoniyat baholash',
    );
    expect(describeEvent(ev('tab_open', '2026-10-14T10:00:00Z', { tab: 'map' }), t, names)).toBe(
      "Bo'limga o'tdi: 360° xarita",
    );
    expect(describeEvent(ev('brand_new_event', '2026-10-14T10:00:00Z'), t, names)).toBe('brand_new_event');
  });

  it('names the shells and the screens added after 14 Oct', () => {
    expect(screenLabel('/', t)).toBe('Ilova ochilishi');
    expect(screenLabel('/guest', t)).toBe('Mehmon bosh oynasi');
    expect(screenLabel('/assess/lead', t)).toBe('Konsultant formasi');
    expect(screenLabel('/university/:id/assess', t)).toBe("Universitet bo'yicha baholash");
  });

  it('tells the two assessments apart (new versions send kind)', () => {
    const names = { u1: 'Hongik University' };
    expect(describeEvent(ev('assessment_start', '2026-10-27T10:00:00Z', { kind: 'visa' }), t, names)).toBe(
      '«Vizam chiqadimi?» testini boshladi',
    );
    expect(
      describeEvent(ev('assessment_start', '2026-10-27T10:00:00Z', { kind: 'university', institution_id: 'u1' }), t, names),
    ).toBe('Baholashni boshladi: Hongik University');
    expect(describeEvent(ev('lead_submit', '2026-10-27T10:00:00Z', { status: 'ok' }), t, names)).toBe(
      "Konsultantga so'rov yubordi: muvaffaqiyatli",
    );
  });

  it('counts the universities picked with ♥ (slot_set, and university_save of old versions)', () => {
    expect(
      pickedUniversities([
        ev('slot_set', '2026-10-27T09:00:00Z', { institution_id: 'a', slot: 1 }),
        ev('slot_set', '2026-10-27T09:01:00Z', { institution_id: 'a', slot: 2 }),
        ev('university_save', '2026-10-15T09:00:00Z', { institution_id: 'b' }),
        ev('university_open', '2026-10-27T09:00:00Z', { institution_id: 'c' }),
      ]).sort(),
    ).toEqual(['a', 'b']);
  });

  it('splits events into visits at a 30-minute gap, newest first', () => {
    const events = [
      ev('app_open', '2026-10-14T09:00:00Z'),
      ev('screen_view', '2026-10-14T09:10:00Z'),
      ev('app_open', '2026-10-14T12:00:00Z'),
    ];
    const visits = sessionsOf(events);
    expect(visits).toHaveLength(2);
    expect(visits[0].map((e) => e.occurred_at)).toEqual(['2026-10-14T12:00:00Z']);
    expect(visits[1]).toHaveLength(2);
  });

  it('collects the universities events name', () => {
    expect(
      institutionIds([
        ev('duel_pick', '2026-10-14T09:00:00Z', { institution_id: 'a', other_id: 'b' }),
        ev('university_save', '2026-10-14T09:00:00Z', { institution_id: 'a' }),
      ]).sort(),
    ).toEqual(['a', 'b']);
  });
});
