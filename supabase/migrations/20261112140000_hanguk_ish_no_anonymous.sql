-- Hanguk Ish (hanguk_ish/, P53): its apps sign in with an anonymous account on
-- the phone (P49, «Allow anonymous sign-ins»). Anyone can open such an account
-- with the publishable key, and hanguk.uz was built while anonymous sign-ins
-- were off (guest-test-session makes its guests by hand): its policies let any
-- signed-in account act on rows of its own — write itself a profile, start
-- interview sessions, put files in a folder of its own. An anonymous account
-- must not. These restrictive policies keep anonymous accounts out of every
-- hanguk.uz table (schema public) and bucket. Hanguk Ish lives in the schema
-- `ish` and the «ish-avatars» bucket, which they do not touch.
--
-- hanguk.uz's own people are never anonymous (staff, students and guests sign
-- in with an e-mail or a phone number), so nothing changes for them; service
-- keys and security definer functions are not under row security anyway.
-- Apply before anonymous sign-ins are turned on.
--
-- A table made later gets the same policy only from its own migration:
--   create policy hanguk_ish_no_anonymous on public.<table> as restrictive
--     for all to authenticated
--     using (coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) is false)
--     with check (coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) is false);
-- One policy per table takes each table's lock for a moment: give up rather
-- than queue behind a long query (and everything behind it); then run again.
set local lock_timeout = '5s';

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
      and not exists (select 1 from pg_policy p
                      where p.polrelid = c.oid and p.polname = 'hanguk_ish_no_anonymous')
  loop
    execute format(
      'create policy hanguk_ish_no_anonymous on public.%I as restrictive for all to authenticated '
      'using (coalesce((select auth.jwt() ->> %L)::boolean, false) is false) '
      'with check (coalesce((select auth.jwt() ->> %L)::boolean, false) is false)',
      t.relname, 'is_anonymous', 'is_anonymous');
  end loop;

  -- Files: hanguk.uz's buckets are closed to them; «ish-avatars» (Hanguk Ish's
  -- photos) stays under its own policies.
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from pg_policy p
                   where p.polrelid = to_regclass('storage.objects') and p.polname = 'hanguk_ish_no_anonymous') then
      execute
        'create policy hanguk_ish_no_anonymous on storage.objects as restrictive for all to authenticated '
        'using (bucket_id = ''ish-avatars'' or coalesce((select auth.jwt() ->> ''is_anonymous'')::boolean, false) is false) '
        'with check (bucket_id = ''ish-avatars'' or coalesce((select auth.jwt() ->> ''is_anonymous'')::boolean, false) is false)';
    end if;
  end if;
end
$$;
