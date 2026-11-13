-- Hanguk Ish — the staff list kept in the CRM (P58, 2026-11-13).
--
-- A person became Hanguk Ish staff only by SQL (hanguk_ish/README.md,
-- «Xodimlar»): ish.profiles, then ish.staff_members. Now a Hanguk Ish staff
-- admin (staff_members.role = 'admin' — Asrbek) adds, removes and sets the
-- role of the staff in CRM → Hanguk Ish → «Xodimlar». Who becomes staff
-- stays the admin's call; the database only keeps it to hanguk.uz's own CRM
-- accounts (public.user_roles: owner, admin, call_operator,
-- document_handler, university_staff) — never a student, an investor or a
-- Hanguk Ish app account. Nobody removes or demotes themselves, so an admin
-- is always left to put things right.

create function ish.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (select 1 from ish.staff_members where user_id = auth.uid() and role = 'admin')
$$;

-- The caller, who must be a staff admin.
create function ish.require_staff_admin()
returns uuid
language plpgsql
stable
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
begin
  if not ish.is_staff_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return v_uid;
end
$$;

-- hanguk.uz's CRM accounts (a staff role in public.user_roles), with the name
-- and e-mail the CRM knows them by. None where hanguk.uz is not there (the
-- Supabase stack of the tests).
create function ish.crm_staff_accounts()
returns table (user_id uuid, full_name text, email text, roles text[])
language plpgsql
stable
security definer
set search_path = ish, pg_catalog
as $$
begin
  if to_regclass('public.user_roles') is null or to_regclass('public.profiles') is null then
    return;
  end if;
  return query execute $q$
    select r.user_id, nullif(btrim(max(p.full_name)), ''), max(u.email)::text,
           array_agg(distinct r.role::text order by r.role::text)
    from public.user_roles r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.user_id = r.user_id
    where r.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
    group by r.user_id
  $q$;
end
$$;

-- CRM → «Xodimlar»: Hanguk Ish's staff (admins first), and the CRM accounts
-- that could be added.
create function ish.staff_people()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff_admin();
begin
  return jsonb_build_object(
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.user_id, 'role', s.role, 'added_at', s.created_at,
               'name', coalesce(c.full_name, nullif(btrim(p.first_name || ' ' || p.last_name), '')),
               'email', coalesce(c.email, u.email::text),
               'me', s.user_id = v_uid)
             order by s.role = 'admin' desc, s.created_at, s.user_id)
      from ish.staff_members s
      join ish.profiles p on p.id = s.user_id
      left join auth.users u on u.id = s.user_id
      left join ish.crm_staff_accounts() c on c.user_id = s.user_id
    ), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.user_id, 'name', c.full_name, 'email', c.email, 'roles', c.roles)
             order by c.full_name nulls last, c.email)
      from ish.crm_staff_accounts() c
      where not exists (select 1 from ish.staff_members s where s.user_id = c.user_id)
    ), '[]'::jsonb));
end
$$;

-- Adds a CRM account to Hanguk Ish's staff (its ish profile too, named as
-- in the CRM). Already staff: only the role changes.
create function ish.staff_add(p_user uuid, p_role text default 'operator')
returns text
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff_admin();
  v_name text;
  v_first text;
begin
  if p_role is null or p_role not in ('operator', 'admin') then
    raise exception 'INVALID';
  end if;
  if p_user = v_uid then
    raise exception 'SELF';
  end if;
  select c.full_name into v_name from ish.crm_staff_accounts() c where c.user_id = p_user;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  v_name := coalesce(v_name, '');
  v_first := split_part(v_name, ' ', 1);
  insert into ish.profiles (id, first_name, last_name)
  values (p_user, left(v_first, 60), left(btrim(substr(v_name, char_length(v_first) + 1)), 60))
  on conflict (id) do nothing;
  insert into ish.staff_members (user_id, role) values (p_user, p_role)
  on conflict (user_id) do update set role = excluded.role;
  return p_role;
end
$$;

create function ish.staff_set_role(p_user uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff_admin();
begin
  if p_role is null or p_role not in ('operator', 'admin') then
    raise exception 'INVALID';
  end if;
  if p_user = v_uid then
    raise exception 'SELF';
  end if;
  update ish.staff_members set role = p_role where user_id = p_user;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return p_role;
end
$$;

-- Off the staff list: the CRM section closes for them. Their ish profile and
-- what they made (the employers and jobs the staff keep together) stay.
create function ish.staff_remove(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff_admin();
begin
  if p_user = v_uid then
    raise exception 'SELF';
  end if;
  delete from ish.staff_members where user_id = p_user;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;

revoke execute on function ish.is_staff_admin(), ish.staff_people(), ish.staff_add(uuid, text),
  ish.staff_set_role(uuid, text), ish.staff_remove(uuid)
  from public, anon;
grant execute on function ish.is_staff_admin(), ish.staff_people(), ish.staff_add(uuid, text),
  ish.staff_set_role(uuid, text), ish.staff_remove(uuid)
  to authenticated;
revoke execute on function ish.require_staff_admin(), ish.crm_staff_accounts() from public, anon, authenticated;
