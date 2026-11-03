-- Hanguk AI: "keyingi 30 kunda qaysi universitetlarda onlayn ariza tugaydi?"
-- (eval uni-09, 2026-11-03) — AI ro'yxatni to'liq bermadi.
--   1) limit 200 tartiblashdan OLDIN qo'llanardi: filtrsiz chaqiruvda 200 ta
--      tasodifiy qator qaytardi (eng yaqin muddatlar tushib qolishi mumkin edi).
--   2) Bir universitet bir necha qator (daraja, bosqich) bo'lib keladi — 45 ta
--      universitet 53+ qator; model ro'yxatni qisqartirib yuborgan.
-- Endi: avval sana bo'yicha tartib, keyin limit; qo'shimcha 'universities' —
-- har universitet bir qator (eng yaqin sana, darajalar), alifbo tartibida, va
-- 'university_count'. Imzo o'zgarmagan.

create or replace function public.ai_uni_deadlines(
  p_days integer default 30,
  p_daraja text default null,
  p_etap text default null,
  p_mine boolean default false,
  p_student_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_student uuid;
  v jsonb;
  v_unis jsonb;
  v_all jsonb;
begin
  -- A student only ever sees their own list; staff may name a student.
  v_student := case when public.ai_is_staff(auth.uid()) then p_student_id else auth.uid() end;

  with mine as (
    select u.institution_id from student_universities_of(v_student) u where v_student is not null
  )
  select jsonb_agg(jsonb_build_object(
           'university', coalesce(i.name_en, i.name_ko), 'guideline_id', g.id, 'daraja', g.daraja,
           'qabul_yili', g.qabul_yili, 'semestr', g.semestr, 'etap', r.etap_nomi, 'bosqich', r.bosqich,
           'date', coalesce(r.tugash_sana, r.boshlanish_sana),
           'date_is', case when r.tugash_sana is not null then 'end' else 'start' end,
           'holat', r.holat,
           'days_left', coalesce(r.tugash_sana, r.boshlanish_sana) - v_today,
           'is_mine', g.institution_id in (select institution_id from mine)))
    into v_all
    from university_guideline_rounds r
    join university_guidelines g on g.id = r.guideline_uuid
    join institutions i on i.id = g.institution_id
    cross join ai_uni_season() s
   where g.qabul_yili = s.qabul_yili and g.semestr = s.semestr
     and coalesce(r.tugash_sana, r.boshlanish_sana) between v_today and v_today + greatest(1, least(coalesce(p_days, 30), 180))
     and coalesce(r.holat, '') <> 'etap_yoq'
     and (p_daraja is null or g.daraja = p_daraja)
     and (p_etap is null or r.etap_nomi ilike '%' || p_etap || '%')
     and (not coalesce(p_mine, false) or g.institution_id in (select institution_id from mine));

  select jsonb_agg(x order by (x->>'date')::date, x->>'university') into v
    from (select x from jsonb_array_elements(coalesce(v_all, '[]'::jsonb)) x
           order by (x->>'date')::date, x->>'university' limit 200) t;

  select jsonb_agg(jsonb_build_object('university', u, 'nearest_date', d, 'days_left', d - v_today,
                                      'levels', lv, 'steps', st) order by u)
    into v_unis
    from (
      select x->>'university' as u, min((x->>'date')::date) as d,
             jsonb_agg(distinct x->>'daraja') as lv, jsonb_agg(distinct x->>'etap') as st
        from jsonb_array_elements(coalesce(v_all, '[]'::jsonb)) x group by 1
    ) q;

  return jsonb_build_object(
    'today', v_today, 'days', p_days,
    'university_count', coalesce(jsonb_array_length(v_unis), 0),
    'universities', coalesce(v_unis, '[]'::jsonb),
    'items', coalesce(v, '[]'::jsonb),
    'note', 'For "which universities" list EVERY entry of universities (alphabetical, one line each with nearest_date). items = the detailed rows, soonest first (max 200). etap names: Online hujjat topshirish, Offline hujjat topshirish, Application fee to''lash, Intervyu, Natija e''lon qilinishi, Kontrakt to''lash, Certificate of Admission berilishi, Vizaga hujjat topshirish');
end;
$$;
