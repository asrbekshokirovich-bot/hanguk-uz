-- ============================================================================
--  uni_db v2 — proposed_sources HITL approval queue
--
--  Plan §E.4 / §E.6 + audit §6.9. The discovery loop's Naver search
--  adapter (and other "wide net" sources) frequently surfaces URLs
--  that *might* be admission boards. We MUST NOT promote them to
--  `announcement_sources` automatically — RLS policies would then
--  expose untrusted URLs to the crawler at full polling cadence.
--
--  Workflow:
--    1. Discovery worker sees a candidate URL.
--    2. Insert into `proposed_sources` with status='pending_review'.
--    3. HITL reviewer reads the candidate, verifies it points at a
--       legitimate `.ac.kr` admission board.
--    4. Reviewer either:
--       (a) Approves → trigger copies row to `announcement_sources`
--           with status='live'; proposed row marked status='promoted'.
--       (b) Rejects → proposed row marked status='rejected' with
--           reason text. Future occurrences of the same URL are
--           short-circuited (no re-propose).
--
--  Indexes are tuned for: (a) "show me pending review queue, oldest
--  first" and (b) "is this URL already proposed/rejected/promoted?"
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  proposed_sources
-- ----------------------------------------------------------------------------
create table if not exists public.proposed_sources (
  id                uuid primary key default gen_random_uuid(),
  url_ko            text not null,                    -- candidate URL (KO-side per §P.1)
  source_type       text not null check (source_type in (
    'university_admission_board','university_oia_board',
    'moe_okep','adiga','study_in_korea','niied','other_korean'
  )),
  proposed_by       text not null check (proposed_by in (
    'naver_search', 'google_pse', 'okep_upstream',
    'adiga_upstream', 'manual'
  )),
  proposed_at       timestamptz not null default now(),
  candidate_title   text,                              -- title hit from search engine
  candidate_snippet text,                              -- search-result excerpt
  matched_keywords  text[] default array[]::text[],   -- which §6.3 anchors fired
  status            text not null default 'pending_review' check (status in (
    'pending_review','approved','promoted','rejected','duplicate'
  )),
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  review_notes      text,
  -- When promoted, this points at the row it created in announcement_sources.
  promoted_to_id    uuid references public.announcement_sources(id),
  unique (url_ko)
);

create index if not exists proposed_sources_status_proposed_idx
  on public.proposed_sources (status, proposed_at);
create index if not exists proposed_sources_proposed_by_idx
  on public.proposed_sources (proposed_by);

alter table public.proposed_sources enable row level security;

-- Reviewers + admins read; service role writes (no anon/authenticated
-- write — discovery worker is service-role).
drop policy if exists proposed_sources_reviewer_read on public.proposed_sources;
create policy proposed_sources_reviewer_read on public.proposed_sources
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin','uni_db_reviewer')
    )
  );

drop policy if exists proposed_sources_reviewer_update on public.proposed_sources;
create policy proposed_sources_reviewer_update on public.proposed_sources
  for update using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin','uni_db_reviewer')
    )
  );

comment on table public.proposed_sources is
  'Plan §E.4 — discovery worker queues candidate URLs here for HITL '
  'approval before they are promoted to announcement_sources. '
  'The unique(url_ko) constraint short-circuits duplicates.';

-- ----------------------------------------------------------------------------
--  Promotion trigger — when reviewer flips status to 'approved',
--  copy to announcement_sources and mark as 'promoted'.
-- ----------------------------------------------------------------------------
create or replace function public.trg_fn_proposed_source_promote()
returns trigger
language plpgsql
as $$
declare
  v_new_id uuid;
begin
  if NEW.status <> 'approved' or OLD.status = 'approved' then
    return NEW;
  end if;

  -- Idempotent — if already in announcement_sources, just link.
  select id into v_new_id
    from public.announcement_sources
    where url_ko = NEW.url_ko;

  if v_new_id is null then
    insert into public.announcement_sources (
      source_type, url_ko, status, notes
    ) values (
      NEW.source_type,
      NEW.url_ko,
      'live',
      coalesce(
        'Promoted from proposed_sources ' || NEW.id::text || '. '
          || coalesce(NEW.review_notes, ''),
        ''
      )
    )
    returning id into v_new_id;
  end if;

  NEW.status         := 'promoted';
  NEW.promoted_to_id := v_new_id;
  NEW.reviewed_by    := coalesce(NEW.reviewed_by, auth.uid());
  NEW.reviewed_at    := coalesce(NEW.reviewed_at, now());

  return NEW;
end $$;

drop trigger if exists trg_proposed_source_promote on public.proposed_sources;
create trigger trg_proposed_source_promote
  before update on public.proposed_sources
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.trg_fn_proposed_source_promote();

-- ----------------------------------------------------------------------------
--  v_proposed_sources_queue — HITL review-queue view
-- ----------------------------------------------------------------------------
create or replace view public.v_proposed_sources_queue as
select
  ps.id,
  ps.url_ko,
  ps.source_type,
  ps.proposed_by,
  ps.proposed_at,
  ps.candidate_title,
  ps.candidate_snippet,
  ps.matched_keywords,
  age(now(), ps.proposed_at) as age,
  case
    when array_length(ps.matched_keywords, 1) >= 3 then 1   -- strong signal
    when array_length(ps.matched_keywords, 1) = 2 then 2
    else 3
  end as priority
from public.proposed_sources ps
where ps.status = 'pending_review'
order by priority asc, ps.proposed_at asc;

comment on view public.v_proposed_sources_queue is
  'HITL queue ordered by signal strength (matched keywords) then age. '
  'Reviewers work top-down to approve / reject discovery proposals.';
