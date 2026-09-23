-- Learning centers (o'quv markazlar): partner schools that send us students.
--
-- A partner center gets its own login. Every student it enters becomes a lead
-- in our pipeline on the spot — no export, no spreadsheet, no operator
-- re-typing names — and the lead remembers which center brought it.
--
-- WHY THIS IS NOT AN app_role
--
-- The obvious design is a 'learning_center' value in public.app_role. It would
-- have handed every center the staff CRM: is_staff_user() and
-- is_non_investor_staff() treat "any role except investor" as staff, and
-- several policies (payments, student_contacts, interview_questions) admit
-- anybody with *any* row in user_roles. A center would have been able to read
-- every payment in the company the moment its account existed.
--
-- So a center account holds no role at all. What makes it a center is a row
-- in public.learning_centers pointing at its auth user; every permission below
-- is granted by that row and by nothing else. Without a role the account is,
-- to the rest of the schema, no more privileged than a student.
--
-- HOW A STUDENT BECOMES A LEAD
--
-- The center inserts into learning_center_students. A BEFORE INSERT trigger
-- (security definer, because the center cannot touch public.leads) either
--   * finds an existing lead with the same phone number — the student already
--     reached us some other way — and links to it without changing it, or
--   * creates a new lead: source 'learning_center', source_id = this row,
--     learning_center_id = the center, assigned to the center's account
--     manager if one is set.
-- Attribution is first-come: a center does not take over a lead that was
-- already ours, and the center sees that row as "already in our base".
--
-- WHAT THE CENTER CAN SEE
--
-- Its own profile and its own students, plus one word of progress per student
-- (the lead's status) through v_learning_center_students. Never the lead row,
-- never another center, never anything a lead from another channel carries.

-- ---------------------------------------------------------------------------
-- 1. The centers
-- ---------------------------------------------------------------------------

create table if not exists public.learning_centers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  city           text,
  address        text,
  contact_person text,
  phone          text,
  -- The center's login. Unique: one account is one center.
  user_id        uuid unique references auth.users(id) on delete set null,
  -- Staff member who works this center's leads. Copied onto each new lead.
  assigned_to    uuid references auth.users(id) on delete set null,
  is_active      boolean not null default true,
  notes          text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.learning_centers is
  'Partner learning centers. user_id is the center''s login; it holds no app_role — this row is its only grant.';

drop trigger if exists update_learning_centers_updated_at on public.learning_centers;
create trigger update_learning_centers_updated_at
  before update on public.learning_centers
  for each row execute function public.update_updated_at_column();

-- The center the signed-in user operates, or null. Security definer so the
-- policies below can call it without recursing into learning_centers' own RLS.
create or replace function public.my_learning_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.learning_centers
   where user_id = auth.uid() and is_active
   limit 1;
$$;

revoke all on function public.my_learning_center_id() from public, anon;
grant execute on function public.my_learning_center_id() to authenticated;

-- Staff who may manage centers and see their students: the same roles that
-- may read leads.
create or replace function public.can_manage_learning_centers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
     where user_id = auth.uid()
       and role in ('owner', 'admin', 'call_operator')
  );
$$;

revoke all on function public.can_manage_learning_centers() from public, anon;
grant execute on function public.can_manage_learning_centers() to authenticated;

alter table public.learning_centers enable row level security;

drop policy if exists "Center reads itself" on public.learning_centers;
create policy "Center reads itself" on public.learning_centers
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Staff read centers" on public.learning_centers;
create policy "Staff read centers" on public.learning_centers
  for select to authenticated
  using (public.can_manage_learning_centers());

drop policy if exists "Admins manage centers" on public.learning_centers;
create policy "Admins manage centers" on public.learning_centers
  for all to authenticated
  using (exists (select 1 from public.user_roles
                  where user_id = auth.uid() and role in ('owner', 'admin')))
  with check (exists (select 1 from public.user_roles
                       where user_id = auth.uid() and role in ('owner', 'admin')));

-- ---------------------------------------------------------------------------
-- 2. The lead remembers its center
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists learning_center_id uuid
    references public.learning_centers(id) on delete set null;

create index if not exists idx_leads_learning_center_id
  on public.leads (learning_center_id) where learning_center_id is not null;

comment on column public.leads.learning_center_id is
  'The partner learning center that registered this lead. NULL for every other channel.';

-- ---------------------------------------------------------------------------
-- 3. The students a center enters
-- ---------------------------------------------------------------------------

create table if not exists public.learning_center_students (
  id           uuid primary key default gen_random_uuid(),
  center_id    uuid not null references public.learning_centers(id) on delete cascade,
  full_name    text not null check (length(trim(full_name)) > 0),
  -- A lead we cannot call is not a lead (see 20260903140000), so the phone
  -- is required and must at least look like a number.
  phone        text not null check (length(regexp_replace(phone, '\D', '', 'g')) >= 9),
  city         text,
  age          integer check (age is null or age between 10 and 80),
  korean_level text,
  notes        text,
  -- Set by the trigger, never by the center.
  lead_id      uuid references public.leads(id) on delete set null,
  already_lead boolean not null default false,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

comment on table public.learning_center_students is
  'Students entered by a partner learning center. Each insert creates (or links) a lead.';
comment on column public.learning_center_students.already_lead is
  'True when the phone number already belonged to a lead from another channel; that lead was linked, not changed.';

-- The same student entered twice by the same center is a typo, not two leads.
create unique index if not exists uq_learning_center_students_phone
  on public.learning_center_students (center_id, (right(regexp_replace(phone, '\D', '', 'g'), 9)));

create index if not exists idx_learning_center_students_center
  on public.learning_center_students (center_id, created_at desc);

create or replace function public.fn_learning_center_student_to_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_center  public.learning_centers%rowtype;
  v_digits  text := right(regexp_replace(new.phone, '\D', '', 'g'), 9);
  v_lead_id uuid;
begin
  select * into v_center from public.learning_centers where id = new.center_id;
  if not found then
    raise exception 'Unknown learning center %', new.center_id;
  end if;

  -- Whatever the client sent for these, the trigger decides them.
  new.full_name := trim(new.full_name);
  new.phone := coalesce(public.normalize_phone(new.phone), trim(new.phone));
  new.lead_id := null;
  new.already_lead := false;

  select l.id into v_lead_id
    from public.leads l
   where coalesce(l.phone, '') <> ''
     and right(regexp_replace(l.phone, '\D', '', 'g'), 9) = v_digits
   order by l.created_at
   limit 1;

  if v_lead_id is not null then
    new.lead_id := v_lead_id;
    new.already_lead := true;
    return new;
  end if;

  insert into public.leads (
    full_name, phone, city, age, korean_level, notes,
    source, source_id, source_note, how_heard,
    learning_center_id, assigned_to, created_by
  ) values (
    new.full_name, new.phone, nullif(trim(new.city), ''), new.age,
    nullif(trim(new.korean_level), ''), nullif(trim(new.notes), ''),
    'learning_center', new.id::text, v_center.name, 'O‘quv markaz',
    v_center.id, v_center.assigned_to, new.created_by
  )
  returning id into v_lead_id;

  new.lead_id := v_lead_id;
  return new;
end;
$$;

revoke all on function public.fn_learning_center_student_to_lead() from public, anon, authenticated;

drop trigger if exists trg_learning_center_student_to_lead on public.learning_center_students;
create trigger trg_learning_center_student_to_lead
  before insert on public.learning_center_students
  for each row execute function public.fn_learning_center_student_to_lead();

alter table public.learning_center_students enable row level security;

drop policy if exists "Center reads own students" on public.learning_center_students;
create policy "Center reads own students" on public.learning_center_students
  for select to authenticated
  using (center_id = public.my_learning_center_id());

drop policy if exists "Center adds own students" on public.learning_center_students;
create policy "Center adds own students" on public.learning_center_students
  for insert to authenticated
  with check (center_id = public.my_learning_center_id());

-- No update or delete for the center: the row is the lead's origin record,
-- and editing it after the office has started calling would only diverge
-- from the lead. Corrections go through us.

drop policy if exists "Staff read center students" on public.learning_center_students;
create policy "Staff read center students" on public.learning_center_students
  for select to authenticated
  using (public.can_manage_learning_centers());

drop policy if exists "Admins manage center students" on public.learning_center_students;
create policy "Admins manage center students" on public.learning_center_students
  for all to authenticated
  using (exists (select 1 from public.user_roles
                  where user_id = auth.uid() and role in ('owner', 'admin')))
  with check (exists (select 1 from public.user_roles
                       where user_id = auth.uid() and role in ('owner', 'admin')));

-- ---------------------------------------------------------------------------
-- 4. What the center sees of progress
-- ---------------------------------------------------------------------------
-- Owner rights (security_invoker unset) so it can read leads.status, which the
-- center cannot. The WHERE clause is the gate: a center sees only its rows,
-- and a lead that was already ours shows no status — how the office is
-- working somebody else's lead is not the center's business.

create or replace view public.v_learning_center_students as
select
  s.id,
  s.center_id,
  s.full_name,
  s.phone,
  s.city,
  s.age,
  s.korean_level,
  s.notes,
  s.already_lead,
  s.created_at,
  case when s.already_lead then null else l.status end as lead_status
from public.learning_center_students s
left join public.leads l on l.id = s.lead_id
where s.center_id = public.my_learning_center_id()
   or public.can_manage_learning_centers();

comment on view public.v_learning_center_students is
  'A learning center''s students with one word of lead progress. Filtered to the caller''s own center.';

revoke all on public.v_learning_center_students from public, anon;
grant select on public.v_learning_center_students to authenticated;
