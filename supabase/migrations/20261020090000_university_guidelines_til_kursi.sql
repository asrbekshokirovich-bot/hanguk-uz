-- Universitetlar katalogi: til kursi (어학당) guideline'lari.
--
-- Til kursi Excel'i ham bakalavr, magistr va kasbiy ta'lim bilan bir xil
-- shablonda to'ldiriladi, faqat universitet varag'idagi daraja = 'til_kursi'
-- (bu qiymat daraja cheklovida boshidan bor). Katalogda "Excel til kursi
-- yuklash" tugmasi shu darajadagi faylni yuklaydi.
--
-- Til kursi yiliga 4 marta qabul qiladi, shuning uchun semestrga bahor va
-- kuzdan tashqari yoz (여름학기, iyun) va qish (겨울학기, dekabr) qo'shiladi.
-- Bular faqat til kursi uchun — buni Excel'ni o'qiydigan sayt tekshiradi.

ALTER TABLE public.university_guidelines
  DROP CONSTRAINT IF EXISTS university_guidelines_semestr_check;

ALTER TABLE public.university_guidelines
  ADD CONSTRAINT university_guidelines_semestr_check CHECK (
    semestr IS NULL OR semestr IN ('bahor', 'yoz', 'kuz', 'qish')
  );
