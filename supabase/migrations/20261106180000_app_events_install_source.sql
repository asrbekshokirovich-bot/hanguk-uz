-- App analytics, plan R6.3 (claude/ilova-rivojlantirish-reja.md, B13): where
-- an Android install came from. Once per phone, on the first launch, from the
-- Play install referrer the app already reads for a lead's link code
-- (IdentityLinks): utm_source / utm_medium / utm_campaign / utm_content
-- (each cut to 60 characters; 'none' when Play gave nothing, 'other' when
-- the referrer had no utm_source) and whether the link carried a lead's code.
-- No new SDK: the privacy policy does not change.

insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  ('install_source', 'lifecycle', 'O''rnatish manbasi (Play referrer: utm_source/medium/campaign)',
   '{source,medium,campaign,content,linked}', 'active', '1.1.3')
on conflict (event) do update set
  family = excluded.family, description_uz = excluded.description_uz,
  props = excluded.props, status = excluded.status;
