-- Payment status stops being a thing an operator types, and the duplicate
-- guard stops applying to only one of the three payment types.
--
-- Two problems this fixes, both found on the live database on 2026-09-16:
--
--  1. `status` was set by hand on every payment. It happened to be correct on
--     all 72 rows, but nothing enforced it -- an operator who recorded money
--     against `paid_amount` and forgot the dropdown left a paid invoice sitting
--     in the "pending" bucket, and the investor's revenue view (which reads
--     paid_amount, not status) and the CRM's overdue list would disagree.
--
--  2. `payments_idempotent_initial_deposit` only guards `initial_deposit`.
--     Two duplicate 'other' rows -- YOVKOCHEV's 10,000,000 UZS (90 seconds
--     apart) and SAYDULLAEV's $5,000 (six minutes apart) -- walked straight
--     past it in June and showed up as 15,000,000 UZS of debt that nobody
--     owed. They were deleted by hand; this stops the next pair.

-- ---------------------------------------------------------------------------
-- 1. status and paid_at derive from paid_amount
-- ---------------------------------------------------------------------------
create or replace function public.payments_sync_status()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- A refund is a decision, not an arithmetic result. Leave it alone.
  if new.status = 'refunded' then
    return new;
  end if;

  -- With no bill to compare against there is nothing to derive.
  if new.amount is null or new.amount <= 0 then
    return new;
  end if;

  if coalesce(new.paid_amount, 0) <= 0 then
    -- 'overdue' is a due_date judgement the CRM makes; keep it if it is
    -- already there, otherwise an unpaid invoice is simply pending.
    new.paid_amount := 0;
    new.paid_at     := null;
    if new.status is distinct from 'overdue' then
      new.status := 'pending';
    end if;

  elsif new.paid_amount >= new.amount then
    -- Covers the overpaid case too (OMONOVA paid 7M against a 6M invoice).
    new.status  := 'completed';
    new.paid_at := coalesce(new.paid_at, now());

  else
    new.status  := 'partial';
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists payments_sync_status on public.payments;
create trigger payments_sync_status
  before insert or update on public.payments
  for each row execute function public.payments_sync_status();

-- ---------------------------------------------------------------------------
-- 2. Duplicate guard for remaining_payment and other
-- ---------------------------------------------------------------------------
-- Deliberately does NOT match on intake_id: `trg_set_default_intake` fills
-- that in a BEFORE INSERT trigger that sorts after this one, so intake_id is
-- still null here. Two identical charges against the same student inside a day
-- are a double-submit whatever season they land in.
create or replace function public.payments_block_duplicate()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare existing_id uuid;
begin
  -- initial_deposit has its own, stricter idempotency trigger.
  if new.payment_type = 'initial_deposit' then
    return new;
  end if;

  select id into existing_id
    from public.payments
   where student_id   = new.student_id
     and payment_type = new.payment_type
     and amount       = new.amount
     and currency     = new.currency
     and coalesce(due_date::text, '') = coalesce(new.due_date::text, '')
     and created_at > now() - interval '24 hours'
   limit 1;

  if existing_id is not null then
    raise warning 'Duplicate payment suppressed for student % (matches %)',
      new.student_id, existing_id;
    return null;  -- swallow the insert, same shape as the initial_deposit guard
  end if;

  return new;
end;
$$;

-- Named to sort after trg_set_default_intake so the row is fully populated by
-- the time the other BEFORE INSERT triggers have had their turn.
drop trigger if exists trg_zz_payments_block_duplicate on public.payments;
create trigger trg_zz_payments_block_duplicate
  before insert on public.payments
  for each row execute function public.payments_block_duplicate();
