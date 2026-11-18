-- Hanguk Ish: the staff see who is interested in a monthly job.
--
-- A worker says «Qiziqaman» on a monthly job (a row in monthly_applications).
-- The CRM lists them with their name and phone so the staff can call both
-- sides. Workers' profiles are not readable by RLS to the staff, so this
-- function (staff only, require_staff) reads them.

create function ish.staff_monthly_interest(p_job uuid default null)
returns table (
  job_id uuid, worker_id uuid, first_name text, last_name text, phone text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return query
    select a.job_id, a.worker_id, p.first_name, p.last_name, p.phone, a.created_at
    from ish.monthly_applications a
    join ish.profiles p on p.id = a.worker_id
    where p_job is null or a.job_id = p_job
    order by a.created_at desc;
end
$$;

revoke execute on function ish.staff_monthly_interest(uuid) from public, anon;
grant execute on function ish.staff_monthly_interest(uuid) to authenticated;
