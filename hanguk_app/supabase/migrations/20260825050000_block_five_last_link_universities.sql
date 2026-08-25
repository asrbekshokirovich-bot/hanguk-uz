-- The last five of 24 August's hand-closures leave the Havolalar tab, by the
-- same mechanism as 20260824090000 and 20260824100000.
--
-- The day's tally reads 7 not_2027 / 6 site_dead / 3 no_guideline / 2 other,
-- but most of those universities are already blocked by the two earlier
-- migrations — those ran mid-afternoon, and work continued until 11:30. What
-- is left is the six closures made after 09:50, across five institutions:
--
--   연성대학교              yeonsung.ac.kr   no_guideline (and site_dead — two
--                                            links, closed 09:52 and 11:24)
--   아주자동차대학교        motor.ac.kr      other — "DUBLIKAT"
--   수원여자대학교          swc.ac.kr        not_2027
--   수원과학대학교          ssc.ac.kr        not_2027
--   겐트대학교글로벌캠퍼스  ghent.ac.kr      no_guideline
--
-- 17 rows across the five; 16 are deleted. None of the five has a single
-- guideline_document, so unlike 호서대 in the previous migration there is no
-- fetched PDF to preserve here.
--
-- 수원여자대학교 is the 신라대 case again: one `promoted` row backed by a live
-- announcement_sources entry. The row stays — it is provenance, not a queue
-- item — and the source is retired to `blocked` instead, which stops the
-- polling without orphaning the reference.

insert into public.blocked_link_hosts (host, institution_name_ko, reason, detail)
values
  ('yeonsung.ac.kr', '연성대학교',             'no_guideline',
   'Sahifada qabul qo''llanmasi yo''q; ikkinchi havolasi ochilmadi — '
   '2026-08-24 da qo''lda yopilgan'),
  ('motor.ac.kr',    '아주자동차대학교',       'other',
   'DUBLIKAT: ayni havola qayta-qayta navbatga chiqqan — '
   '2026-08-24 da qo''lda yopilgan'),
  ('swc.ac.kr',      '수원여자대학교',         'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('ssc.ac.kr',      '수원과학대학교',         'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('ghent.ac.kr',    '겐트대학교글로벌캠퍼스', 'no_guideline',
   'Sahifada qabul qo''llanmasi yo''q — 2026-08-24 da qo''lda yopilgan')
on conflict (host) do nothing;

delete from public.proposed_sources ps
 where public.is_blocked_link(ps.url_ko)
   and ps.status <> 'promoted';

update public.announcement_sources
   set status = 'blocked',
       notes = coalesce(notes || ' | ', '')
               || 'Blocked 2026-08-25: institution dropped from the 2027 link queue'
 where public.is_blocked_link(url_ko)
   and status <> 'blocked';
