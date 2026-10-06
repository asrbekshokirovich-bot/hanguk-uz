import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../useLeadSettings';

// useLeadSettings -> api -> the supabase client, which throws without env vars
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import type { AlertRecipient } from '../../types';
import {
  addTags,
  buildHours,
  buildLadder,
  buildLostReasons,
  buildOffers,
  buildRecipientPayload,
  buildTemplates,
  buildTimer,
  describeStep,
  emptyRecipient,
  groupTemplates,
  ladderToForm,
  normalizeTags,
  offersToForm,
  parseInteger,
  recipientToForm,
  timerToForm,
  unknownVariables,
  validateAnnounce,
  validateAutoReply,
  validateHours,
  validateLadder,
  validateLostReasons,
  validateOffers,
  validateQueueLimit,
  validateRecipient,
  validateTemplate,
  validateTemplates,
  validateTimer,
} from '../settingsModel';

describe('numbers', () => {
  it('parses whole numbers only', () => {
    expect(parseInteger(' 15 ')).toBe(15);
    expect(parseInteger('1.5')).toBeNull();
    expect(parseInteger('-3')).toBeNull();
    expect(parseInteger('')).toBeNull();
  });
});

describe('tags', () => {
  it('trims, drops blanks and repeats (any case), keeps the first spelling', () => {
    expect(normalizeTags([' kafolat ', '', 'Kafolat', '100%', '  '])).toEqual(['kafolat', '100%']);
  });

  it('adds comma / line separated words one by one', () => {
    expect(addTags(['kafolat'], 'bepul noutbuk, 100%\nKAFOLAT; bitta narx')).toEqual(['kafolat', 'bepul noutbuk', '100%', 'bitta narx']);
  });
});

describe('work hours', () => {
  it('builds the object the SQL helpers read, days sorted and unique', () => {
    expect(buildHours({ start: '09:00', end: '22:00', days: [7, 1, 3, 3] })).toEqual({ start: '09:00', end: '22:00', days: [1, 3, 7] });
  });

  it('refuses an end before the start, a bad time and no days', () => {
    expect(validateHours({ start: '09:00', end: '22:00', days: [1] })).toBeNull();
    expect(validateHours({ start: '22:00', end: '09:00', days: [1] })).toMatch(/keyin/);
    expect(validateHours({ start: '9:00', end: '22:00', days: [1] })).toMatch(/SS:DD/);
    expect(validateHours({ start: '09:00', end: '22:00', days: [] })).toMatch(/kun/);
  });
});

describe('timer', () => {
  it('saves two numeric keys', () => {
    expect(buildTimer({ timer: '10', repeat: '15' })).toEqual({ timer_minutes: 10, escalation_repeat_minutes: 15 });
    expect(timerToForm({ timer_minutes: 10, escalation_repeat_minutes: 10 })).toEqual({ timer: '10', repeat: '10' });
  });

  it('refuses zero, text and absurd values', () => {
    expect(validateTimer({ timer: '10', repeat: '10' })).toBeNull();
    expect(validateTimer({ timer: '0', repeat: '10' })).toMatch(/Taymer/);
    expect(validateTimer({ timer: '10', repeat: 'x' })).toMatch(/Takror/);
    expect(validateTimer({ timer: '500', repeat: '10' })).toMatch(/Taymer/);
  });
});

