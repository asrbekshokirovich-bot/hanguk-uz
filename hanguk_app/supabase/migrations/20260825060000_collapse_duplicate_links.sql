-- One guideline, one card.
--
-- The operator's complaint, in their words: "bitta link 2 yoki 3 marta
-- takrorlanib kelayapdi". 순천향대학교 is the clearest case — four cards in the
-- queue for a single PDF:
--
--   …/download.do?sfn=20260612032140994_2027%ED%95%99…모집요강.pdf
--   …/download.do?sfn=20260612032140994_2027%ed%95%99…모집요강.pdf&ofn=…
--   …/download.do?sfn=20260612032203548_2027%ed%95%99…모집요강.pdf
--   …/download.do?sfn=20260612032203548_2027%ED%95%99…모집요강.pdf&ofn=…
--
-- Three separate reasons why `unique(url_ko)` sees four distinct links:
--   * percent-escape case — %ED%95%99 vs %ed%95%99 is the same byte, but not
--     the same string;
--   * an `&ofn=` parameter that only tells the browser what to name the
--     download;
--   * two upload ids 23 seconds apart, the university having posted the same
--     file twice.
--
-- No amount of string equality collapses those. What identifies the document
-- is the filename it is served under, so that is the key:
--
--   host + the longest document filename in the URL, escapes lowercased and an
--   upload-timestamp prefix dropped — falling back to the whole normalised URL
--   when the link carries no filename at all.
--
-- The fallback is the important half. 부경대's two links are
-- `filedown.php?bbsid=pdf_paper&file_seq=1565` and
-- `?bbsid=notice&file_seq=1562`, and 충남대's are `?code=notice_intl` and
-- `?code=notice_faculty` — different documents behind identical paths. A rule
-- like "same path, ignore the query" would have merged those and quietly
-- deleted a guideline. Under-merging leaves an extra card; over-merging loses a
-- document, so where the URL does not name a file, nothing is assumed.
--
-- Two near-duplicates are therefore left standing on purpose: 대구대's
-- `pdfViewer/CAT076` vs `CAT076?download=1`, and 차의과학's `/` vs
-- `/?kboard_content_redirect=3310`. Both are the same page — but the rule that
-- would catch them is the same rule that would have eaten 부경대's second file.

-- ---------------------------------------------------------------------------
-- 1. The key.
-- ---------------------------------------------------------------------------

create or replace function public.link_dedup_key(url text)
returns text
language plpgsql
immutable
as $$
declare
  bare text; host text; rest text; norm text; fname text;
