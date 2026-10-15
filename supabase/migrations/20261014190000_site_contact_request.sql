-- "Konsultantga murojaat" on hanguk.uz/auth: a contact request, not an account.
--
-- Until now that link opened a guest sign-up (name, email, password) handled by
-- the guest-auth edge function. It stored the password in leads.password AS
-- TYPED and compared it as plain text, then sent the person to /guest-portal —
-- a page that does not exist. Nothing ever used those "accounts" (11 leads,
-- 14.04–30.09.2026), so the owner decided (2026-10-14): ask for a name and a
-- phone, make it a lead the operators see at once, and keep no password.
--
-- public.site_contact_request(name, phone, email, note) — called only by the
-- guest-auth edge function (service role):
--   * the phone must be an Uzbek number (+998 + 9 digits, as app_register) or
--     an international one (10–15 digits, e.g. a parent abroad);
--   * a student's own number is not a lead ('student');
--   * the latest lead with the same Uzbek number comes back to "Yangi lid"
--     (new_lead_at / sla_start_at, as app_register does) with a note; otherwise
--     a new lead, source 'site';
--   * the same number again within 10 minutes changes nothing ('ok' — a double
--     click or a reload is not a second lead);
--   * more than 30 site requests in 10 minutes: 'busy' (a bot filling the form).
-- With lead module v2 live, the lead is re-engaged on the v2 desk too
-- (fn_lead_reengage, if it exists); a new row gets its v2 timer from the v2
-- insert trigger.

create or replace function public.site_contact_request(
  p_name text, p_phone text, p_email text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_name     text := left(nullif(trim(coalesce(p_name, '')), ''), 120);
  v_email    text := left(nullif(lower(trim(coalesce(p_email, ''))), ''), 200);
  v_digits   text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_national text := public.fn_uz_national_phone(p_phone);
  v_phone    text;
  v_note     text;
  v_lead_id  uuid;
begin
  if v_name is null then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  if v_national is not null then
    v_phone := '+998 ' || substr(v_national, 1, 2) || ' ' || substr(v_national, 3, 3)
            || ' ' || substr(v_national, 6, 2) || ' ' || substr(v_national, 8, 2);
    if public.fn_is_student_phone(v_national) then
      return jsonb_build_object('status', 'student');
    end if;
  elsif length(v_digits) between 10 and 15 then
    v_phone := '+' || v_digits;
  else
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  if (select count(*) from public.leads
       where source = 'site' and created_at > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('status', 'busy');
  end if;

  v_note := 'Saytdan murojaat: ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI')
         || case when v_email is not null then ' · ' || v_email else '' end
         || case when nullif(trim(coalesce(p_note, '')), '') is not null
                 then E'\n' || left(trim(p_note), 1000) else '' end;

  -- The latest lead with this number, if any (Uzbek numbers, as app_register).
  if v_national is not null then
    select l.id into v_lead_id
      from public.leads l
     where v_national = any (public.fn_phone_keys(l.phone))
     order by l.updated_at desc
     limit 1;
  else
    select l.id into v_lead_id
      from public.leads l
     where regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') = v_digits
     order by l.updated_at desc
     limit 1;
  end if;

  if v_lead_id is not null then
    -- A double click / reload: the same number a moment ago is the same request.
    if exists (select 1 from public.leads l
                where l.id = v_lead_id and l.notes like '%Saytdan murojaat:%'
                  and l.updated_at > now() - interval '10 minutes') then
      return jsonb_build_object('status', 'ok');
    end if;
    update public.leads l
       set notes = concat_ws(E'\n', nullif(trim(l.notes), ''), v_note),
           email = coalesce(l.email, v_email),
           new_lead_at = now(),
           sla_start_at = public.fn_lead_sla_start(now()),
           sla_alerted_at = null,
           quick_contact_alerted_at = case when l.last_contacted_at is not null then now() end,
           updated_at = now()
     where l.id = v_lead_id;
    if to_regprocedure('public.fn_lead_reengage(uuid, timestamp with time zone)') is not null then
      execute 'select public.fn_lead_reengage($1, now())' using v_lead_id;
    end if;
  else
    insert into public.leads (full_name, phone, email, source, status, contact_channel, notes,
                              new_lead_at, sla_start_at)
    values (v_name, v_phone, v_email, 'site', 'new', 'Sayt', v_note,
            now(), public.fn_lead_sla_start(now()))
    returning id into v_lead_id;
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.site_contact_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.site_contact_request(text, text, text, text) to service_role;