describe('ladder', () => {
  it('round-trips the seed to exactly the seed JSON', () => {
    const form = ladderToForm(DEFAULT_SETTINGS.ladder);
    expect(validateLadder(form)).toBeNull();
    expect(buildLadder(form)).toEqual(DEFAULT_SETTINGS.ladder);
  });

  it('writes each step in the shape fn_lead_ladder_next reads', () => {
    const built = buildLadder({
      steps: [
        { kind: 'minutes', value: '20', at: '10:00' },
        { kind: 'minutes', value: '180', at: '10:00' },
        { kind: 'next_day', value: '', at: '11:30' },
        { kind: 'days', value: '3', at: '09:30' },
      ],
      windowDays: '10',
      dmAfter: '3',
    });
    expect(built).toEqual({
      steps: [
        { kind: 'minutes', value: 20 }, // no `at`
        { kind: 'minutes', value: 180 },
        { kind: 'next_day', at: '11:30' }, // no `value`
        { kind: 'days', value: 3, at: '09:30' },
      ],
      window_days: 10,
      dm_after_attempt: 3,
    });
  });

  it('says which step is wrong', () => {
    const ok = ladderToForm(DEFAULT_SETTINGS.ladder);
    const withStep = (i: number, patch: Partial<(typeof ok.steps)[number]>) => ({
      ...ok,
      steps: ok.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
    expect(validateLadder(withStep(0, { value: '' }))).toMatch(/2-urinish/);
    expect(validateLadder(withStep(2, { at: '25:00' }))).toMatch(/4-urinish/);
    expect(validateLadder(withStep(3, { value: '0' }))).toMatch(/5-urinish/);
    expect(validateLadder({ ...ok, windowDays: '0' })).toMatch(/Oyna/);
    expect(validateLadder({ ...ok, dmAfter: '9' })).toMatch(/DM/);
  });

  it('describes a step in words', () => {
    expect(describeStep({ kind: 'minutes', value: '15', at: '' })).toBe('+15 daqiqa');
    expect(describeStep({ kind: 'minutes', value: '120', at: '' })).toBe('+2 soat');
    expect(describeStep({ kind: 'next_day', value: '', at: '10:00' })).toBe('ertasi kuni 10:00');
    expect(describeStep({ kind: 'days', value: '2', at: '10:00' })).toBe('+2 kun, 10:00');
  });
});

describe('auto reply', () => {
  it('needs both languages', () => {
    expect(validateAutoReply({ uz: 'Salom', ru: 'Привет' })).toBeNull();
    expect(validateAutoReply({ uz: 'Salom', ru: '  ' })).toMatch(/bo'sh/);
  });
});

describe('templates', () => {
  const t = (over = {}) => ({ key: 'greeting', group: 'salom', uz: 'Salom, {ism}!', ru: 'Привет, {ism}!', ...over });

  it('knows the documented variables and flags typos before they reach a client', () => {
    expect(unknownVariables('{ism} {tarif} {narx} {sana} {operator}')).toEqual([]);
    expect(unknownVariables('Salom {ismi}, {name} {ism}')).toEqual(['{ismi}', '{name}']);
    expect(validateTemplate(t({ uz: 'Salom {ismi}' }), [])).toMatch(/\{ismi\}/);
  });

  it('needs a valid unique key, a group and both texts', () => {
    expect(validateTemplate(t(), [])).toBeNull();
    expect(validateTemplate(t({ key: 'Bad Key' }), [])).toMatch(/Kalit/);
    expect(validateTemplate(t(), [t()])).toMatch(/allaqachon/);
    expect(validateTemplate(t({ group: ' ' }), [])).toMatch(/Guruh/);
    expect(validateTemplate(t({ uz: '' }), [])).toMatch(/O'zbekcha/);
    expect(validateTemplate(t({ ru: '' }), [])).toMatch(/Ruscha/);
  });

  it('validates a whole list and names the template', () => {
    expect(validateTemplates([t(), t({ key: 'price' })])).toBeNull();
    expect(validateTemplates([t(), t({ key: 'price', uz: '{x}' })])).toMatch(/^«price»/);
    expect(validateTemplates([t(), t()])).toMatch(/allaqachon/);
  });

  it('writes needs_boss only when it is on', () => {
    expect(buildTemplates([t({ needs_boss: false }), t({ key: 'no_risk', group: 'no_risk', needs_boss: true })])).toEqual([
      { key: 'greeting', group: 'salom', uz: 'Salom, {ism}!', ru: 'Привет, {ism}!' },
      { key: 'no_risk', group: 'no_risk', uz: 'Salom, {ism}!', ru: 'Привет, {ism}!', needs_boss: true },
    ]);
  });

  it('groups in first-seen order', () => {
    const groups = groupTemplates([t(), t({ key: 'a', group: 'narx' }), t({ key: 'b', group: 'salom' })]);
    expect(groups.map((g) => [g.group, g.items.map((i) => i.key)])).toEqual([
      ['salom', ['greeting', 'b']],
      ['narx', ['a']],
    ]);
  });
});

describe('offers', () => {
  it('turns the object into rows and back', () => {
    const rows = offersToForm({ standart: { title: 'Standart', text: '2 mln', needs_boss: false } });
    expect(rows).toEqual([{ key: 'standart', title: 'Standart', text: '2 mln', needs_boss: false }]);
    expect(buildOffers([{ key: 'gks', title: ' GKS ', text: ' Narx — rahbardan ', needs_boss: true }])).toEqual({
      gks: { title: 'GKS', text: 'Narx — rahbardan', needs_boss: true },
    });
  });

  it('needs unique keys, a title and a text', () => {
    const o = { key: 'standart', title: 'Standart', text: '2 mln', needs_boss: false };
    expect(validateOffers([o])).toBeNull();
    expect(validateOffers([o, o])).toMatch(/takrorlangan/);
    expect(validateOffers([{ ...o, title: '' }])).toMatch(/nomini/);
    expect(validateOffers([{ ...o, text: '' }])).toMatch(/matnini/);
    expect(validateOffers([{ ...o, key: 'Standart' }])).toMatch(/kalit/);
  });
});

describe('lost reasons', () => {
  it('needs at least one reason, unique keys and labels', () => {
    const r = { key: 'price', label: 'Narx', queue: 'price' };
    expect(validateLostReasons([r])).toBeNull();
    expect(validateLostReasons([])).toMatch(/Kamida/);
    expect(validateLostReasons([r, r])).toMatch(/takrorlangan/);
    expect(validateLostReasons([{ ...r, label: ' ' }])).toMatch(/nomini/);
  });

  it('an empty queue is stored as null', () => {
    expect(buildLostReasons([{ key: 'spam', label: ' Spam ', queue: '' as unknown as null }])).toEqual([{ key: 'spam', label: 'Spam', queue: null }]);
  });
});

describe('queue limit and announcements', () => {
  it('limit is a whole number from 1 to 500', () => {
    expect(validateQueueLimit('15')).toBeNull();
    expect(validateQueueLimit('0')).toMatch(/Kunlik limit/);
    expect(validateQueueLimit('abc')).toMatch(/Kunlik limit/);
  });

  it('an announced Hanbox group needs its date', () => {
    expect(validateAnnounce({ hanbox_group_date: '2026-10-26', hanbox_announced: true, no_risk_announced: false })).toBeNull();
    expect(validateAnnounce({ hanbox_group_date: '', hanbox_announced: true, no_risk_announced: false })).toMatch(/sana/);
    expect(validateAnnounce({ hanbox_group_date: '26.10', hanbox_announced: false, no_risk_announced: false })).toMatch(/sana/);
  });
});

describe('Telegram recipients', () => {
  const existing: AlertRecipient = {
    chat_id: '123456789',
    label: 'Omina',
    enabled: true,
    watchdog: true,
    staff_user_id: 'u1',
    escalate: true,
    boss_alerts: false,
    reports_daily: true,
    reports_weekly: false,
  };

  it('the payload carries exactly the columns the form owns (watchdog is left alone)', () => {
    expect(buildRecipientPayload({ ...emptyRecipient, chat_id: ' -1001234567 ', label: ' Rahbar ', boss_alerts: true, reports_daily: true, reports_weekly: true })).toEqual({
      chat_id: '-1001234567',
      label: 'Rahbar',
      staff_user_id: null,
      escalate: true,
      boss_alerts: true,
      reports_daily: true,
      reports_weekly: true,
      enabled: true,
    });
    expect(Object.keys(buildRecipientPayload(recipientToForm(existing)))).not.toContain('watchdog');
  });

  it('an edit round-trips', () => {
    expect(buildRecipientPayload(recipientToForm(existing))).toEqual({
      chat_id: '123456789',
      label: 'Omina',
      staff_user_id: 'u1',
      escalate: true,
      boss_alerts: false,
      reports_daily: true,
      reports_weekly: false,
      enabled: true,
    });
  });

  it('needs a numeric chat id, a name and a new id when adding', () => {
    const f = { ...emptyRecipient, chat_id: '123456789', label: 'Omina' };
    expect(validateRecipient(f, [], true)).toBeNull();
    expect(validateRecipient({ ...f, chat_id: '@omina' }, [], true)).toMatch(/Chat ID/);
    expect(validateRecipient({ ...f, chat_id: '12' }, [], true)).toMatch(/Chat ID/);
    expect(validateRecipient({ ...f, label: ' ' }, [], true)).toMatch(/Nomini/);
    expect(validateRecipient(f, ['123456789'], true)).toMatch(/allaqachon/);
    expect(validateRecipient(f, ['123456789'], false)).toBeNull(); // editing the same row is fine
    expect(validateRecipient({ ...f, chat_id: '-1001234567' }, [], true)).toBeNull(); // a group
  });
});
