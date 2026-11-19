-- Hanguk Ish — personal offers opened with puyl (2026-11-20; «10-qadam»).
--
-- Hanguk's staff find a job (Telegram groups and channels of employers in
-- Korea), call the employer, and send it to 3–4 workers they choose. Each
-- offer lives 30 minutes: the worker sees the pay, the time and the area,
-- not the phone or the exact address. Opening them costs puyl (by the pay:
-- 150 000+ won 20 P, 110 000+ 16 P, 80 000+ 13 P, 50 000+ 10 P, else 7 P);
-- the job is then the worker's (a confirmed place) and closes for the others
-- once its places are full. Puyl does not come back. An offer not opened in
-- 30 minutes expires; the staff then send it to the next ones. A push comes
-- with the offer and again 5 minutes before it ends.
--
-- The worker then calls the employer and marks the steps themselves: opened →
-- called → went to work; then rates the employer.

-- What the whole job pays (the staff's figure; else hours × hourly wage), and
-- when the staff last talked to the employer.
alter table ish.shifts
  add column total_pay int check (total_pay between 0 and 100000000),
  add column checked_at timestamptz;

alter table ish.job_offers
  add column expires_at timestamptz,
  add column reminded_at timestamptz;
alter table ish.job_offers drop constraint job_offers_status_check;
alter table ish.job_offers add constraint job_offers_status_check
  check (status in ('sent', 'declined', 'applied', 'expired', 'closed'));
create index job_offers_live_idx on ish.job_offers (expires_at) where status = 'sent';

-- The worker's own steps on an opened job: 0 opened, 1 called, 2 went to work.
alter table ish.applications
  add column worker_step smallint not null default 0 check (worker_step between 0 and 2);

-- What a job pays in all.
create function ish.job_pay(s ish.shifts)
returns int
language sql
immutable
as $$
  select coalesce(s.total_pay,
                  (s.hourly_wage * extract(epoch from (s.ends_at - s.starts_at)) / 3600)::int)
$$;

-- Puyl to open a job that pays [p_pay] won.
create function ish.unlock_price(p_pay int)
returns int
language sql
immutable
as $$
  select case
    when p_pay >= 150000 then 20
    when p_pay >= 110000 then 16
    when p_pay >= 80000 then 13
    when p_pay >= 50000 then 10
    else 7
  end
$$;

-- The street of an address without the house: «마포구 독막로 4, 1층» → «마포구 독막로 •••».
create function ish.mask_address(p_address text)
returns text
language sql
immutable
as $$
  select case when coalesce(btrim(p_address), '') = '' then ''
              else array_to_string((string_to_array(btrim(p_address), ' '))[1:2], ' ') || ' •••' end
$$;

-- The staff send a job to the workers they chose: at most 4 waiting at once,
-- each for 30 minutes. A worker who had it before does not get it again.
create or replace function ish.staff_send_offers(p_shift uuid, p_workers uuid[], p_note text default '')
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
  v_shift ish.shifts;
  v_live int;
  v_count int;
begin
  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if char_length(coalesce(btrim(p_note), '')) > 300 then
    raise exception 'INVALID';
  end if;
  select count(*) into v_live from ish.job_offers
  where shift_id = p_shift and status = 'sent' and expires_at > now();
  if v_live + coalesce(cardinality(p_workers), 0) > 4 then
    raise exception 'TOO_MANY';
  end if;
  with sent as (
    insert into ish.job_offers (shift_id, worker_id, sent_by, note, expires_at)
    select p_shift, w.user_id, v_uid, coalesce(btrim(p_note), ''), now() + interval '30 minutes'
    from ish.worker_profiles w
    where w.user_id = any (p_workers) and w.onboarded_at is not null
      and not exists (select 1 from ish.business_members m
                      where m.business_id = v_shift.business_id and m.user_id = w.user_id)
      and not exists (select 1 from ish.applications a
                      where a.shift_id = p_shift and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
    on conflict (shift_id, worker_id) do nothing
    returning id, worker_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'job_offer', jsonb_strip_nulls(jsonb_build_object(
           'offer_id', id, 'shift_id', p_shift, 'business_id', v_shift.business_id,
           'note', nullif(coalesce(btrim(p_note), ''), '')))
  from sent;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- The staff's figures of a job: what it pays in all, and «I talked to the
-- employer now» (shown to the worker as when it was checked).
create function ish.staff_job_details(p_shift uuid, p_total_pay int default null, p_checked boolean default false)
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  if p_total_pay is not null and p_total_pay not between 0 and 100000000 then
    raise exception 'INVALID';
  end if;
  update ish.shifts
  set total_pay = p_total_pay,
      checked_at = case when p_checked then now() else checked_at end
  where id = p_shift;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;

-- The worker's offers (Ishlar): the waiting ones first, then what ended in
-- the last two days. No phone, no exact address: the price opens them.
create function ish.my_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  return coalesce((
    select jsonb_agg(card order by live desc, ends_in, created_at desc)
    from (
      select
        (o.status = 'sent' and o.expires_at > now()) as live,
        o.expires_at as ends_in,
        o.created_at,
        jsonb_build_object(
          'offer_id', o.id, 'shift_id', s.id,
          'status', case when o.status = 'sent' and o.expires_at <= now() then 'expired' else o.status end,
          'expires_at', o.expires_at, 'title', s.title, 'translations', s.translations,
          'pay', ish.job_pay(s), 'hourly_wage', s.hourly_wage,
          'starts_at', s.starts_at, 'ends_at', s.ends_at,
          'price', ish.unlock_price(ish.job_pay(s)),
          'sent_count', (select count(*) from ish.job_offers x
                         where x.shift_id = s.id and abs(extract(epoch from (x.created_at - o.created_at))) < 120),
          'slots', s.slots, 'taken', ish.confirmed_count(s.id),
          'checked_at', s.checked_at, 'note', o.note,
          'area', b.area, 'address', ish.mask_address(coalesce(nullif(s.address, ''), b.address)),
          'phone', '010-••••-••••',
          'distance_km', case when w.lat is not null and coalesce(s.lat, b.lat) is not null
                              then round(ish.distance_km(w.lat, w.lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng))::numeric, 1) end
        ) as card
      from ish.job_offers o
      join ish.shifts s on s.id = o.shift_id
      join ish.businesses b on b.id = s.business_id
      left join ish.worker_profiles w on w.user_id = o.worker_id
      where o.worker_id = v_uid and o.status in ('sent', 'expired', 'closed')
        and (o.status = 'sent' or o.created_at > now() - interval '2 days')
    ) t
  ), '[]'::jsonb);
end
$$;

-- One opened job as «Mening ishlarim» shows it: the phone and the address.
create function ish.my_job_card(p_application uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'application_id', a.id, 'shift_id', s.id, 'title', s.title, 'translations', s.translations,
    'pay', ish.job_pay(s), 'hourly_wage', s.hourly_wage, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'phone', coalesce(nullif(c.phone, ''), p.phone, ''),
    'address', btrim(concat_ws(', ', nullif(coalesce(nullif(s.address, ''), b.address), ''), nullif(b.address_detail, ''))),
    'lat', coalesce(s.lat, b.lat), 'lng', coalesce(s.lng, b.lng),
    'business', b.name, 'step', a.worker_step, 'price', a.coins_paid, 'opened_at', a.created_at,
    'stars', (select r.stars from ish.ratings r where r.application_id = a.id and r.direction = 'worker_to_business'),
    'distance_km', case when w.lat is not null and coalesce(s.lat, b.lat) is not null
                        then round(ish.distance_km(w.lat, w.lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng))::numeric, 1) end)
  from ish.applications a
  join ish.shifts s on s.id = a.shift_id
  join ish.businesses b on b.id = s.business_id
  left join ish.business_contacts c on c.business_id = b.id
  left join ish.profiles p on p.id = b.owner_id
  left join ish.worker_profiles w on w.user_id = a.worker_id
  where a.id = p_application
$$;

-- «Telefon va manzilni ochish»: the price is taken, the job is the worker's.
-- OFFER_EXPIRED after 30 minutes; SHIFT_FULL when the others were faster;
-- NO_COINS without enough puyl. Opening again returns the same card, free.
create function ish.unlock_offer(p_shift uuid)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_offer ish.job_offers;
  v_shift ish.shifts;
  v_app ish.applications;
  v_price int;
begin
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));
  select * into v_shift from ish.shifts where id = p_shift for update;
  select * into v_offer from ish.job_offers where shift_id = p_shift and worker_id = v_uid for update;
  if v_offer.id is null or v_shift.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_offer.status = 'applied' then
    select * into v_app from ish.applications
    where shift_id = p_shift and worker_id = v_uid and status not in ('cancelled', 'rejected')
    order by created_at desc limit 1;
    if v_app.id is not null then
      return ish.my_job_card(v_app.id);
    end if;
  end if;
  if v_offer.status <> 'sent' or v_offer.expires_at <= now() then
    raise exception 'OFFER_EXPIRED';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    update ish.job_offers set status = 'closed' where id = v_offer.id;
    raise exception 'SHIFT_FULL';
  end if;
  if exists (
    select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid and a.status in ('pending', 'confirmed', 'checked_in')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) then
    raise exception 'TIME_CONFLICT';
  end if;

  v_price := ish.unlock_price(ish.job_pay(v_shift));
  insert into ish.applications (shift_id, worker_id, status, decided_at, coins_paid)
  values (p_shift, v_uid, 'confirmed', now(), v_price)
  returning * into v_app;
  perform ish.coin_move(v_uid, -v_price, 'unlock', v_app.id, null, '');
  update ish.job_offers set status = 'applied', responded_at = now() where id = v_offer.id;
  -- Full now: the job closes for the others still waiting.
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    update ish.job_offers set status = 'closed'
    where shift_id = p_shift and status = 'sent' and id <> v_offer.id;
  end if;
  return ish.my_job_card(v_app.id);
