-- P50 (Asrbek, 2026-11-12): the 사장님 app asks for nothing — no SMS (P49)
-- and no 사업자등록번호. «시작하기» signs in and opens the owner's business at
-- once, without a check (Asrbek chose this over a staff check): it can post
-- shifts right away.
--
-- A business without a number is now allowed for owners too (P39 allowed it
-- only for the employers the staff manage). Owners who register a number
-- (ish-business-register, 국세청) keep that path; the number stays unique.
alter table ish.businesses drop constraint businesses_biz_no_or_managed;

-- BA0 «시작하기»: the signed-in owner's business, opened now if there is
-- none yet (one per account; pressing again gives the same one). Its name
-- until someone sets the real one: 사업장 + the first four of its id
-- (사업장 7F3A) — distinct, and nothing made up.
create function ish.open_business()
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_id uuid;
begin
  -- Two presses at the same moment open one business.
  perform pg_advisory_xact_lock(hashtext('ish.open_business'), hashtext(v_uid::text));
  select m.business_id into v_id
  from ish.business_members m
  join ish.businesses b on b.id = m.business_id
  where m.user_id = v_uid and m.role = 'owner'
  order by b.created_at
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  v_id := gen_random_uuid();
  insert into ish.businesses (id, owner_id, name, status)
  values (v_id, v_uid, '사업장 ' || upper(left(v_id::text, 4)), 'verified');
  insert into ish.business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end
$$;

revoke execute on function ish.open_business() from public, anon;
grant execute on function ish.open_business() to authenticated;
