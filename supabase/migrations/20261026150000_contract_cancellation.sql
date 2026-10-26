-- Shartnomani bekor qilish (talaba profilidagi "Shartnomani bekor qilish").
--
-- Asrbek's rules (2026-10-26):
--   * The button sits at the bottom of the student's profile and asks
--     "Rostdan ham bekor qilmoqchimisiz?" before doing anything.
--   * An izoh (note) is required; the amount refunded to the student is asked.
--   * The student stays in the list with a red "Bekor qilingan" badge, and
--     season counts (investor "Students Signed") stop counting them.
--   * Only Omina, admins and the owner may cancel - and restore with
--     "Shartnomani tiklash".
--
-- The cancellation is per season, like is_free_reapplication: it lives on the
-- student_intakes row of that season.
--
-- What happens to the money: for every payment of that student in that season
--   * the refund is taken off paid_amount, newest payment first;
--   * the bill (amount) is cut down to what is kept, so no debt remains;
--   * a payment left with nothing kept becomes 'refunded'.
-- The kept money therefore stays in revenue, the refunded part leaves it, and
-- the debt disappears from every list. The payments' previous state is stored
-- in contract_cancellations.payments_before so a restore puts it back exactly.
-- Transfers (payment_transactions) are not touched: they are what was received.

-- 1. The season row carries the current state, so lists can filter cheaply.
alter table public.student_intakes
  add column if not exists contract_cancelled_at timestamptz,
  add column if not exists contract_cancelled_by uuid references auth.users (id) on delete set null,
  add column if not exists contract_cancel_note  text;

-- 2. Who may cancel besides owner/admin (Omina). Same shape as
--    application_fee_access.
create table if not exists public.contract_cancel_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);

alter table public.contract_cancel_access enable row level security;

drop policy if exists "contract_cancel_access_read" on public.contract_cancel_access;
create policy "contract_cancel_access_read" on public.contract_cancel_access
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

drop policy if exists "contract_cancel_access_manage" on public.contract_cancel_access;
create policy "contract_cancel_access_manage" on public.contract_cancel_access
  for all to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  )
  with check (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create or replace function public.can_cancel_contracts(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.has_role(p_uid, 'owner'::public.app_role)
      or public.has_role(p_uid, 'admin'::public.app_role)
      or exists (select 1 from public.contract_cancel_access a where a.user_id = p_uid)
$$;

revoke all on function public.can_cancel_contracts(uuid) from public, anon;
grant execute on function public.can_cancel_contracts(uuid) to authenticated, service_role;

-- 3. History: one row per cancellation, kept after a restore.
create table if not exists public.contract_cancellations (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null,
  intake_id       uuid not null references public.intakes (id) on delete cascade,
  note            text not null check (btrim(note) <> ''),
  -- [{"currency":"USD","amount":1000}]
  refunds         jsonb not null default '[]'::jsonb,
  -- [{"id":..,"amount":..,"paid_amount":..,"status":..,"paid_at":..}]
  payments_before jsonb not null default '[]'::jsonb,
  cancelled_by    uuid references auth.users (id) on delete set null default auth.uid(),
  cancelled_at    timestamptz not null default now(),
  restored_by     uuid references auth.users (id) on delete set null,
  restored_at     timestamptz
);

create index if not exists contract_cancellations_student_idx
  on public.contract_cancellations (student_id, intake_id, cancelled_at desc);

alter table public.contract_cancellations enable row level security;

-- Any staff member who can open the profile sees why it was cancelled.
-- Writes only go through the two functions below.
drop policy if exists "contract_cancellations_read" on public.contract_cancellations;
create policy "contract_cancellations_read" on public.contract_cancellations
  for select to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid())));

