-- Hanguk Ish: the job alert (notification card and push) must not show the
-- exact place of a hidden job. Before: notification_card gave the shift's
-- exact lat/lng even when the worker had not paid. Now the point is rounded
-- (about 1 km) until the worker can see the place, and the card carries the
-- unlock price so the alert can say what opening costs.

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
        'lat', case when ish.can_see_place(s.id) then coalesce(s.lat, b.lat)
                    else ish.round_point(coalesce(s.lat, b.lat)) end,
        'lng', case when ish.can_see_place(s.id) then coalesce(s.lng, b.lng)
                    else ish.round_point(coalesce(s.lng, b.lng)) end,
        'status', s.status,
        'unlock_price', ish.shift_unlock_price(s.id))
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
