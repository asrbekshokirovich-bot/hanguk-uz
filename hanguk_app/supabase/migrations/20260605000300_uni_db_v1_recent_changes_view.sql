-- ============================================================================
--  uni_db v1 — v_user_recent_changes view (Phase 1, plan §I + §H.6)
--
--  Surfaces change_events for entities the current user has tracked.
--  Used by the Flutter home banner (HomeRecentChangesBanner) and the
--  notify-tracked-changes Edge Function (Phase 3).
--
--  RLS: the underlying user_tracked_universities row enforces ownership;
--  the view inherits its filtering through `auth.uid()` in the JOIN.
-- ============================================================================

set local search_path = public, pg_catalog;

create or replace view public.v_user_recent_changes as
with linked as (
  -- admission_cycles: entity_id IS the cycle id; institution_id from there.
  select ce.id, ce.detected_at, ce.field_name, ce.entity_type, ce.entity_id,
         ce.old_value, ce.new_value, ce.reason,
         ac.institution_id
    from public.change_events ce
    join public.admission_cycles ac
      on ce.entity_type = 'admission_cycles' and ce.entity_id = ac.id

  union all
  -- cycle_dates: entity_id is the cycle_date id; resolve via cycle_id.
  select ce.id, ce.detected_at, ce.field_name, ce.entity_type, ce.entity_id,
         ce.old_value, ce.new_value, ce.reason,
         ac.institution_id
    from public.change_events ce
    join public.cycle_dates cd       on ce.entity_type = 'cycle_dates' and ce.entity_id = cd.id
    join public.admission_cycles ac  on ac.id = cd.cycle_id

  union all
  -- tuition: institution_id directly on the row.
  select ce.id, ce.detected_at, ce.field_name, ce.entity_type, ce.entity_id,
         ce.old_value, ce.new_value, ce.reason,
         t.institution_id
    from public.change_events ce
    join public.tuition t on ce.entity_type = 'tuition' and ce.entity_id = t.id

  union all
  -- scholarships: institution_id directly on the row (nullable, fine).
  select ce.id, ce.detected_at, ce.field_name, ce.entity_type, ce.entity_id,
         ce.old_value, ce.new_value, ce.reason,
         s.institution_id
    from public.change_events ce
    join public.scholarships s on ce.entity_type = 'scholarships' and ce.entity_id = s.id

  union all
  -- requirements: resolve via cycle_id.
  select ce.id, ce.detected_at, ce.field_name, ce.entity_type, ce.entity_id,
         ce.old_value, ce.new_value, ce.reason,
         ac.institution_id
    from public.change_events ce
    join public.requirements r       on ce.entity_type = 'requirements' and ce.entity_id = r.id
    join public.admission_cycles ac  on ac.id = r.cycle_id
)
select
  l.id                              as change_event_id,
  l.detected_at,
  l.field_name,
  l.entity_type,
  l.entity_id,
  l.old_value,
  l.new_value,
  l.reason,
  utu.user_id,
  i.id                              as institution_id,
  i.name_ko,
  i.name_en
from linked l
join public.institutions i              on i.id = l.institution_id
join public.user_tracked_universities utu
  on utu.institution_id = i.id
 and utu.user_id        = auth.uid()
where l.detected_at > now() - interval '30 days'
order by l.detected_at desc;

comment on view public.v_user_recent_changes is
  'Plan §H.6 — change_events scoped to the current user via user_tracked_universities.';
