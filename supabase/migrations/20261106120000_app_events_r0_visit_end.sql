-- App analytics, plan R0.6 / R0.7 (2026-11-06):
-- * app_background: + session_s, screens — how long the visit had lasted and
--   how many screens it saw; a visit's last app_background is where it ended.
-- * study_plan_test_result (new): the Study Plan test's end — ok with its
--   mark, error, or left without a mark; how long the student wrote and the
--   server took. Only study_plan_test_open was recorded before.

insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  ('study_plan_test_result', 'assessment', 'Study Plan testi natijasi (ball, xato yoki tashlab ketildi)',
   '{institution_id,result,score,ms,seconds,timed_out,error}', 'active', '1.1.3')
on conflict (event) do update set
  family = excluded.family, description_uz = excluded.description_uz,
  props = excluded.props, status = excluded.status;

update public.app_event_types set props = '{session_s,screens}' where event = 'app_background';
