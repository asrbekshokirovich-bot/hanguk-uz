-- Read-only university catalogue for the student app.
--
-- The CRM's "Universitetlar → Ma'lumotli" section lists the institutions staff
-- have loaded a guideline Excel for (university_guidelines and its three child
-- tables). Those tables are staff-only under RLS, so the app could not show
-- them. The app's Explore screen (guest mode) and the Applications browse list
-- (a student with no applications yet) now render exactly that set, so every
-- Excel staff upload appears in the app on its next refresh — nobody keeps a
-- second list by hand.
--
-- Views rather than wider policies: only the columns a student reads are
-- exposed. Who uploaded the file, its name, the source page numbers and the
-- staff notes stay behind the staff-only policies.
--
-- The views run as their owner, so they read past the base tables' RLS. That
-- is the point, and it is also why every privilege but SELECT is revoked: a
-- single-table view is auto-updatable, and Supabase's default grants would
-- otherwise let anon write the base table through it.

create or replace view public.v_app_university_catalog as
select
  g.id                   as guideline_id,
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
  g.updated_at
from public.university_guidelines g
join public.institutions i on i.id = g.institution_id;

create or replace view public.v_app_university_faculties as
select
  f.guideline_uuid as guideline_id,
  f.tartib,
  f.track,
  f.kollej_en,
  f.kollej_kr,
  f.fakultet_en,
  f.fakultet_kr,
  f.topik_min,
  f.ielts_min,
  f.toefl_ibt_min,
  f.kontrakt_summa,
  f.kontrakt_davri
from public.university_guideline_faculties f;

create or replace view public.v_app_university_rounds as
select
  r.guideline_uuid as guideline_id,
  r.bosqich,
  r.etap_raqam,
  r.etap_nomi,
  r.boshlanish_sana,
  r.boshlanish_vaqt,
  r.tugash_sana,
  r.tugash_vaqt,
  r.holat
from public.university_guideline_rounds r;

create or replace view public.v_app_university_docs as
select
  d.guideline_uuid as guideline_id,
  d.tartib,
  d.hujjat_nomi,
  d.kimlar_uchun,
  d.majburiy,
  d.apostil
from public.university_guideline_docs d;

revoke all on public.v_app_university_catalog   from public, anon, authenticated;
revoke all on public.v_app_university_faculties from public, anon, authenticated;
revoke all on public.v_app_university_rounds    from public, anon, authenticated;
revoke all on public.v_app_university_docs      from public, anon, authenticated;

grant select on public.v_app_university_catalog   to anon, authenticated;
grant select on public.v_app_university_faculties to anon, authenticated;
grant select on public.v_app_university_rounds    to anon, authenticated;
grant select on public.v_app_university_docs      to anon, authenticated;
