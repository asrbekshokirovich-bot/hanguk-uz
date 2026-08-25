-- Five more universities are in the table twice — under two names each.
--
-- 20260825070000 caught the pairs that share a name. These share a *domain*
-- and differ in name, because Korean universities rename themselves and the
-- crawler met both names. Their own `name_en` is what settles each case:
--
--   acts.ac.kr  아세아연합신학대학교 "Asia United Theological University"
--               아신대학교           "ACTS University"
--   kcu.ac.kr   그리스도대학교       "Christian University (Korea Christian University)"
--               한국기독교대학교     "Korea Christian University"
--               케이씨대학교         "KC University"
--   kkot.ac.kr  꽃동네대학교         "Catholic Kkottongnae University"
--               가톨릭꽃동네대학교   "Kkottongnae University"      (names crossed over)
--   ocu.ac.kr   열린사이버대학교     "Open Cyber University"
--               한국열린사이버대학교 "Open Cyber University of Korea"
--   ust.ac.kr   과학기술연합대학원대학교     "University of Science and Technology (UST)"
--               한국과학기술정보연구원대학교 "UST (University of Science & Technology)"
--
-- Three same-domain groups are NOT merged, because a shared domain there is a
-- data error rather than evidence of one school:
--
--   dsu.ac.kr    동신대학교 "Dongshin University"   — dsu.ac.kr is theirs
--                동서울대학교 "Dong Seoul University" — theirs is du.ac.kr
--   dhc.ac.kr    대구보건대학교 "Daegu Health College" — dhc.ac.kr is theirs
--                동아보건대학교 "Donga College of Health"
--   kopo.ac.kr   한국폴리텍대학 "Korea Polytechnics (multi-campus)"
--                한국폴리텍I 서울 "Korea Polytechnic I (Seoul)" — a campus of it
--
-- Merging 동서울대학교 into 동신대학교 would fuse two universities and take a
-- guideline document, 14 admission cycles and a programme with it. The fix
-- there is a corrected `primary_domain`, which is a separate decision about
-- where the crawler should go, so it is left for the operator.

-- The survivor is named, not derived. Child counts would pick correctly for
-- acts / kcu / kkot but choose arbitrarily for ocu and ust, where both rows are
-- empty and only the name distinguishes them — and the current, official name
-- is the one the CRM should display.
create temporary table rename_plan (primary_domain text, keeper_name text)
  on commit drop;

insert into rename_plan values
  ('acts.ac.kr', '아신대학교'),
  ('kcu.ac.kr',  '케이씨대학교'),
  ('kkot.ac.kr', '가톨릭꽃동네대학교'),
  ('ocu.ac.kr',  '한국열린사이버대학교'),
  ('ust.ac.kr',  '과학기술연합대학원대학교');

create temporary table rename_pairs on commit drop as
select loser.id as loser, keeper.id as keeper
  from rename_plan p
  join public.institutions keeper
    on keeper.primary_domain = p.primary_domain
   and keeper.name_ko = p.keeper_name
  join public.institutions loser
    on loser.primary_domain = p.primary_domain
   and loser.id <> keeper.id;

-- Every plan row must have found its keeper, or a typo in the list above would
-- silently merge nothing and this migration would report success.
do $$
declare missing text;
begin
  select string_agg(p.primary_domain, ', ')
    into missing
    from rename_plan p
   where not exists (select 1 from public.institutions i
                      where i.primary_domain = p.primary_domain
                        and i.name_ko = p.keeper_name);
  if missing is not null then
    raise exception 'keeper not found for: %', missing;
  end if;
end $$;

-- Same order as 20260825070000: move every child across all 27 referencing
-- tables first, delete the empty shell last. Most of those foreign keys cascade
-- on delete, so the reverse order would take programmes, cycles and documents
-- with the row.
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
         from rename_pairs p where t.%I = p.loser',
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
 using rename_pairs p
 where i.id = p.loser;
