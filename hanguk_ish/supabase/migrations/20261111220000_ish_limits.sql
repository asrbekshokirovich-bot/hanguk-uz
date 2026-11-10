-- Hanguk Ish — limits against misuse (P14, 2026-11-11).
--
-- Generous for a person, tight for a script. A refused call raises
-- TOO_MANY_REQUESTS, which both apps explain («시도가 너무 많아요…»,
-- «Urinishlar juda ko'p…»). Only calls made by a signed-in person count:
-- the server's own jobs and the service role have no auth.uid().
--
--   * chat: 20 messages a minute, 300 a day per sender;
--   * shifts: 30 applications a day per worker, 3 to the same shift (taking
--     and cancelling it over and over would tell the owner each time);
--   * «다시 요청»: one invitation per worker and shift (more would be noise);
--   * reports (A11): 10 a day;
--   * business registration (BA0, 국세청 lookups): 10 tries an hour, counted
--     by the business-register edge function.

create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index applications_worker_created_idx on public.applications (worker_id, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

create function public.messages_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20
     or (select count(*) from public.messages
         where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 300 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger messages_limit before insert on public.messages
  for each row execute function public.messages_limit();

create function public.applications_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (select count(*) from public.applications
      where worker_id = new.worker_id and created_at > now() - interval '1 day') >= 30
     or (select count(*) from public.applications
         where worker_id = new.worker_id and shift_id = new.shift_id) >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger applications_limit before insert on public.applications
  for each row execute function public.applications_limit();

create function public.reports_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (select count(*) from public.reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger reports_limit before insert on public.reports
  for each row execute function public.reports_limit();

revoke execute on function public.messages_limit() from public, anon, authenticated;
revoke execute on function public.applications_limit() from public, anon, authenticated;
revoke execute on function public.reports_limit() from public, anon, authenticated;

-- «다시 요청» once per worker and shift: a second press tells nobody again.
create or replace function public.request_again(p_shift uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.shifts;
begin
  perform public.require_uid();
  select * into v_shift from public.shifts where id = p_shift;
  if not found or not public.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if not exists (
    select 1 from public.applications a join public.shifts s on s.id = a.shift_id
    where s.business_id = v_shift.business_id and a.worker_id = p_worker and a.status = 'completed'
  ) then
    raise exception 'NOT_FOUND';
  end if;
  if exists (
    select 1 from public.notifications n
    where n.user_id = p_worker and n.kind = 'request_again' and n.data ->> 'shift_id' = p_shift::text
  ) then
    return;
  end if;
  perform public.notify(p_worker, 'request_again',
    jsonb_build_object('shift_id', p_shift, 'business_id', v_shift.business_id));
end
$$;

-- BA0 tries, written and read only by the business-register edge function
-- (service role): no policy, no grant.
create table public.business_register_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  biz_no text not null check (biz_no ~ '^[0-9]{10}$'),
  created_at timestamptz not null default now()
);

create index business_register_attempts_user_idx on public.business_register_attempts (user_id, created_at desc);

alter table public.business_register_attempts enable row level security;
revoke all on public.business_register_attempts from anon, authenticated;
