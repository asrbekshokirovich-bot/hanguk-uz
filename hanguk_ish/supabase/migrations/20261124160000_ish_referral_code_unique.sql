-- Hanguk Ish: invite codes must never block a sign-up. The column default
-- (6 hex characters of an md5) collided: with 20 000 workers (tests/perf.sh)
-- a new profile failed on «worker_profiles_referral_code_key». Now a trigger
-- picks a free code from 32 letters and digits that are easy to read
-- (no 0/O, 1/I): about a billion codes, checked before use.

create or replace function ish.new_referral_code()
returns text
language plpgsql
volatile
set search_path = ish
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from ish.worker_profiles where referral_code = v_code);
  end loop;
  return v_code;
end
$$;
revoke execute on function ish.new_referral_code() from public, anon, authenticated;

create or replace function ish.worker_profiles_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if new.referral_code is null then
    new.referral_code := ish.new_referral_code();
  end if;
  return new;
end
$$;
revoke execute on function ish.worker_profiles_referral_code() from public, anon, authenticated;

alter table ish.worker_profiles alter column referral_code drop default;
create trigger worker_profiles_referral_code before insert on ish.worker_profiles
  for each row execute function ish.worker_profiles_referral_code();
