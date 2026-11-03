-- Hanguk AI: yo'riqnoma PDF qidiruvi kalit so'zlarni topmayotgan edi.
--
-- Sabab (2026-11-03, eval pdf-01..03):
--   1) chunk_text_ko &@~ '기숙사 수용인원' — PGroonga'da bo'sh joy = AND. Model
--      bitta ortiqcha so'z qo'shsa (sahifada "수용인원" yo'q), natija 0 ta.
--   2) p_query_ko bo'lsa p_query umuman ishlatilmasdi — inglizcha yo'riqnoma
--      (K-Arts: "Online application (www.jinhakapply.com)") koreyscha so'z bilan
--      hech qachon topilmasdi.
--   3) Embedding'siz bo'laklar (~6 800 ta, Gemini 429) faqat shu kalit so'z
--      yo'li bilan topiladi, shuning uchun 1–2 yo'riqnomaning PDF'i umuman
--      qidiruvga chiqmasdi.
--   4) Bir xil PDF ikki guideline_documents qatori bo'lib kirgan (135 ta
--      takror bo'lak) — natijalarning yarmi takror edi.
--
-- Endi: p_query_ko + p_query → alohida kalit so'zlar (kichik harf, takrorsiz,
-- shovqin so'zlarsiz, 4 bo'g'inli koreyscha so'zning yarmlari ham: 원서접수 →
-- 원서, 접수 — PDF'da bo'sh joy bilan yozilgan bo'lishi mumkin). Sahifa ISTALGAN
-- kalit so'z bilan topiladi (OR), tartib: nechta kalit so'z bor (koreyscha 3+
-- bo'g'in = 2 ball, boshqasi 1), keyin PGroonga balli. Bir xil matnli bo'laklar
-- bittaga qisqaradi. Imzo o'zgarmagan (hanguk-ai-chat tool shu argumentlarni
-- yuboradi; tool o'zi ham OR so'rov yuboradi, bu funksiya uni ham to'g'ri o'qiydi).

