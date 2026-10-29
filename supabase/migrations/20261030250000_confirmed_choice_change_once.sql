-- A finally confirmed university ("Yakuniy tasdiqlash") may be changed ONCE
-- per student, and only by Omina and the admins (Asrbek, 2026-10-29).
--
--   * public.choice_change_access lists who may do it besides the admin role
--     (Omina). Rows are added by a one-off insert, not here.
--   * public.can_change_confirmed_choice() — admin role or listed.
--   * public.university_choice_changes — one row per student (primary key):
--     the change that was used, by whom and when.
--   * public.unlock_confirmed_choice(choice_id) — checks the right and the
--     one-time limit, logs the change and removes the confirmed choice; staff
--     then pick the new university the usual way (student agrees, confirm).
--   * A trigger stops anyone else removing a confirmed choice or changing its
--     university or status directly (the rank may still move when another
--     choice is removed; cascades from a deleted student still work).

create table if not exists public.choice_change_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);

comment on table public.choice_change_access is
  'Staff who may change a confirmed university choice (once per student) besides the admin role.';

alter table public.choice_change_access enable row level security;

drop policy if exists "choice_change_access_read" on public.choice_change_access;
create policy "choice_change_access_read" on public.choice_change_access
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create or replace function public.can_change_confirmed_choice()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (select 1 from public.choice_change_access a where a.user_id = auth.uid())
  )
$$;

revoke all on function public.can_change_confirmed_choice() from public, anon;
grant execute on function public.can_change_confirmed_choice() to authenticated;

create table if not exists public.university_choice_changes (
  student_id     uuid primary key references auth.users (id) on delete cascade,
  institution_id uuid,
  choice_id      uuid,
  changed_by     uuid references auth.users (id) on delete set null,
  changed_at     timestamptz not null default now()
);

comment on table public.university_choice_changes is
  'The one change of a confirmed university a student is allowed (one row per student).';

alter table public.university_choice_changes enable row level security;

drop policy if exists "university_choice_changes_staff_read" on public.university_choice_changes;
create policy "university_choice_changes_staff_read" on public.university_choice_changes
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'document_handler'::public.app_role)
    or public.has_role((select auth.uid()), 'call_operator'::public.app_role)
  );

create or replace function public.unlock_confirmed_choice(p_choice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_choice public.student_university_choices;
begin
  if not public.can_change_confirmed_choice() then
    raise exception 'Tasdiqlangan universitetni faqat Omina va adminlar almashtira oladi';
  end if;

  select * into v_choice from public.student_university_choices where id = p_choice_id for update;
  if not found then
    raise exception 'Tanlov topilmadi';
  end if;
  if v_choice.status <> 'confirmed' then
    raise exception 'Bu universitet hali yakuniy tasdiqlanmagan — oddiy olib tashlash mumkin';
  end if;
  if exists (select 1 from public.university_choice_changes c where c.student_id = v_choice.student_id) then
    raise exception 'Bu talabaning tasdiqlangan universiteti allaqachon bir marta almashtirilgan';
  end if;

  insert into public.university_choice_changes (student_id, institution_id, choice_id, changed_by)
  values (v_choice.student_id, v_choice.institution_id, v_choice.id, auth.uid());

  perform set_config('hanguk.unlock_confirmed_choice', 'on', true);
  delete from public.student_university_choices where id = p_choice_id;
  perform set_config('hanguk.unlock_confirmed_choice', 'off', true);
end;
$$;

revoke all on function public.unlock_confirmed_choice(uuid) from public, anon;
grant execute on function public.unlock_confirmed_choice(uuid) to authenticated;

create or replace function public.fn_guard_confirmed_choice()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'confirmed'
     or pg_trigger_depth() > 1
     or coalesce(current_setting('hanguk.unlock_confirmed_choice', true), 'off') = 'on'
     or coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Tasdiqlangan universitetni "Almashtirish (1 marta)" orqali almashtiring';
  end if;
  if new.institution_id is distinct from old.institution_id or new.status is distinct from old.status then
    raise exception 'Tasdiqlangan universitetni "Almashtirish (1 marta)" orqali almashtiring';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_confirmed_choice on public.student_university_choices;
create trigger trg_guard_confirmed_choice
  before update or delete on public.student_university_choices
  for each row execute function public.fn_guard_confirmed_choice();
