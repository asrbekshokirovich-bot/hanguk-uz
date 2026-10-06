import { Textarea } from '@/components/ui/textarea';
import { findForbidden } from '../../forbidden';
import type { LeadSettings } from '../../types';
import { normalizeTags, validateAutoReply } from '../settingsModel';
import { FieldLabel, SectionShell, TagEditor } from './SectionShell';
import { useSettingsSection } from './useSettingsSection';

interface Props {
  settings: LeadSettings;
}

// ---- Avtojavob matni ---------------------------------------------------------------------

export function AutoReplySection({ settings }: Props) {
  const s = useSettingsSection<{ uz: string; ru: string }>({
    id: 'auto_reply',
    server: { uz: settings.auto_reply.uz, ru: settings.auto_reply.ru },
    build: (f) => ({ auto_reply: { uz: f.uz.trim(), ru: f.ru.trim() } }),
    validate: validateAutoReply,
  });
  const warn = (text: string) => findForbidden(text, settings.forbidden_words);
  return (
    <SectionShell
      id="auto_reply"
      title="Avtojavob matni"
      description={
        <>
          Ish vaqtidan tashqarida (22:00–09:00) kelgan xabarga <strong>bir suhbatga bir marta</strong> yuboriladi. Avtojavob «javob berildi» hisoblanmaydi —
          lid 09:00 da HOZIR'ning tepasida turadi. Hech qachon «raqamingizni yozing» bilan boshlamang.
        </>
      }
      section={s}
    >
      {(['uz', 'ru'] as const).map((lang) => (
        <FieldLabel key={lang} label={lang === 'uz' ? "O'zbekcha matn" : 'Ruscha matn'}>
          <Textarea
            value={s.draft[lang]}
            onChange={(e) => s.setDraft((d) => ({ ...d, [lang]: e.target.value }))}
            rows={4}
            className="text-sm font-normal"
          />
          {warn(s.draft[lang]) && (
            <span className="text-[12px] font-medium text-destructive">Taqiqlangan so'z: «{warn(s.draft[lang])}»</span>
          )}
        </FieldLabel>
      ))}
    </SectionShell>
  );
}

// ---- Taqiqlangan so'zlar ---------------------------------------------------------------------

export function ForbiddenWordsSection({ settings }: Props) {
  const s = useSettingsSection<{ words: string[] }>({
    id: 'forbidden',
    server: { words: settings.forbidden_words },
    build: (f) => ({ forbidden_words: normalizeTags(f.words) }),
  });
  return (
    <SectionShell
      id="forbidden"
      title="Taqiqlangan so'zlar"
      description="Yozish oynasi va izohga ochiq javob bu so'zni qizil bilan ko'rsatadi va yuborishni to'xtatadi. «% chegirma» iborasi har doim taqiqlangan (rahbar tasdig'i kerak)."
      section={s}
    >
      <TagEditor label="Taqiqlangan so'zlar" tags={s.draft.words} onChange={(words) => s.setDraft({ words })} tone="danger" />
    </SectionShell>
  );
}

// ---- Rahbarga darhol so'zlar ------------------------------------------------------------------

export function BossWordsSection({ settings }: Props) {
  const s = useSettingsSection<{ words: string[] }>({
    id: 'boss_words',
    server: { words: settings.boss_alert_words },
    build: (f) => ({ boss_alert_words: normalizeTags(f.words) }),
  });
  return (
    <SectionShell
      id="boss_words"
      title="Rahbarga darhol so'zlar"
      description="Mijoz chatda shu so'zlardan birini yozsa, rahbarga lid havolasi bilan Telegram xabari boradi (qaytarish, pul, sud, shikoyat, direktor ...)."
      section={s}
    >
      <TagEditor label="Rahbarga darhol so'zlar" tags={s.draft.words} onChange={(words) => s.setDraft({ words })} />
    </SectionShell>
  );
}
