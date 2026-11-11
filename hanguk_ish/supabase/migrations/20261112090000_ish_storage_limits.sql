-- Hanguk Ish — the photo bucket's limits on every database (P19, 2026-11-12).
--
-- config.toml gives the local stack's «ish-avatars» bucket images only, at most
-- 2 MiB, but a hosted project does not read config.toml: there the bucket was
-- made by the app-reads migration without limits, so a signed-in person could
-- keep any file — a web page, a program — at a public address of ours. Same
-- limits here. Skipped where Supabase Storage is not installed.
do $$
begin
  if to_regclass('storage.buckets') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
    set file_size_limit = 2 * 1024 * 1024,
        allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
    where id = 'ish-avatars';
  end if;
end
$$;