create or replace function public.guideline_text_search(
  p_query text,
  p_query_ko text default null,
  p_embedding vector(1024) default null,
  p_institution_id uuid default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout = '8s'
as $$
declare
  v_n integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_terms text[];
  v_weights integer[];
  v_q text;
  v jsonb;
begin
  begin
    perform set_config('hnsw.iterative_scan', 'strict_order', true);
    perform set_config('hnsw.ef_search', '100', true);
  exception when undefined_object then
    null;
  end;

  -- Keywords: Korean first, then the other query; "OR" and quotes from a
  -- ready-made PGroonga query fall out as separators / stopwords.
  with raw as (
    select lower(s.t) as t, s.ord::numeric as ord
      from regexp_split_to_table(coalesce(p_query_ko, '') || ' ' || coalesce(p_query, ''),
                                 '[^[:alnum:]가-힣]+') with ordinality s(t, ord)
  ),
  base as (
    select t, min(ord) as ord
      from raw
     where char_length(t) >= 2
       and t not in ('or', 'and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'an', 'what',
                     'which', 'how', 'many', 'much', 'where', 'when', 'who', 'does', 'do', 'with', 'from',
                     'by', 'about', 'pdf', 'guideline', 'university', 'universitet', 'universiteti', 'va',
                     'yoki', 'qaysi', 'nechta', 'qanday', 'qachon', 'qayerda', 'uchun', 'bilan', 'haqida',
                     'ham', 'bor', 'ayt', 'riqnoma', 'сколько', 'какой', 'какие', 'где', 'как', 'что',
                     'для', 'при')
     group by t
  ),
  terms as (
    select t, case when t ~ '^[가-힣]{3,}$' then 2 else 1 end as w, ord from base
    union all
    select h.t, 1, b.ord + 0.5
      from base b
     cross join lateral (values (substr(b.t, 1, 2)), (substr(b.t, 3, 2))) h(t)
     where b.t ~ '^[가-힣]{4}$'
  ),
  kw as (
    select t, max(w) as w, min(ord) as ord
      from terms
     group by t
     order by min(ord)
     limit 24
  )
  select array_agg(t order by ord), array_agg(w order by ord),
         string_agg('"' || t || '"', ' OR ' order by ord)
    into v_terms, v_weights, v_q
    from kw;

  with kw as (
    select k.t, k.w from unnest(v_terms, v_weights) k(t, w)
  ),
  -- flat = lower-case text without whitespace, so 원서접수 also counts "원서 접수".
  -- Materialized: computed once per page, not once per keyword (0.4 s vs 6.7 s
  -- for 3 600 candidates). 1000 = cap by PGroonga score for very broad queries.
  cand as materialized (
    select c.id, c.institution_id, md5(c.chunk_text_ko) as h,
           translate(lower(c.chunk_text_ko), E' \t\r\n' || chr(160) || chr(12288), '') as flat,
           pgroonga_score(c.tableoid, c.ctid) as s
      from embedding_chunks c
     where v_q is not null
       and c.chunk_text_ko &@~ v_q
       and (p_institution_id is null or c.institution_id = p_institution_id)
     order by pgroonga_score(c.tableoid, c.ctid) desc
     limit 1000
  ),
  fts as (
    select d.id, row_number() over (order by d.cov desc, d.s desc) as rank
      from (
        select distinct on (cand.institution_id, cand.h)
               cand.id, cand.s,
               (select coalesce(sum(kw.w), 0) from kw where strpos(cand.flat, kw.t) > 0) as cov
          from cand
         order by cand.institution_id, cand.h, cand.s desc
      ) d
     order by d.cov desc, d.s desc
     limit 60
  ),
  sem as (
    select c.id, row_number() over (order by c.embedding <=> p_embedding) as rank
      from embedding_chunks c
     where p_embedding is not null and c.embedding is not null
       and (p_institution_id is null or c.institution_id = p_institution_id)
     order by c.embedding <=> p_embedding
     limit 60
  ),
  fused as (
    select coalesce(fts.id, sem.id) as id,
           coalesce(1.0 / (50 + fts.rank), 0) + coalesce(1.0 / (50 + sem.rank), 0) as score
      from fts full outer join sem on fts.id = sem.id
  ),
  top as (
    select d.id, d.score
      from (
        select distinct on (c.institution_id, md5(c.chunk_text_ko)) f.id, f.score
          from fused f
          join embedding_chunks c on c.id = f.id
         order by c.institution_id, md5(c.chunk_text_ko), f.score desc
      ) d
     order by d.score desc
     limit v_n
  )
  select jsonb_agg(jsonb_build_object(
           'university', coalesce(i.name_en, i.name_ko),
           'institution_id', c.institution_id,
           'document_id', c.guideline_document_id,
           'academic_year', d.academic_year,
           'semester', d.semester,
           'page', c.page,
           'text', left(c.chunk_text_ko, 1400),
           'official_url', d.source_url_ko,
           'score', round(t.score::numeric, 4))
         order by t.score desc)
    into v
    from top t
    join embedding_chunks c on c.id = t.id
    left join guideline_documents d on d.id = c.guideline_document_id
    left join institutions i on i.id = c.institution_id;

  return jsonb_build_object(
    'indexed_documents', (select count(*) from guideline_index_state where status = 'done'),
    'keywords', coalesce(to_jsonb(v_terms), '[]'::jsonb),
    'results', coalesce(v, '[]'::jsonb),
    'note', 'text is the guideline PDF (mostly Korean, some English); cite the page. No result: try other / fewer keywords once.');
end;
$$;

revoke all on function public.guideline_text_search(text, text, vector, uuid, integer) from public, anon;
grant execute on function public.guideline_text_search(text, text, vector, uuid, integer) to authenticated, service_role;
