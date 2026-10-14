-- Lead module v2 (spec "HANGUK Lid bo'limi TT", 2026-10-05) — part 5 of 5: old leads.
--
-- Spec §16 / decision 9.2. Every lead that lived in the old CRM becomes
-- crm_generation = 'old' (the column default did that for existing rows when
-- 20261014201000 added the column) and moves to "Baza":
--
--   * stage from the old status:
--       new / contacted / qualified  -> contacted  ("Aloqada")
--       converted                    -> student    ("Talaba")
--       lost                         -> lost       ("Yo'qotildi")
--   * the 05.10 analysis (ai_summary), the notes, the call result, the
--     next_follow_up date (the 38 callbacks of the old operators — open
--     question 67) are NOT touched;
--   * nothing lands on the desk: due_at stays empty, no timer, no alert;
--   * lost leads get a reason, mapped from the "Rad etildi:" line the old
--     screen wrote into `notes`, and a reactivation-queue row;
--   * the queue rows wait: due_at is NULL, so nothing flows to BUGUN until a
--     senior presses "Navbatni boshlash" (otherwise the first run of
--     lead-reactivation would push 15 old leads a day onto the operators
--     without anybody deciding to);
--   * the season filter (intake_id) is no longer applied by the new screens;
--     target_intake stays as a field.
--
-- Safe to re-run: only rows that have not been migrated yet (stage_changed_at
-- is NULL) are touched. It writes only to old-generation rows.
--
-- Everything below runs with the lead triggers switched off for this
-- transaction (lead_v2.merging), so 600+ rows do not write 600 stage events
-- or send 600 "student" alerts to the boss.

do $$
declare
  r record;
  v_reason text;
  v_comp text;
  v_line text;
  n_total integer := 0;
  n_lost integer := 0;
  n_student integer := 0;
  n_active integer := 0;
begin
  perform set_config('lead_v2.merging', '1', true);

  for r in
    select l.id, l.status, l.notes, l.cert_level, l.converted_to_student_id, l.updated_at, l.created_at
      from public.leads l
     where l.crm_generation = 'old'
       and l.stage_changed_at is null
       and l.merged_into_id is null
  loop
    n_total := n_total + 1;

    if r.status = 'converted' or r.converted_to_student_id is not null then
      update public.leads
         set stage = 'student', stage_changed_at = coalesce(r.updated_at, r.created_at)
       where id = r.id;
      n_student := n_student + 1;

    elsif r.status = 'lost' then
      -- the old reject screen wrote "Rad etildi: <reason> — <detail>" into notes
      select trim(x) into v_line
        from unnest(string_to_array(coalesce(r.notes, ''), E'\n')) x
       where trim(x) like 'Rad etildi:%'
       limit 1;
      v_reason := lower(coalesce(v_line, ''));
      v_comp := null;

      if v_reason like '%qiziqmaydi%' then
        v_reason := 'not_interested';
      elsif v_reason like '%byudjet%' then
        v_reason := 'price';
      elsif v_reason like '%hujjat%' then
        v_reason := case when coalesce(nullif(trim(r.cert_level), ''), 'Yo''q') = 'Yo''q'
                         then 'no_certificate' else 'not_fit' end;
      elsif v_reason like '%boshqa markaz%' then
        v_reason := 'other_center';
        v_comp := nullif(trim(split_part(v_line, '—', 2)), '');
      elsif v_reason like '%bog''lanib%' or v_reason like '%boglanib%' then
        v_reason := 'no_contact';
      elsif v_reason like '%dublikat%' then
        v_reason := 'spam_duplicate';
      elsif lower(coalesce(r.notes, '')) like '%dublikat%' then
        v_reason := 'spam_duplicate';
      else
        v_reason := 'not_interested';
      end if;

      update public.leads
         set stage = 'lost', lost_reason = v_reason, lost_competitor = v_comp,
             competitor = coalesce(competitor, v_comp),
             lost_at = coalesce(r.updated_at, r.created_at),
             stage_changed_at = coalesce(r.updated_at, r.created_at)
       where id = r.id;
      perform public.fn_lead_enqueue_reactivation(r.id, v_reason);
      n_lost := n_lost + 1;

    else
      update public.leads
         set stage = 'contacted', stage_changed_at = coalesce(r.updated_at, r.created_at)
       where id = r.id;
      n_active := n_active + 1;
    end if;
  end loop;

  -- Nothing starts by itself: the queues wait for "Navbatni boshlash".
  update public.reactivation_queues q
     set due_at = null
   where q.status = 'waiting'
     and exists (select 1 from public.leads l where l.id = q.lead_id and l.crm_generation = 'old');

  raise notice 'lead v2 migration: % old leads (% active -> Aloqada, % students, % lost with queues)',
    n_total, n_active, n_student, n_lost;
  perform set_config('lead_v2.merging', '', true);
end $$;
