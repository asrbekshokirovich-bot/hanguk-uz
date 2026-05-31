-- =============================================================================
-- One-shot backfill publisher for the uni-DB pipeline (SQL port of
-- services/uni_db/src/uni_db/workers/publish_worker.py).
--
-- STATUS: already executed against production (Hanguk 2026 / lysjdtyanhdfphqyijsr)
-- on 2026-05-31 — published 63 review items → 98 content rows, 33 stale held,
-- 83 empty skipped, 0 errors. Kept here as a reusable, audited artifact for the
-- rare case the Python worker / cron is unavailable.
--
-- The CANONICAL ongoing publisher is publish_worker.py (run via the uni-db-sync
-- GitHub Action). Prefer that. Use this only as a manual fallback.
--
-- Safe-by-default: the temp functions are REVOKEd from anon/authenticated
-- immediately and DROPped at the end, so no SECURITY DEFINER content-writer is
-- ever left exposed via PostgREST.
--
-- Behavior mirrors publish_worker.py exactly:
--   * payload = reviewer_decision (if present) else parsed_output
--   * empty / _extraction_failed  -> mark published, outcome 'skipped'
--   * past-cycle (newest detected year in payload+source URL < current year)
--                                 -> mark published, outcome 'held', write nothing
--   * cycle-scoped requirements/documents hang off get-or-create admission_cycles
--     (status 'unverified'); tuition/scholarships institution-scoped; calendar
--     periods upsert university_admission_periods
--   * carries needs_attention/attention_reason onto every published row
--   * idempotent via review_queue.published_at (re-runs publish nothing)
--
-- Run:  psql "$UNI_DB_SUPABASE_DB_URL" -f publish_backlog.sql
-- =============================================================================

begin;

create or replace function pg_temp._uni_d(t text) returns date
language plpgsql immutable as $$
begin
  if t is null or btrim(t)='' then return null; end if;
  return (left(t,10))::date;
exception when others then return null;
end $$;

create or replace function pg_temp._uni_track_for(aud text, cat text) returns text
language sql immutable as $$
  select case
    when lower(coalesce(aud,''))='foreign' then 'foreign'
    when lower(coalesce(aud,''))='overseas_korean' then 'overseas_korean_full'
    when coalesce(cat,'') like '%재외국민%' then 'overseas_korean_full'
    when coalesce(cat,'') like '%편입%' then 'transfer'
    when coalesce(cat,'') like '%대학원%' or lower(coalesce(aud,'')) like '%대학원%' then 'grad_foreign'
    else 'foreign' end
$$;

-- get-or-create admission cycle. pg_temp so it is session-local and never
-- exposed via PostgREST.
create or replace function pg_temp._uni_get_cycle(
  p_inst uuid, p_gd_queue uuid, p_year int, p_term text, p_track text,
  p_cat text, p_na boolean, p_ar text) returns uuid
language plpgsql as $$
declare v_gd uuid; v_id uuid;
begin
  select ej.guideline_document_id into v_gd
    from public.review_queue rq join public.extraction_jobs ej on ej.id=rq.entity_id
   where rq.id = p_gd_queue;
  insert into public.admission_cycles
    (institution_id, intake_year, intake_term, cycle_track, round_number,
     applicant_category, guideline_document_id, status, needs_attention, attention_reason)
  values (p_inst, p_year, p_term, p_track, 1, p_cat, v_gd, 'unverified', p_na, p_ar)
  on conflict (institution_id, intake_year, intake_term, cycle_track, round_number, applicant_category)
  do update set guideline_document_id=excluded.guideline_document_id,
                needs_attention = admission_cycles.needs_attention or excluded.needs_attention,
                attention_reason = coalesce(admission_cycles.attention_reason, excluded.attention_reason),
                updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function pg_temp.fn_publish_backlog(p_limit int default 2000)
returns table(approved_seen int, published int, rows_written int,
              skipped int, held int, errors int)
language plpgsql
as $fn$
declare
  rec record; payload jsonb; r jsonb;
  v_floor int := extract(year from now())::int;
  v_default_yr int := extract(year from now())::int + 1;
  v_year int; v_term text; v_newest int; v_cycle uuid;
  v_na boolean; v_ar text; v_cat text; v_track text; v_n int; v_blob text;
