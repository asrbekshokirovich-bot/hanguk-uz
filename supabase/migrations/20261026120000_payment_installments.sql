-- Payment installments ("bo'laklar") for one payment account.
--
-- Students pay one contract amount in several transfers (and, on the
-- 2-payment tariff, two amounts that can each arrive in parts). The CRM had no
-- way to add a second transfer to an existing payment: every "Add Payment"
-- opened a new payments row, i.e. a new debt. This migration gives each
-- transfer a real payment date and adds one atomic way to record a transfer
-- against an existing payment.
--
-- Deliberately NOT done: a trigger that recomputes payments.paid_amount as
-- sum(payment_transactions.amount). Production holds payments whose
-- paid_amount has no transactions behind it (recorded before transactions
-- were kept), and seven code paths plus the command-center webhook still set
-- paid_amount themselves. A sum trigger would erase those amounts or count
-- them twice. Instead record_payment_installment() adds the transfer and moves
-- paid_amount by exactly that amount, in one transaction, so legacy amounts
-- stay intact and nothing is counted twice.

-- 1. The date the money was actually paid (from the receipt). created_at is
--    when someone typed it in, which can be days later and decides whether
--    the contract was paid within its 7 working days.
alter table public.payment_transactions
  add column if not exists paid_on date not null default current_date;

comment on column public.payment_transactions.paid_on is
  'Date the student actually paid this transfer (from the receipt). created_at is when it was entered.';

-- Existing transfers: the best date we have is when they were entered.
update public.payment_transactions
   set paid_on = (created_at at time zone 'Asia/Tashkent')::date
 where created_at is not null
   and paid_on = current_date
   and (created_at at time zone 'Asia/Tashkent')::date <> current_date;

create index if not exists payment_transactions_payment_id_paid_on_idx
  on public.payment_transactions (payment_id, paid_on);

-- 2. Record one transfer against an existing payment, atomically.
--    SECURITY INVOKER: the caller's own RLS on payments/payment_transactions
--    decides whether this is allowed, exactly as for a direct insert.
create or replace function public.record_payment_installment(
  p_payment_id   uuid,
  p_amount       numeric,
  p_paid_on      date default current_date,
  p_method       text default null,
  p_gateway_fee  numeric default 0,
  p_notes        text default null,
  p_receipt_urls text[] default '{}'::text[]
)
returns table (
  transaction_id   uuid,
  new_paid_amount  numeric,
  payment_amount   numeric,
  was_completed    boolean,
  is_completed     boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_tx_id   uuid;
  v_new     numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Bo''lak summasi musbat bo''lishi kerak' using errcode = '22023';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'To''lov hisobi topilmadi yoki unga ruxsat yo''q' using errcode = 'P0002';
  end if;
  if v_payment.status = 'refunded' then
    raise exception 'Qaytarilgan to''lovga bo''lak qo''shib bo''lmaydi' using errcode = '22023';
  end if;

  insert into public.payment_transactions (
    payment_id, amount, payment_method, gateway_fee, notes,
    receipt_url, receipt_urls, paid_on, created_by
  ) values (
    p_payment_id, p_amount, p_method, coalesce(p_gateway_fee, 0), p_notes,
    nullif((coalesce(p_receipt_urls, '{}'::text[]))[1], ''),
    coalesce(p_receipt_urls, '{}'::text[]),
    coalesce(p_paid_on, current_date),
    auth.uid()
  )
  returning id into v_tx_id;

  v_new := coalesce(v_payment.paid_amount, 0) + p_amount;

  -- payments_sync_status derives status/paid_at from paid_amount.
  update public.payments
     set paid_amount = v_new
   where id = p_payment_id;

  return query
    select v_tx_id,
           v_new,
           v_payment.amount,
           coalesce(v_payment.paid_amount, 0) >= v_payment.amount,
           v_new >= v_payment.amount;
end;
$$;

comment on function public.record_payment_installment(uuid, numeric, date, text, numeric, text, text[]) is
  'Adds one transfer (bo''lak) to an existing payment and raises paid_amount by the same amount, atomically.';

grant execute on function public.record_payment_installment(uuid, numeric, date, text, numeric, text, text[]) to authenticated;
