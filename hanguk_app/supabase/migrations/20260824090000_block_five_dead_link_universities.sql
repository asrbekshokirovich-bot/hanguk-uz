-- Five universities leave the Havolalar tab for good.
--
-- The first twelve links closed under the reason system (20260823180000) split
-- 7 `uploaded` / 3 `not_2027` / 2 `site_dead`. The seven uploads are finished
-- work — the PDF is in the database. The other five are not:
--
--   대구한의대학교      www.dhu.ac.kr          not_2027
--   송원대학교          iphak.songwon.ac.kr    not_2027
--   신라대학교          ipsi.silla.ac.kr       not_2027
--   안동과학대학교      ipsi.asc.ac.kr         site_dead
--   세종사이버대학교    go.sjcu.ac.kr          site_dead
--
-- and the operator asked for them to be gone, so that no future reopen brings
-- them back.
--
-- Deleting the rows alone would NOT do that. `propose_source._INSERT_SQL` is
-- `on conflict (url_ko) do update` — the row's continued existence at a
-- terminal status is the only thing keeping a re-crawled URL out of the queue.
-- Delete it and the next discovery sweep inserts it afresh at
-- `pending_review`, i.e. the card returns tomorrow. Worse, the crawler needs
-- only to find a *different* URL on the same host to bring the university back
-- under a new id, which no row-level state can prevent.
--
-- So the block is per HOST, held in its own table, enforced by a trigger on
-- the way in. Then the rows can be deleted as asked: the table, not the row,
-- is what remembers.
--
-- What is deliberately kept:
--   * 신라대's one `promoted` row. It is not a queue item — it is the
--     provenance record of an announcement_source. That source (a 2026학년도
--     notice) is retired below instead, which stops the polling without
--     orphaning the reference.
--   * every institution row. None of the five has a single guideline_document
--     (checked: 0 each), so nothing was extracted from them and nothing is
--     lost; but an institution is referenced across the CRM and dropping one
--     to silence a link is the wrong-sized hammer.

-- ---------------------------------------------------------------------------
-- 1. Host arithmetic, in one place.
-- ---------------------------------------------------------------------------