-- 4. Cancel.
create or replace function public.cancel_student_contract(
  p_student_id uuid,
  p_intake_id  uuid,
  p_note       text,
  p_refunds    jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id       uuid;
  v_snapshot jsonb;
  v_refunds  jsonb;   -- normalised: [{"currency":"USD","amount":1000}]
  v_left     jsonb;   -- remaining refund per currency: {"USD":1000}
  v_ref      record;
  v_pay      record;
  v_rem      numeric;
  v_take     numeric;
  v_paid_cur numeric;
begin
  if not public.can_cancel_contracts(auth.uid()) then
    raise exception 'Shartnomani bekor qilishga ruxsat yo''q' using errcode = '42501';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Izoh yozilishi shart' using errcode = '22023';
  end if;

  perform 1 from public.student_intakes
   where student_id = p_student_id and intake_id = p_intake_id
   for update;
  if not found then
    raise exception 'Talaba bu mavsumda topilmadi' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.student_intakes
              where student_id = p_student_id and intake_id = p_intake_id
                and contract_cancelled_at is not null) then
    raise exception 'Shartnoma allaqachon bekor qilingan' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('currency', c, 'amount', a)), '[]'::jsonb),
         coalesce(jsonb_object_agg(c, a), '{}'::jsonb)
    into v_refunds, v_left
    from (
      select upper(btrim(r->>'currency')) as c, sum((r->>'amount')::numeric) as a
        from jsonb_array_elements(coalesce(p_refunds, '[]'::jsonb)) r
       where coalesce((r->>'amount')::numeric, 0) > 0
       group by 1
    ) x;

  -- Never refund more than was paid in that currency this season.
  for v_ref in select key as currency, value::numeric as amount from jsonb_each_text(v_left) loop
    select coalesce(sum(p.paid_amount), 0) into v_paid_cur
      from public.payments p
     where p.student_id = p_student_id and p.intake_id = p_intake_id
       and p.status <> 'refunded' and upper(p.currency) = v_ref.currency;
    if v_ref.amount > v_paid_cur then
      raise exception 'Qaytariladigan summa (% %) to''langandan (% %) ko''p',
        v_ref.amount, v_ref.currency, v_paid_cur, v_ref.currency using errcode = '22023';
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'amount', p.amount, 'paid_amount', p.paid_amount,
           'status', p.status, 'paid_at', p.paid_at)), '[]'::jsonb)
    into v_snapshot
    from public.payments p
   where p.student_id = p_student_id and p.intake_id = p_intake_id
     and p.status <> 'refunded';

  -- Refund off the newest payments first, then close every bill at what is kept.
  for v_pay in
    select p.id, upper(p.currency) as currency, coalesce(p.paid_amount, 0) as paid
      from public.payments p
     where p.student_id = p_student_id and p.intake_id = p_intake_id
       and p.status <> 'refunded'
     order by p.created_at desc
  loop
    v_rem  := coalesce((v_left ->> v_pay.currency)::numeric, 0);
    v_take := least(v_rem, v_pay.paid);
    v_left := jsonb_set(v_left, array[v_pay.currency], to_jsonb(v_rem - v_take), true);

    if v_pay.paid - v_take > 0 then
      update public.payments
         set amount = v_pay.paid - v_take,
             paid_amount = v_pay.paid - v_take
       where id = v_pay.id;
    else
      update public.payments
         set status = 'refunded',
             paid_amount = 0
       where id = v_pay.id;
    end if;
  end loop;

  update public.student_intakes
     set contract_cancelled_at = now(),
         contract_cancelled_by = auth.uid(),
         contract_cancel_note  = btrim(p_note)
   where student_id = p_student_id and intake_id = p_intake_id;

  insert into public.contract_cancellations (student_id, intake_id, note, refunds, payments_before)
  values (p_student_id, p_intake_id, btrim(p_note), v_refunds, v_snapshot)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.cancel_student_contract(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.cancel_student_contract(uuid, uuid, text, jsonb) to authenticated;

-- 5. Restore: put every payment back exactly as it was before the cancel.
create or replace function public.restore_student_contract(
  p_student_id uuid,
  p_intake_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_c   public.contract_cancellations%rowtype;
  v_row jsonb;
begin
  if not public.can_cancel_contracts(auth.uid()) then
    raise exception 'Shartnomani tiklashga ruxsat yo''q' using errcode = '42501';
  end if;

  select * into v_c
    from public.contract_cancellations
   where student_id = p_student_id and intake_id = p_intake_id and restored_at is null
   order by cancelled_at desc
   limit 1
   for update;
  if not found then
    raise exception 'Bekor qilingan shartnoma topilmadi' using errcode = 'P0002';
  end if;

  for v_row in select * from jsonb_array_elements(v_c.payments_before) loop
    update public.payments
       set amount      = (v_row->>'amount')::numeric,
           paid_amount = (v_row->>'paid_amount')::numeric,
           status      = v_row->>'status',
           paid_at     = nullif(v_row->>'paid_at', '')::timestamptz
     where id = (v_row->>'id')::uuid;
  end loop;

  update public.student_intakes
     set contract_cancelled_at = null,
         contract_cancelled_by = null,
         contract_cancel_note  = null
   where student_id = p_student_id and intake_id = p_intake_id;

  update public.contract_cancellations
     set restored_at = now(), restored_by = auth.uid()
   where id = v_c.id;

  return v_c.id;
end;
$$;

revoke all on function public.restore_student_contract(uuid, uuid) from public, anon;
grant execute on function public.restore_student_contract(uuid, uuid) to authenticated;

-- 6. Investor "Students Signed": a cancelled contract is not a signed student.
--    Same view as prod (pg_get_viewdef, 2026-10-26); only the signed count
--    gains "AND si.contract_cancelled_at IS NULL".
create or replace view public.v_investor_season_funnel as
 WITH base AS (
         SELECT ik.id AS intake_id,
            ( SELECT count(*) AS count
                   FROM leads l
                  WHERE (l.intake_id = ik.id)) AS leads,
            ( SELECT count(*) AS count
                   FROM (student_intakes si
                     JOIN profiles p ON ((p.user_id = si.student_id)))
                  WHERE ((si.intake_id = ik.id) AND (NOT p.is_demo) AND (si.contract_cancelled_at IS NULL))) AS signed,
            ( SELECT count(*) AS count
                   FROM applications a
                  WHERE ((a.intake_id = ik.id) AND (a.submitted_at IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
                           FROM profiles p
                          WHERE ((p.user_id = a.student_id) AND p.is_demo)))))) AS submitted
           FROM intakes ik
        )
 SELECT b.intake_id,
    s.stage,
    s.stage_order,
        CASE s.stage_order
            WHEN 0 THEN b.leads
            WHEN 1 THEN b.signed
            WHEN 2 THEN (0)::bigint
            WHEN 3 THEN b.submitted
            WHEN 4 THEN (0)::bigint
            WHEN 5 THEN (0)::bigint
            WHEN 6 THEN (0)::bigint
            ELSE NULL::bigint
        END AS student_count
   FROM (base b
     CROSS JOIN ( VALUES ('Leads'::text,0), ('Signed'::text,1), ('Documents Ready'::text,2), ('Submitted'::text,3), ('Offer Received'::text,4), ('Visa Approved'::text,5), ('Departed'::text,6)) s(stage, stage_order))
  WHERE investor_can_view_intake(b.intake_id);
