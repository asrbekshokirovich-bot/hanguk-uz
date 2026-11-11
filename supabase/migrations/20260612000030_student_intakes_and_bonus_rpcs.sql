-- Season membership as an explicit, role-independent fact + server-side bonus helpers.
-- Forward-only and additive: no existing column, policy, or row is dropped or altered.
--
-- Why: student "membership" in a season was previously re-derived on every screen
-- from applications ∪ documents ∪ payments. Those tables have different per-role RLS
-- (e.g. call_operator cannot read `documents`), so the derived roster differed by
-- account, and record-less students vanished entirely. `student_intakes` makes the
-- roster a single, role-independent source of truth.

-- 1) student <-> intake membership (multi-season: a student may belong to several)
create table if not exists public.student_intakes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,                 -- = profiles.user_id
  intake_id uuid not null references public.intakes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, intake_id)
);
comment on table public.student_intakes is 'Which admission intake(s) a student belongs to. Single source of truth for the per-season roster.';
create index if not exists student_intakes_intake_idx on public.student_intakes (intake_id);
create index if not exists student_intakes_student_idx on public.student_intakes (student_id);

alter table public.student_intakes enable row level security;

-- Any staff member (has a row in user_roles) sees the whole roster; a student sees their own.
drop policy if exists "student_intakes_select" on public.student_intakes;
create policy "student_intakes_select" on public.student_intakes
  for select to authenticated
  using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid())
    or auth.uid() = student_id
  );

-- Staff can manage membership.
drop policy if exists "student_intakes_write" on public.student_intakes;
create policy "student_intakes_write" on public.student_intakes
  for all to authenticated
  using (
    has_role(auth.uid(), 'owner'::app_role) or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'call_operator'::app_role) or has_role(auth.uid(), 'document_handler'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role) or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'call_operator'::app_role) or has_role(auth.uid(), 'document_handler'::app_role)
  );

-- 2) Backfill membership from existing season-stamped records ...
insert into public.student_intakes (student_id, intake_id)
select distinct student_id, intake_id
from (
  select student_id, intake_id from public.applications where student_id is not null and intake_id is not null
  union
  select student_id, intake_id from public.documents     where student_id is not null and intake_id is not null
  union
  select student_id, intake_id from public.payments      where student_id is not null and intake_id is not null
) u
on conflict (student_id, intake_id) do nothing;

-- ... and recover record-less (orphan) students into the current default intake so they reappear.
insert into public.student_intakes (student_id, intake_id)
select p.user_id, (select id from public.intakes where is_default order by year desc limit 1)
from public.profiles p
where not exists (select 1 from public.user_roles ur where ur.user_id = p.user_id)        -- non-staff only
  and not exists (select 1 from public.student_intakes si where si.student_id = p.user_id) -- no membership yet
  and exists (select 1 from public.intakes where is_default)
on conflict (student_id, intake_id) do nothing;

-- 3) Self-healing: any season-stamped record auto-enrolls its student into that season,
--    so creating an application/document/payment for a student carries them into the season.
create or replace function public.ensure_student_intake()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_id is not null and new.intake_id is not null then
    insert into public.student_intakes (student_id, intake_id)
    values (new.student_id, new.intake_id)
    on conflict (student_id, intake_id) do nothing;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['applications','documents','payments'] loop
    execute format('drop trigger if exists trg_ensure_student_intake on public.%I', t);
    execute format('create trigger trg_ensure_student_intake after insert on public.%I for each row execute function public.ensure_student_intake()', t);
  end loop;
end $$;

-- 4) Server-side bonus helpers. `staff_bonuses` stays owner-only at the table level
--    (the security-hardening intent); these SECURITY DEFINER functions let any staff
--    member record/read a bonus without widening direct table access.
create or replace function public.record_staff_bonus(
  p_student_id uuid,
  p_plan_type text,
  p_bonus_amount numeric,
  p_currency text default 'UZS',
  p_month_year text default to_char(now(), 'YYYY-MM')
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if coalesce(p_bonus_amount, 0) <= 0 then
    return false;
  end if;
  -- idempotent: at most one bonus per student
  if exists (select 1 from public.staff_bonuses sb where sb.student_id = p_student_id) then
    return false;
  end if;
  insert into public.staff_bonuses (student_id, plan_type, bonus_amount, currency, status, month_year)
  values (p_student_id, p_plan_type, p_bonus_amount, coalesce(p_currency, 'UZS'), 'pending',
          coalesce(p_month_year, to_char(now(), 'YYYY-MM')));
  return true;
end $$;

create or replace function public.staff_bonus_amount(p_student_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare v numeric;
begin
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  select sb.bonus_amount into v
  from public.staff_bonuses sb
  where sb.student_id = p_student_id
  order by sb.created_at
  limit 1;
  return coalesce(v, 0);
end $$;

revoke all on function public.record_staff_bonus(uuid, text, numeric, text, text) from public, anon;
revoke all on function public.staff_bonus_amount(uuid) from public, anon;
grant execute on function public.record_staff_bonus(uuid, text, numeric, text, text) to authenticated, service_role;
grant execute on function public.staff_bonus_amount(uuid) to authenticated, service_role;