begin
  bare := rtrim(regexp_replace(coalesce(url, ''), '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''), '/');
  host := regexp_replace(lower(split_part(bare, '/', 1)), '^www\.', '');
  rest := case when position('/' in bare) > 0
               then substring(bare from position('/' in bare)) else '' end;

  -- Lowercase every %XY escape, so %ED%95%99 and %ed%95%99 stop being two
  -- links. Only the escapes: the rest of a query string is case-sensitive and
  -- routinely carries base64 ids, which lowercasing would collide.
  select coalesce(string_agg(
           case when m.arr[1] ~ '^%[0-9A-Fa-f]{2}$' then lower(m.arr[1]) else m.arr[1] end,
           '' order by m.ord), '')
    into norm
    from regexp_matches(rest, '%[0-9A-Fa-f]{2}|[^%]+|%', 'g') with ordinality as m(arr, ord);

  -- The LONGEST filename in the URL, not the first or last one. A download
  -- endpoint routinely carries two — `?sfn=<real name>.pdf&ofn=<display>.pdf` —
  -- and picking by position lets the display name decide the document's
  -- identity. It can be anything: a self-test with `&ofn=x.pdf` slipped a
  -- known duplicate straight past the last-match version of this rule.
  --
  -- The `length >= 8` floor is what keeps the timestamp strip honest. 경기대
  -- serves `1781656406769_0.pdf`; reduced to `0.pdf` that would collide with
  -- every other `0.pdf` on the host, so it is rejected as a name and the URL
  -- falls through to the whole-string branch.
  select f into fname
    from (select regexp_replace(m.arr[1], '^[0-9]{8,}[_-]', '') as f
            from regexp_matches(norm,
                   '[^/?&=]+\.(?:pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip)', 'g') as m(arr)) c
   where length(f) >= 8
   order by length(f) desc, f
   limit 1;

  if fname is not null then
    return host || '|' || fname;
  end if;
  return host || norm;
end
$$;

comment on function public.link_dedup_key(text) is
  'Identity of the document a link points at: host + longest filename where '
  'the URL names one, else the whole normalised URL. Escape case, an &ofn= '
  'display parameter and an upload-timestamp prefix are all noise and are '
  'removed; query strings are otherwise preserved, because two guidelines '
  'routinely differ only there.';

-- ---------------------------------------------------------------------------
-- 2. Collapse what is already stored.
-- ---------------------------------------------------------------------------

-- Which row survives is not arbitrary. A `promoted` row is referenced by an
-- announcement_source; a row the operator has already ruled on carries a
-- decision that must not be thrown away and re-asked. Only when the group is
-- undifferentiated does age decide.
with ranked as (
  select id,
         row_number() over (
           partition by public.link_dedup_key(url_ko)
           order by case status
                      when 'promoted'       then 0
                      when 'dismissed'      then 1
                      when 'approved'       then 2
                      when 'rejected'       then 3
                      when 'pending_review' then 4
                      else 5
                    end,
                    proposed_at,
                    id
         ) as rn
  from public.proposed_sources
)
delete from public.proposed_sources ps
 using ranked r
 where ps.id = r.id
   and r.rn > 1;

-- ---------------------------------------------------------------------------
-- 3. Keep them from coming back.
-- ---------------------------------------------------------------------------

-- Deleting alone would not hold, for the reason 20260824090000 spelled out:
-- `propose_source` inserts with `on conflict (url_ko) do update`, so a deleted
-- row is re-inserted at `pending_review` on the next sweep — and a duplicate
-- is by definition a *different* url_ko, which no unique constraint on that
-- column can catch. The check has to be on the key.
--
-- A unique index on link_dedup_key(url_ko) would be the obvious move and is
-- the wrong one: it makes the insert raise, and `on conflict (url_ko)` cannot
-- absorb a violation of a different constraint, so one duplicate candidate
-- would abort a sweep of hundreds. The existing block trigger already has the
-- right shape — skip the row, keep going — so the check joins it there.
create or replace function public.fn_proposed_sources_block_host()
returns trigger
language plpgsql
as $$
begin
  if public.is_blocked_link(new.url_ko) then
    raise log 'proposed_sources: % is on a blocked host; not queued', new.url_ko;
    return null;
  end if;

  -- Same document, different URL string. The `url_ko <> new.url_ko` guard
  -- matters: when the URL is byte-identical the caller's `on conflict do
  -- update` is the right path, and swallowing the insert here would silently
  -- stop the title/snippet refresh it exists to perform.
  if exists (
    select 1 from public.proposed_sources ps
     where ps.url_ko <> new.url_ko
       and public.link_dedup_key(ps.url_ko) = public.link_dedup_key(new.url_ko)
  ) then
    raise log 'proposed_sources: % duplicates a stored link; not queued', new.url_ko;
    return null;
  end if;

  return new;
end
$$;

-- The dedup check would otherwise scan the table once per insert, and the
-- sweep inserts in a loop. Dropped first because a functional index built on
-- an earlier body of `link_dedup_key` would keep answering with the old key.
drop index if exists public.idx_proposed_sources_dedup_key;
create index idx_proposed_sources_dedup_key
  on public.proposed_sources (public.link_dedup_key(url_ko));
