-- Hanguk AI — robust student lookup for the staff assistant.
--
-- The assistant used to match students with `full_name ILIKE '%token%'`, then
-- LIMIT 3 with no ranking. That meant:
--   • common first names (Sevara, Aziz, Diyora…) returned an arbitrary 3 rows,
--     so the student actually asked about was often NOT among them;
--   • any spelling / transliteration / apostrophe / script drift
--     (O'G'LI vs OGLI, JAVOHIR vs Жавохир) matched nothing at all.
-- Result: "sometimes it finds the student, sometimes it doesn't."
--
-- This migration adds fuzzy, ranked, apostrophe-tolerant search over the student
-- roster (and phone numbers) via the `search_students` RPC the edge function calls.

create extension if not exists pg_trgm;

-- Normalise a name for matching: lower-case, drop apostrophes, collapse spaces.
-- IMMUTABLE so it can back an expression index.
create or replace function public.hanguk_normalize_name(p text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
           regexp_replace(lower(coalesce(p, '')), '[''ʼ`’]', '', 'g'),
           '\s+', ' ', 'g'
         )
$$;

-- Trigram indexes make the fuzzy match fast and index-accelerated.
create index if not exists idx_profiles_fullname_trgm
  on public.profiles using gin (public.hanguk_normalize_name(full_name) gin_trgm_ops);

create index if not exists idx_profiles_phone_trgm
  on public.profiles using gin (phone gin_trgm_ops);

-- Ranked student search. Matches on:
--   • fuzzy word-similarity of the normalised name (handles typos / partials),
--   • a plain normalised substring (catches exact partials similarity may miss),
--   • the digits of a pasted phone number.
-- Returns the best `p_limit` STUDENTS only (never staff), highest score first.
create or replace function public.search_students(p_query text, p_limit int default 6)
returns table(user_id uuid, full_name text, phone text, score real)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select public.hanguk_normalize_name(p_query) as nq,
           regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as nphone
  )
  select p.user_id,
         p.full_name,
         p.phone,
         greatest(
           word_similarity(q.nq, public.hanguk_normalize_name(p.full_name)),
           case
             when length(q.nphone) >= 7
              and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || q.nphone || '%'
             then 1.0
             else 0.0
           end
         )::real as score
  from public.profiles p, q
  where p.role = 'student'
    and (
      q.nq <% public.hanguk_normalize_name(p.full_name)
      or public.hanguk_normalize_name(p.full_name) like '%' || q.nq || '%'
      or (
        length(q.nphone) >= 7
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || q.nphone || '%'
      )
    )
  order by score desc, p.full_name asc
  limit greatest(coalesce(p_limit, 6), 1)
$$;

grant execute on function public.search_students(text, int) to anon, authenticated, service_role;
grant execute on function public.hanguk_normalize_name(text) to anon, authenticated, service_role;