end
$$;

-- «Mening ishlarim»: the jobs the worker opened, newest first.
create function ish.my_jobs()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select coalesce(jsonb_agg(ish.my_job_card(a.id) order by a.created_at desc), '[]'::jsonb)
  from ish.applications a
  where a.worker_id = auth.uid() and a.coins_paid > 0 and a.status not in ('cancelled', 'rejected')
$$;

-- The worker's own step: 0 opened, 1 called, 2 went to work.
create function ish.set_job_step(p_application uuid, p_step int)
returns int
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_uid();
  if p_step is null or p_step not between 0 and 2 then
    raise exception 'INVALID';
  end if;
  update ish.applications set worker_step = p_step
  where id = p_application and worker_id = auth.uid() and coins_paid > 0;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return p_step;
end
$$;

-- «Ish beruvchini baholang»: after «Ishga chiqdim».
create function ish.rate_job(p_application uuid, p_stars int)
returns int
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_uid();
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'INVALID';
  end if;
  if not exists (select 1 from ish.applications
                 where id = p_application and worker_id = auth.uid() and coins_paid > 0 and worker_step = 2) then
    raise exception 'NOT_FOUND';
  end if;
  insert into ish.ratings (application_id, direction, rater_id, stars, tags)
  values (p_application, 'worker_to_business', auth.uid(), p_stars, '{}')
  on conflict (application_id, direction) do update set stars = excluded.stars, created_at = now();
  return p_stars;
