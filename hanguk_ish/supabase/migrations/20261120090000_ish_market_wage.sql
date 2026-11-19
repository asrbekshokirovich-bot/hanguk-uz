-- Hanguk Ish — what shifts around here pay (2026-11-20).
--
-- BA2 «근무 올리기» shows the owner the average hourly wage next to the
-- minimum, with quick buttons around it and a note that a wage under the
-- average may be slower to fill. The average is real: the mean of the
-- hourly wages of the shifts posted in the last 90 days by verified
-- businesses, rounded to 100 won — of the owner's own district when at least
-- 5 shifts there give one, else of all of them, else nothing (null: the app
-- shows dashes, never a made-up figure). Only a member of the business asks.

create function ish.market_wage(p_business uuid)
returns int
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_district text;
  v_n int;
  v_avg numeric;
begin
  perform ish.require_uid();
  if not ish.is_business_member(p_business) then
    raise exception 'NOT_FOUND';
  end if;
  select nullif(btrim(district), '') into v_district from ish.businesses where id = p_business;

  if v_district is not null then
    select count(*), round(avg(s.hourly_wage) / 100) * 100 into v_n, v_avg
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.status = 'open' and b.status = 'verified' and s.created_at > now() - interval '90 days'
      and lower(btrim(b.district)) = lower(v_district);
    if v_n >= 5 then
      return v_avg::int;
    end if;
  end if;

  select count(*), round(avg(s.hourly_wage) / 100) * 100 into v_n, v_avg
  from ish.shifts s join ish.businesses b on b.id = s.business_id
  where s.status = 'open' and b.status = 'verified' and s.created_at > now() - interval '90 days';
  if v_n >= 5 then
    return v_avg::int;
  end if;
  return null;
end
$$;

revoke execute on function ish.market_wage(uuid) from public, anon;
grant execute on function ish.market_wage(uuid) to authenticated;
