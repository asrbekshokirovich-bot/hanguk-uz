-- Hanguk Ish: the worker says what was actually paid.
--
-- When a shift is over the worker is asked «belgilangan pul berildimi yoki
-- kamroqmi?». confirm_payment(application, amount) records the amount the
-- worker received (and when); A09 «Daromad» counts it as paid at once. When it
-- is less than what the shift came to, the staff get a report («unpaid») in the
-- CRM (and the Telegram alert reports already send).

alter table ish.applications
  add column received_amount int check (received_amount between 0 and 100000000),
  add column received_at timestamptz;

comment on column ish.applications.received_amount is
  'Won the worker says they received for the shift (confirm_payment); null until they say.';

create function ish.confirm_payment(p_application uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  a ish.applications;
begin
  perform ish.require_uid();
  select * into a from ish.applications where id = p_application and worker_id = auth.uid() for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if a.status <> 'completed' then
    raise exception 'NOT_COMPLETED' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000000 then
    raise exception 'INVALID' using errcode = 'P0001';
  end if;

  update ish.applications set received_amount = p_amount, received_at = now() where id = a.id;

  -- Less than the shift came to: the staff look into it. A refused report
  -- (too many today) never undoes what the worker said.
  if a.pay_amount is not null and p_amount < a.pay_amount then
    begin
      insert into ish.reports (reporter_id, application_id, business_id, reason, body)
      select a.worker_id, a.id, s.business_id, 'unpaid',
             format('Ishchi %s won oldi, hisoblangan maosh %s won.', p_amount, a.pay_amount)
      from ish.shifts s where s.id = a.shift_id;
    exception when others then
      null;
    end;
  end if;
end
$$;

revoke execute on function ish.confirm_payment(uuid, int) from public, anon;
grant execute on function ish.confirm_payment(uuid, int) to authenticated;

-- A06 / A07 / A09: the worker's own cards carry what they said they received.
create or replace function ish.application_card(p_application uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'application_id', a.id,
    'status', a.status,
    'created_at', a.created_at,
    'decided_at', a.decided_at,
    'cancelled_at', a.cancelled_at,
    'late_cancel', a.late_cancel,
    'check_in_at', a.check_in_at,
    'check_out_at', a.check_out_at,
    'late_minutes', a.late_minutes,
    'worked_minutes', a.worked_minutes,
    'pay_amount', a.pay_amount,
    'paid_at', a.paid_at,
    'received_amount', a.received_amount,
    'received_at', a.received_at,
    'my_stars', r.stars,
    'my_tags', coalesce(to_jsonb(r.tags), '[]'::jsonb),
    'shift', ish.shift_card(a.shift_id, w.lat, w.lng)
  )
  from ish.applications a
  left join ish.ratings r on r.application_id = a.id and r.direction = 'worker_to_business'
  left join ish.worker_profiles w on w.user_id = a.worker_id
  where a.id = p_application
$$;

-- A12: the entry of a finished shift shows whether the worker already answered.
create or replace function ish.notification_card(p_notification bigint)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'id', n.id,
    'kind', n.kind,
    'data', n.data,
    'created_at', n.created_at,
    'read_at', n.read_at,
    'shift', (
      select jsonb_build_object(
        'id', s.id, 'title', s.title, 'translations', s.translations,
        'starts_at', s.starts_at, 'ends_at', s.ends_at, 'hourly_wage', s.hourly_wage,
        'lat', coalesce(s.lat, b.lat), 'lng', coalesce(s.lng, b.lng), 'status', s.status)
      from ish.shifts s join ish.businesses b on b.id = s.business_id
      where s.id = ref.shift_id),
    'business', ish.business_brief(coalesce(ref.business_id,
      (select s.business_id from ish.shifts s where s.id = ref.shift_id))),
    'application', (
      select jsonb_build_object('id', a.id, 'status', a.status, 'pay_amount', a.pay_amount,
                                'worked_minutes', a.worked_minutes,
                                'received_amount', a.received_amount, 'received_at', a.received_at)
      from ish.applications a where a.id = ref.application_id),
    'worker', (
      select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name)
      from ish.profiles p where p.id = ref.worker_id)
  )
  from ish.notifications n
  cross join lateral (
    select
      case when n.data ->> 'shift_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'shift_id')::uuid end as shift_id,
      case when n.data ->> 'business_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'business_id')::uuid end as business_id,
      case when n.data ->> 'application_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'application_id')::uuid end as application_id,
      case when n.data ->> 'worker_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'worker_id')::uuid end as worker_id
  ) ref
  where n.id = p_notification
$$;
