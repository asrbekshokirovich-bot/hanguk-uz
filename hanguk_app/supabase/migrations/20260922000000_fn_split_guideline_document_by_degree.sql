-- ============================================================================
--  fn_split_guideline_document_by_degree — the missing half of the
--  "degree_split" document-flag card.
--
--  parse_worker.py already detects a guideline PDF that mixes undergraduate
--  and graduate admission info in one document (degree.is_combined + a real
--  section-header boundary from split_by_degree) and raises a document-level
--  review_queue card telling the reviewer to "split into separate admission
--  cycles... after the document has been split, Approve to remove this card."
--
--  But nothing in the system ever performed that split — clicking Approve
--  only dismissed the card; the underlying data stayed as one combined,
--  under-specified document. This RPC is the actual split action: it creates
--  (or reuses) the two admission_cycles rows the note describes — one for
--  each degree track — both linked to this guideline_document_id, and then
--  resolves the document-flag card since the split it asked for now exists.
--
--  Scope, stated plainly: this creates the two CYCLE records so both degree
--  levels are tracked and visible, marked needs_attention until their fields
--  are populated. It does not re-run extraction against the document a
--  second time scoped to the graduate section — that still happens through
--  the existing reparse/retry-failed pipeline, exactly how every other
--  admission_cycle's fields get filled in field-by-field as review items are
--  approved (see publish_worker.get_or_create_cycle, which this mirrors).
-- ============================================================================

set local search_path = public, pg_catalog;

create or replace function public.fn_split_guideline_document_by_degree(
  p_document_id     uuid,
  p_undergrad_track text default 'foreign',
  p_grad_track      text default 'grad_foreign',
  p_intake_year     smallint default null,
  p_intake_term     text default null
)
returns table(undergrad_cycle_id uuid, grad_cycle_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller          uuid := auth.uid();
  v_institution_id  uuid;
  v_year            smallint;
  v_term            text;
  v_undergrad_id    uuid;
  v_grad_id         uuid;
  v_category        constant text := '외국인전형';  -- matches publish_worker._DEFAULT_CATEGORY
  v_attention_note  constant text :=
    'Split from a combined undergraduate+graduate guideline — pending re-extraction for this track.';
begin
  if v_caller is null then
    raise exception 'fn_split_guideline_document_by_degree: auth.uid() is null';
  end if;
  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_split_guideline_document_by_degree: caller % is not authorized to review', v_caller;
  end if;

  select institution_id into v_institution_id
    from public.guideline_documents
   where id = p_document_id;

  if v_institution_id is null then
    raise exception 'fn_split_guideline_document_by_degree: guideline_document % not found', p_document_id;
  end if;

  -- Resolve which intake (year/term) this document targets: an explicit
  -- caller-supplied value wins, then any cycle already linked to this
  -- document, then the crawl target's default intake.
  v_year := p_intake_year;
  v_term := p_intake_term;

  if v_year is null or v_term is null then
    select intake_year, intake_term into v_year, v_term
      from public.admission_cycles
     where guideline_document_id = p_document_id
     order by created_at asc
     limit 1;
  end if;

  if v_year is null or v_term is null then
    select "year", season into v_year, v_term
      from public.intakes
     where is_default
     limit 1;
  end if;

  if v_year is null or v_term is null then
    raise exception
      'fn_split_guideline_document_by_degree: could not resolve an intake year/term for document % — pass p_intake_year/p_intake_term explicitly',
      p_document_id;
  end if;

  insert into public.admission_cycles
    (institution_id, intake_year, intake_term, cycle_track, round_number,
     applicant_category, guideline_document_id, status, needs_attention, attention_reason)
  values
    (v_institution_id, v_year, v_term, p_undergrad_track, 1,
     v_category, p_document_id, 'unverified', true, v_attention_note)
  on conflict (institution_id, intake_year, intake_term, cycle_track,
               round_number, applicant_category)
    do update set guideline_document_id = excluded.guideline_document_id,
                  needs_attention       = true,
                  attention_reason      = coalesce(admission_cycles.attention_reason, excluded.attention_reason),
                  updated_at            = now()
  returning id into v_undergrad_id;

  insert into public.admission_cycles
    (institution_id, intake_year, intake_term, cycle_track, round_number,
     applicant_category, guideline_document_id, status, needs_attention, attention_reason)
  values
    (v_institution_id, v_year, v_term, p_grad_track, 1,
     v_category, p_document_id, 'unverified', true, v_attention_note)
  on conflict (institution_id, intake_year, intake_term, cycle_track,
               round_number, applicant_category)
    do update set guideline_document_id = excluded.guideline_document_id,
                  needs_attention       = true,
                  attention_reason      = coalesce(admission_cycles.attention_reason, excluded.attention_reason),
                  updated_at            = now()
  returning id into v_grad_id;

  -- The split the card asked for now exists — resolve it like any other
  -- reviewer decision instead of leaving it to a manual, undocumented
  -- "approve once you've split it yourself" step.
  update public.review_queue
     set status         = 'approved',
         assigned_to    = v_caller,
         resolved_at    = now(),
         reviewer_notes = coalesce(reviewer_notes, '')
                           || E'\n[split] resolved — cycles ' || v_undergrad_id || ' / ' || v_grad_id
   where entity_type = 'guideline_documents'
     and entity_id   = p_document_id
     and status in ('open', 'in_review', 'rejected')
     and reviewer_notes ilike '%split into separate admission%';

  return query select v_undergrad_id, v_grad_id;
end
$$;

revoke all on function public.fn_split_guideline_document_by_degree(uuid, text, text, smallint, text) from public;
grant execute on function public.fn_split_guideline_document_by_degree(uuid, text, text, smallint, text)
  to authenticated, service_role;

comment on function public.fn_split_guideline_document_by_degree(uuid, text, text, smallint, text) is
  'Reviewer action for a degree_split document-flag card: creates the two admission_cycles the card describes (undergrad + grad, both linked to the guideline_document) and resolves the flag. Field-level data for each track still fills in through the normal extraction/review pipeline.';
