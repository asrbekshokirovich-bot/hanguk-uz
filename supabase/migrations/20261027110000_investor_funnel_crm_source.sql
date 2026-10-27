-- Investor "Mavsum jarayoni" counts the same way as the CRM Arizalar board
-- (src/components/crm/pages/ApplicationsPipeline.tsx, 2026-10-27, Asrbek:
-- "nimaga to'g'risini yozmasdan xato yozayapsan").
--
-- The funnel read the old applications table. Staff stopped working there on
-- 2026-10-15, and its newer statuses (e.g. originals_sent) were not counted,
-- so Muratov dropped out of Submitted when his paper documents were posted.
-- Every stage now reads what the CRM board reads:
--   Documents Ready - "hujjat tayyor" flag, OR all 8 required pack documents
--                     approved (same rule as buildApplicationPack),
--                     OR the student is already at a later stage
--   Submitted       - any university submitted online or posted offline
--                     (student_university_submissions)
--   Offer Received  - any university result recorded
--   Visa Approved   - visa_approved_at, OR a final university with visa received
--   Departed        - departed_at
-- Leads and Signed are unchanged.

create or replace view public.v_investor_season_funnel as
 WITH members AS (
         SELECT si.intake_id,
                si.student_id,
                si.docs_ready,
                si.visa_approved_at,
                si.departed_at,
                EXISTS (SELECT 1 FROM student_university_submissions s
                         WHERE s.student_id = si.student_id
                           AND (s.online_submitted_at IS NOT NULL OR s.offline_sent_at IS NOT NULL)) AS submitted,
                EXISTS (SELECT 1 FROM student_university_submissions s
                         WHERE s.student_id = si.student_id AND s.result IS NOT NULL) AS offered,
                EXISTS (SELECT 1 FROM student_university_submissions s
                         WHERE s.student_id = si.student_id AND s.final_at IS NOT NULL
                           AND s.visa_status = 'received') AS visa_received
           FROM student_intakes si
           JOIN profiles p ON p.user_id = si.student_id
          WHERE NOT p.is_demo AND si.contract_cancelled_at IS NULL
        ), pack AS (
         -- All 8 required application-pack documents approved. Required slots
         -- and legacy aliases as in src/lib/studentDocSlots.ts; matching as in
         -- src/lib/translationDocuments.ts matchesSlot (newest upload wins).
         -- Inline, not a function: function privileges in a view are checked
         -- against the investor, who must not call helpers on student data.
         SELECT m.intake_id, m.student_id,
                (SELECT count(*)
                   FROM (VALUES ('applicant_id_card', NULL::text), ('foreign_passport', 'applicant_passport'),
                                ('father_id_card', 'parent_passport'), ('mother_id_card', NULL), ('birth_certificate', NULL),
                                ('language_certificate', NULL), ('photo', NULL), ('diploma', NULL)) sl(slot_id, alias)
                  WHERE (SELECT d.status FROM documents d
                          WHERE d.student_id = m.student_id
                            AND EXISTS (SELECT 1 FROM unnest(ARRAY[sl.slot_id, sl.alias]) k(id)
                                         WHERE k.id IS NOT NULL AND (
                                               position('[' || k.id || ']' in lower(coalesce(d.name, ''))) > 0
                                            OR starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), k.id || '-')
                                            OR starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), k.id || '.')))
                          ORDER BY d.created_at DESC LIMIT 1) = 'approved') = 8 AS pack_ready
           FROM members m
        ), staged AS (
         SELECT m.*,
                (m.docs_ready OR m.submitted OR m.offered OR p.pack_ready) AS docs_done,
                (m.visa_approved_at IS NOT NULL OR m.visa_received) AS visa_ok
           FROM members m JOIN pack p USING (intake_id, student_id)
        ), base AS (
         SELECT ik.id AS intake_id,
                (SELECT count(*) FROM leads l WHERE l.intake_id = ik.id) AS leads,
                (SELECT count(*) FROM staged m WHERE m.intake_id = ik.id) AS signed,
                (SELECT count(*) FROM staged m WHERE m.intake_id = ik.id AND m.docs_done) AS docs_ready,
                (SELECT count(*) FROM staged m WHERE m.intake_id = ik.id AND (m.submitted OR m.offered)) AS submitted,
                (SELECT count(*) FROM staged m WHERE m.intake_id = ik.id AND m.offered) AS offered,
                (SELECT count(*) FROM staged m WHERE m.intake_id = ik.id AND m.visa_ok) AS visa_approved,
                (SELECT count(*) FROM staged m WHERE m.intake_id = ik.id AND m.departed_at IS NOT NULL) AS departed
           FROM intakes ik
        )
 SELECT b.intake_id,
    s.stage,
    s.stage_order,
        CASE s.stage_order
            WHEN 0 THEN b.leads
            WHEN 1 THEN b.signed
            WHEN 2 THEN b.docs_ready
            WHEN 3 THEN b.submitted
            WHEN 4 THEN b.offered
            WHEN 5 THEN b.visa_approved
            WHEN 6 THEN b.departed
            ELSE NULL::bigint
        END AS student_count
   FROM base b
     CROSS JOIN ( VALUES ('Leads'::text,0), ('Signed'::text,1), ('Documents Ready'::text,2), ('Submitted'::text,3), ('Offer Received'::text,4), ('Visa Approved'::text,5), ('Departed'::text,6)) s(stage, stage_order)
  WHERE investor_can_view_intake(b.intake_id);
