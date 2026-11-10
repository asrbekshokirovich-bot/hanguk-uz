-- Hanguk Ish: A06 shows how far the worker's shifts are.
--
-- The prototype's A06 card reads «Mapo-gu, Sinchon-ro 12-gil · 1,2 km», but
-- the cards of my_shifts / my_shift came without a distance: the feed's
-- position is not sent there. They now measure from the position the app
-- last saved for the worker (worker_profiles.lat / lng, rounded; A03). Only
-- the worker's own cards are built here: application_card is called by
-- my_shifts and my_shift, which check the caller.

create or replace function public.application_card(p_application uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
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
    'my_stars', r.stars,
    'my_tags', coalesce(to_jsonb(r.tags), '[]'::jsonb),
    'shift', public.shift_card(a.shift_id, w.lat, w.lng)
  )
  from public.applications a
  left join public.ratings r on r.application_id = a.id and r.direction = 'worker_to_business'
  left join public.worker_profiles w on w.user_id = a.worker_id
  where a.id = p_application
$$;
