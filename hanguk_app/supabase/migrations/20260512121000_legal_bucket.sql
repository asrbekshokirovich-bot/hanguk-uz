-- ─────────────────────────────────────────────────────────────────────────────
-- 20260512121000 — Legal documents storage bucket
--
-- Creates a public-read Supabase Storage bucket called `legal` for serving
-- the Privacy Policy and Terms of Service markdown documents. The source
-- markdown lives in `docs/legal/`; deployment is manual (drag-drop in the
-- Supabase Studio UI or via the `supabase` CLI) — DO NOT script the upload
-- here because the migration system can't move file contents.
--
-- After deploying this migration:
--
--   supabase storage cp docs/legal/PRIVACY_POLICY.md \
--       storage://legal/privacy_policy.md
--   supabase storage cp docs/legal/TERMS_OF_SERVICE.md \
--       storage://legal/terms_of_service.md
--
-- The canonical URLs (used in `lib/core/config/app_config.dart`):
--   https://<ref>.supabase.co/storage/v1/object/public/legal/privacy_policy.md
--   https://<ref>.supabase.co/storage/v1/object/public/legal/terms_of_service.md
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('legal', 'legal', true)
on conflict (id) do update set public = true;

-- Public-read policy (anyone, even unauthenticated, can SELECT objects).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read on legal bucket'
  ) then
    create policy "Public read on legal bucket"
      on storage.objects
      for select
      to public
      using (bucket_id = 'legal');
  end if;
end$$;

-- Only the service role can write/update/delete legal documents.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Service role write on legal bucket'
  ) then
    create policy "Service role write on legal bucket"
      on storage.objects
      for all
      to service_role
      using (bucket_id = 'legal')
      with check (bucket_id = 'legal');
  end if;
end$$;
