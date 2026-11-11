import { describe, expect, it } from 'vitest';

// KG6 (claude/qirgiziston-reja.md): server texts in Kyrgyz, and the AI told
// which country the app is set up for.
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => undefined } };

const { stageMessage } = await import('../../../supabase/functions/notify-student-stages/messages.ts');
const { messageText, stopLabel } = await import('../../../supabase/functions/notify-guest-reminders/messages.ts');
const { normalizeLang: guestLang } = await import('../../../supabase/functions/notify-guest-reminders/plan.ts');
const DS = await import('../../../supabase/functions/telegram-webhook/deadline_sub.ts');
const { textFor, checkCampaign } = await import('../../../supabase/functions/send-guest-push/campaign.ts');
const { telegramText } = await import('../../../supabase/functions/student-app-invite/invite.ts');
const { weeklyLimitMessage } = await import('../../../supabase/functions/interview-ai/guest_quota.ts');
const { guestSystem, studentSystem, staffSystem, normalizeCountry, langLine } = await import(
  '../../../supabase/functions/hanguk-ai-chat/prompts.ts'
);

const cyrillic = /[Ѐ-ӿ]/;

describe('Kyrgyz server texts', () => {
  it('student stage notifications exist in ky for every kind', () => {
    const kinds = [
      'documents_ready', 'university_offered', 'university_confirmed', 'online_submitted', 'offline_sent',
      'admission_accepted', 'final_university', 'interview_scheduled', 'admission_rejected', 'visa_process',
      'visa_waiting', 'visa_received', 'offer_reminder', 'deadline_7', 'deadline_3', 'deadline_1',
    ] as const;
    for (const k of kinds) {
      const m = stageMessage(k, ['Ajou University', 'Inha University'], 'ky');
      expect(m.title).toMatch(cyrillic);
      expect(m.body).toMatch(cyrillic);
      expect(m.body).not.toContain("o'");
    }
    expect(stageMessage('admission_accepted', ['A', 'B'], 'ky').body).toBe('Сиз кабыл алындыңыз: A жана B.');
    expect(stageMessage('deadline_3', ['A'], 'ky').title).toBe('Онлайн арызга 3 күн калды ⏰');
  });

  it('guest reminders and the Telegram bot answer in ky', () => {
    expect(guestLang('ky')).toBe('ky');
    expect(guestLang('ky-KG')).toBe('ky');
    expect(messageText('deadline_1', 'ky', ['A']).title).toBe('Онлайн арыз берүү эртең бүтөт ⏰');
    expect(messageText('guideline_new', 'ky', ['A', 'B']).body).toContain('A жана B');
    expect(stopLabel('ky')).toBe('Токтотуу');
    expect(DS.lang('ky')).toBe('ky');
    for (const t of [DS.linkedText('ky'), DS.stoppedText('ky'), DS.unknownText('ky')]) expect(t).toMatch(cyrillic);
  });

  it('a Kyrgyz phone gets the Russian campaign text when no Kyrgyz one was written', () => {
    const c = checkCampaign({ campaign: 'kg-test', title: { uz: 'Salom', ru: 'Привет' }, body: { uz: 'Matn', ru: 'Текст' } });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(textFor(c.value, 'ky')).toEqual({ title: 'Привет', body: 'Текст' });
    const both = checkCampaign({ campaign: 'kg-test', title: { uz: 'Salom', ky: 'Салам' }, body: { uz: 'Matn', ky: 'Текст ky' } });
    if (!both.ok) throw new Error('bad');
    expect(textFor(both.value, 'ky')).toEqual({ title: 'Салам', body: 'Текст ky' });
    const uzOnly = checkCampaign({ campaign: 'kg-test', title: { uz: 'Salom' }, body: { uz: 'Matn' } });
    if (!uzOnly.ok) throw new Error('bad');
    expect(textFor(uzOnly.value, 'ky')).toEqual({ title: 'Salom', body: 'Matn' });
  });

  it('the app invite and the interview limit have ky', () => {
    const text = telegramText(
      { lang: 'ky', full_name: 'Айбек Асанов', link_code: null, magic_code: 'ABCD1234' } as never,
      null,
    );
    expect(text).toContain('Саламатсызбы, Айбек!');
    expect(text).toContain('Кирүү коду: ABCD1234');
    expect(weeklyLimitMessage('ky')).toMatch(cyrillic);
  });
});

describe('Hanguk AI and the country', () => {
  it('answers in Kyrgyz when asked', () => {
    expect(langLine('ky')).toContain('Кыргыз');
  });

  it('a Kyrgyz guest gets the Bishkek embassy and no Uzbek phone', () => {
    expect(normalizeCountry('kg')).toBe('KG');
    expect(normalizeCountry(undefined)).toBe('UZ');
    const kg = guestSystem({ language: 'ky', today: '2026-11-11', country: 'KG' });
    expect(kg).toContain('Bishkek');
    expect(kg).toContain('KICB');
    expect(kg).toContain('instagram.com/hanguk_consulting');
    expect(kg).not.toContain('+998');
    const uz = guestSystem({ language: 'uz', today: '2026-11-11' });
    expect(uz).toContain('+998 95 833 15 30');
    expect(uz).not.toContain('Bishkek');
    expect(uz).toContain('Korean Embassy in Tashkent');
  });

  it('a Kyrgyz student is told the same; staff know about KG leads', () => {
    expect(studentSystem({ language: 'ru', today: 'x', name: 'A', country: 'KG' })).toContain('Korean Embassy in Bishkek');
    expect(studentSystem({ language: 'uz', today: 'x', name: 'A' })).not.toContain('Bishkek');
    expect(studentSystem({ language: 'uz', today: 'x', name: 'A' })).toContain('Korean Embassy in Tashkent');
    expect(staffSystem({ language: 'uz', today: 'x', staffName: 'A', team: '', sqlSchema: null })).toContain("leads.country = 'KG'");
  });
});
