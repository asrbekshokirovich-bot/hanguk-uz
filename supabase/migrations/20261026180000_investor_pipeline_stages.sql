-- Investor "Season Pipeline" from what the CRM actually records.
--
-- Audit 2026-10-26: v_investor_season_funnel hard-coded 0 for Documents
-- Ready, Offer Received, Visa Approved and Departed, and counted Submitted by
-- applications.submitted_at, which the CRM fills inconsistently. The CRM's
-- application status already walks documents_collection -> documents_translation
-- -> apostille -> application_submitted -> university_response -> visa_documents
-- -> completed ("Visa Applied"). Asrbek asked for Visa Approved and Departed to
-- become real CRM fields.
--
-- Every stage now counts STUDENTS (not applications) of the season, excluding
-- demo profiles and cancelled contracts, so the funnel only ever narrows:
--   Signed          - season member (student_intakes), contract not cancelled
--   Documents Ready - docs_ready flag, or any application already past documents
--   Submitted       - any application at application_submitted or later
--   Offer Received  - any application at university_response or later
--   Visa Approved   - student_intakes.visa_approved_at is set   (new field)
--   Departed        - student_intakes.departed_at is set        (new field)
-- Leads are unchanged.
--
-- v_investor_applications drops cancelled contracts and gains student_id, so
-- the Watchlist can count students rather than applications.

alter table public.student_intakes
  add column if not exists visa_approved_at date,
  add column if not exists departed_at      date;

comment on column public.student_intakes.visa_approved_at is
  'Date the student''s visa was approved for this season (CRM student profile).';
comment on column public.student_intakes.departed_at is
  'Date the student left for Korea for this season (CRM student profile).';

create or replace view public.v_investor_season_funnel as
 WITH members AS (
         SELECT si.intake_id,
                si.student_id,
                si.docs_ready,
                si.visa_approved_at,
                si.departed_at,
                EXISTS (SELECT 1 FROM applications a
                         WHERE a.student_id = si.student_id AND a.intake_id = si.intake_id
                           AND a.status = ANY (ARRAY['apostille','application_submitted','university_response','visa_documents','completed'])) AS past_documents,
                EXISTS (SELECT 1 FROM applications a
                         WHERE a.student_id = si.student_id AND a.intake_id = si.intake_id
                           AND a.status = ANY (ARRAY['application_submitted','university_response','visa_documents','completed'])) AS submitted,
                EXISTS (SELECT 1 FROM applications a
                         WHERE a.student_id = si.student_id AND a.intake_id = si.intake_id
                           AND a.status = ANY (ARRAY['university_response','visa_documents','completed'])) AS offered
           FROM student_intakes si
           JOIN profiles p ON p.user_id = si.student_id
          WHERE NOT p.is_demo AND si.contract_cancelled_at IS NULL
        ), base AS (
         SELECT ik.id AS intake_id,
                (SELECT count(*) FROM leads l WHERE l.intake_id = ik.id) AS leads,
                (SELECT count(*) FROM members m WHERE m.intake_id = ik.id) AS signed,
                (SELECT count(*) FROM members m WHERE m.intake_id = ik.id AND (m.docs_ready OR m.past_documents)) AS docs_ready,
                (SELECT count(*) FROM members m WHERE m.intake_id = ik.id AND m.submitted) AS submitted,
                (SELECT count(*) FROM members m WHERE m.intake_id = ik.id AND m.offered) AS offered,
                (SELECT count(*) FROM members m WHERE m.intake_id = ik.id AND m.visa_approved_at IS NOT NULL) AS visa_approved,
                (SELECT count(*) FROM members m WHERE m.intake_id = ik.id AND m.departed_at IS NOT NULL) AS departed
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

-- Same columns as prod (pg_get_viewdef, 2026-10-26) plus student_id at the end;
-- cancelled contracts are no longer listed.
create or replace view public.v_investor_applications as
 SELECT a.id AS application_id,
    a.intake_id,
    sp.full_name AS student_name,
    sp.payment_plan AS plan,
    COALESCE(inst.name_en, inst.name_ko) AS university,
    a.degree_level AS program,
    a.status,
    a.submitted_at,
    a.updated_at,
    (CURRENT_DATE - (a.updated_at)::date) AS days_since_movement,
    a.student_id
   FROM ((applications a
     LEFT JOIN profiles sp ON ((sp.user_id = a.student_id)))
     LEFT JOIN institutions inst ON ((inst.id = a.institution_id)))
  WHERE (investor_can_view_intake(a.intake_id) AND (NOT (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.user_id = a.student_id) AND p.is_demo))))
    AND NOT EXISTS (SELECT 1 FROM student_intakes si
                     WHERE si.student_id = a.student_id AND si.intake_id = a.intake_id
                       AND si.contract_cancelled_at IS NOT NULL));
