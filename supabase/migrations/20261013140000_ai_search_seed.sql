-- The AI university search: exclusions, and the common fields written
-- beforehand (owner, 2026-10-13: run on the Gemini free quota, so spend as
-- few model calls as possible).
--
--   * ai_search_by_field: a term with a leading minus now excludes the
--     programmes it names. Korean names are compounds, so "의학과" alone
--     also finds 수의학과 (veterinary) and 식물의학과 (plant medicine);
--     "tibbiyot" needs "-수의", "-식물". Matching is otherwise unchanged.
--   * ai_search_terms: the search terms for the fields students ask about
--     most, under the ways they type them (Uzbek Latin and Cyrillic,
--     Russian, English, Korean; every apostrophe Uzbek uses). Written by
--     hand and checked against the catalogue on 2026-10-13, so these texts
--     never reach the model. A seeded text replaces whatever the model
--     stored for it.
--
-- The terms are the ones the edge function's prompt asks the model for, so
-- a seeded answer and a model answer read the same way.

create or replace function public.ai_search_by_field(p_terms text[])
returns table (institution_id uuid, guideline_id uuid, matched text[], match_count integer)
language sql
stable
set search_path to 'public'
as $function$
  with input as (
    select distinct term from unnest(p_terms) as term
  ),
  t as (
    select term from input
    where length(term) >= 2 and term ~ '^[a-z0-9가-힣 ]+$'
  ),
  x as (
    select substr(term, 2) as term from input
    where length(term) >= 3 and term ~ '^-[a-z0-9가-힣 ]+$'
  ),
  f as (
    select
      f.guideline_id,
      f.tartib,
      nullif(coalesce(nullif(trim(f.fakultet_en), ''), trim(f.fakultet_kr)), '') as label,
      ' ' || trim(regexp_replace(
        lower(normalize(coalesce(f.fakultet_en, '') || ' ' || coalesce(f.fakultet_kr, ''), NFKC)),
        '[^a-z0-9가-힣]+', ' ', 'g'
      )) as hay
    from public.v_app_university_faculties f
  ),
  m as (
    select f.guideline_id, f.label, min(f.tartib) as ord
    from f
    where f.label is not null
      and exists (
        select 1 from t
        where case
          when t.term ~ '[가-힣]' then strpos(f.hay, t.term) > 0
          when length(t.term) > 3 then strpos(f.hay, ' ' || t.term) > 0
          else f.hay ~ (' ' || t.term || '([^a-z0-9]|$)')
        end
      )
      and not exists (
        select 1 from x
        where case
          when x.term ~ '[가-힣]' then strpos(f.hay, x.term) > 0
          when length(x.term) > 3 then strpos(f.hay, ' ' || x.term) > 0
          else f.hay ~ (' ' || x.term || '([^a-z0-9]|$)')
        end
      )
    group by f.guideline_id, f.label
  ),
  g as (
    select
      c.institution_id,
      c.guideline_id,
      c.daraja,
      c.qabul_yili,
      coalesce(c.is_partner, false) as partner,
      (case when upper(coalesce(c.narx_valyuta, 'KRW')) = 'USD' then 1400 else 1 end)
        * coalesce(c.kontrakt_min, c.kontrakt_max)
        / (case when c.kontrakt_davri = 'yil' then 2 else 1 end) as fee,
      array_agg(m.label order by m.ord) as matched,
      count(*)::integer as n
    from m
    join public.v_app_university_catalog c on c.guideline_id = m.guideline_id
    where c.is_active is not false
    group by c.institution_id, c.guideline_id, c.daraja, c.qabul_yili, c.is_partner,
      c.narx_valyuta, c.kontrakt_min, c.kontrakt_max, c.kontrakt_davri
  ),
  u as (
    select g.institution_id, max(g.n) as best, bool_or(g.partner) as partner, min(g.fee) as fee
    from g
    group by g.institution_id
  )
  select g.institution_id, g.guideline_id, g.matched, g.n
  from g
  join u on u.institution_id = g.institution_id
  order by u.best desc, u.partner desc, u.fee asc nulls last, u.institution_id,
    (g.daraja = 'bakalavr') desc, g.qabul_yili desc nulls last, g.guideline_id;