end
$$;

-- Every minute: offers past their 30 minutes expire; 5 minutes before the
-- end the worker is reminded once (a push with the offer).
create function ish.offers_tick()
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int;
begin
  with due as (
    update ish.job_offers set reminded_at = now()
    where status = 'sent' and reminded_at is null
      and expires_at > now() and expires_at <= now() + interval '5 minutes'
    returning id, worker_id, shift_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'job_offer', jsonb_build_object('offer_id', id, 'shift_id', shift_id, 'reminder', true)
  from due;
  get diagnostics v_count = row_count;
  update ish.job_offers set status = 'expired', responded_at = now()
  where status = 'sent' and expires_at <= now();
  return v_count;
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ish-offers', '* * * * *', 'select ish.offers_tick()');
  end if;
end
$$;

revoke execute on function ish.job_pay(ish.shifts) from public, anon;
revoke execute on function ish.unlock_price(int) from public, anon;
revoke execute on function ish.mask_address(text) from public, anon;
revoke execute on function ish.staff_job_details(uuid, int, boolean) from public, anon;
revoke execute on function ish.my_offers() from public, anon;
revoke execute on function ish.my_job_card(uuid) from public, anon, authenticated;
revoke execute on function ish.unlock_offer(uuid) from public, anon;
revoke execute on function ish.my_jobs() from public, anon;
revoke execute on function ish.set_job_step(uuid, int) from public, anon;
revoke execute on function ish.rate_job(uuid, int) from public, anon;
revoke execute on function ish.offers_tick() from public, anon, authenticated;
grant execute on function ish.job_pay(ish.shifts), ish.unlock_price(int), ish.mask_address(text) to authenticated;
grant execute on function ish.staff_job_details(uuid, int, boolean), ish.my_offers(), ish.unlock_offer(uuid),
  ish.my_jobs(), ish.set_job_step(uuid, int), ish.rate_job(uuid, int) to authenticated;

-- CRM: the job page also shows what it pays in all, its price in puyl, when
-- the employer was last called, and each offer's end and the worker's puyl.
create or replace function ish.staff_shift(p_shift uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  if not exists (select 1 from ish.shifts where id = p_shift) then
    raise exception 'NOT_FOUND';
  end if;
  return (
    select ish.shift_card(s.id) || jsonb_build_object(
      'invite_only', s.invite_only,
      'managed', b.managed_by_staff,
      'business_id', b.id,
      'total_pay', s.total_pay,
      'job_pay', ish.job_pay(s),
      'unlock_price', ish.unlock_price(ish.job_pay(s)),
      'checked_at', s.checked_at,
      'contact', (select jsonb_build_object('contact_name', c.contact_name, 'phone', c.phone,
                                            'telegram', c.telegram, 'source', c.source, 'notes', c.notes)
                  from ish.business_contacts c where c.business_id = b.id),
      'notes', (select jsonb_build_object('source', n.source, 'notes', n.notes)
                from ish.shift_notes n where n.shift_id = s.id),
      'offers', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', o.id,
                 'status', case when o.status = 'sent' and o.expires_at <= now() then 'expired' else o.status end,
                 'note', o.note, 'created_at', o.created_at, 'expires_at', o.expires_at,
                 'responded_at', o.responded_at,
                 'worker', ish.staff_worker_card(o.worker_id))
               order by o.created_at, o.id)
        from ish.job_offers o where o.shift_id = s.id), '[]'::jsonb),
      'applications', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', a.id, 'status', a.status, 'created_at', a.created_at, 'decided_at', a.decided_at,
                 'check_in_at', a.check_in_at, 'check_out_at', a.check_out_at,
                 'worked_minutes', a.worked_minutes, 'pay_amount', a.pay_amount, 'paid_at', a.paid_at,
                 'coins_paid', a.coins_paid, 'worker_step', a.worker_step,
                 'worker', ish.staff_worker_card(a.worker_id))
               order by a.created_at, a.id)
        from ish.applications a where a.shift_id = s.id), '[]'::jsonb))
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift
  );
end
$$;

-- A worker as the CRM shows them, with their puyl now.
create or replace function ish.staff_worker_card(p_worker uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'phone', p.phone,
    'avatar_path', p.avatar_path, 'language', p.language,
    'languages', w.languages, 'topik', w.topik, 'university', w.university, 'district', w.district,
    'visa', w.visa, 'reliability', w.reliability, 'onboarded', w.onboarded_at is not null,
    'completed', (select count(*) from ish.applications a
                  where a.worker_id = p.id and a.status = 'completed'),
    'no_shows', (select count(*) from ish.applications a
                 where a.worker_id = p.id and a.status = 'no_show'),
    'coins', coalesce((select c.balance from ish.coin_wallets c where c.worker_id = p.id), 0))
  from ish.profiles p
  left join ish.worker_profiles w on w.user_id = p.id
  where p.id = p_worker
$$;
