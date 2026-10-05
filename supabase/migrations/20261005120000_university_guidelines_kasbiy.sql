-- Universitetlar katalogi: kasbiy ta'lim (전문대학, 전문학사) guideline'lari.
--
-- Kollejlar uchun Excel ham bakalavr va magistr bilan bir xil shablonda
-- to'ldiriladi, faqat universitet varag'idagi daraja = 'kasbiy'. Katalogda
-- "Excel kasbiy" tugmasi shu darajadagi faylni yuklaydi.

ALTER TABLE public.university_guidelines
  DROP CONSTRAINT IF EXISTS university_guidelines_daraja_check;

ALTER TABLE public.university_guidelines
  ADD CONSTRAINT university_guidelines_daraja_check CHECK (
    daraja IS NULL OR daraja IN
      ('bakalavr', 'transfer', 'magistratura', 'doktorantura', 'til_kursi', 'kasbiy')
  );
