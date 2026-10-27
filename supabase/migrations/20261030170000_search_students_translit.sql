-- Hanguk AI could not find "Muratov Shoxrux" (2026-10-27): the CRM stores
-- "MURATOV SHOKHRUKH ULUGBEKOVICH", and staff type names in Uzbek Latin
-- (x, q, sh) while passports use English transliteration (kh, k), in any
-- order, often only the first name. search_students compared the whole query
-- with the whole name, so "Shoxrux" alone scored 0.38 and missed.
--
-- Now both sides are folded the same way (kh->x, q->k, apostrophes dropped)
-- and every query word is matched against the name's words; a student is
-- returned when each query word (3+ letters) matches some name word. Phone
-- matching is unchanged. Same signature and columns, so callers are unaffected.

create or replace function public.hanguk_fold_name(p text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select replace(replace(public.hanguk_normalize_name(p), 'kh', 'x'), 'q', 'k')
$$;

create or replace function public.search_students(p_query text, p_limit integer default 6)
returns table(user_id uuid, full_name text, phone text, score real)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select public.hanguk_fold_name(p_query) as fq,
           regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as nphone
  ), qt as (
    select t from q, regexp_split_to_table(q.fq, '[^[:alnum:]]+') t where length(t) >= 3
  ), cand as (
    select p.user_id, p.full_name, p.phone,
           public.hanguk_fold_name(p.full_name) as fn,
           regexp_split_to_array(public.hanguk_fold_name(p.full_name), '[^[:alnum:]]+') as words
      from public.profiles p
     where p.role = 'student'
  ), scored as (
    select c.user_id, c.full_name, c.phone,
           greatest(
             word_similarity(q.fq, c.fn),
             coalesce((select avg((select max(similarity(qt.t, w)) from unnest(c.words) w)) from qt), 0),
             case when length(q.nphone) >= 7
                   and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.nphone || '%'
                  then 1.0 else 0.0 end
           )::real as score,
           (exists (select 1 from qt)
            and not exists (
              select 1 from qt
               where not exists (select 1 from unnest(c.words) w
                                  where w like qt.t || '%' or similarity(qt.t, w) >= 0.45))) as all_words,
           (q.fq <% c.fn or c.fn like '%' || q.fq || '%') as whole,
           (length(q.nphone) >= 7
            and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.nphone || '%') as by_phone
      from cand c, q
  )
  select s.user_id, s.full_name, s.phone, s.score
    from scored s
   where s.whole or s.all_words or s.by_phone
   order by s.score desc, s.full_name asc
   limit greatest(coalesce(p_limit, 6), 1)
$$;
