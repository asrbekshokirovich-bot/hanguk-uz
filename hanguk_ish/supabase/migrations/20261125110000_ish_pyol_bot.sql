-- Hanguk Ish: buying puyl through the Telegram bot (2026-11-25).
--
-- The app shows no payment details (store rules). A worker writes to the
-- bot (functions/ish-pyol-bot): their phone or invite code, a pack, then a
-- screenshot of the transfer. The bot files an ordinary top-up request
-- (source 'telegram', the screenshot in the private bucket
-- ish-topup-proofs); the staff check the money and approve it in the CRM as
-- before, and the app says «+100 puyl». Only the bot (service role) calls
-- the bot_* functions.

alter table ish.topup_requests add column source text not null default 'app'
  check (source in ('app', 'telegram'));
alter table ish.topup_requests add column proof_path text check (char_length(proof_path) <= 200);

-- Who is writing from which chat, and the pack they chose.
create table ish.bot_chats (
  chat_id bigint primary key,
  worker_id uuid references ish.profiles (id) on delete cascade,
  pyols integer,
  lang text not null default 'uz' check (lang in ('uz', 'ru', 'en', 'ko')),
  updated_at timestamptz not null default now()
);
alter table ish.bot_chats enable row level security;
revoke all on ish.bot_chats from public, anon, authenticated;

-- The worker for a phone number (as typed: 010-1234-5678, +82 10 …) or an
-- invite code; null when none. Only onboarded workers.
create or replace function ish.bot_find_worker(p_text text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_digits text := regexp_replace(coalesce(p_text, ''), '\D', '', 'g');
  v_code text := upper(btrim(coalesce(p_text, '')));
  v_id uuid;
begin
  if v_digits like '010%' then
    v_digits := '82' || substr(v_digits, 2);
  end if;
  select w.user_id into v_id
  from ish.worker_profiles w join ish.profiles p on p.id = w.user_id
  where w.onboarded_at is not null
    and ((char_length(v_digits) >= 11 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_digits)
         or (v_code ~ '^[A-Z0-9]{6}$' and w.referral_code = v_code))
  limit 1;
  if v_id is null then
    return null;
  end if;
  return (select jsonb_build_object(
    'worker_id', p.id,
    -- Only the first name and the last name's first letter: a code alone
    -- must not reveal who someone is.
    'name', btrim(coalesce(p.first_name, '') || ' ' || left(coalesce(p.last_name, ''), 1)
                  || case when coalesce(p.last_name, '') <> '' then '.' else '' end),
    'balance', coalesce((select balance from ish.coin_wallets where worker_id = p.id), 0))
    from ish.profiles p where p.id = v_id);
end
$$;
revoke execute on function ish.bot_find_worker(text) from public, anon, authenticated;

-- What the bot shows: the packs and where to send the money (as in the CRM).
create or replace function ish.bot_payment_details()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'packs', ish.pyol_packs(),
    'methods', coalesce((select jsonb_object_agg(s.key, s.value) from ish.payment_settings s
                         where btrim(s.value) <> ''), '{}'::jsonb))
$$;
revoke execute on function ish.bot_payment_details() from public, anon, authenticated;

-- A top-up request from the bot, with the screenshot.
create or replace function ish.bot_request_topup(p_worker uuid, p_pyols integer, p_payer text, p_proof text)
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_won int;
  v_id uuid;
begin
  if not exists (select 1 from ish.worker_profiles where user_id = p_worker and onboarded_at is not null) then
    raise exception 'NOT_FOUND';
  end if;
  select (p ->> 'won')::int into v_won
  from jsonb_array_elements(ish.pyol_packs()) p where (p ->> 'pyols')::int = p_pyols;
  if v_won is null then
    raise exception 'INVALID';
  end if;
  if (select count(*) from ish.topup_requests where worker_id = p_worker and status = 'pending') >= 3 then
    raise exception 'TOO_MANY';
  end if;
  insert into ish.topup_requests (worker_id, pyols, amount_won, method, payer_name, source, proof_path)
  values (p_worker, p_pyols, v_won, 'bank', left(btrim(coalesce(p_payer, '')), 100), 'telegram',
          nullif(left(coalesce(p_proof, ''), 200), ''))
  returning id into v_id;
  return v_id;
end
$$;
revoke execute on function ish.bot_request_topup(uuid, integer, text, text) from public, anon, authenticated;

-- The CRM list shows where a request came from and its screenshot.
create or replace function ish.staff_topups(p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'worker_id', t.worker_id, 'first_name', p.first_name, 'last_name', p.last_name,
      'phone', p.phone, 'pyols', t.pyols, 'amount_won', t.amount_won, 'method', t.method,
      'payer_name', t.payer_name, 'status', t.status, 'note', t.note,
      'source', t.source, 'proof_path', t.proof_path,
      'created_at', t.created_at, 'decided_at', t.decided_at) order by t.created_at desc)
    from (select * from ish.topup_requests
          where p_status is null or status = p_status
          order by created_at desc limit 300) t
    join ish.profiles p on p.id = t.worker_id), '[]'::jsonb);
end
$$;

-- The screenshots: private; the staff may look at them.
do $$
begin
  if to_regclass('storage.objects') is not null and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name) values ('ish-topup-proofs', 'ish-topup-proofs') on conflict (id) do nothing;
    execute $p$create policy ish_topup_proofs_staff_read on storage.objects for select to authenticated
      using (bucket_id = 'ish-topup-proofs' and ish.is_staff())$p$;
  end if;
end
$$;