$function$;

revoke all on function public.ai_search_by_field(text[]) from public, anon, authenticated;
grant execute on function public.ai_search_by_field(text[]) to service_role;

-- The common fields: each field's terms once, then the keys of the ways
-- students type it. A key is what the edge function looks up (queryKey in
-- search.ts): the prompt version, then the text in lower case, NFKC, with
-- single spaces; every Uzbek apostrophe (' ʻ ‘ ’ ` ʼ) is written out.
with field(id, name, terms) as (
  values
    (1, 'IT / dasturlash', array['comput', 'software', 'information technolog', 'information secur', 'information and communication', 'information system', 'informatics', 'cybersecur', 'cyber secur', 'artificial intelligence', 'data scien', 'ai', 'it', 'ict', '컴퓨터', '소프트웨어', '정보통신', '정보보호', '정보보안', '인공지능', '데이터사이언스']::text[]),
    (2, 'Stomatologiya', array['dent', '치의', '치위생', '치기공', '치과']::text[]),
    (3, 'Tibbiyot', array['medicine', 'pre med', 'premed', '의예', '의학과', '의학전공', '-veterinar', '-plant', '-sport', '-aqualife', '-artificial intelligence', '-data medic', '-수의', '-식물', '-스포츠', '-데이터', '-치의']::text[]),
    (4, 'Hamshiralik', array['nurs', '간호']::text[]),
    (5, 'Farmatsevtika', array['pharm', '약학', '제약']::text[]),
    (6, 'Fizioterapiya', array['physical therap', 'physiotherap', 'rehabilitat', '물리치료', '재활']::text[]),
    (7, 'Biznes / menejment', array['business', 'marketing', '경영', '마케팅', '-hotel', '-touris', '-관광', '-호텔', '-산림']::text[]),
    (8, 'Iqtisodiyot', array['econom', '경제']::text[]),
    (9, 'Moliya / buxgalteriya', array['financ', 'account', '금융', '재무', '회계']::text[]),
    (10, 'Logistika', array['logistic', 'supply chain', '물류']::text[]),
    (11, 'Turizm / mehmonxona', array['touris', 'hospitality', 'hotel manag', 'hotel and touris', '관광', '호텔경영', '호스피탈리티']::text[]),
    (12, 'Pazandachilik', array['culinar', 'cook', 'food service', '조리', '외식']::text[]),
    (13, 'Koreys tili', array['korean langu', 'korean lit', 'korean stud', 'korean as a', '한국어', '국어국문']::text[]),
    (14, 'Ingliz tili', array['english lang', 'english lit', '영어영문', '영어학', '-education']::text[]),
    (15, 'Tarjimonlik', array['interpret', 'translat', '통번역', '통역', '번역', '-translational']::text[]),
    (16, 'Pedagogika', array['educat', 'teach', '교육']::text[]),
    (17, 'Psixologiya', array['psycholog', '심리']::text[]),
    (18, 'Huquq', array['law', 'legal', '법학', '법률']::text[]),
    (19, 'Xalqaro munosabatlar', array['international relat', 'international stud', 'international politic', 'diplomac', '국제관계', '국제학', '외교', '-international students', '-undeclared', '-open major']::text[]),
    (20, 'Jurnalistika / media', array['journalis', 'media', 'broadcast', '미디어', '언론', '방송']::text[]),
    (21, 'Kino / aktyorlik', array['film', 'acting', 'theater', 'theatre', '영화', '연기', '연극']::text[]),
    (22, 'Musiqa', array['music', 'vocal', 'piano', '음악', '실용음악', '성악', '피아노']::text[]),
    (23, 'Tasviriy san''at', array['fine art', 'painting', 'sculpture', '미술', '회화', '조소']::text[]),
    (24, 'Dizayn', array['design', '디자인', '-mechanical', '-manufactur', '-design engineering', '-system design', '-systems design']::text[]),
    (25, 'Go''zallik / kosmetologiya', array['beauty', 'cosmet', 'hair', 'makeup', '뷰티', '미용', '피부', '화장품']::text[]),
    (26, 'Sport', array['sport', 'physical educat', 'taekwondo', '체육', '스포츠', '태권도']::text[]),
    (27, 'Ijtimoiy ish', array['social welfare', 'social work', '사회복지']::text[]),
    (28, 'Arxitektura', array['architect', '건축']::text[]),
    (29, 'Qurilish', array['civil', 'construction', '건설', '토목', '-civiliz']::text[]),
    (30, 'Mexanika', array['mechanic', '기계']::text[]),
    (31, 'Elektrotexnika / elektronika', array['electric', 'electron', 'semiconductor', '전기', '전자', '반도체']::text[]),
    (32, 'Aviatsiya', array['aviation', 'airline', 'aircraft', 'aerospace', '항공']::text[]),
    (33, 'Kimyo', array['chemi', '화학과', '화학공학', '응용화학', '화학생명', '화학전공', '화학부', '-chinese']::text[]),
    (34, 'Biologiya', array['biolog', 'life scien', 'biotech', '생명', '생물']::text[]),
    (35, 'Qishloq xo''jaligi', array['agricult', 'horticult', 'animal scien', '농업', '원예', '축산']::text[])
),
typed(field_id, keys) as (
  values
    (1, array['v1:ai', 'v1:artificial intelligence', 'v1:computer', 'v1:computer science', 'v1:cybersecurity', 'v1:dasturchi', 'v1:dasturiy ta''minot', 'v1:dasturiy ta`minot', 'v1:dasturiy taʻminot', 'v1:dasturiy taʼminot', 'v1:dasturiy ta‘minot', 'v1:dasturiy ta’minot', 'v1:dasturlash', 'v1:data science', 'v1:informatika', 'v1:it', 'v1:it yo''nalishi', 'v1:it yo`nalishi', 'v1:it yoʻnalishi', 'v1:it yoʼnalishi', 'v1:it yo‘nalishi', 'v1:it yo’nalishi', 'v1:kiberxavfsizlik', 'v1:kompyuter', 'v1:kompyuter ilmlari', 'v1:programmer', 'v1:programming', 'v1:software', 'v1:sun''iy intellekt', 'v1:sun`iy intellekt', 'v1:sunʻiy intellekt', 'v1:sunʼiy intellekt', 'v1:sun‘iy intellekt', 'v1:sun’iy intellekt', 'v1:айти', 'v1:дастурлаш', 'v1:информатика', 'v1:искусственный интеллект', 'v1:ит', 'v1:кибербезопасность', 'v1:компьютер', 'v1:компютер', 'v1:программирование', 'v1:программист', 'v1:소프트웨어', 'v1:컴퓨터']),
    (2, array['v1:dental', 'v1:dentist', 'v1:dentistry', 'v1:stomatolog', 'v1:stomatologiya', 'v1:tish', 'v1:tish shifokori', 'v1:стоматолог', 'v1:стоматология', 'v1:치과', 'v1:치의학']),
    (3, array['v1:doctor', 'v1:medical', 'v1:medicine', 'v1:shifokor', 'v1:tibbiyot', 'v1:vrach', 'v1:врач', 'v1:лечебное дело', 'v1:медицина', 'v1:тиббиёт', 'v1:шифокор', 'v1:의대', 'v1:의학']),
    (4, array['v1:hamshira', 'v1:hamshiralik', 'v1:hamshiralik ishi', 'v1:nurse', 'v1:nursing', 'v1:медсестра', 'v1:сестринское дело', 'v1:ҳамширалик', 'v1:간호', 'v1:간호학']),
    (5, array['v1:dorishunoslik', 'v1:farmatsevt', 'v1:farmatsevtika', 'v1:pharmaceutical', 'v1:pharmacy', 'v1:фармацевт', 'v1:фармацевтика', 'v1:фармация', 'v1:약학']),
    (6, array['v1:fizioterapiya', 'v1:physical therapy', 'v1:physiotherapy', 'v1:rehabilitation', 'v1:реабилитация', 'v1:физиотерапия', 'v1:물리치료']),
    (7, array['v1:biznes', 'v1:biznes boshqaruvi', 'v1:business', 'v1:business administration', 'v1:management', 'v1:marketing', 'v1:menejment', 'v1:бизнес', 'v1:маркетинг', 'v1:менеджмент', 'v1:경영', 'v1:경영학']),
    (8, array['v1:economics', 'v1:economy', 'v1:iqtisod', 'v1:iqtisodiyot', 'v1:иқтисодиёт', 'v1:экономика', 'v1:경제', 'v1:경제학']),
    (9, array['v1:accounting', 'v1:audit', 'v1:bank ishi', 'v1:buxgalteriya', 'v1:finance', 'v1:moliya', 'v1:банковское дело', 'v1:бухгалтер', 'v1:бухгалтерия', 'v1:молия', 'v1:финансы', 'v1:금융', 'v1:회계']),
    (10, array['v1:logistics', 'v1:logistika', 'v1:логистика', 'v1:물류']),
    (11, array['v1:hospitality', 'v1:hotel', 'v1:mehmonxona', 'v1:mehmonxona ishi', 'v1:tourism', 'v1:turizm', 'v1:гостиничное дело', 'v1:отель', 'v1:туризм', 'v1:관광']),
    (12, array['v1:chef', 'v1:cooking', 'v1:culinary', 'v1:oshpaz', 'v1:oshpazlik', 'v1:pazandachilik', 'v1:кулинария', 'v1:повар', 'v1:조리']),
    (13, array['v1:korean', 'v1:korean language', 'v1:korean studies', 'v1:koreys filologiyasi', 'v1:koreys tili', 'v1:koreyshunoslik', 'v1:корееведение', 'v1:корейский', 'v1:корейский язык', 'v1:국어국문', 'v1:한국어']),
    (14, array['v1:english', 'v1:english language', 'v1:ingliz filologiyasi', 'v1:ingliz tili', 'v1:английский', 'v1:английский язык', 'v1:영문학', 'v1:영어']),
    (15, array['v1:interpretation', 'v1:tarjima', 'v1:tarjimon', 'v1:tarjimonlik', 'v1:translation', 'v1:перевод', 'v1:переводчик', 'v1:통번역']),
    (16, array['v1:education', 'v1:o''qituvchi', 'v1:o''qituvchilik', 'v1:o`qituvchi', 'v1:o`qituvchilik', 'v1:oʻqituvchi', 'v1:oʻqituvchilik', 'v1:oʼqituvchi', 'v1:oʼqituvchilik', 'v1:o‘qituvchi', 'v1:o‘qituvchilik', 'v1:o’qituvchi', 'v1:o’qituvchilik', 'v1:pedagog', 'v1:pedagogika', 'v1:teacher', 'v1:teaching', 'v1:педагогика', 'v1:учитель', 'v1:교육']),
    (17, array['v1:psixolog', 'v1:psixologiya', 'v1:psychology', 'v1:психолог', 'v1:психология', 'v1:심리', 'v1:심리학']),
    (18, array['v1:huquq', 'v1:huquqshunoslik', 'v1:law', 'v1:lawyer', 'v1:yurist', 'v1:право', 'v1:юриспруденция', 'v1:юрист', 'v1:ҳуқуқ', 'v1:법학']),
    (19, array['v1:diplomacy', 'v1:diplomatiya', 'v1:international relations', 'v1:xalqaro munosabatlar', 'v1:дипломатия', 'v1:международные отношения', 'v1:국제관계', 'v1:외교']),
    (20, array['v1:journalism', 'v1:jurnalist', 'v1:jurnalistika', 'v1:media', 'v1:media communication', 'v1:журналист', 'v1:журналистика', 'v1:медиа', 'v1:미디어', 'v1:방송']),
    (21, array['v1:acting', 'v1:aktyor', 'v1:aktyorlik', 'v1:film', 'v1:kino', 'v1:актер', 'v1:актерское мастерство', 'v1:актёр', 'v1:кино', 'v1:연기', 'v1:영화']),
    (22, array['v1:k-pop', 'v1:kpop', 'v1:music', 'v1:musiqa', 'v1:musiqachi', 'v1:vokal', 'v1:вокал', 'v1:музыка', 'v1:실용음악', 'v1:음악']),
    (23, array['v1:fine arts', 'v1:painting', 'v1:rassom', 'v1:rassomlik', 'v1:tasviriy san''at', 'v1:tasviriy san`at', 'v1:tasviriy sanʻat', 'v1:tasviriy sanʼat', 'v1:tasviriy san‘at', 'v1:tasviriy san’at', 'v1:изобразительное искусство', 'v1:художник', 'v1:미술']),
    (24, array['v1:design', 'v1:designer', 'v1:dizayn', 'v1:dizayner', 'v1:fashion design', 'v1:grafik dizayn', 'v1:дизайн', 'v1:дизайнер', 'v1:디자인']),
    (25, array['v1:beauty', 'v1:cosmetology', 'v1:go''zallik', 'v1:go`zallik', 'v1:goʻzallik', 'v1:goʼzallik', 'v1:go‘zallik', 'v1:go’zallik', 'v1:kosmetolog', 'v1:kosmetologiya', 'v1:sartaroshlik', 'v1:visajist', 'v1:визажист', 'v1:косметология', 'v1:парикмахер', 'v1:미용', 'v1:뷰티']),
    (26, array['v1:jismoniy tarbiya', 'v1:sport', 'v1:sports', 'v1:taekwondo', 'v1:спорт', 'v1:тхэквондо', 'v1:физическая культура', 'v1:физкультура', 'v1:체육']),
    (27, array['v1:ijtimoiy ish', 'v1:social welfare', 'v1:social work', 'v1:социальная работа', 'v1:사회복지']),
    (28, array['v1:architecture', 'v1:arxitektor', 'v1:arxitektura', 'v1:архитектор', 'v1:архитектура', 'v1:건축']),
    (29, array['v1:civil engineering', 'v1:construction', 'v1:qurilish', 'v1:строительство', 'v1:건설', 'v1:토목']),
    (30, array['v1:mashinasozlik', 'v1:mechanical', 'v1:mechanical engineering', 'v1:mexanika', 'v1:машиностроение', 'v1:механика', 'v1:기계']),
    (31, array['v1:electrical engineering', 'v1:electronics', 'v1:elektronika', 'v1:elektrotexnika', 'v1:semiconductor', 'v1:yarim o''tkazgich', 'v1:yarim o`tkazgich', 'v1:yarim oʻtkazgich', 'v1:yarim oʼtkazgich', 'v1:yarim o‘tkazgich', 'v1:yarim o’tkazgich', 'v1:электроника', 'v1:электротехника', 'v1:반도체', 'v1:전자']),
    (32, array['v1:airline', 'v1:aviation', 'v1:aviatsiya', 'v1:styuardessa', 'v1:uchuvchi', 'v1:авиация', 'v1:пилот', 'v1:стюардесса', 'v1:항공']),
    (33, array['v1:chemical engineering', 'v1:chemistry', 'v1:kimyo', 'v1:кимё', 'v1:химия', 'v1:화학']),
    (34, array['v1:biologiya', 'v1:biology', 'v1:biotechnology', 'v1:biotexnologiya', 'v1:биология', 'v1:биотехнология', 'v1:생명']),
    (35, array['v1:agriculture', 'v1:agronomiya', 'v1:qishloq xo''jaligi', 'v1:qishloq xo`jaligi', 'v1:qishloq xoʻjaligi', 'v1:qishloq xoʼjaligi', 'v1:qishloq xo‘jaligi', 'v1:qishloq xo’jaligi', 'v1:агрономия', 'v1:сельское хозяйство', 'v1:농업'])
)
insert into public.ai_search_terms (query_key, terms)
select k.query_key, f.terms
from typed t
cross join unnest(t.keys) as k(query_key)
join field f on f.id = t.field_id
on conflict (query_key) do update set terms = excluded.terms, created_at = now();
