-- Butun to'lovni (payments + bo'laklari) o'chirish RPC'si (Asrbek, 2026-11-13:
-- "ominaga ruhsat ber"). RLS bo'yicha faqat owner/admin/moliya ruxsati
-- o'chira olardi; payment_delete_access'dagilar (Omina) faqat bo'lakni.
-- Endi can_delete_payment_installments (owner, admin, payment_delete_access)
-- yoki has_finance_access bo'lsa butun to'lov ham o'chadi.
create or replace function public.delete_payment(p_payment_id uuid)
returns table (payment_id uuid, removed_transactions int, receipt_urls text[])
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_urls text[];
  v_n int;
begin
  if not (public.can_delete_payment_installments(auth.uid()) or public.has_finance_access(auth.uid())) then
    raise exception 'To''lovni o''chirishga ruxsat yo''q' using errcode = '42501';
  end if;

  perform 1 from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'To''lov topilmadi' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct u) filter (where coalesce(u, '') <> ''), '{}'), count(distinct t.id)
    into v_urls, v_n
    from public.payment_transactions t
    left join lateral unnest(coalesce(t.receipt_urls, '{}'::text[]) || array[t.receipt_url]) u on true
   where t.payment_id = p_payment_id;

  delete from public.expenses
   where linked_transaction_id in (select id from public.payment_transactions where payment_transactions.payment_id = p_payment_id);
  delete from public.payment_transactions where payment_transactions.payment_id = p_payment_id;
  delete from public.payments where id = p_payment_id;

  return query select p_payment_id, coalesce(v_n, 0), v_urls;
end;
$$;

revoke all on function public.delete_payment(uuid) from public, anon;
grant execute on function public.delete_payment(uuid) to authenticated;
