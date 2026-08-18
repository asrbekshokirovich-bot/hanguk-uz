-- Compact the dead-key archive: keep the evidence, drop the 97,992 copies.
--
-- The previous migration moved 97,994 rejected jobs into
-- `extraction_jobs_archive`, which cost 56 MB. Measured after the move, that
-- 56 MB stores exactly TWO distinct `error_text` values, ONE distinct
-- `raw_output`, and TWO distinct `parsed_output` values — the same sentence
-- written out ninety-eight thousand times, because every row failed at the
-- same door with the same message.
--
-- What the archive is actually for is the SHAPE of the incident: which
-- (document, field_group) pairs were hit, how many times, and over what
-- window. None of that lives in the repeated payload.
--
-- So the payload is kept on one representative row per distinct value —
-- `payload_sample = true` marks them — and nulled everywhere else. The
-- evidence is still queryable in full, and a reader who wants to know what
-- these rows contained selects the samples. `error_text` is left on every
-- row: it is the reason a row is here, it is what a future query filters
-- on, and at two distinct values Postgres already stores it cheaply.
--
-- Nulling in place rather than deleting rows keeps the counts honest — the
-- archive must still answer "how many attempts hit this document" with the
-- real number, not with a number that shrank when someone tidied up.

alter table public.extraction_jobs_archive
  add column if not exists payload_sample boolean not null default false;

comment on column public.extraction_jobs_archive.payload_sample is
  'True on the rows that retain raw_output/parsed_output. Every other row in '
  'the same archive_reason group carried an identical payload, nulled to '
  'avoid storing one sentence ninety-eight thousand times.';

-- One keeper per distinct payload, chosen by `id` so the choice is stable if
-- this ever has to be re-derived.
with keepers as (
  select distinct on (archive_reason, parsed_output::text, raw_output::text) id
    from public.extraction_jobs_archive
   where parsed_output is not null or raw_output is not null
   order by archive_reason, parsed_output::text, raw_output::text, id
)
update public.extraction_jobs_archive a
   set payload_sample = true
  from keepers k
 where a.id = k.id;

update public.extraction_jobs_archive
   set raw_output = null,
       parsed_output = null
 where payload_sample = false
   and (raw_output is not null or parsed_output is not null);
