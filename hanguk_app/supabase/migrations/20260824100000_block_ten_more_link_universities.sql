-- Ten more universities leave the Havolalar tab, by the same mechanism as
-- 20260824090000.
--
-- These are the rest of today's hand-closures — every link the operator closed
-- for a reason other than "the PDF is now in the database":
--
--   과학기술연합대학원대학교        ust.ac.kr        not_2027
--   한국전력국제원자력대학원대학교  kings.ac.kr      not_2027
--   경북전문대학교                  kbc.ac.kr        not_2027
--   여주대학교                      yit.ac.kr        not_2027
--   순천제일대학교                  sjc.ac.kr        site_dead
--   세경대학교                      sekyung.ac.kr    site_dead
--   성심외국어대학                  sungsim.ac.kr    site_dead
--   호남신학대학교                  htus.ac.kr       site_dead
--   세계사이버대학교                world.ac.kr      no_guideline
--   호서대학교                      hoseo.ac.kr      other
--
-- 28 rows in all; none is `promoted`, and none of the ten has an
-- announcement_sources entry, so nothing is retired here.
--
-- 호서대 is the odd one and worth stating plainly, because deleting its rows
-- looks like throwing away work: its 2027 PDF WAS fetched successfully at
-- 06:49 and is in guideline_documents (175 KB, parse_status=succeeded). The
-- link was closed a second time at 09:07 with `other` and the operator's own
-- words, "DUBLIKAT. QAYTA CHIQAYAPTI." — the same file reached the queue under
-- four different URL strings, two of them differing only in the case of their
-- percent-escapes (`%ED%98%B8` vs `%ed%98%b8`), which `unique(url_ko)` reads as
-- two distinct URLs. Closing one therefore did not close the others.
--
-- So for 호서대 the block is the fix for the complaint, not a discard: the
-- links stop coming back, and the document it already produced is untouched.
-- Same for every institution row here — the block covers links only.

insert into public.blocked_link_hosts (host, institution_name_ko, reason, detail)
values
  ('ust.ac.kr',     '과학기술연합대학원대학교',       'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('kings.ac.kr',   '한국전력국제원자력대학원대학교', 'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('kbc.ac.kr',     '경북전문대학교',                 'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('yit.ac.kr',     '여주대학교',                     'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('sjc.ac.kr',     '순천제일대학교',                 'site_dead',
   'Sayt javob bermaydi — 2026-08-24 da qo''lda yopilgan'),
  ('sekyung.ac.kr', '세경대학교',                     'site_dead',
   'Sayt javob bermaydi — 2026-08-24 da qo''lda yopilgan'),
  ('sungsim.ac.kr', '성심외국어대학',                 'site_dead',
   'Sayt javob bermaydi — 2026-08-24 da qo''lda yopilgan'),
  ('htus.ac.kr',    '호남신학대학교',                 'site_dead',
   'Sayt javob bermaydi — 2026-08-24 da qo''lda yopilgan'),
  ('world.ac.kr',   '세계사이버대학교',               'no_guideline',
   'Sahifada qabul qo''llanmasi yo''q — 2026-08-24 da qo''lda yopilgan'),
  ('hoseo.ac.kr',   '호서대학교',                     'other',
   'DUBLIKAT: bitta PDF 4 xil havola bo''lib qayta-qayta chiqqan. '
   '2027 hujjati 06:49 da bazaga olingan va saqlanadi.')
on conflict (host) do nothing;

delete from public.proposed_sources ps
 where public.is_blocked_link(ps.url_ko)
   and ps.status <> 'promoted';

-- No-op for these ten (none has a source row), but kept so the two block
-- migrations read identically and a later one copied from either is complete.
update public.announcement_sources
   set status = 'blocked',
       notes = coalesce(notes || ' | ', '')
               || 'Blocked 2026-08-24: institution dropped from the 2027 link queue'
 where public.is_blocked_link(url_ko)
   and status <> 'blocked';
