-- The app shows official partner universities first (owner, 2026-10-05).
--
-- v_app_university_catalog gains institutions.is_partner (CRM → Universitetlar
-- → "Mark as partner"). The app's universities list puts partners first, and
-- the "Viza imkoniyatim" result puts a matching partner first with a
-- "Rasmiy hamkor" badge. The column is appended, so existing readers keep
-- their column order.

create or replace view public.v_app_university_catalog as
select
  g.id as guideline_id,
  g.institution_id,
  i.name_ko,
  i.name_ko_short,
  i.name_en,
  i.city_ko,
  i.institution_type,
  g.univ_nomi_en,
  g.univ_nomi_kr,
  g.kampus,
  g.shahar,
  g.qabul_yili,
  g.semestr,
  g.daraja,
  g.english_track,
  g.korean_track,
  g.topik_min,
  g.ielts_min,
  g.toefl_ibt_min,
  g.narx_valyuta,
  g.kirish_tolovi,
  g.kontrakt_min,
  g.kontrakt_max,
  g.kontrakt_davri,
  g.fakultet_soni,
  g.ariza_tolovi,
  g.ariza_tolovi_valyuta,
  g.bank_summa,
  g.bank_valyuta,
  g.tavsiyanoma,
  g.updated_at,
  i.ieqas_status,
  i.is_active,
  i.is_partner
from public.university_guidelines g
join public.institutions i on i.id = g.institution_id;

grant select on public.v_app_university_catalog to anon, authenticated;
