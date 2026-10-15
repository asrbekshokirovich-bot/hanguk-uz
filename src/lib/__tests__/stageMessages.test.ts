import { describe, expect, it } from 'vitest';
import { normalizeLang, stageMessage } from '../../../supabase/functions/notify-student-stages/messages';

describe('stage notification text', () => {
  it('speaks the phone language and falls back to Uzbek', () => {
    expect(normalizeLang('ru')).toBe('ru');
    expect(normalizeLang('ko-KR')).toBe('ko');
    expect(normalizeLang('de')).toBe('uz');
    expect(normalizeLang(null)).toBe('uz');
    expect(stageMessage('documents_ready', [], 'uz').title).toBe("Hujjatlaringiz yig'ildi ✅");
    expect(stageMessage('documents_ready', [], 'ru').title).toBe('Документы собраны ✅');
  });

  it('names the universities, joining several into one message', () => {
    expect(stageMessage('online_submitted', ['Kyungpook National University'], 'uz').body).toBe(
      'Onlayn arizangiz topshirildi: Kyungpook National University.',
    );
    expect(stageMessage('university_offered', ['A', 'B'], 'uz').body).toBe(
      "Konsultantingiz siz uchun 2 ta universitet tanladi: A va B. Ilovada ko'rib, javob bering.",
    );
    expect(stageMessage('university_confirmed', ['A', 'B', 'C'], 'en').body).toBe(
      'A, B and C — confirmed. Your application is being prepared.',
    );
    expect(stageMessage('offline_sent', ['A'], 'vi').title).toBe('Đã gửi hồ sơ giấy 📮');
  });
});
