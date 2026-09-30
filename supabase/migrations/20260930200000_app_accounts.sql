-- Sign-up in the Hanguk app: phone number and password.
--
-- The owner's rule (2026-09-30): the app opens on a language choice, then a
-- sign-up screen (Uzbek phone number, password, password again). Signing up
-- is required before the Welcome screen; a returning person signs in with the
-- same phone and password. There is no SMS check.
--
--   * public.app_accounts holds each app account: the +998 number, a bcrypt
--     hash of the password, and the lead it became. Nothing reads it directly;
--     only the two functions below touch it.
--   * public.app_register(phone, password):
--       - a number that belongs to a student (who signs in with a Magic Code)
--         is sent to the Magic Code screen — no account, no lead;
--       - a number already signed up is sent to sign-in;
--       - otherwise the account is created and the person lands in the CRM:
--         a new lead "Ilova: +998 …" in "Yangi lid" (10-minute countdown and
--         alerts, as for Instagram/Telegram), or, when the number is already a
--         lead, that lead is marked "Ilovadan ro'yxatdan o'tdi". An old lead
--         nobody has answered goes back to "Yangi lid"; one already answered
--         or rejected keeps its result and shows in "Bugungi lidlar".
--   * public.app_login(phone, password) checks the password. Ten wrong
--     passwords in a row lock the number for 15 minutes.

create table if not exists public.app_accounts (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique,
  password_hash   text not null,
  lead_id         uuid references public.leads (id) on delete set null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

alter table public.app_accounts enable row level security;
revoke all on table public.app_accounts from anon, authenticated;

-- The 9-digit national numbers written in a phone field. CRM fields hold every
-- shape ("90 123 45 67", "+998901234567", "901234567/911234567", and two
-- numbers run together), so each part is reduced to its last nine digits.
create or replace function public.fn_phone_keys(p_text text)
returns text[]
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select coalesce(array_agg(k) filter (where k is not null), '{}')
  from (
    select case when length(d) >= 9 then right(d, 9) end as k
    from (
      select regexp_replace(part, '\D', '', 'g') as d
      from regexp_split_to_table(coalesce(p_text, ''), '[/,;|]') as part
    ) digits
    where length(d) <> 18
    union all
    select h
    from (
      select regexp_replace(part, '\D', '', 'g') as d
      from regexp_split_to_table(coalesce(p_text, ''), '[/,;|]') as part
    ) digits,
    lateral (values (left(d, 9)), (right(d, 9))) as halves(h)
    where length(d) = 18
  ) keys
$$;

-- "901234567" from what the app sends ("+998901234567", "998 90 123 45 67",
-- "90 123 45 67"); null for anything that is not an Uzbek mobile number.
create or replace function public.fn_uz_national_phone(p_phone text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case
    when d ~ '^998[0-9]{9}$' then right(d, 9)
    when d ~ '^[0-9]{9}$' then d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x
$$;

-- True when the number belongs to a student who signs in with a Magic Code.
create or replace function public.fn_is_student_phone(p_national text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
    select 1 from public.profiles p
     where p.magic_code is not null
       and (p_national = any (public.fn_phone_keys(p.phone))
            or p_national = any (public.fn_phone_keys(p.additional_phone)))
  ) or exists (
    select 1 from public.student_phones sp
      join public.profiles p on p.id = sp.student_id
     where p.magic_code is not null
       and (p_national = any (public.fn_phone_keys(sp.phone_norm))
            or p_national = any (public.fn_phone_keys(sp.phone)))
  )
$$;

create or replace function public.app_register(p_phone text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $$
declare
  v_national text := public.fn_uz_national_phone(p_phone);
  v_phone    text;
  v_pretty   text;
  v_lead     public.leads%rowtype;
  v_lead_id  uuid;
  v_note     text;
begin
  if v_national is null then
    return jsonb_build_object('status', 'invalid_phone');
  end if;
  if length(coalesce(p_password, '')) < 6 or length(p_password) > 72 then
    return jsonb_build_object('status', 'weak_password');
  end if;

  v_phone := '+998' || v_national;
  v_pretty := '+998 ' || substr(v_national, 1, 2) || ' ' || substr(v_national, 3, 3)
           || ' ' || substr(v_national, 6, 2) || ' ' || substr(v_national, 8, 2);

  if public.fn_is_student_phone(v_national) then
    return jsonb_build_object('status', 'student');
  end if;

  if exists (select 1 from public.app_accounts a where a.phone = v_phone) then
    return jsonb_build_object('status', 'exists');
  end if;

  -- The latest lead with this number, if any.
  select l.* into v_lead
    from public.leads l
   where v_national = any (public.fn_phone_keys(l.phone))
   order by l.updated_at desc
   limit 1;

  v_note := 'Ilovadan ro''yxatdan o''tdi: '
         || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI');

  if v_lead.id is not null then
    update public.leads l
       set notes = concat_ws(E'\n', nullif(trim(l.notes), ''), v_note),
           new_lead_at = now(),
           sla_start_at = public.fn_lead_sla_start(now()),
           sla_alerted_at = null,
           -- Answered long ago is not "answered within 30 seconds": keep the
           -- quick-exit watchdog (fn_lead_quick_contact_scan) off this lead.
           quick_contact_alerted_at = case when l.last_contacted_at is not null then now() end,
           updated_at = now()
     where l.id = v_lead.id;
    v_lead_id := v_lead.id;
  else
    insert into public.leads (full_name, phone, source, status, contact_channel, notes,
                              new_lead_at, sla_start_at)
    values ('Ilova: ' || v_pretty, v_phone, 'app', 'new', 'Ilova', v_note,
            now(), public.fn_lead_sla_start(now()))
    returning id into v_lead_id;
  end if;

  insert into public.app_accounts (phone, password_hash, lead_id)
  values (v_phone, crypt(p_password, gen_salt('bf')), v_lead_id);

  return jsonb_build_object('status', 'ok', 'phone', v_phone);
exception
  when unique_violation then
    -- Two sign-ups of the same number at once: the first one won.
    return jsonb_build_object('status', 'exists');
end;
$$;

create or replace function public.app_login(p_phone text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $$
declare
  v_national text := public.fn_uz_national_phone(p_phone);
  v_account  public.app_accounts%rowtype;
begin
  if v_national is null then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  select * into v_account from public.app_accounts a where a.phone = '+998' || v_national;

  if v_account.id is null then
    if public.fn_is_student_phone(v_national) then
      return jsonb_build_object('status', 'student');
    end if;
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_account.locked_until is not null and v_account.locked_until > now() then
    return jsonb_build_object('status', 'locked');
  end if;

  if v_account.password_hash <> crypt(coalesce(p_password, ''), v_account.password_hash) then
    update public.app_accounts
       set failed_attempts = case when failed_attempts + 1 >= 10 then 0 else failed_attempts + 1 end,
           locked_until = case when failed_attempts + 1 >= 10 then now() + interval '15 minutes' end
     where id = v_account.id;
    return jsonb_build_object('status', 'wrong_password');
  end if;

  update public.app_accounts
     set failed_attempts = 0, locked_until = null, last_login_at = now()
   where id = v_account.id;

  return jsonb_build_object('status', 'ok', 'phone', v_account.phone);
end;
$$;

revoke all on function public.fn_is_student_phone(text) from public, anon, authenticated;
revoke all on function public.app_register(text, text) from public;
revoke all on function public.app_login(text, text) from public;
grant execute on function public.app_register(text, text) to anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;
