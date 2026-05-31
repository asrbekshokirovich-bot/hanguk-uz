-- ============================================================================
--  uni_db v2 — guideline-blobs storage bucket + access log (ADR-009)
--
--  Replaces Phase 0/1's planned Cloudflare R2 with Supabase Storage as
--  the canonical blob backend for crawled admission-guideline PDFs.
--
--  ADR-009 commitments:
--    * Bucket is PRIVATE (`public = false`).
--    * Only the service-role key uploads (the Python crawler).
--    * App users access via 15-minute signed URLs minted server-side.
--    * Every signed-URL grant writes a row to `pdf_access_log` for
--      forensic audit (PIPA / copyright defense).
--
--  Idempotent — `on conflict` for the bucket row and `if not exists`
--  for the audit table.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  Bucket: guideline-blobs (private)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('guideline-blobs', 'guideline-blobs', false)
on conflict (id) do update set public = excluded.public;

-- Block all SELECT/INSERT/UPDATE/DELETE from authenticated + anon roles
-- on objects in this bucket. Service role bypasses RLS as usual, so the
-- crawler's uploads still work.

drop policy if exists "guideline_blobs_no_anon_read"
  on storage.objects;
create policy "guideline_blobs_no_anon_read"
  on storage.objects
  for select
  using (bucket_id = 'guideline-blobs' and false);

drop policy if exists "guideline_blobs_no_authenticated_write"
  on storage.objects;
create policy "guideline_blobs_no_authenticated_write"
  on storage.objects
  for insert
  with check (bucket_id = 'guideline-blobs' and false);

-- ----------------------------------------------------------------------------
--  pdf_access_log — every signed URL minted leaves a forensic trail
-- ----------------------------------------------------------------------------
create table if not exists public.pdf_access_log (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete set null,
  guideline_document_id uuid references public.guideline_documents(id) on delete set null,
  storage_path          text not null,
  signed_url_ttl_sec    int not null default 900,
  granted_at            timestamptz not null default now(),
  ip_address            inet,
  user_agent            text
);

create index if not exists pdf_access_log_user_idx
  on public.pdf_access_log (user_id, granted_at desc);
create index if not exists pdf_access_log_doc_idx
  on public.pdf_access_log (guideline_document_id, granted_at desc);

alter table public.pdf_access_log enable row level security;

-- Users can read their own access log; admins can read all.
drop policy if exists pdf_access_log_owner_read on public.pdf_access_log;
create policy pdf_access_log_owner_read on public.pdf_access_log
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- INSERT only via service role (no policy → denied for anon/auth).

comment on table public.pdf_access_log is
  'ADR-009 — append-only audit trail of signed URL grants for blob access.';
