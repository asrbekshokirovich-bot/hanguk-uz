import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));

import { MISSING_FIELD_LABEL } from '../../copy';
import {
  buildCallPayload,
  busyProblems,
  defaultNextLocal,
  deriveChatChannels,
  evaluateGuard,
  fillTemplate,
  findTemplate,
  forbiddenRanges,
  initialTalkedForm,
  missingMandatory,
  pickDefaultChannel,
  problemSentence,
  queueName,
  recommendedOfferKeys,
  recommendedOffers,
  stageOptionDisabled,
  talkedProblems,
  type TalkedForm,
} from '../cardLogic';
import { cleanHandle, cleanPhone } from '../leadWrite';
import { telHref } from '../phone';
import { COMPLETE_FIVE, SEED_OFFERS, makeLead } from './helpers';
import { DEFAULT_SETTINGS } from '../../useLeadSettings';

const NOW = new Date('2026-10-05T10:00:00Z'); // 15:00 in Tashkent
const OBJECTIONS = DEFAULT_SETTINGS.objections;

const filled = (over: Partial<TalkedForm> = {}): TalkedForm => ({
  ...initialTalkedForm(makeLead({ ...COMPLETE_FIVE }), NOW),
  objection: 'Narx',
  competitor: "Yo'q",
  ...over,
});

describe('the 5 mandatory fields', () => {
  it('lists what is empty, like fn_lead_missing_fields', () => {
    expect(missingMandatory({})).toEqual(['goal', 'certificate', 'age_grade', 'region', 'decider']);
    expect(missingMandatory({ ...COMPLETE_FIVE })).toEqual([]);
  });

  it('accepts a school class instead of an age, and "Yo\'q" as a certificate answer', () => {
    expect(missingMandatory({ ...COMPLETE_FIVE, age: null, study_year: '10-sinf', cert_level: "Yo'q" })).toEqual([]);
    expect(missingMandatory({ ...COMPLETE_FIVE, age: null })).toEqual(['age_grade']);
    expect(missingMandatory({ ...COMPLETE_FIVE, city: '  ' })).toEqual(['region']);
  });
});

describe('what "Saqlash" waits for after "Gaplashildi"', () => {
  it('asks for the 5 fields, the objection and the other centre', () => {
    const form = initialTalkedForm(makeLead(), NOW);
    expect(talkedProblems(form, NOW)).toEqual([
      'goal',
      'certificate',
      'age_grade',
      'region',
      'decider',
      'objection',
      'competitor',
    ]);
    expect(problemSentence(['goal', 'objection'])).toBe(`To‘ldirilmagan: ${MISSING_FIELD_LABEL.goal}, ${MISSING_FIELD_LABEL.objection}`);
  });

  it('asks for objection and competitor on every call, even when the lead already has them', () => {
    const form = initialTalkedForm(makeLead({ ...COMPLETE_FIVE, objection: 'Narx', competitor: 'ON201' }), NOW);
    expect(talkedProblems(form, NOW)).toEqual(['objection', 'competitor']);
  });

  it('is satisfied once everything is filled (default next action: tomorrow 10:00)', () => {
    expect(defaultNextLocal(NOW)).toBe('2026-10-06T10:00');
    expect(talkedProblems(filled(), NOW)).toEqual([]);
  });

  it('needs the Taklif turi for the stage Taklif', () => {
    expect(talkedProblems(filled({ stage: 'offer' }), NOW)).toEqual(['product_fit']);
    expect(talkedProblems(filled({ stage: 'offer', product_fit: 'standart' }), NOW)).toEqual([]);
  });

  it('needs a date from tomorrow and a reason for Kutish', () => {
    expect(talkedProblems(filled({ stage: 'waiting' }), NOW)).toEqual(['wait_until', 'wait_reason']);
    expect(talkedProblems(filled({ stage: 'waiting', waitUntil: '2026-10-05', waitReason: 'money' }), NOW)).toEqual(['wait_until']);
    expect(talkedProblems(filled({ stage: 'waiting', waitUntil: '2026-10-06', waitReason: 'money' }), NOW)).toEqual([]);
  });

  it('needs a reason for Yo\'qotildi, and the centre when the reason is "Boshqa markaz"', () => {
    expect(talkedProblems(filled({ stage: 'lost' }), NOW)).toEqual(['lost_reason']);
    expect(talkedProblems(filled({ stage: 'lost', lostReason: 'price' }), NOW)).toEqual([]);
    expect(talkedProblems(filled({ stage: 'lost', lostReason: 'other_center' }), NOW)).toEqual(['lost_competitor']);
    expect(talkedProblems(filled({ stage: 'lost', lostReason: 'other_center', lostCompetitor: 'ON201' }), NOW)).toEqual([]);
  });

  it('refuses a next action that has already passed, accepts the 1/3/7-day follow-up without a time', () => {
    expect(talkedProblems(filled({ nextLocal: '2026-10-05T09:00' }), NOW)).toEqual(['next_action_past']);
    expect(talkedProblems(filled({ nextLocal: '' }), NOW)).toEqual(['next_action']);
    expect(talkedProblems(filled({ nextMode: 'followup', nextLocal: '' }), NOW)).toEqual([]);
  });

  it('"Band / keyin" needs a callback time in the future', () => {
    expect(busyProblems(null, NOW)).toEqual(['callback_time']);
    expect(busyProblems('2026-10-05T09:00:00Z', NOW)).toEqual(['next_action_past']);
    expect(busyProblems('2026-10-05T11:00:00Z', NOW)).toEqual([]);
  });

  it('never offers a stage below the lead\'s own, but always Kutish and Yo\'qotildi', () => {
    expect(stageOptionDisabled('contacted', 'offer')).toBe(true);
    expect(stageOptionDisabled('interested', 'offer')).toBe(true);
    expect(stageOptionDisabled('offer', 'offer')).toBe(false);
    expect(stageOptionDisabled('contract', 'offer')).toBe(false);
    expect(stageOptionDisabled('waiting', 'contract')).toBe(false);
    expect(stageOptionDisabled('lost', 'contract')).toBe(false);
    expect(stageOptionDisabled('contacted', 'new')).toBe(false);
  });
});

