-- Hanguk AI — analytics views for the read-only "query_database" tool.
--
-- The assistant can now run SQL to COUNT / AGGREGATE / JOIN / CONCLUDE over real
-- data ("how many students were accepted?", "revenue by university", "leads with
-- an exam in May"). To make that safe it only ever queries this `ai` schema of
-- read-only views, which expose *safe columns only* — never SIP passwords,
-- magic codes, lead passwords or any secret. The edge function additionally runs
-- every query in a READ ONLY transaction with search_path=ai and a denylist, and
-- only owner/admin staff get the tool at all.
--
-- Views run with owner (postgres) rights, i.e. they see all rows regardless of
-- RLS — that is intentional: this is an org-wide analytics surface for trusted
-- admins, not a per-user data path.

CREATE SCHEMA IF NOT EXISTS ai;

-- Students / staff directory (no magic_code, no SIP creds, no username/avatar).
CREATE OR REPLACE VIEW ai.students AS
SELECT user_id, full_name, phone, additional_phone, city, status, role,
       language_track, topik_level, ielts_score, is_gks_applicant,
       payment_plan, payment_mode, study_work_priority,
       korean_region_preference, office_location, notes, university_notes,
       contract_date, dob, birth_date, created_at, updated_at
FROM public.profiles;

-- Universities/colleges applications point at.
CREATE OR REPLACE VIEW ai.institutions AS
SELECT id, name_en, name_ko, name_ko_short, city_ko, region_code, tier,
       institution_type, is_partner, is_visible_on_map, created_at
FROM public.institutions;

-- Applications, with the university name joined in for convenience.
CREATE OR REPLACE VIEW ai.applications AS
SELECT a.id, a.student_id, a.institution_id, i.name_en AS university_name,
       a.status, a.decision, a.decision_at, a.degree_level, a.intake_id,
       a.submitted_at, a.notes, a.created_at, a.updated_at
FROM public.applications a
LEFT JOIN public.institutions i ON i.id = a.institution_id;

-- Admission cycles (season + year).
CREATE OR REPLACE VIEW ai.intakes AS
SELECT id, season, year, is_open, is_default, created_at
FROM public.intakes;

-- Payments / finance.
CREATE OR REPLACE VIEW ai.payments AS
SELECT id, student_id, application_id, payment_type, amount, paid_amount,
       currency, status, due_date, paid_at, invoice_number, notes,
       created_at, updated_at
FROM public.payments;

-- Documents (metadata only — no storage paths needed for analytics).
CREATE OR REPLACE VIEW ai.documents AS
SELECT id, student_id, application_id, name, status, file_type,
       reviewed_at, reviewed_by, created_at, updated_at
FROM public.documents;

-- Leads pipeline (no password, no login history).
CREATE OR REPLACE VIEW ai.leads AS
SELECT id, full_name, phone, email, city, status, source, priority_score,
       interest_level, education_level, korean_level, english_level,
       exam_type, exam_date, target_intake, preferred_program,
       preferred_university, budget_range, how_heard, next_follow_up,
       last_contacted_at, assigned_to, converted_to_student_id,
       referred_by_student_id, ai_summary, notes, created_at, updated_at
FROM public.leads;

-- Tasks / follow-ups.
CREATE OR REPLACE VIEW ai.tasks AS
SELECT id, title, description, status, priority, due_date, student_id,
       application_id, assigned_to, source, completed_at, created_at, updated_at
FROM public.tasks;

-- Calls (metadata; transcripts/analysis are separate views).
CREATE OR REPLACE VIEW ai.calls AS
SELECT id, student_id, lead_id, direction, status, duration, started_at,
       ended_at, phone_number, staff_id, notes, created_at
FROM public.calls;

-- Call analysis (the bilingual summaries + structured signals).
CREATE OR REPLACE VIEW ai.call_analyses AS
SELECT id, call_id, student_id, lead_id, intent, sentiment, summary_uz,
       summary_en, topics, risk_flags, follow_up_needed, follow_up_reason,
       action_items, promises, created_at
FROM public.call_analyses;

-- Chat messages (Telegram/Instagram/…).
CREATE OR REPLACE VIEW ai.messages AS
SELECT id, student_id, direction, content, source, message_type, status,
       sender_name, created_at
FROM public.messages;

-- Parsed document contents (OCR/extraction).
CREATE OR REPLACE VIEW ai.document_extractions AS
SELECT id, document_id, student_id, doc_type, language, full_text,
       key_fields, created_at
FROM public.document_extractions;

-- The `ai` schema is only ever reached by the edge function over its direct
-- (postgres) DB connection. Make sure the browser roles can never touch it.
REVOKE ALL ON SCHEMA ai FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA ai FROM PUBLIC, anon, authenticated;
