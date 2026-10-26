-- Universitet nomi institutions jadvalidan olinadi, Excel'dan emas.
--
-- my_university_choices() nomni eng yangi yo'riqnomaning univ_nomi_en /
-- univ_nomi_kr ustunidan olardi (coalesce(g.univ_nomi_en, i.name_en)). Bu
-- xodim Excel'ga qo'lda yozgan matn: magistratura fayllarida u
-- "… — Graduate School", "(Graduate School)", "… 일반대학원" kabi qo'shimcha
-- bilan keladi va ilovadagi "Mening universitetlarim" shunday nomni ko'rsatardi.
-- Endi institutions.name_en / name_ko asosiy, Excel nomi faqat zaxira.
--
-- Funksiyaning qolgan qismi prod'dagi joriy ta'rifdan (2026-10-26,
-- pg_get_functiondef) aynan ko'chirilgan; faqat ikki coalesce tartibi o'zgardi.
-- Bazadagi ma'lumot o'zgarmaydi.

create or replace function public.my_university_choices()
 returns table(id uuid, rank smallint, status text, responded_at timestamp with time zone, change_reason text, change_note text, confirmed_at timestamp with time zone, institution_id uuid, name_en text, name_ko text, city text, is_partner boolean, ielts_min numeric, topik_min numeric, kontrakt_min numeric, narx_valyuta text, kontrakt_davri text, online_deadline date, student_ielts numeric, student_topik numeric)
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
$function$;

revoke all on function public.my_university_choices() from public, anon;
grant execute on function public.my_university_choices() to authenticated;
