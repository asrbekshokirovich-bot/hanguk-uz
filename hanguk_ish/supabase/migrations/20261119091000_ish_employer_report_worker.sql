-- Hanguk Ish — the owner can report a worker (2026-11-19).
--
-- Workers could report a business (A11 → ish.reports), the owner had no way
-- to say a worker did not come or misbehaved. report_worker() writes the same
-- ish.reports row (so the CRM «Shikoyatlar» tab and the Telegram alert get it
-- as they get a worker's), about one application of the owner's own business.
-- The body says who it is about: the CRM shows the writer (the owner).
-- The usual limit applies (10 a day, reports_limit).

create function ish.report_worker(p_application uuid, p_reason text, p_body text default '')
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_business uuid;
  v_worker uuid;
  v_name text;
  v_text text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if p_reason is null or p_reason not in ('no_show', 'behaviour', 'other')
     or v_text = '' or char_length(v_text) > 1500 then
    raise exception 'INVALID';
  end if;
  select s.business_id, a.worker_id into v_business, v_worker
  from ish.applications a join ish.shifts s on s.id = a.shift_id
  where a.id = p_application;
  if v_business is null or not ish.is_business_member(v_business) then
    raise exception 'NOT_FOUND';
  end if;
  select btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) into v_name
  from ish.profiles p where p.id = v_worker;
  insert into ish.reports (reporter_id, application_id, business_id, reason, body)
  values (v_uid, p_application, v_business, p_reason,
          format('Ish beruvchi ishchi ustidan: %s.%s%s', coalesce(nullif(v_name, ''), '–'), E'\n', v_text))
  returning id into v_id;
  return v_id;
end
$$;

revoke execute on function ish.report_worker(uuid, text, text) from public, anon;
grant execute on function ish.report_worker(uuid, text, text) to authenticated;
