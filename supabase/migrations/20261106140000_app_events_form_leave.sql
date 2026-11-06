-- App analytics, plan R0.5 (2026-11-06): form_leave — how far a form or an
-- assessment page got when it was left: answers changed on this visit out of
-- its questions, whether it was sent (lead, survey, visa, university). Only
-- the opening and the send were recorded, so a form left half-way looked
-- like one never touched.

insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  ('form_leave', 'form', 'Forma yoki baholash sahifasidan chiqildi (nechta javob, yuborildimi)',
   '{form,answered,total,sent,institution_id}', 'active', '1.1.3')
on conflict (event) do update set
  family = excluded.family, description_uz = excluded.description_uz,
  props = excluded.props, status = excluded.status;
