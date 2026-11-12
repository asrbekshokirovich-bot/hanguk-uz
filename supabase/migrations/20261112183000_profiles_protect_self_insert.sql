-- A profile written by its own account carries no privileges.
--
-- profiles has two INSERT policies that let any signed-in account write a row
-- for itself ("Users can insert their own profile", "profiles_owner_insert":
-- only user_id = auth.uid() is checked). fn_profiles_protect_self_update
-- keeps such an account from raising payment_plan, role, status, is_demo and
-- the like on UPDATE, but INSERT had no guard: an account without a profile
-- could write itself one with payment_plan 'premium' (HeyGen avatar and other
-- paid parts read it), role 'admin', a contract date. On 2026-11-12, 245 of
-- 352 accounts had no profile (211 of them guests from guest-test-session);
-- none had written one.
--
-- Nothing of hanguk.uz writes a profile as the account itself: handle_new_user
-- (security definer, owner postgres), the edge functions (service role) and
-- staff (their own policy) do, and pass through unchanged — the same roles
-- fn_profiles_protect_self_update lets through. For anyone else the
-- privileged columns take their defaults; name, phone, language and the other
-- fields a person fills in are kept.

create or replace function public.fn_profiles_protect_self_insert()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Only direct API writes are restricted. SECURITY DEFINER code and the
  -- service role run as a different database role and pass through.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if exists (
    select 1 from public.user_roles r
     where r.user_id = auth.uid()
       and r.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  ) then
    return new;
  end if;

  new.created_at := now();
  new.role := 'student';
  new.username := null;
  new.magic_code := null;
  new.status := 'offline';
  new.is_demo := false;
  new.contract_date := null;
  new.contract_url := null;
  new.payment_plan := null;
  new.payment_mode := 'one_time';
  new.notes := null;
  new.university_notes := null;
  new.university_selection_status := 'none';
  new.office_location := null;
  new.sip1_user := null;
  new.sip1_password := null;
  new.sip1_server := null;
  new.sip1_port := '5060';
  new.sip1_label := null;
  new.sip2_user := null;
  new.sip2_password := null;
  new.sip2_server := null;
  new.sip2_port := '5060';
  new.sip2_label := null;
  return new;
end;
$$;

create or replace trigger trg_profiles_protect_self_insert
  before insert on public.profiles
  for each row execute function public.fn_profiles_protect_self_insert();