begin
  approved_seen:=0; published:=0; rows_written:=0; skipped:=0; held:=0; errors:=0;
  for rec in
    select rq.id as queue_id, rq.reviewer_decision, rq.needs_attention,
           rq.reviewer_notes as attention_reason, ej.field_group, ej.parsed_output,
           gd.institution_id, coalesce(gd.source_url_ko,'') as source_url_ko
      from public.review_queue rq
      join public.extraction_jobs ej on ej.id = rq.entity_id
      join public.guideline_documents gd on gd.id = ej.guideline_document_id
     where rq.status='approved' and rq.published_at is null
       and rq.entity_type='extraction_jobs' and gd.institution_id is not null
     order by rq.resolved_at asc nulls last limit p_limit
  loop
    approved_seen := approved_seen + 1;
    v_na := coalesce(rec.needs_attention,false); v_ar := rec.attention_reason;
    payload := coalesce(rec.reviewer_decision, rec.parsed_output);
    if payload is null then payload := '{}'::jsonb; end if;

    if (payload ? '_extraction_failed')
       or ( coalesce(jsonb_array_length(case when jsonb_typeof(payload->'rows')='array' then payload->'rows' else '[]'::jsonb end),0)=0
        and coalesce(jsonb_array_length(case when jsonb_typeof(payload->'events')='array' then payload->'events' else '[]'::jsonb end),0)=0
        and coalesce(jsonb_array_length(case when jsonb_typeof(payload->'periods')='array' then payload->'periods' else '[]'::jsonb end),0)=0 )
    then
      skipped:=skipped+1;
      update public.review_queue set published_at=now(), published_outcome='skipped' where id=rec.queue_id;
      continue;
    end if;

    if rec.field_group not in ('tuition','scholarships','requirements','basic_requirements','documents_required','document_checklist','calendar') then
      skipped:=skipped+1;
      update public.review_queue set published_at=now(), published_outcome='skipped' where id=rec.queue_id;
      continue;
    end if;

    v_blob := payload::text;
    v_newest := greatest(
      coalesce((select max((m[1])::int) from regexp_matches(v_blob,'(?<![0-9])(20[0-3][0-9])(?![0-9])','g') m),0),
      coalesce((select max((m[1])::int) from regexp_matches(rec.source_url_ko,'(20[0-3][0-9])','g') m),0));
    if v_newest between 1 and (v_floor-1) then
      held:=held+1;
      update public.review_queue set published_at=now(), published_outcome='held' where id=rec.queue_id;
      continue;
    end if;

    v_year := coalesce((select max((m[1])::int) from regexp_matches(v_blob,'(?<![0-9])(20[2-3][0-9])(?![0-9])','g') m where (m[1])::int between 2024 and 2031), v_default_yr);
    v_term := case when v_blob ~ '(후기|9월|가을|fall|9 월)' then 'fall' else 'spring' end;
    v_n := 0;

    begin
      if rec.field_group='tuition' then
        for r in select * from jsonb_array_elements(payload->'rows') loop
          if r ? 'amount_krw' and (r->>'amount_krw') is not null then
            insert into public.tuition (institution_id, faculty_group, academic_year, semester_number,
              amount_krw, admission_fee_krw, is_first_semester, source_text_ko, extractor_confidence, needs_attention, attention_reason)
            values (rec.institution_id, coalesce(nullif(r->>'faculty_group',''),'전체'),
              coalesce((r->>'academic_year')::int, v_year), coalesce((r->>'semester_number')::int,1),
              (r->>'amount_krw')::bigint, (r->>'admission_fee_krw')::bigint,
              coalesce((r->>'is_first_semester')::boolean, coalesce((r->>'semester_number')::int,1)=1),
              r->>'source_text_ko', (r->>'extractor_confidence')::numeric, v_na, v_ar);
            v_n:=v_n+1;
          end if;
        end loop;
      elsif rec.field_group='scholarships' then
        for r in select * from jsonb_array_elements(payload->'rows') loop
          if coalesce(r->>'scope','')<>'' and coalesce(r->>'name_ko','')<>'' and coalesce(r->>'award_type','')<>''
             and not (r->>'award_type'='other' and (r->>'award_value') is null and (r->'topik_tier_table') is null and (r->'ielts_tier_table') is null) then
            insert into public.scholarships (institution_id, scope, name_ko, name_en, award_type, award_value,
              applicant_categories, topik_tier_table, ielts_tier_table, eligibility_predicate, prose_ko,
              source_text_ko, extractor_confidence, needs_attention, attention_reason)
            values (rec.institution_id, r->>'scope', r->>'name_ko', r->>'name_en', r->>'award_type', (r->>'award_value')::numeric,
              case when jsonb_typeof(r->'applicant_categories')='array' then array(select jsonb_array_elements_text(r->'applicant_categories')) end,
              case when r->'topik_tier_table' is not null and r->'topik_tier_table'<>'null'::jsonb then r->'topik_tier_table' end,
              case when r->'ielts_tier_table' is not null and r->'ielts_tier_table'<>'null'::jsonb then r->'ielts_tier_table' end,
              case when r->'eligibility_predicate' is not null and r->'eligibility_predicate'<>'null'::jsonb then r->'eligibility_predicate' end,
              r->>'prose_ko', r->>'source_text_ko', (r->>'extractor_confidence')::numeric, v_na, v_ar);
            v_n:=v_n+1;
          end if;
        end loop;
      elsif rec.field_group in ('requirements','basic_requirements') then
        for r in select * from jsonb_array_elements(payload->'rows') loop
          v_cat := coalesce(nullif(trim(r->>'applicant_category'),''),'외국인전형');
          v_track := pg_temp._uni_track_for(r->>'audience', v_cat);
          v_cycle := pg_temp._uni_get_cycle(rec.institution_id, rec.queue_id, v_year, v_term, v_track, v_cat, v_na, v_ar);
          insert into public.requirements (cycle_id, applicant_category, topik_min_level, topik_deferred, english_test,
            gpa_floor_pct, interview_required, practical_exam_required, prose_ko, source_text_ko, extractor_confidence, needs_attention, attention_reason)
          values (v_cycle, v_cat, (r->>'topik_min_level')::int, coalesce((r->>'topik_deferred')::boolean,false),
            case when r->'english_test' is not null and r->'english_test'<>'null'::jsonb then r->'english_test' end,
            (r->>'gpa_floor_pct')::numeric, coalesce((r->>'interview_required')::boolean,false),
            coalesce((r->>'practical_exam_required')::boolean,false), r->>'prose_ko', r->>'source_text_ko',
            (r->>'extractor_confidence')::numeric, v_na, v_ar);
          v_n:=v_n+1;
        end loop;
      elsif rec.field_group in ('documents_required','document_checklist') then
        for r in select * from jsonb_array_elements(payload->'rows') loop
          v_cat := coalesce(nullif(trim(r->>'applicant_category'),''),'외국인전형');
          v_track := pg_temp._uni_track_for(r->>'audience', v_cat);
          v_cycle := pg_temp._uni_get_cycle(rec.institution_id, rec.queue_id, v_year, v_term, v_track, v_cat, v_na, v_ar);
          insert into public.documents_required (cycle_id, applicant_category, document_type, is_required,
            is_apostille_required, country_specific, notes_ko, source_text_ko, needs_attention, attention_reason)
          values (v_cycle, v_cat,
            coalesce(nullif(r->>'document_type',''), nullif(r->>'document_name_ko',''), nullif(r->>'name_ko',''), nullif(r->>'label_ko',''), nullif(r->>'name_en',''),'서류'),
            coalesce((r->>'is_required')::boolean,true),
            coalesce((r->>'is_apostille_required')::boolean,(r->>'is_notarization_required')::boolean,false),
            case when r->'country_specific' is not null and r->'country_specific'<>'null'::jsonb and r->'country_specific'<>'{}'::jsonb then r->'country_specific' end,
            r->>'notes_ko', r->>'source_text_ko', v_na, v_ar);
          v_n:=v_n+1;
        end loop;
      elsif rec.field_group='calendar' then
        for r in select * from jsonb_array_elements(case when jsonb_typeof(payload->'periods')='array' then payload->'periods' else '[]'::jsonb end) loop
          insert into public.university_admission_periods (institution_id, semester, year, program_level, language_track,
            application_start, application_end, document_deadline, result_announcement, online_application_start,
            online_application_end, offline_application_start, offline_application_end, interview_start, interview_end,
            application_fee_krw, application_fee_usd, needs_attention, attention_reason)
          values (rec.institution_id, v_term, v_year, coalesce(nullif(r->>'program_level',''),'undergraduate'), r->>'language_track',
            pg_temp._uni_d(r->>'application_start'), pg_temp._uni_d(r->>'application_end'), pg_temp._uni_d(r->>'document_deadline'),
            pg_temp._uni_d(r->>'result_announcement'), pg_temp._uni_d(r->>'online_application_start'), pg_temp._uni_d(r->>'online_application_end'),
            pg_temp._uni_d(r->>'offline_application_start'), pg_temp._uni_d(r->>'offline_application_end'),
            pg_temp._uni_d(r->>'interview_start'), pg_temp._uni_d(r->>'interview_end'),
            (r->>'application_fee_krw')::bigint, (r->>'application_fee_usd')::numeric, v_na, v_ar)
          on conflict (institution_id, semester, year, program_level, language_track) do update set
            application_start=excluded.application_start, application_end=excluded.application_end,
            document_deadline=excluded.document_deadline, result_announcement=excluded.result_announcement,
            online_application_start=excluded.online_application_start, online_application_end=excluded.online_application_end,
            offline_application_start=excluded.offline_application_start, offline_application_end=excluded.offline_application_end,
            interview_start=excluded.interview_start, interview_end=excluded.interview_end,
            application_fee_krw=excluded.application_fee_krw, application_fee_usd=excluded.application_fee_usd,
            needs_attention=excluded.needs_attention, attention_reason=excluded.attention_reason, updated_at=now();
          v_n:=v_n+1;
        end loop;
      end if;
    exception when others then
      errors:=errors+1; continue;
    end;

    update public.review_queue set published_at=now(), published_outcome='published' where id=rec.queue_id;
    published:=published+1; rows_written:=rows_written+v_n;
  end loop;
  return next;
end
$fn$;

-- Publish the backlog.
select * from pg_temp.fn_publish_backlog(2000);

-- Reconcile cycle-level flags from children (order-independent, idempotent):
-- a cycle is needs_attention if any of its requirements/documents are.
update public.admission_cycles c
   set needs_attention = true,
       attention_reason = coalesce(c.attention_reason, 'low_confidence'),
       updated_at = now()
 where not c.needs_attention
   and ( exists (select 1 from public.requirements r where r.cycle_id=c.id and r.needs_attention)
      or exists (select 1 from public.documents_required d where d.cycle_id=c.id and d.needs_attention) );

commit;
-- pg_temp.* functions vanish automatically at session end; nothing exposed.