create or replace function public.link_host(url text)
returns text
language sql
immutable
as $$
  select lower(
    split_part(
      split_part(regexp_replace(coalesce(url, ''), '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''), '/', 1),
      ':', 1)
  )
$$;

comment on function public.link_host(text) is
  'Hostname of a URL, lowercased, port and credentials stripped. Returns '''' '
  'for null/garbage rather than raising — a blocklist check must never be the '
  'thing that kills a crawl.';

-- ---------------------------------------------------------------------------
-- 2. The blocklist.
-- ---------------------------------------------------------------------------

create table if not exists public.blocked_link_hosts (
  host                text primary key,
  institution_name_ko text not null,
  reason              text not null,
  detail              text,
  blocked_at          timestamptz not null default now(),
  blocked_by          uuid references auth.users (id) on delete set null,
  constraint blocked_link_hosts_reason_check check (reason = any (array[
    'not_2027'::text, 'already_have'::text, 'uploaded'::text,
    'no_guideline'::text, 'site_dead'::text, 'not_relevant'::text,
    'other'::text
  ])),
  -- A bare registrable domain, no scheme, no path, no leading dot. Subdomains
  -- are matched by suffix at check time, so `silla.ac.kr` covers
  -- `ipsi.silla.ac.kr` and `global.silla.ac.kr` without five rows for one
  -- university.
  constraint blocked_link_hosts_host_check check (
    host = lower(host) and host !~ '[/:]' and host !~ '^\.' and host <> ''
  )
);

comment on table public.blocked_link_hosts is
  'Hosts whose links must never enter the Havolalar tab again. Consulted by '
  'trg_proposed_sources_block_host on insert and by '
  'v_proposed_links_dashboard on read, so blocking a host both stops new '
  'candidates and hides any row that slipped in earlier.';

alter table public.blocked_link_hosts enable row level security;

drop policy if exists blocked_link_hosts_reviewer_read on public.blocked_link_hosts;
create policy blocked_link_hosts_reviewer_read on public.blocked_link_hosts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin', 'uni_db_reviewer')
    )
  );

drop policy if exists blocked_link_hosts_reviewer_write on public.blocked_link_hosts;
create policy blocked_link_hosts_reviewer_write on public.blocked_link_hosts
  for all using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin', 'uni_db_reviewer')
    )
  );

-- security definer: the trigger fires under the discovery worker and the view
-- is read by a reviewer, and neither should need a grant on a config table for
-- the block to hold. It reads five rows and returns a boolean.
create or replace function public.is_blocked_link(url text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocked_link_hosts b
    where public.link_host(url) = b.host
       or public.link_host(url) like '%.' || b.host
  )
$$;

comment on function public.is_blocked_link(text) is
  'True when the URL belongs to a blocked host or any of its subdomains.';

-- ---------------------------------------------------------------------------
-- 3. Enforce on the way in.
-- ---------------------------------------------------------------------------

create or replace function public.fn_proposed_sources_block_host()
returns trigger
language plpgsql
as $$
begin
  if public.is_blocked_link(new.url_ko) then
    -- RETURN NULL, not RAISE. The discovery sweep proposes hundreds of
    -- candidates per run in one loop; an exception would abort the batch over
    -- a link we simply do not want. Skipping is the whole intent.
    raise log 'proposed_sources: % is on a blocked host; not queued', new.url_ko;
    return null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_proposed_sources_block_host on public.proposed_sources;
create trigger trg_proposed_sources_block_host
  before insert on public.proposed_sources
  for each row execute function public.fn_proposed_sources_block_host();

-- ---------------------------------------------------------------------------
-- 4. Enforce on the way out, for rows blocked after they were already stored.
-- ---------------------------------------------------------------------------

-- CREATE OR REPLACE may only APPEND columns; the column list is unchanged and
-- only the WHERE gains a clause.
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
where not public.is_blocked_link(ps.url_ko)
  and (
    ps.status = 'pending_review'
    or (
      ps.status = 'rejected'
      and (
        ps.reviewed_by is not null
        or (ps.review_notes is not null
            and ps.review_notes not like 'Auto-dismissed%')
      )
    )
  )
order by ps.proposed_at desc;

grant select on public.v_proposed_links_dashboard to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 5. The five, and their rows.
-- ---------------------------------------------------------------------------

insert into public.blocked_link_hosts (host, institution_name_ko, reason, detail)
values
  ('dhu.ac.kr',     '대구한의대학교',   'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('songwon.ac.kr', '송원대학교',       'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('silla.ac.kr',   '신라대학교',       'not_2027',
   'Havola 2027 emas — 2026-08-24 da qo''lda yopilgan'),
  ('asc.ac.kr',     '안동과학대학교',   'site_dead',
   'Sayt javob bermaydi — 2026-08-24 da qo''lda yopilgan'),
  ('sjcu.ac.kr',    '세종사이버대학교', 'site_dead',
   'Sayt javob bermaydi — 2026-08-24 da qo''lda yopilgan')
on conflict (host) do nothing;

-- 32 rows across the five hosts: 7 dismissed, 25 rejected. The one `promoted`
-- row is excluded — see the header.
delete from public.proposed_sources ps
 where public.is_blocked_link(ps.url_ko)
   and ps.status <> 'promoted';

-- 신라대's promoted source is a 2026학년도 notice. Left `live` it would keep
-- being polled for a university we have just removed from the queue.
update public.announcement_sources
   set status = 'blocked',
       notes = coalesce(notes || ' | ', '')
               || 'Blocked 2026-08-24: institution dropped from the 2027 link queue'
 where public.is_blocked_link(url_ko)
   and status <> 'blocked';