describe('the recordCall payload (RecordCallPayload)', () => {
  const startedAt = '2026-10-05T10:00:00.000Z';

  it('Gaplashildi: the five fields, objection, competitor, stage and a callback time', () => {
    const payload = buildCallPayload('talked', { startedAt, talked: filled({ note: '  ota-onasi bilan  ' }) });
    expect(payload).toEqual({
      started_at: startedAt,
      fields: {
        education_level: 'Bakalavr',
        cert_level: 'TOPIK 3',
        age: 19,
        city: "Farg'ona",
        decider: 'parent',
        objection: 'Narx',
        competitor: "Yo'q",
      },
      stage: 'contacted',
      next_action_kind: 'callback',
      next_action_at: '2026-10-06T05:00:00.000Z', // tomorrow 10:00 Tashkent
      note: 'ota-onasi bilan',
    });
  });

  it('Gaplashildi with the 1/3/7-day follow-up sends the kind and no time', () => {
    const payload = buildCallPayload('talked', { startedAt, talked: filled({ nextMode: 'followup' }) });
    expect(payload.next_action_kind).toBe('followup');
    expect(payload).not.toHaveProperty('next_action_at');
  });

  it('Gaplashildi carries the referral, the school class and the Taklif turi when they are set', () => {
    const payload = buildCallPayload('talked', {
      startedAt,
      talked: filled({
        age: null,
        study_year: '11-sinf',
        referral_type: 'student',
        referral_name: ' Aziz ',
        stage: 'offer',
        product_fit: 'hanbox',
      }),
    });
    expect(payload.fields).toMatchObject({
      study_year: '11-sinf',
      referral_type: 'student',
      referral_name: 'Aziz',
      product_fit: 'hanbox',
    });
    expect(payload.fields).not.toHaveProperty('age');
    expect(payload.stage).toBe('offer');
  });

  it('Gaplashildi + Kutish sends the date and the reason, no next action', () => {
    const payload = buildCallPayload('talked', {
      startedAt,
      talked: filled({ stage: 'waiting', waitUntil: '2026-10-12', waitReason: 'family_decision' }),
    });
    expect(payload).toMatchObject({ stage: 'waiting', wait_until: '2026-10-12', wait_reason: 'family_decision' });
    expect(payload).not.toHaveProperty('next_action_at');
    expect(payload).not.toHaveProperty('next_action_kind');
  });

  it('Gaplashildi + Yo\'qotildi sends the reason and the centre', () => {
    const payload = buildCallPayload('talked', {
      startedAt,
      talked: filled({ stage: 'lost', lostReason: 'other_center', lostCompetitor: ' Bright Future ' }),
    });
    expect(payload).toMatchObject({ stage: 'lost', lost_reason: 'other_center', lost_competitor: 'Bright Future' });
    expect(payload).not.toHaveProperty('next_action_at');
  });

  it("Ko'tarmadi and Nomer xato send nothing but started_at", () => {
    expect(buildCallPayload('no_answer', { startedAt })).toEqual({ started_at: startedAt });
    expect(buildCallPayload('wrong_number', { startedAt })).toEqual({ started_at: startedAt });
  });

  it('Band / keyin sends the callback time and the note', () => {
    expect(buildCallPayload('busy', { startedAt, busyAt: '2026-10-05T12:00:00.000Z', note: ' keyinroq ' })).toEqual({
      started_at: startedAt,
      next_action_at: '2026-10-05T12:00:00.000Z',
      note: 'keyinroq',
    });
  });
});

