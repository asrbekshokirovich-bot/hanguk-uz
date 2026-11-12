-- The site's "Ro'yxatdan o'tish" form (guest-auth) kept each guest's password
-- in leads.password exactly as it was typed. 16 leads had one on 2026-11-12.
-- The CRM reads leads with `select *`, so those passwords went to the browser
-- of everyone on the staff who opened «Lidlar», and sat in every export and
-- backup of the table.
--
-- A password belongs nowhere a person can read it:
--   * lead_credentials holds a bcrypt hash per lead. Row-level security is on
--     and there is no policy: only server code (the service role) reaches it.
--   * fn_guest_set_password / fn_guest_check_password are the only way in.
--     Checking counts wrong guesses: five in a row lock the account for 15
--     minutes, and after that every further wrong guess locks it again.
--   * The passwords typed so far are hashed into the new table and erased
--     from leads. The column stays (older function versions still name it)
--     and is empty from here on.

create table if not exists public.lead_credentials (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.lead_credentials is
  'bcrypt hashes of the passwords guests set on the site (guest-auth). Server code only: RLS on, no policies.';

alter table public.lead_credentials enable row level security;
revoke all on table public.lead_credentials from public, anon, authenticated;
grant select, insert, update, delete on table public.lead_credentials to service_role;

create or replace function public.fn_guest_set_password(p_lead_id uuid, p_password text)
returns void
language sql
security definer
set search_path to 'public', 'extensions', 'pg_catalog'
as $$
  insert into public.lead_credentials (lead_id, password_hash)
  values (p_lead_id, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  on conflict (lead_id) do update
     set password_hash = excluded.password_hash,
         failed_attempts = 0,
         locked_until = null,
         updated_at = now();
$$;

-- 'ok' | 'wrong' | 'locked' | 'none' (the lead has no password here).
create or replace function public.fn_guest_check_password(p_lead_id uuid, p_password text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_catalog'
as $$
declare
  c public.lead_credentials%rowtype;
begin
  select * into c from public.lead_credentials where lead_id = p_lead_id for update;
  if not found then
    return 'none';
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    return 'locked';
  end if;
  if c.password_hash = extensions.crypt(p_password, c.password_hash) then
    update public.lead_credentials
       set failed_attempts = 0, locked_until = null
     where lead_id = p_lead_id;
    return 'ok';
  end if;
  update public.lead_credentials
     set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
   where lead_id = p_lead_id;
  return 'wrong';
end;
$$;

revoke all on function public.fn_guest_set_password(uuid, text) from public, anon, authenticated;
revoke all on function public.fn_guest_check_password(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_guest_set_password(uuid, text) to service_role;
grant execute on function public.fn_guest_check_password(uuid, text) to service_role;

-- What was typed so far: hash it, then forget it.
insert into public.lead_credentials (lead_id, password_hash)
select l.id, extensions.crypt(l.password, extensions.gen_salt('bf', 10))
  from public.leads l
 where coalesce(l.password, '') <> ''
on conflict (lead_id) do nothing;

update public.leads
   set password = null
 where password is not null;
