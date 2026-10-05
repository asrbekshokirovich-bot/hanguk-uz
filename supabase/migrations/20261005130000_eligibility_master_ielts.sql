-- "Viza imkoniyatim": the IELTS question (owner, 2026-10-05).
--
-- The app now asks for the IELTS score (S02, question 5) and stores it in
-- leads.quiz_answers ->> 'english'. For a master's applicant an IELTS of at
-- least this score counts as the language requirement met (as TOPIK 3+ does),
-- and English-taught programmes asking no more than the score are offered.
-- The app falls back to the same 5.5 when the row cannot be read.

insert into public.eligibility_rules (key, value, note) values
  ('d2_master_ielts_min', '5.5', 'Magistratura: shu IELTS va yuqori bo''lsa — TOPIK 3+ kabi hisoblanadi')
on conflict (key) do nothing;
