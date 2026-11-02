-- Biriktirilgan universitetda talaba fakultet tanlaydi, xodim tasdiqlaydi
-- (Asrbek, 2026-10-29).
--
-- Tartib: xodim universitetni biriktiradi → talaba "Roziman" → ilovada
-- alohida "Fakultet tanlang" qadami → CRM'da xodim fakultetni tasdiqlaydi
-- (yoki "Qayta tanlasin" — tanlov tozalanadi). Allaqachon rozi bo'lingan va
-- tasdiqlangan tanlovlar ham fakultet tanlaydi.
--
-- Fakultetlar universitet yo'riqnomasidan (university_guideline_faculties):
-- har daraja (bakalavr, magistratura, kasbiy) uchun eng yangi yo'riqnoma.
-- Nomi tanlov qatoriga ham yoziladi: yo'riqnoma qayta yuklansa fakultet
-- qatorlari almashadi (faculty_id null bo'ladi), talabaning tanlovi esa qoladi.
--
-- Bazadagi mavjud ma'lumot o'zgarmaydi — faqat yangi bo'sh ustunlar.

alter table public.student_university_choices
  add column if not exists faculty_id uuid references public.university_guideline_faculties(id) on delete set null,
  add column if not exists faculty_name text,
  add column if not exists faculty_daraja text,
  add column if not exists faculty_chosen_at timestamptz,
  add column if not exists faculty_confirmed_at timestamptz,
  add column if not exists faculty_confirmed_by uuid;

comment on column public.student_university_choices.faculty_name is
  'Talaba tanlagan fakultet nomi (yo''riqnomadan nusxa: "en / kr").';
comment on column public.student_university_choices.faculty_confirmed_at is
  'Xodim fakultetni tasdiqlagan vaqt; null — tasdiq kutilmoqda.';

-- Shu universitetning fakultetlari: har daraja uchun eng yangi yo'riqnoma.
create or replace function public.choice_faculties_of(p_institution_id uuid)
 returns table(id uuid, daraja text, qabul_yili integer, semestr text, track text,
               kollej_en text, kollej_kr text, fakultet_en text, fakultet_kr text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select f.id, g.daraja, g.qabul_yili, g.semestr, f.track,
         f.kollej_en, f.kollej_kr, f.fakultet_en, f.fakultet_kr
    from (
      select distinct on (g1.daraja) g1.*
        from public.university_guidelines g1
       where g1.institution_id = p_institution_id
         and coalesce(g1.daraja, '') <> 'til_kursi'
       order by g1.daraja, g1.qabul_yili desc nulls last, (g1.semestr = 'kuz') desc, g1.updated_at desc
    ) g
    join public.university_guideline_faculties f on f.guideline_uuid = g.id
   where coalesce(nullif(trim(f.fakultet_en), ''), nullif(trim(f.fakultet_kr), '')) is not null
   order by (g.daraja = 'bakalavr') desc, g.daraja, f.tartib;
$function$;

revoke all on function public.choice_faculties_of(uuid) from public, anon, authenticated;

-- Talaba: o'z tanlovidagi universitetning fakultetlari.
create or replace function public.my_choice_faculties(p_choice_id uuid)
 returns table(id uuid, daraja text, qabul_yili integer, semestr text, track text,
               kollej_en text, kollej_kr text, fakultet_en text, fakultet_kr text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_inst uuid;
begin
  select c.institution_id into v_inst
    from public.student_university_choices c
   where c.id = p_choice_id and c.student_id = auth.uid();
  if v_inst is null then
    raise exception 'Choice not found' using errcode = '42501';
  end if;
  return query select * from public.choice_faculties_of(v_inst);
end;
$function$;

revoke all on function public.my_choice_faculties(uuid) from public, anon;
grant execute on function public.my_choice_faculties(uuid) to authenticated;

-- Talaba fakultet tanlaydi: universitetga rozi bo'lgandan keyin (yoki xodim
-- tasdiqlagan bo'lsa), fakultet hali tasdiqlanmagan bo'lsa.
create or replace function public.choose_choice_faculty(p_choice_id uuid, p_faculty_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row public.student_university_choices%rowtype;
  v_fac record;
begin
  select * into v_row from public.student_university_choices where id = p_choice_id;
  if not found or v_row.student_id is distinct from auth.uid() then
    raise exception 'Choice not found' using errcode = '42501';
  end if;
  if v_row.status not in ('accepted', 'confirmed') then
    raise exception 'Accept the university first' using errcode = '42501';
  end if;
  if v_row.faculty_confirmed_at is not null then
    raise exception 'Faculty already confirmed by the consultant' using errcode = '42501';
  end if;
  select * into v_fac from public.choice_faculties_of(v_row.institution_id) f where f.id = p_faculty_id;
  if not found then
    raise exception 'Faculty not found for this university' using errcode = '22023';
  end if;
  update public.student_university_choices
     set faculty_id = p_faculty_id,
         faculty_name = concat_ws(' / ', nullif(trim(v_fac.fakultet_en), ''), nullif(trim(v_fac.fakultet_kr), '')),
         faculty_daraja = v_fac.daraja,
         faculty_chosen_at = now(),
         faculty_confirmed_at = null,
         faculty_confirmed_by = null
   where id = p_choice_id;
end;
$function$;

revoke all on function public.choose_choice_faculty(uuid, uuid) from public, anon;
grant execute on function public.choose_choice_faculty(uuid, uuid) to authenticated;

-- my_university_choices(): fakultet maydonlari qo'shildi. Qaytariladigan
-- ustunlar o'zgargani uchun drop + create; qolgan qism prod'dagi
-- ta'rifdan (2026-10-29, pg_get_functiondef) aynan ko'chirilgan.
drop function if exists public.my_university_choices();

create function public.my_university_choices()
 returns table(id uuid, rank smallint, status text, responded_at timestamp with time zone, change_reason text, change_note text, confirmed_at timestamp with time zone, institution_id uuid, name_en text, name_ko text, city text, is_partner boolean, ielts_min numeric, topik_min numeric, kontrakt_min numeric, narx_valyuta text, kontrakt_davri text, online_deadline date, student_ielts numeric, student_topik numeric,
               faculty_name text, faculty_daraja text, faculty_chosen_at timestamp with time zone, faculty_confirmed_at timestamp with time zone, has_faculties boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.id, c.rank, c.status, c.responded_at, c.change_reason, c.change_note, c.confirmed_at,
         i.id, coalesce(i.name_en, g.univ_nomi_en), coalesce(i.name_ko, g.univ_nomi_kr),
         coalesce(g.shahar, i.city_ko), i.is_partner,
         g.ielts_min, g.topik_min, g.kontrakt_min, g.narx_valyuta, g.kontrakt_davri,
         (select min(r.tugash_sana) from public.university_guideline_rounds r
            join public.university_guidelines g2 on g2.id = r.guideline_uuid
           where g2.institution_id = i.id and r.etap_nomi = 'Online hujjat topshirish'
             and r.tugash_sana >= current_date),
         p.ielts_score, p.topik_level,
         c.faculty_name, c.faculty_daraja, c.faculty_chosen_at, c.faculty_confirmed_at,
         exists (select 1 from public.choice_faculties_of(i.id))
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
$function$;

revoke all on function public.my_university_choices() from public, anon;
grant execute on function public.my_university_choices() to authenticated;
