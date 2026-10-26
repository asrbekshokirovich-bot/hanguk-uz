-- «Mijozlar faolligi» (plan v2, stage 5 — the documents team's page): which
-- students are waiting on something they have to do in the app.
--   * offers      — a university offer not answered yet, oldest first (over
--                   48 hours is signal 4), with whether the reminder push went
--                   and when the student was last in the app;
--   * documents   — students with a contract whose application pack is not
--                   complete: the required slots with no upload, or whose
--                   newest upload was rejected (asked again);
--   * inactive    — students with a contract who have not opened the app for
--                   7 days, or never signed in on it.
-- Staff only (no investor), like the rest of the app analytics. Students are
-- the profiles with a contract that is not cancelled.

-- The pack's required slots with nothing usable in them: 'missing' (no upload)
-- or 'rejected' (the newest upload was rejected). Mirrors
-- APPLICATION_PACK_SLOTS (required) and matchesSlot() with its legacy aliases
-- (src/lib/studentDocSlots.ts, src/lib/translationDocuments.ts), the same list
-- as student_documents_complete.
create or replace function public.fn_student_document_gaps(p_student uuid)
returns table (slot_id text, state text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with slots(slot_id, ids, ord) as (
    values
      ('applicant_id_card',    array['applicant_id_card'], 1),
      ('foreign_passport',     array['foreign_passport', 'applicant_passport'], 2),
      ('father_id_card',       array['father_id_card', 'parent_passport'], 3),
      ('mother_id_card',       array['mother_id_card'], 4),
      ('birth_certificate',    array['birth_certificate'], 5),
      ('language_certificate', array['language_certificate'], 6),
      ('photo',                array['photo'], 7),
      ('diploma',              array['diploma'], 8)
  ),
  newest as (
    select s.slot_id, s.ord,
           (select d.status
              from public.documents d
             where d.student_id = p_student
               and exists (
                 select 1 from unnest(s.ids) as i(id)
                  where strpos(lower(coalesce(d.name, '')), '[' || i.id || ']') > 0
                     or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), i.id || '-')
                     or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), i.id || '.'))
             order by d.created_at desc
             limit 1) as status
      from slots s
  )
  select n.slot_id, case when n.status is null then 'missing' else 'rejected' end
    from newest n
   where n.status is null or n.status = 'rejected'
   order by n.ord;
$$;

revoke all on function public.fn_student_document_gaps(uuid) from public, anon, authenticated;

create or replace function public.analytics_clients_activity()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_now timestamptz := now();
  v_out jsonb;
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with students as (
    select p.user_id, p.full_name, p.contract_date
      from public.profiles p
     where p.contract_date is not null and coalesce(p.status, '') <> 'cancelled'
  ),
  app as (
    select i.user_id, max(i.last_seen_at) as last_seen_at
      from public.app_installs i
     where i.user_id is not null
     group by i.user_id
  ),
  offers as (
    select c.student_id, pr.full_name, c.institution_id, coalesce(inst.name_en, inst.name_ko) as university,
           c.created_at as offered_at,
           (select n.sent_at from public.student_stage_notifications n
             where n.student_id = c.student_id and n.kind = 'offer_reminder' and n.institution_id = c.institution_id) as reminded_at,
           app.last_seen_at
      from public.student_university_choices c
      left join public.profiles pr on pr.user_id = c.student_id
      left join public.institutions inst on inst.id = c.institution_id
      left join app on app.user_id = c.student_id
     where c.status = 'offered' and c.responded_at is null
  ),
  docs as (
    select s.user_id, s.full_name, s.contract_date, g.gaps, app.last_seen_at,
           (select max(d.created_at) from public.documents d where d.student_id = s.user_id) as last_upload_at
      from students s
      cross join lateral (select jsonb_agg(jsonb_build_object('slot', x.slot_id, 'state', x.state)) as gaps
                            from public.fn_student_document_gaps(s.user_id) x) g
      left join app on app.user_id = s.user_id
     where g.gaps is not null
  ),
  inactive as (
    select s.user_id, s.full_name, s.contract_date, app.last_seen_at
      from students s
      left join app on app.user_id = s.user_id
     where app.last_seen_at is null or app.last_seen_at < v_now - interval '7 days'
  )
  select jsonb_build_object(
    'now', v_now,
    'offers', coalesce((select jsonb_agg(jsonb_build_object(
                 'user_id', o.student_id, 'name', o.full_name, 'institution_id', o.institution_id,
                 'university', o.university, 'offered_at', o.offered_at,
                 'overdue', o.offered_at <= v_now - interval '48 hours',
                 'reminded_at', o.reminded_at, 'last_seen_at', o.last_seen_at) order by o.offered_at)
               from offers o), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(jsonb_build_object(
                 'user_id', d.user_id, 'name', d.full_name, 'contract_date', d.contract_date, 'gaps', d.gaps,
                 'last_upload_at', d.last_upload_at, 'last_seen_at', d.last_seen_at)
                 order by d.contract_date, d.full_name)
               from docs d), '[]'::jsonb),
    'inactive', coalesce((select jsonb_agg(jsonb_build_object(
                 'user_id', i.user_id, 'name', i.full_name, 'contract_date', i.contract_date,
                 'last_seen_at', i.last_seen_at) order by i.last_seen_at nulls first, i.full_name)
               from inactive i), '[]'::jsonb))
    into v_out;
  return v_out;
end;
$$;

revoke all on function public.analytics_clients_activity() from public, anon;
grant execute on function public.analytics_clients_activity() to authenticated;