describe('the allowed offers (spec §11)', () => {
  const keys = (over: Parameters<typeof makeLead>[0]) =>
    recommendedOfferKeys(makeLead(over), OBJECTIONS);

  it('TOPIK 3+ / IELTS 5.5+ -> Standart and Premium', () => {
    expect(keys({ cert_level: 'TOPIK 3' })).toEqual(['standart', 'premium']);
    expect(keys({ cert_level: 'TOPIK 6' })).toEqual(['standart', 'premium']);
    expect(keys({ cert_level: 'IELTS 5.5' })).toEqual(['standart', 'premium']);
    expect(keys({ cert_level: 'IELTS 7.0+' })).toEqual(['standart', 'premium']);
  });

  it('no certificate or a school class -> Hanbox', () => {
    expect(keys({ cert_level: "Yo'q" })).toEqual(['hanbox']);
    expect(keys({ study_year: '10-sinf' })).toEqual(['hanbox']);
    expect(keys({ cert_level: 'TOPIK 4', study_year: '11-sinf' })).toEqual(['standart', 'premium', 'hanbox']);
  });

  it('a documents / finance (or visa) worry -> NO RISK, which needs the boss', () => {
    expect(keys({ cert_level: 'TOPIK 3', objection: 'Hujjat / moliya' })).toEqual(['standart', 'premium', 'no_risk']);
    expect(keys({ objection: 'viza rad etilishidan qo‘rqadi' })).toEqual(['no_risk']);
    const offers = recommendedOffers(makeLead({ objection: 'Hujjat / moliya' }), SEED_OFFERS, OBJECTIONS);
    expect(offers.map((o) => [o.key, o.offer.needs_boss])).toEqual([['no_risk', true]]);
  });

  it('a GKS goal -> GKS; a vocational goal or TOPIK 2 -> Kasbiy', () => {
    expect(keys({ education_level: 'GKS' })).toEqual(['gks']);
    expect(keys({ education_level: 'Kasbiy ta’lim' })).toEqual(['kasbiy']);
    expect(keys({ cert_level: 'TOPIK 2' })).toEqual(['kasbiy']);
  });

  it('shows nothing until there is something to go on, and skips offers the settings do not have', () => {
    expect(keys({})).toEqual([]);
    expect(recommendedOffers(makeLead({ cert_level: 'TOPIK 3' }), { standart: SEED_OFFERS.standart }, OBJECTIONS).map((o) => o.key)).toEqual(['standart']);
  });
});

describe('the composer guard (spec §6, §10, §11)', () => {
  const words = DEFAULT_SETTINGS.forbidden_words;

  it('lets ordinary text through', () => {
    expect(evaluateGuard('Salom, qanday yordam beray?', words, false).ok).toBe(true);
    expect(evaluateGuard('   ', words, false).ok).toBe(true);
  });

  it('stops a forbidden word, whatever its case, and names it', () => {
    const g = evaluateGuard('Biz Kafolat beramiz', words, true);
    expect(g).toMatchObject({ ok: false, kind: 'word', word: 'kafolat', reason: "'kafolat' so'zi taqiqlangan" });
    expect(evaluateGuard('narx 100% aniq', words, false)).toMatchObject({ ok: false, word: '100%' });
  });

  it('stops a "% chegirma" phrase until the lead has an approved promise', () => {
    const blocked = evaluateGuard('Sizga 10% chegirma beramiz', words, false);
    expect(blocked).toMatchObject({ ok: false, kind: 'discount' });
    expect(blocked.reason).toContain("Avval rahbar tasdig'ini oling");
    expect(evaluateGuard('Sizga 10% chegirma beramiz', words, true).ok).toBe(true);
    expect(evaluateGuard('chegirma 15 foiz', words, false).kind).toBe('discount');
  });

  it('a forbidden word stays blocked even with an approved promise', () => {
    expect(evaluateGuard('10% chegirma va kafolat', words, true).kind).toBe('word');
  });

  it('stops text that still has an unfilled {variable}', () => {
    expect(evaluateGuard('{ism}, {sana} gacha', words, false)).toMatchObject({ ok: false, kind: 'variable', word: '{ism}' });
  });

  it('finds where to underline: words, the discount phrase (unless approved), leftover variables', () => {
    const text = 'kafolat va 10% chegirma {sana}';
    expect(forbiddenRanges(text, words, true).map((r) => text.slice(r.start, r.end))).toEqual(['kafolat', '10% chegirma', '{sana}']);
    expect(forbiddenRanges(text, words, false).map((r) => text.slice(r.start, r.end))).toEqual(['kafolat', '{sana}']);
    expect(forbiddenRanges('Kafolat, kafolat', ['kafolat'], false)).toHaveLength(2);
  });
});

