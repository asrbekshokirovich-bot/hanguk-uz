-- Universitet tanlash → talaba tasdig'i → xodimning yakuniy tasdig'i.
--
-- The owner's flow (2026-10-14):
--   1. Staff offer universities (two of their choosing; the third is the
--      partner university) — status 'offered'.
--   2. The student answers in the mobile app: "Roziman" → 'accepted', or
--      "O'zgartirish so'rayman" with a reason → 'change_requested'.
--   3. Staff have the last word: "Yakuniy tasdiqlash" → 'confirmed'. Only
--      confirmed choices feed Onlayn / Oflayn ariza.
--
-- Students never write the table directly: respond_university_choice() lets
-- them answer their own, not-yet-confirmed choices and nothing else, and
-- my_university_choices() gives them what the app card shows (the guideline
-- tables are staff-only).
--
-- Applied to production on 2026-10-14 through the Supabase connector; kept
-- here so the repo matches.

alter table public.student_university_choices
  add column if not exists status text not null default 'offered'
    check (status in ('offered', 'accepted', 'change_requested', 'confirmed')),
  add column if not exists responded_at timestamptz,
  add column if not exists change_reason text,
  add column if not exists change_note text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid;

create or replace function public.respond_university_choice(
  p_choice_id uuid,
  p_accept boolean,
  p_reason text default null,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.student_university_choices%rowtype;
begin
  select * into v_row from public.student_university_choices where id = p_choice_id;
  if not found or v_row.student_id is distinct from auth.uid() then
    raise exception 'Choice not found' using errcode = '42501';
  end if;
  if v_row.status = 'confirmed' then
    raise exception 'Already confirmed by the consultant' using errcode = '42501';
  end if;
  update public.student_university_choices
     set status = case when p_accept then 'accepted' else 'change_requested' end,
         responded_at = now(),
         change_reason = case when p_accept then null else nullif(trim(p_reason), '') end,
         change_note = case when p_accept then null else nullif(trim(p_note), '') end
   where id = p_choice_id;
end;
$$;

revoke all on function public.respond_university_choice(uuid, boolean, text, text) from public, anon;
grant execute on function public.respond_university_choice(uuid, boolean, text, text) to authenticated;

create or replace function public.my_university_choices()
returns table (
  id uuid,
  rank smallint,
  status text,
  responded_at timestamptz,
  change_reason text,
  change_note text,
  confirmed_at timestamptz,
  institution_id uuid,
  name_en text,
  name_ko text,
  city text,
  is_partner boolean,
  ielts_min numeric,
  topik_min numeric,
  kontrakt_min numeric,
  narx_valyuta text,
  kontrakt_davri text,
  online_deadline date,
  student_ielts numeric,
  student_topik numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.rank, c.status, c.responded_at, c.change_reason, c.change_note, c.confirmed_at,
         i.id, coalesce(g.univ_nomi_en, i.name_en), coalesce(g.univ_nomi_kr, i.name_ko),
         coalesce(g.shahar, i.city_ko), i.is_partner,
         g.ielts_min, g.topik_min, g.kontrakt_min, g.narx_valyuta, g.kontrakt_davri,
         (select min(r.tugash_sana) from public.university_guideline_rounds r
            join public.university_guidelines g2 on g2.id = r.guideline_uuid
           where g2.institution_id = i.id and r.etap_nomi = 'Online hujjat topshirish'
             and r.tugash_sana >= current_date),
         p.ielts_score, p.topik_level
    from public.student_university_choices c
    join public.institutions i on i.id = c.institution_id
    left join public.profiles p on p.user_id = c.student_id
    left join lateral (
      select * from public.university_guidelines g1
       where g1.institution_id = i.id
       order by g1.qabul_yili desc nulls last, (g1.semestr = 'kuz') desc, g1.updated_at desc
       limit 1
    ) g on true
   where c.student_id = auth.uid()
   order by c.rank;
$$;

revoke all on function public.my_university_choices() from public, anon;
grant execute on function public.my_university_choices() to authenticated;
