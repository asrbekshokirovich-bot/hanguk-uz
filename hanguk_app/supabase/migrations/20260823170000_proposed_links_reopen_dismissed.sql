-- The Havolalar tab reads `status = 'pending_review'` and shows 0 links, while
-- 2 511 rows sit at 'rejected'. Not all of those deserve to come back:
--
--   167  a person dismissed by hand         <- bring back
--   240  auto-dismissed WITH a stated reason (PDF fetch failed, identity
--        unverified, cycle not published yet)  <- bring back: the host blocked
--        the crawler, which is exactly the case this tab exists for
--   888  "Auto-dismissed: not a 2027 Spring semester candidate" <- leave hidden,
--        the queue was deliberately narrowed to the 2027 intake
--  1216  one naver_search sweep on 2026-05-26, no reason recorded, sample rows
--        point at 2019 and 2026 PDFs  <- leave hidden, they are stale
--
-- Reopening 'rejected' creates a problem the review queue did not have: the
-- dismiss action writes `status='rejected'` and stamps `reviewed_by`, so a link
-- the operator closes TODAY would match the "a person dismissed it" rule and
-- reappear immediately — an un-closeable card. So dismissal gets its own
-- terminal state, and 'rejected' keeps its historical meaning.
--
-- `dismissed` is added to the CHECK rather than reusing 'duplicate' (wrong
-- meaning) or encoding state in `review_notes` (the auto-dismisser already
-- writes prose there; two writers on one column is how it starts lying).
alter table public.proposed_sources
  drop constraint proposed_sources_status_check;

alter table public.proposed_sources
  add constraint proposed_sources_status_check
  check (status = any (array[
    'pending_review'::text, 'approved'::text, 'promoted'::text,
    'rejected'::text, 'duplicate'::text,
    -- New: a reviewer has dealt with this link and it must not come back.
    'dismissed'::text
  ]));

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
  -- Lets the card say "this was closed before" instead of looking untouched.
  (ps.status = 'rejected') as was_closed,
  (ps.reviewed_by is not null) as closed_by_person
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

comment on view public.v_proposed_links_dashboard is
  'Guideline URLs a human should open by hand: still pending, plus the ones '
  'closed earlier for a stated reason (a person dismissed it, or the crawler '
  'recorded why it could not ingest). Excludes the 2027-cycle auto-filter and '
  'the stale 2026-05-26 naver sweep. A link dismissed from the UI moves to '
  'status=''dismissed'' and leaves this view for good.';

grant select on public.v_proposed_links_dashboard to authenticated, anon, service_role;
