-- Closing a link recorded nothing about WHY.
--
-- 2 511 rows sit at 'rejected' and the only thing separating "a person judged
-- this useless" from "the crawler could not reach the host" is whether
-- `reviewed_by` happens to be set. That is an accident of implementation, not
-- a reason, and it is why deciding which of those to bring back took reading
-- prose in `review_notes` and grouping it by regex.
--
-- So the reason gets its own column. Not more prose in `review_notes`: the
-- crawler already writes there, and a column with two writers is a column that
-- starts lying -- the same argument that gave dismissal its own status value in
-- 20260823170000.
--
-- The vocabulary is drawn from what actually happened to the 407 links that
-- were reopened, so a reviewer picking from it is describing a real case:
--   not_2027       the page announces another intake year
--   already_have   this guideline is already in the database
--   uploaded       the PDF was downloaded and uploaded by hand
--   no_guideline   the page carries no admission guideline at all
--   site_dead      the URL is dead or the host will not serve us
--   not_relevant   graduate-only, cyber university, domestic-only track
--   other          anything else -- `dismiss_detail` carries the words

alter table public.proposed_sources
  add column if not exists dismiss_reason text,
  add column if not exists dismiss_detail text;

alter table public.proposed_sources
  drop constraint if exists proposed_sources_dismiss_reason_check;

alter table public.proposed_sources
  add constraint proposed_sources_dismiss_reason_check
  check (dismiss_reason is null or dismiss_reason = any (array[
    'not_2027'::text, 'already_have'::text, 'uploaded'::text,
    'no_guideline'::text, 'site_dead'::text, 'not_relevant'::text,
    'other'::text
  ]));

comment on column public.proposed_sources.dismiss_reason is
  'Why a reviewer closed this link. Null on rows closed before '
  '20260823180000 — those predate the field and their reason, where there is '
  'one, is prose in review_notes.';

-- Backfill what this session already established, so the column is not born
-- with a hole where the 165 links closed earlier today should be. Both groups
-- were closed on evidence recorded at the time.
update public.proposed_sources
   set dismiss_reason = 'not_2027',
       dismiss_detail = 'Izohda faqat eski yil eslatilgan, 2027 emas (2026-08-23)'
 where status = 'dismissed'
   and dismiss_reason is null
   and review_notes like '%havolalar ro''yxatidan chiqarildi%';

update public.proposed_sources
   set dismiss_reason = 'not_2027',
       dismiss_detail = 'Havola ochib tekshirildi — sahifada 2027학년도 yo''q (2026-08-23)'
 where status = 'dismissed'
   and dismiss_reason is null;

-- CREATE OR REPLACE may only APPEND columns, so the two new ones go last --
-- renaming or reordering an existing view column is rejected outright.
create or replace view public.v_proposed_links_dashboard
with (security_invoker = true)
as
select
  ps.id,
  ps.url_ko,
  ps.source_type,
  ps.proposed_by,
  ps.proposed_at,
  ps.candidate_title,
  ps.candidate_snippet,
  ps.review_notes,
  ps.status,
  ps.reviewed_at,
  (ps.status = 'rejected') as was_closed,
  (ps.reviewed_by is not null) as closed_by_person,
  ps.dismiss_reason,
  ps.dismiss_detail
from public.proposed_sources ps
where ps.status = 'pending_review'
   or (
     ps.status = 'rejected'
     and (
       ps.reviewed_by is not null
       or (ps.review_notes is not null
           and ps.review_notes not like 'Auto-dismissed%')
     )
   )
order by ps.proposed_at desc;

grant select on public.v_proposed_links_dashboard to authenticated, anon, service_role;
