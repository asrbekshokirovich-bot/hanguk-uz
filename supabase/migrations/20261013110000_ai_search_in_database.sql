-- The AI university search (ai-university-search), made fast.
--
-- The function answered in 4–7 s: every request ran in a fresh isolate, so
-- its in-memory caches were always empty and it re-read the whole catalogue
-- (some 5000 programme rows) before matching. Owner, 2026-10-13: match in
-- the database and keep what the model read, so "IT" asked twice reaches
-- the model once.
--
--   * ai_search_by_field(terms) — the matching search.ts did, in one query:
--     every guideline with a programme of the field, by programme name
--     (fakultet_en / fakultet_kr, never the college's), universities with
--     more such programmes first, then official partners, then the cheaper;
--     a university's guidelines together, the bachelor's first.
--   * ai_search_terms — the search terms the model gave for a typed text
--     (empty for a text that names no field), keyed by the normalised text
--     and a prompt version, so a better prompt starts afresh.
--
-- Both are for the edge function (service role) only.

create table if not exists public.ai_search_terms (
  query_key  text primary key,
  terms      text[] not null,
  created_at timestamptz not null default now()
);

alter table public.ai_search_terms enable row level security;

comment on table public.ai_search_terms is
  'Search terms the model gave for a typed text (ai-university-search), so the same text needs no second call. Service role only.';

-- How a term names a programme (the rules search.ts had):
--   * Korean: anywhere — Korean names are compounds ("컴퓨터공학과");
--   * an English acronym of up to three letters ("ai", "it", "ict"): a whole
--     word, or followed by Korean ("AI융합학과"), never inside a word
--     ("Italian");
--   * any other English term: the start of a word ("comput" finds "Computer
--     Science", "art" does not find "Department"); a phrase works the same.
-- Terms are limited to lower-case letters, digits, Hangul and spaces, so none
-- can carry a pattern of its own into the regular expression.
create or replace function public.ai_search_by_field(p_terms text[])
returns table (institution_id uuid, guideline_id uuid, matched text[], match_count integer)
language sql
stable
set search_path to 'public'
as $function$
  with t as (
    select distinct term
    from unnest(p_terms) as term
    where length(term) >= 2 and term ~ '^[a-z0-9가-힣 ]+$'
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
