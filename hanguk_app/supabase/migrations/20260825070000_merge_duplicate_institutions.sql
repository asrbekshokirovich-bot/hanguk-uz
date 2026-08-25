-- Six universities are in `institutions` twice.
--
-- Same Korean name, same domain, two rows — and because everything downstream
-- keys on institution_id, the two halves accumulate separate histories. 덕성
-- 여자대학교 is the case that shows why this is not cosmetic: one row holds 4
-- student applications, 2 guideline documents and a room; the other holds 10
-- admission cycles and a third document. Neither row is the university.
--
-- Two same-name pairs are deliberately NOT merged, because they are not
-- duplicates — they are two institutions the crawler gave one name:
--
--   국제사이버대학교   icu.ac.kr   vs  gjcu.ac.kr
--   동원대학교         dist.ac.kr  vs  tw.ac.kr
--
-- Merging those would fuse two schools into one. The name is what collides;
-- the domain is what identifies, so the domain is part of the key here and of
-- the constraint at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Who survives.
-- ---------------------------------------------------------------------------

-- 27 tables reference institutions and most cascade on delete, so deleting the
-- loser before its children are moved would silently take programs, tuition,
-- scholarships, admission cycles and guideline documents with it. Everything
-- below therefore moves first and deletes last.
--
-- The survivor is the row carrying more history, counted across every
-- referencing table rather than guessed from one of them — `guideline_documents`
-- alone would have picked the wrong 고려사이버대학교, whose only trace is a
-- crawl_run. Age breaks a genuine tie.
create temporary table dup_children (inst uuid, n bigint) on commit drop;

do $$
declare r record;
begin
  for r in
    select conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join lateral unnest(c.conkey) as k(attnum) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and c.confrelid = 'public.institutions'::regclass
  loop
    execute format(
      'insert into dup_children
       select %I, count(*) from public.%s where %I is not null group by 1',
      r.col, r.tbl, r.col);
  end loop;
end $$;

create temporary table dup_plan on commit drop as
with totals as (
  select i.id, i.name_ko, i.primary_domain, i.created_at,
         coalesce((select sum(n) from dup_children d where d.inst = i.id), 0) as weight
    from public.institutions i
),
ranked as (
  select *, row_number() over (
             partition by name_ko, primary_domain
             order by weight desc, created_at, id) as rn,
            first_value(id) over (
             partition by name_ko, primary_domain
             order by weight desc, created_at, id) as keeper
    from totals
)
select id as loser, keeper, name_ko, primary_domain
  from ranked
 where rn > 1;

-- ---------------------------------------------------------------------------
-- 2. Move every child, then drop the empty shell.
-- ---------------------------------------------------------------------------

do $$
declare r record; moved bigint; total bigint := 0;
begin
  for r in
    select conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join lateral unnest(c.conkey) as k(attnum) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and c.confrelid = 'public.institutions'::regclass
  loop
    execute format(
      'update public.%s t set %I = p.keeper
         from dup_plan p where t.%I = p.loser',
      r.tbl, r.col, r.col);
    get diagnostics moved = row_count;
    total := total + moved;
    if moved > 0 then
      raise notice 'merge: moved % row(s) in %', moved, r.tbl;
    end if;
  end loop;
  raise notice 'merge: % child row(s) reassigned in total', total;
end $$;

delete from public.institutions i
 using dup_plan p
 where i.id = p.loser;

-- 송원대학교 is a four-year private university; the row that survived the merge
-- carries whichever type the crawler guessed, and one of the two halves had it
-- as `junior_college`. Correct it explicitly rather than leave the outcome to
-- which row happened to win.
update public.institutions
   set institution_type = 'private'
 where name_ko = '송원대학교'
   and primary_domain = 'songwon.ac.kr'
   and institution_type <> 'private';

-- ---------------------------------------------------------------------------
-- 3. Stop it happening again.
-- ---------------------------------------------------------------------------

-- Name alone would reject 국제사이버대학교 and 동원대학교, which are two real
-- schools apiece. Name plus domain is the pair that actually means "this is the
-- same university" — and `primary_domain` is not null on any of the 420 rows,
-- so the index has no hole to leak through.
create unique index if not exists uq_institutions_name_domain
  on public.institutions (name_ko, primary_domain);
