-- Five more links were closed `site_dead` while the previous migration was
-- being written (11:17–11:23). Same rule applied, same way: fetch each one by
-- hand, three attempts, https / http / `www.`, before believing the label.
--
--   TIRIK   www.ncc.re.kr    11 KB   국제암대학원대학교
--   TIRIK   www.hsc.ac.kr   200 KB   한림성심대학교
--   TIRIK   www.snjc.ac.kr  113 KB   서울여자간호대학교
--   —       wbgs.ac.kr               원불교대학원대학교
--   —       sbgst.ac.kr              서울성경신학대학원대학교
--
-- 한림성심대학교 is worth noting separately, because it breaks the tidy
-- explanation from the previous migration. Its stored link was ALREADY
-- `https://www.hsc.ac.kr/` — the `www.` was never missing — and the host
-- answers with a 200 KB page. So a missing `www.` is one cause of a false
-- `site_dead`, not the cause: something in the operator's own path to these
-- hosts fails intermittently too. That is worth knowing before the next
-- fourteen get written off.

insert into public.blocked_link_hosts (host, institution_name_ko, reason, detail)
values
  ('wbgs.ac.kr',  '원불교대학원대학교',       'site_dead',
   'Qo''lda 3 marta sinaldi (https/http/www) — javob yo''q (2026-08-25)'),
  ('sbgst.ac.kr', '서울성경신학대학원대학교', 'site_dead',
   'Qo''lda 3 marta sinaldi (https/http/www) — javob yo''q (2026-08-25)')
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

-- Delete before insert, for the dedup-key reason spelled out in
-- 20260825110000: the key strips `www.`, so the replacement collides with the
-- row it replaces and would be skipped silently the other way round.
create temporary table live_again2 (host text, uni text, working_url text)
  on commit drop;

insert into live_again2 values
  ('ncc.re.kr',  '국제암대학원대학교',   'https://www.ncc.re.kr/'),
  ('hsc.ac.kr',  '한림성심대학교',       'https://www.hsc.ac.kr/'),
  ('snjc.ac.kr', '서울여자간호대학교',   'https://www.snjc.ac.kr/');

delete from public.proposed_sources ps
 using live_again2 l
 where regexp_replace(public.link_host(ps.url_ko), '^[^.]+\.(?=.*\..*\.)', '') = l.host
   and ps.dismiss_reason = 'site_dead';

insert into public.proposed_sources
  (url_ko, source_type, proposed_by, candidate_title, candidate_snippet)
select l.working_url,
       'university_admission_board',
       'manual',
       l.uni,
       'Xato ravishda "sayt o''lik" deb yopilgan edi. Bu manzil 2026-08-25 da '
       'qo''lda tekshirildi va ochildi.'
  from live_again2 l;
