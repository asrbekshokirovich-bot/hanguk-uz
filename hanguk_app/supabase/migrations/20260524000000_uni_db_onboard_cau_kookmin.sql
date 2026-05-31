-- Onboard Chung-Ang (중앙대) + Kookmin (국민대): institution rows + live
-- announcement_sources pointing at the real notice boards found via the
-- browser probe (2026-05-24). Adapters: configs/cau.py + configs/kookmin.py
-- (static HTML lists) with the generic_attachment PDF resolver.
--
-- Idempotent: institutions de-dupe on primary_domain; sources on url_ko.
set local search_path = public, pg_catalog;

insert into public.institutions (name_ko, name_en, institution_type, primary_domain, city_ko)
select v.name_ko, v.name_en, v.institution_type, v.primary_domain, v.city_ko
from (values
  ('중앙대학교', 'Chung-Ang University', 'private', 'cau.ac.kr',     '서울'),
  ('국민대학교', 'Kookmin University',   'private', 'kookmin.ac.kr', '서울')
) as v(name_ko, name_en, institution_type, primary_domain, city_ko)
where not exists (
  select 1 from public.institutions i where i.primary_domain = v.primary_domain
);

insert into public.announcement_sources (source_type, url_ko, status, institution_id, notes)
select 'university_admission_board', s.url_ko, 'live',
       (select id from public.institutions where primary_domain = s.domain),
       s.notes
from (values
  ('https://oia.cau.ac.kr/bbs/board.php?tbl=bbs61',          'cau.ac.kr',
   'CAU 외국인입학 공지 (oia gnuboard tbl=bbs61) — probe 2026-05-24'),
  ('https://admission.kookmin.ac.kr/foreigner/notice.php',   'kookmin.ac.kr',
   'Kookmin 재외국민/외국인 notice.php — probe 2026-05-24')
) as s(url_ko, domain, notes)
on conflict (url_ko) do update
  set status         = 'live',
      institution_id = excluded.institution_id,
      notes          = excluded.notes;
