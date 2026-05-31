-- ============================================================================
--  uni_db v3 — pdf_access_log: extend with audit fields the Edge Function uses
--
--  Phase 2's 20260606000000_uni_db_v2_storage_bucket.sql already created
--  public.pdf_access_log with:
--    user_id, guideline_document_id, storage_path, signed_url_ttl_sec,
--    granted_at, ip_address, user_agent
--
--  Phase 3's get-pdf-url Edge Function additionally records:
--    bucket             — which storage bucket the URL was for
--    expires_at         — concrete expiry timestamp (granted_at + ttl)
--    reason             — soft category ('open_original', 'admin_review', ...)
--
--  This migration adds those three columns. The pre-existing column set
--  is unchanged. Indexes from Phase 2 already cover the user / document
--  lookups; no new indexes needed.
-- ============================================================================

alter table public.pdf_access_log
  add column if not exists bucket     text default 'guideline-blobs',
  add column if not exists expires_at timestamptz,
  add column if not exists reason     text;

comment on column public.pdf_access_log.bucket is
  'Supabase Storage bucket the signed URL targeted. Default guideline-blobs.';
comment on column public.pdf_access_log.expires_at is
  'Concrete expiry timestamp = granted_at + signed_url_ttl_sec. Cached so '
  'audit queries do not need to recompute.';
comment on column public.pdf_access_log.reason is
  'Soft category for the grant (open_original, admin_review, export, ...)';
