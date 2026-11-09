-- To'lov bo'lagini (chek bilan) CRM'dan o'chirish — owner, admin va ruxsat
-- berilgan xodim (Asrbek, 2026-11-09: "omina uchun cheklarni o'chira oladigan qil").
--
-- Avval bo'lakni faqat owner bazadan o'chira olardi (payment_transactions
-- DELETE policy), CRM'da tugma yo'q edi, va o'chirilganda paid_amount
-- o'zgarmay qolardi. delete_payment_installment() bo'lakni o'chiradi va
-- paid_amount'ni aynan shu summaga kamaytiradi (record_payment_installment
-- ning teskarisi), bitta tranzaksiyada. Komissiya xarajati (expenses) ham
-- o'chiriladi. Holatni payments_sync_status trigger paid_amount'dan oladi.
--
-- Kim ro'yxatda — bu migratsiyada emas (alohida insert, Asrbek ruxsati bilan).

create table if not exists public.payment_delete_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);

comment on table public.payment_delete_access is
  'Staff who may delete a payment installment (bo''lak) and its receipt without holding owner/admin.';

alter table public.payment_delete_access enable row level security;

drop policy if exists "payment_delete_access_read" on public.payment_delete_access;
create policy "payment_delete_access_read" on public.payment_delete_access
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

drop policy if exists "payment_delete_access_manage" on public.payment_delete_access;
create policy "payment_delete_access_manage" on public.payment_delete_access
  for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

create or replace function public.can_delete_payment_installments(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.has_role(p_uid, 'owner'::public.app_role)
      or public.has_role(p_uid, 'admin'::public.app_role)
      or exists (select 1 from public.payment_delete_access a where a.user_id = p_uid)
$$;

revoke all on function public.can_delete_payment_installments(uuid) from public, anon;
grant execute on function public.can_delete_payment_installments(uuid) to authenticated, service_role;

create or replace function public.delete_payment_installment(p_transaction_id uuid)
returns table (payment_id uuid, removed_amount numeric, new_paid_amount numeric, receipt_urls text[])
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tx  public.payment_transactions%rowtype;
  v_new numeric;
begin
  if not public.can_delete_payment_installments(auth.uid()) then
    raise exception 'Bo''lakni o''chirishga ruxsat yo''q' using errcode = '42501';
  end if;

  select * into v_tx from public.payment_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Bo''lak topilmadi' using errcode = 'P0002';
  end if;

  perform 1 from public.payments where id = v_tx.payment_id for update;

  delete from public.expenses where linked_transaction_id = v_tx.id;
  delete from public.payment_transactions where id = v_tx.id;

  update public.payments
     set paid_amount = greatest(coalesce(paid_amount, 0) - v_tx.amount, 0),
         updated_at = now()
   where id = v_tx.payment_id
  returning paid_amount into v_new;

  return query select
    v_tx.payment_id,
    v_tx.amount,
    v_new,
    array(select distinct u from unnest(
      coalesce(v_tx.receipt_urls, '{}'::text[]) || array[v_tx.receipt_url]) u
      where coalesce(u, '') <> '');
end;
$$;

comment on function public.delete_payment_installment(uuid) is
  'Deletes one transfer (bo''lak) and lowers payments.paid_amount by its amount, atomically. Owner/admin/payment_delete_access.';

revoke all on function public.delete_payment_installment(uuid) from public, anon;
grant execute on function public.delete_payment_installment(uuid) to authenticated;
