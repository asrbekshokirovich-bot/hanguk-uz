-- TOPIK / IELTS grantlarini university_grants_2027.json dan bazaga yuklash.
--
-- Supabase SQL editor'da, qadamma-qadam. Fayl guideline_id bo'yicha: har bir
-- guideline'ning grant xulosasi (university_guidelines.grant_*) va qoidalari
-- (university_guideline_grants). Fayldagi guideline'larning eski qoidalari
-- almashtiriladi, boshqalariga tegilmaydi. Birinchi yuklash 2026-10-21
-- (commit 567573e): 131 guideline, 824 qoida.

-- 1) Faylni yuklab olish. <commit> — fayl o'zgargan commit (GitHub'dagi).
select net.http_get(
  url := 'https://raw.githubusercontent.com/asrbekshokirovich-bot/hanguk-uz/<commit>/supabase/data/university_grants_2027.json',
  timeout_milliseconds := 30000
) as request_id;

-- 2) Javob kelganini tekshirish: status_code = 200 bo'lishi kerak.
--    <request_id> — 1-qadamda qaytgan raqam (quyida hamma joyda).
select status_code, error_msg, jsonb_array_length(content::jsonb -> 'guidelines') as guidelines
from net._http_response
where id = <request_id>;

-- 3) Yozish — bitta tranzaksiyada.
begin;

delete from public.university_guideline_grants gr
using public.university_guidelines ug, net._http_response resp,
  jsonb_array_elements(resp.content::jsonb -> 'guidelines') as g(item)
where resp.id = <request_id> and resp.status_code = 200
  and ug.guideline_id = g.item ->> 'guideline_id'
  and gr.guideline_uuid = ug.id;

with doc as (
  select content::jsonb as d from net._http_response where id = <request_id> and status_code = 200
), g as (
  select value as g from doc, jsonb_array_elements(doc.d -> 'guidelines')
), upd as (
  update public.university_guidelines ug set
    grant_holat        = g.g ->> 'grant_holat',
    grant_min          = (g.g ->> 'grant_min')::numeric,
    grant_max          = (g.g ->> 'grant_max')::numeric,
    grant_boshqa       = g.g ->> 'grant_boshqa',
    grant_izoh         = g.g ->> 'grant_izoh',
    grant_manba        = g.g ->> 'grant_manba',
    grant_tekshirilgan = ((select d from doc) ->> 'tekshirilgan')::date
  from g
  where ug.guideline_id = g.g ->> 'guideline_id'
  returning ug.id
), ins as (
  insert into public.university_guideline_grants (
    guideline_uuid, tartib, qachon, nomi, kimlar_uchun, mezon, talab,
    topik_min, topik_max, ielts_min, toefl_ibt_min, boshqa_test,
    grant_foiz, grant_asosi, grant_summa, grant_qoshimcha,
    muddat, davom_shart, kampus, sahifa, iqtibos, manba
  )
  select
    ug.id, r.tartib, r.qachon, r.nomi, r.kimlar_uchun, r.mezon, r.talab,
    r.topik_min, r.topik_max, r.ielts_min, r.toefl_ibt_min, r.boshqa_test,
    r.grant_foiz, r.grant_asosi, r.grant_summa, r.grant_qoshimcha,
    r.muddat, r.davom_shart, r.kampus, r.sahifa, r.iqtibos, r.manba
  from g
  join public.university_guidelines ug on ug.guideline_id = g.g ->> 'guideline_id'
  cross join lateral jsonb_to_recordset(coalesce(g.g -> 'grantlar', '[]'::jsonb)) as r (
    tartib int, qachon text, nomi text, kimlar_uchun text, mezon text, talab text,
    topik_min numeric, topik_max numeric, ielts_min numeric, toefl_ibt_min numeric,
    boshqa_test text, grant_foiz numeric, grant_asosi text, grant_summa numeric,
    grant_qoshimcha text, muddat text, davom_shart text, kampus text, sahifa text,
    iqtibos text, manba text
  )
  returning 1
)
-- Fayldagi guideline soni bilan solishtiring: bazada yo'q guideline_id'lar yozilmaydi.
select (select count(*) from g) as faylda, (select count(*) from upd) as yangilandi,
  (select count(*) from ins) as qoidalar;

commit;
