-- Security audit 2026-11-05, K5: payment receipts were in a public bucket and
-- any signed-in user (including self-created guest accounts) could list,
-- overwrite and delete them. The bucket becomes private and only inbox staff
-- (owner/admin/call_operator/document_handler) can read or change receipts.
-- Investors stay blocked by the existing restrictive deny_investor_storage.
-- The CRM opens receipts through short-lived signed URLs (src/lib/receiptUrl.ts);
-- stored public URLs keep working as input because the path is parsed from them.

update storage.buckets set public = false where id = 'payment-receipts';

drop policy if exists "Authenticated users can delete payment receipts" on storage.objects;
drop policy if exists "Authenticated users can upload payment receipts" on storage.objects;
drop policy if exists "Authenticated can read payment receipts" on storage.objects;
drop policy if exists "Authenticated users can update payment receipts" on storage.objects;

drop policy if exists "Staff read payment receipts" on storage.objects;
create policy "Staff read payment receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and public.fn_is_inbox_staff());

drop policy if exists "Staff upload payment receipts" on storage.objects;
create policy "Staff upload payment receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and public.fn_is_inbox_staff());

drop policy if exists "Staff update payment receipts" on storage.objects;
create policy "Staff update payment receipts"
  on storage.objects for update to authenticated
  using (bucket_id = 'payment-receipts' and public.fn_is_inbox_staff())
  with check (bucket_id = 'payment-receipts' and public.fn_is_inbox_staff());

drop policy if exists "Staff delete payment receipts" on storage.objects;
create policy "Staff delete payment receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-receipts' and public.fn_is_inbox_staff());
