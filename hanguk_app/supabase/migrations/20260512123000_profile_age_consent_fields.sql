-- P1 #16 + #17: Add age-gate + consent columns to profiles.
--
-- Korean youth-protection law (정보통신망법) prohibits internet service to
-- under-14s and requires parental consent for 14-18. PIPA + GDPR require
-- the marketing-consent toggle to default OFF and be separable from the
-- legal service consent.
--
-- Idempotent: re-running this migration is safe.

do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'dob'
  ) then
    alter table public.profiles add column dob date;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'parental_consent'
  ) then
    alter table public.profiles add column parental_consent boolean not null default false;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'parental_email'
  ) then
    alter table public.profiles add column parental_email text;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'marketing_consent'
  ) then
    alter table public.profiles add column marketing_consent boolean not null default false;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'marketing_consent_at'
  ) then
    alter table public.profiles add column marketing_consent_at timestamptz;
  end if;
exception
  when undefined_table then
    -- profiles table doesn't exist on this branch yet; surface a notice
    -- so the migration is still applied cleanly when the table arrives.
    raise notice 'profiles table not found; skipping age/consent columns.';
end$$;

-- Minimum-age check: under 14 must never reach the service.
-- Enforced at write-time via a trigger so even buggy clients can't smuggle
-- a 13-year-old in. 14-18 is allowed but requires parental_consent=true.
create or replace function public.fn_enforce_min_age()
returns trigger
language plpgsql
as $$
declare
  age_years int;
begin
  if new.dob is null then
    return new;
  end if;
  age_years := extract(year from age(current_date, new.dob));
  if age_years < 14 then
    raise exception 'Hanguk does not provide service to users under 14.'
      using errcode = 'check_violation';
  end if;
  if age_years < 18 and coalesce(new.parental_consent, false) = false then
    raise exception 'Parental consent is required for users under 18.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='profiles') then
    -- (Re)create trigger.
    drop trigger if exists trg_profiles_enforce_min_age on public.profiles;
    create trigger trg_profiles_enforce_min_age
      before insert or update on public.profiles
      for each row execute function public.fn_enforce_min_age();
  end if;
end$$;
