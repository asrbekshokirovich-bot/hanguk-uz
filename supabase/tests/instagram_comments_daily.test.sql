-- Local test for 20261112170000_instagram_comments_daily.sql.
--
--   createdb ig_comments_test && psql -v ON_ERROR_STOP=1 -d ig_comments_test \
--     -f supabase/tests/instagram_comments_daily.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

-- instagram_comments as the function reads it (20260903100000).
create table public.instagram_comments (
  id uuid primary key default gen_random_uuid(),
  comment_id text not null unique,
  media_product_type text,
  parent_comment_id text,
  from_username text,
  text text,
  commented_at timestamptz not null,
  is_from_me boolean not null default false,
  status text not null default 'new'
    check (status in ('new','replied','private_replied','hidden','ignored')));

\i supabase/migrations/20261112170000_instagram_comments_daily.sql

-- 11 November in Tashkent is 10 Nov 19:00 UTC → 11 Nov 19:00 UTC.
insert into public.instagram_comments (comment_id, media_product_type, parent_comment_id, from_username, text, commented_at, is_from_me, status) values
  -- the day before and the day after: not counted
  ('before',  'AD',    null,   'early',  'Narxi qancha',                     '2026-11-10 18:59+00', false, 'new'),
  ('after',   'AD',    null,   'late',   'Manzil?',                          '2026-11-11 19:00+00', false, 'new'),
  -- waiting
  ('q1',      'AD',    null,   'ali',    E'To''lov   oldindanmi\ntil kursi uchun', '2026-11-10 19:00+00', false, 'new'),
  ('plus',    'REELS', null,   'vali',   '+',                                '2026-11-11 05:00+00', false, 'new'),
  ('cyr',     'AD',    null,   'gani',   'Ёш чегараси',                      '2026-11-11 06:00+00', false, 'new'),
  ('nested',  'REELS', 'top',  'sami',   'Nomer tashlang',                   '2026-11-11 07:00+00', false, 'new'),
  -- emoji and dots alone: counted, waiting for nothing
  ('emoji',   'REELS', null,   'fan',    '🔥🔥🔥',                           '2026-11-11 08:00+00', false, 'new'),
  ('dots',    'AD',    null,   'dot',    '. . .',                            '2026-11-11 08:01+00', false, 'new'),
  ('empty',   'AD',    null,   'none',   null,                               '2026-11-11 08:02+00', false, 'new'),
  -- answered: from the CRM, by a private reply, hidden, or in the Instagram app
  ('crm',     'AD',    null,   'a1',     'Narxi?',                           '2026-11-11 09:00+00', false, 'replied'),
  ('dm',      'AD',    null,   'a2',     'Narxi?',                           '2026-11-11 09:01+00', false, 'private_replied'),
  ('spam',    'AD',    null,   'bot',    'botdan NFT oldim',                 '2026-11-11 09:02+00', false, 'hidden'),
  ('inapp',   'AD',    null,   'a3',     'Qayerda joylashgansiz',            '2026-11-11 09:03+00', false, 'new'),
  ('inapp-r', 'AD',    'inapp','hanguk', 'Direktga yozdik',                  '2026-11-11 09:30+00', true,  'ignored'),
  -- the account's earlier comment under the same thread is not an answer
  ('late-q',  'AD',    'thr',  'a4',     'Javob bermadingiz',                '2026-11-11 10:00+00', false, 'new'),
  ('early-r', 'AD',    'thr',  'hanguk', 'Salom',                            '2026-11-11 09:50+00', true,  'ignored');

do $$
declare r record;
begin
  select * into r from public.fn_instagram_comments_daily('2026-11-11');
  -- 12 from other people that day (the account's two are not comments to answer).
  if r.total <> 12 then raise exception 'total: % (expected 12)', r.total; end if;
  if r.unanswered <> 5 then raise exception 'unanswered: % (expected 5)', r.unanswered; end if;
  if jsonb_array_length(r.items) <> 5 then raise exception 'items: %', r.items; end if;
  -- newest first; whitespace folded; the type of media kept
  if r.items->0->>'username' <> 'a4' then raise exception 'first item: %', r.items->0; end if;
  if r.items->4->>'text' <> 'To''lov oldindanmi til kursi uchun' then raise exception 'last item: %', r.items->4; end if;
  if r.items->4->>'media' <> 'AD' then raise exception 'media: %', r.items->4; end if;
  if exists (select 1 from jsonb_array_elements(r.items) e where e->>'username' in ('fan','dot','none','a1','a2','bot','a3','early','late','hanguk')) then
    raise exception 'answered, wordless or other days in the list: %', r.items;
  end if;
end $$;

-- More than five waiting: the count is whole, the list is the latest five.
insert into public.instagram_comments (comment_id, media_product_type, from_username, text, commented_at)
select 'more-' || g, 'AD', 'u' || g, '+', timestamptz '2026-11-11 12:00+00' + g * interval '1 minute' from generate_series(1, 4) g;
do $$
declare r record;
begin
  select * into r from public.fn_instagram_comments_daily('2026-11-11');
  if r.total <> 16 or r.unanswered <> 9 then raise exception 'after more: % / %', r.total, r.unanswered; end if;
  if jsonb_array_length(r.items) <> 5 or r.items->0->>'username' <> 'u4' or r.items->4->>'username' <> 'a4' then
    raise exception 'latest five: %', r.items;
  end if;
end $$;

-- A day with nothing: one row of zeros and an empty list.
do $$
declare r record;
begin
  select * into r from public.fn_instagram_comments_daily('2026-01-01');
  if r.total <> 0 or r.unanswered <> 0 or r.items <> '[]'::jsonb then raise exception 'empty day: %', r; end if;
end $$;

-- Only the service role may call it.
do $$
begin
  if has_function_privilege('anon', 'public.fn_instagram_comments_daily(date)', 'execute')
     or has_function_privilege('authenticated', 'public.fn_instagram_comments_daily(date)', 'execute') then
    raise exception 'anon/authenticated can execute';
  end if;
  if not has_function_privilege('service_role', 'public.fn_instagram_comments_daily(date)', 'execute') then
    raise exception 'service_role cannot execute';
  end if;
end $$;

\echo instagram_comments_daily: OK