describe('templates', () => {
  const lead = makeLead({ full_name: 'Dilnoza Abdullayeva', product_fit: 'premium' });

  it('fills {ism} {tarif} {narx} {sana} {operator}', () => {
    const text = '{ism}, {tarif}: {narx}. {sana} — {operator}';
    expect(
      fillTemplate(text, { lead: { ...lead, wait_until: '2026-10-12' }, offers: SEED_OFFERS, operatorName: 'Omina' }),
    ).toBe('Dilnoza, Premium: 3 mln + 10 mln vizadan keyin. 12.10 — Omina');
  });

  it('falls back to Standart like the database does, and drops {ism} for an Instagram placeholder name', () => {
    const anon = makeLead({ full_name: 'Instagram 12345', product_fit: null });
    expect(fillTemplate('{ism}, siz bilan {tarif}', { lead: anon, offers: SEED_OFFERS })).toBe('Siz bilan Standart');
  });

  it('leaves what it cannot resolve in place, so the guard can stop it', () => {
    const out = fillTemplate('{ism}, {sana} gacha', { lead, offers: SEED_OFFERS });
    expect(out).toBe('Dilnoza, {sana} gacha');
    expect(evaluateGuard(out, [], false).kind).toBe('variable');
  });

  it("uses the settings' own template, or the built-in 'called' / 'confirm_phone'", () => {
    expect(findTemplate([], 'called')?.uz).toContain("bog'lanmoqchi bo'ldik");
    expect(findTemplate([], 'confirm_phone')?.uz).toContain('tasdiqlang');
    expect(findTemplate([], 'nope')).toBeNull();
    expect(findTemplate([{ key: 'called', group: 'x', uz: 'mening', ru: 'moy' }], 'called')?.uz).toBe('mening');
  });
});

describe('chat channels', () => {
  it('derives (source, sender id) from the identities and the lead\'s own source', () => {
    const lead = makeLead({ source: 'instagram', source_id: 'ig-1', telegram_handle: 'dilnoza_t' });
    const channels = deriveChatChannels(lead, [
      { channel: 'telegram', identifier: '555', identifier_label: 'dilnoza_t' },
      { channel: 'instagram', identifier: 'ig-1', identifier_label: null },
      { channel: 'phone', identifier: '+998941966989' },
    ]);
    expect(channels.map((c) => [c.source, c.senderId])).toEqual([
      ['telegram', '555'],
      ['instagram', 'ig-1'],
    ]);
    expect(channels[0].label).toBe('@dilnoza_t');
  });

  it('has no channel for a form / phone lead, and none for Facebook (no send path)', () => {
    expect(deriveChatChannels(makeLead({ source: 'meta_form', source_id: 'leadgen-1' }), [])).toEqual([]);
    expect(deriveChatChannels(makeLead({ source: 'facebook', source_id: 'fb-1' }), [])).toEqual([]);
  });

  it('starts on the channel the client wrote on last, else the preferred one', () => {
    const channels = deriveChatChannels(makeLead({ source: 'instagram', source_id: 'ig-1' }), [
      { channel: 'telegram', identifier: '555' },
    ]);
    expect(pickDefaultChannel(channels, 'telegram', null)?.source).toBe('telegram');
    expect(pickDefaultChannel(channels, null, 'telegram')?.source).toBe('telegram');
    expect(pickDefaultChannel(channels, null, null)?.source).toBe('telegram');
    expect(pickDefaultChannel([], 'telegram', null)).toBeNull();
  });
});

describe('small helpers', () => {
  it('names a reactivation queue from its label', () => {
    expect(queueName('hanbox')).toBe('Hanbox');
    expect(queueName('no_risk')).toBe('NO RISK');
    expect(queueName(null)).toBeNull();
  });

  it('builds a tel: link, adding +998 to a bare local number', () => {
    expect(telHref('+998 94 196 69 89')).toBe('tel:+998941966989');
    expect(telHref('94 196 69 89')).toBe('tel:+998941966989');
  });

  it('cleans a typed phone / handle the way the database will store it (the database does the validating)', () => {
    expect(cleanHandle(' @Dilnoza_A ')).toBe('dilnoza_a');
    expect(cleanHandle('  ')).toBeNull();
    expect(cleanPhone('')).toBeNull();
    expect(cleanPhone(' +998 90 123 45 67 ')).toBe('+998 90 123 45 67');
    expect(cleanPhone('123')).toBe('123'); // refused by lead_save_fields with phone_invalid, not here
  });
});
