-- State for telegram-poll: the company Telegram account read from inside
-- Supabase, with no bot and no server of our own.
--
-- telegram-poll logs in as the account (MTProto, the same session the
-- Railway userbot used) once a minute, asks Telegram for everything that
-- happened since the last run (updates.getDifference) and hands it to
-- telegram-ingest. Two things have to survive between those runs:
--
--   * where the last run stopped (pts/qts/date/seq), so the next one asks for
--     exactly what is new — nothing lost across a gap, nothing twice;
--   * a lease, so a run that is slow never overlaps the next minute's run on
--     the same session.
--
-- telegram_peer_cache keeps each chat's access_hash. MTProto cannot address a
-- user by id alone, and a session restored every minute starts with an empty
-- cache, so without this a CRM reply to anyone not seen in the current run
-- would need the whole dialog list pulled first.

create table if not exists public.telegram_poll_state (
  account_label text primary key,
  pts           integer,
  qts           integer,
  date          integer,
  seq           integer,
  lease_until   timestamptz,
  last_run_at   timestamptz,
  last_error    text,
  updated_at    timestamptz not null default now()
);

create table if not exists public.telegram_peer_cache (
  account_label text not null,
  peer_id       text not null,
  access_hash   text not null,
  updated_at    timestamptz not null default now(),
  primary key (account_label, peer_id)
);

-- Service role only: nothing in the CRM reads these.
alter table public.telegram_poll_state enable row level security;
alter table public.telegram_peer_cache enable row level security;

-- Take the lease if nobody holds it; returns the saved position, or nothing
-- when a previous run is still going.
create or replace function public.telegram_poll_acquire(p_label text, p_lease_seconds integer)
returns table (pts integer, qts integer, date integer, seq integer)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.telegram_poll_state (account_label)
  values (p_label)
  on conflict (account_label) do nothing;

  return query
  update public.telegram_poll_state s
     set lease_until = now() + make_interval(secs => p_lease_seconds),
         last_run_at = now(),
         updated_at  = now()
   where s.account_label = p_label
     and (s.lease_until is null or s.lease_until < now())
  returning s.pts, s.qts, s.date, s.seq;
end;
$$;

-- Remember where Telegram's update stream is up to.
create or replace function public.telegram_poll_save(
  p_label text, p_pts integer, p_qts integer, p_date integer, p_seq integer
)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.telegram_poll_state
     set pts = p_pts, qts = p_qts, date = p_date, seq = p_seq,
         last_error = null, updated_at = now()
   where account_label = p_label;
$$;

-- Hand the lease back, recording why the run ended badly if it did.
create or replace function public.telegram_poll_release(p_label text, p_error text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.telegram_poll_state
     set lease_until = null,
         last_error  = coalesce(p_error, last_error),
         updated_at  = now()
   where account_label = p_label;
$$;

revoke all on function public.telegram_poll_acquire(text, integer) from public, anon, authenticated;
revoke all on function public.telegram_poll_save(text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.telegram_poll_release(text, text) from public, anon, authenticated;
