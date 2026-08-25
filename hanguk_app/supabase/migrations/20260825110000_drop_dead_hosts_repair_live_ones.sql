-- 25 August's rejections leave the queue — but only the ones that are actually
-- rejections.
--
-- 21 links were closed `site_dead` today, against 6 the whole of yesterday.
-- A tripling in one day is a claim about the internet, so it was checked: every
-- one of the 21 was fetched by hand, three attempts each, over https, http and
-- with a `www.` prefix.
--
-- Seven answered. All seven only on `www.`:
--
--   www.ansan.ac.kr      69 KB      www.hanil.ac.kr       114 KB
--   www.baewha.ac.kr    149 KB      www.hanyeong.ac.kr      8 KB
--   www.bufs.ac.kr        2 KB      www.sc.ac.kr           92 KB
--   www.gangdong.ac.kr   25 KB
--
-- The stored links are bare domains — `https://gbhc.ac.kr/`, no `www.` — and a
-- good number of Korean university hosts simply do not answer in that form.
-- The site was never dead; the link was written wrong. 한영대's case is the one
-- that shows the cost: `www.hanyeong.ac.kr/ipsi/Common/file/application_2027.pdf`
-- returns a 400 KB 2027 guideline, and it had been closed as a dead host.
--
-- So the seven keep their place in the queue, with the URL that works replacing
-- the one that never could, and their hosts are NOT blocked. The other fourteen
-- did not answer in any form and are blocked and deleted like the rest.
--
-- The remaining fourteen closures today are uncontested: three `already_have`
-- (the guideline is in the database), three `no_guideline`, one `not_2027`.

-- ---------------------------------------------------------------------------
-- 1. Block the hosts that never answered.
-- ---------------------------------------------------------------------------

insert into public.blocked_link_hosts (host, institution_name_ko, reason, detail)
values
  -- site_dead: fetched by hand three times over https/http/www — no response.
  ('gbhc.ac.kr',          '경북보건대학교',             'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('kyeyak.ac.kr',        '계약신학대학원대학교',       'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('supu.ac.kr',          '선학유피대학원대학교',       'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('sudo.ac.kr',          '수도국제대학원대학교',       'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('suwoncatholic.ac.kr', '수원가톨릭대학교',           'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('sewc.ac.kr',          '숭의여자대학교',             'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('gju.ac.kr',           '신경주대학교',               'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('kictt.ac.kr',         '실천신학대학원대학교',       'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('asialife.ac.kr',      '아시아라이프대학교',         'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('wgst.ac.kr',          '웨스트민스터신학대학원대학교','site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('utah.ac.kr',          '유타대학교아시아캠퍼스',     'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('cntu.ac.kr',          '전남과학대학교',             'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('jeonghwa.ac.kr',      '정화예술대학교',             'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  ('hosan.ac.kr',         '호산대학교',                 'site_dead', 'Qo''lda 3 marta sinaldi — javob yo''q (2026-08-25)'),
  -- already_have: the guideline is already a guideline_document.
  ('jesus.ac.kr',         '예수대학교',                 'already_have', 'Qo''llanma bazada bor (2026-08-25)'),
  ('kg.ac.kr',            '한국골프대학교',             'already_have', 'Qo''llanma bazada bor (2026-08-25)'),
  ('ktc.ac.kr',           '한국관광대학교',             'already_have', 'Qo''llanma bazada bor (2026-08-25)'),
  -- no_guideline / not_2027.
  ('gtec.ac.kr',          '경기과학기술대학교',         'no_guideline', 'Sahifada qabul qo''llanmasi yo''q (2026-08-25)'),
  ('igse.ac.kr',          '국제어학대학원대학교',       'no_guideline', 'Sahifada qabul qo''llanmasi yo''q (2026-08-25)'),
  ('kopo.ac.kr',          '한국폴리텍대학',             'no_guideline', 'Sahifada qabul qo''llanmasi yo''q (2026-08-25)'),
  ('rgu.ac.kr',           '개혁신학대학원대학교',       'not_2027',     'Havola 2027 emas (2026-08-25)')
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

-- ---------------------------------------------------------------------------
-- 2. Repair the seven that were alive all along.
-- ---------------------------------------------------------------------------

-- Delete first, insert second, and in that order: the dedup trigger added in
-- 20260825060000 compares `link_dedup_key`, which strips `www.`, so
-- `https://www.sc.ac.kr/` and the stored `https://sc.ac.kr/` are the same link
-- to it. Inserting first would silently skip every replacement.
create temporary table live_again (host text, uni text, working_url text)
  on commit drop;

insert into live_again values
  ('ansan.ac.kr',    '안산대학교',       'https://www.ansan.ac.kr/'),
  ('baewha.ac.kr',   '배화여자대학교',   'https://www.baewha.ac.kr/'),
  ('bufs.ac.kr',     '부산외국어대학교', 'https://www.bufs.ac.kr/'),
  ('gangdong.ac.kr', '강동대학교',       'https://www.gangdong.ac.kr/'),
  ('hanil.ac.kr',    '한일장신대학교',   'https://www.hanil.ac.kr/'),
  ('sc.ac.kr',       '수성대학교',       'https://www.sc.ac.kr/'),
  -- Not the homepage for 한영대: the guideline itself is reachable, and it is
  -- the thing the queue exists to find.
  ('hanyeong.ac.kr', '한영대학교',
   'https://www.hanyeong.ac.kr/ipsi/Common/file/application_2027.pdf');

delete from public.proposed_sources ps
 using live_again l
 where regexp_replace(public.link_host(ps.url_ko), '^[^.]+\.(?=.*\..*\.)', '') = l.host
   and ps.dismiss_reason = 'site_dead';

insert into public.proposed_sources
  (url_ko, source_type, proposed_by, candidate_title, candidate_snippet)
select l.working_url,
       'university_admission_board',
       'manual',
       l.uni,
       'Avvalgi havola www. siz yozilgani uchun ochilmagan va xato ravishda '
       '"sayt o''lik" deb yopilgan edi. Bu manzil 2026-08-25 da qo''lda '
       'tekshirildi va ochildi.'
  from live_again l;
