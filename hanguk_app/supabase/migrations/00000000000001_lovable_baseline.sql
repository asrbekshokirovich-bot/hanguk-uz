-- =============================================================================
--  Hanguk 2026 production baseline schema (replaced staging shim 2026-05-08)
--
--  Captured via:
--    pg_dump --schema=public --schema-only --no-owner --no-privileges --no-comments
--  Sanitized to strip ALTER OWNER, COMMENT ON ROLE, cluster GRANTs, most
--  session SETs, SELECT pg_catalog.set_config, and \restrict.
--
--  Source-of-truth schema for the Hanguk 2026 prod project (lysjdtyanhdfphqyijsr).
--  Subsequent uni_db_v1 / v2 / v3 migrations build on top of this.
-- =============================================================================

-- Required for round-trip restore: pg_dump emits SQL-language functions
-- that reference tables defined later in the file. Without this set,
-- those CREATE FUNCTION statements fail at parse time. The setting is
-- session-local and reverts at end of statement run.
SET check_function_bodies = false;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'owner',
    'admin',
    'call_operator',
    'document_handler',
    'university_staff'
);


--
-- Name: university_selection_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.university_selection_status AS ENUM (
    'none',
    'pending',
    'approved'
);


--
-- Name: admin_get_auth_user_id_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_auth_user_id_by_email(p_email text) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select id from auth.users where email = p_email limit 1;
$$;


--
-- Name: extract_doc_type_tag(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_doc_type_tag(doc_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE 
    WHEN doc_name ~ '^\[([^\]]+)\]' 
    THEN (regexp_match(doc_name, '^\[([^\]]+)\]'))[1]
    ELSE NULL
  END
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_regional_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_regional_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
      DECLARE
          result json;
      BEGIN
          WITH lead_stats AS (
              SELECT city, count(*) as leads_count
              FROM leads
              WHERE city IS NOT NULL AND city != ''
              GROUP BY city
          ),
          student_stats AS (
              SELECT city, count(*) as students_count
              FROM profiles
              WHERE city IS NOT NULL AND city != ''
              GROUP BY city
          ),
          all_cities AS (
              SELECT city FROM lead_stats
              UNION
              SELECT city FROM student_stats
          )
          SELECT json_object_agg(
              city,
              json_build_object(
                  'leads', COALESCE((SELECT leads_count FROM lead_stats WHERE lead_stats.city = all_cities.city), 0),
                  'students', COALESCE((SELECT students_count FROM student_stats WHERE student_stats.city = all_cities.city), 0)
              )
          ) INTO result
          FROM all_cities;

          RETURN COALESCE(result, '{}'::json);
      END;
      $$;


--
-- Name: handle_new_application_room(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_application_room() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_room_id UUID;
  v_existing_room_id UUID;
BEGIN
  -- Check if room already exists for this university
  SELECT id INTO v_existing_room_id FROM public.university_rooms WHERE university_id = NEW.university_id;
  
  IF v_existing_room_id IS NULL THEN
    -- Create new room
    INSERT INTO public.university_rooms (university_id) VALUES (NEW.university_id) RETURNING id INTO v_room_id;
    
    -- Create discussion channel
    INSERT INTO public.room_channels (room_id, channel_type, name_uz, name_en, name_ru, name_ko)
    VALUES (v_room_id, 'discussion', 'Muhokama', 'Discussion', 'Обсуждение', '토론');
    
    -- Create announcement channel
    INSERT INTO public.room_channels (room_id, channel_type, name_uz, name_en, name_ru, name_ko)
    VALUES (v_room_id, 'announcement', 'E''lonlar', 'Announcements', 'Объявления', '공지사항');
  ELSE
    v_room_id := v_existing_room_id;
  END IF;
  
  -- Add student as room member
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (v_room_id, NEW.student_id, 'student')
  ON CONFLICT (room_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
      BEGIN
        IF NEW.email LIKE 'student-%@hanguk.local' THEN
          UPDATE public.profiles 
          SET user_id = NEW.id
          WHERE user_id = (NEW.raw_user_meta_data->>'original_user_id')::uuid;
          RETURN NEW;
        END IF;

        INSERT INTO public.profiles (user_id, full_name, preferred_language)
        VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'uz'))
        ON CONFLICT(user_id) DO NOTHING;

        RETURN NEW;
      END;
      $$;


--
-- Name: handle_university_staff_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_university_staff_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Find the university room for this assignment
  SELECT id INTO v_room_id FROM public.university_rooms 
  WHERE university_id = NEW.university_id AND is_active = true
  LIMIT 1;
  
  IF v_room_id IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (v_room_id, NEW.user_id, 'university_staff')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: increment_thread_unread(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_thread_unread(p_source text, p_sender_id text, p_sender_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.message_threads (source, sender_id, sender_name, last_message_at, unread_count, status)
  VALUES (p_source, p_sender_id, p_sender_name, now(), 1, 'active')
  ON CONFLICT (source, sender_id) DO UPDATE SET
    unread_count = message_threads.unread_count + 1,
    last_message_at = now(),
    sender_name = EXCLUDED.sender_name;
END;
$$;


--
-- Name: is_room_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;


--
-- Name: set_task_external_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_task_external_id() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.external_task_id IS NULL THEN
    NEW.external_task_id := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: admission_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    semester text NOT NULL,
    year integer NOT NULL,
    program_level text NOT NULL,
    total integer DEFAULT 0,
    processed integer DEFAULT 0,
    found integer DEFAULT 0,
    failed integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    triggered_by text DEFAULT 'manual'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_context_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_context_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_type text NOT NULL,
    context_data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_context_cache_user_type_check CHECK ((user_type = ANY (ARRAY['student'::text, 'staff'::text])))
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_type text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    context_snapshot jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_conversations_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text]))),
    CONSTRAINT ai_conversations_user_type_check CHECK ((user_type = ANY (ARRAY['student'::text, 'staff'::text])))
);


--
-- Name: app_version_pings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_version_pings (
    user_id uuid NOT NULL,
    platform text NOT NULL,
    version text NOT NULL,
    build integer,
    locale text,
    channel text DEFAULT 'stable'::text NOT NULL,
    raw_user_agent text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_versions (
    id text NOT NULL,
    latest_version text NOT NULL,
    download_url text NOT NULL,
    force_update boolean DEFAULT true,
    sha256 text,
    size_bytes bigint,
    release_notes text,
    min_supported_version text,
    ios_app_store_url text,
    channel text DEFAULT 'stable'::text NOT NULL,
    rollout_percentage integer DEFAULT 100 NOT NULL,
    force_full_reinstall boolean DEFAULT false NOT NULL,
    CONSTRAINT app_versions_channel_check CHECK ((channel = ANY (ARRAY['stable'::text, 'beta'::text, 'canary'::text]))),
    CONSTRAINT app_versions_rollout_percentage_check CHECK (((rollout_percentage >= 0) AND (rollout_percentage <= 100)))
);


--
-- Name: application_form_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_form_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    semester text NOT NULL,
    year integer NOT NULL,
    program_level text NOT NULL,
    form_url text,
    scraped_content text,
    analyzed_data jsonb,
    scraped_at timestamp with time zone DEFAULT now() NOT NULL,
    is_valid boolean DEFAULT true NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_confidence jsonb DEFAULT '{}'::jsonb,
    validation_status text DEFAULT 'pending'::text,
    last_validated_at timestamp with time zone,
    CONSTRAINT application_form_cache_program_level_check CHECK ((program_level = ANY (ARRAY['undergraduate'::text, 'graduate'::text, 'phd'::text, 'all'::text]))),
    CONSTRAINT application_form_cache_semester_check CHECK ((semester = ANY (ARRAY['spring'::text, 'fall'::text]))),
    CONSTRAINT application_form_cache_source_check CHECK ((source = ANY (ARRAY['studyinkorea'::text, 'official_website'::text, 'manual'::text]))),
    CONSTRAINT application_form_cache_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'validated'::text, 'needs_review'::text, 'stale'::text])))
);


--
-- Name: application_form_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_form_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cache_id uuid NOT NULL,
    university_id uuid NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    change_type text NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    severity text DEFAULT 'info'::text NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    notes text,
    CONSTRAINT application_form_changes_change_type_check CHECK ((change_type = ANY (ARRAY['deadline_changed'::text, 'fee_changed'::text, 'document_added'::text, 'document_removed'::text, 'requirement_changed'::text, 'program_added'::text, 'program_removed'::text, 'other'::text]))),
    CONSTRAINT application_form_changes_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: application_form_validations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_form_validations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cache_id uuid NOT NULL,
    university_id uuid NOT NULL,
    validated_at timestamp with time zone DEFAULT now() NOT NULL,
    validation_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    discrepancies jsonb DEFAULT '[]'::jsonb,
    field_confidence_scores jsonb DEFAULT '{}'::jsonb,
    overall_confidence integer DEFAULT 0 NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    CONSTRAINT application_form_validations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text, 'needs_review'::text]))),
    CONSTRAINT application_form_validations_validation_type_check CHECK ((validation_type = ANY (ARRAY['cross_reference'::text, 'change_detection'::text, 'manual_review'::text])))
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    university_id uuid NOT NULL,
    status text DEFAULT 'documents_collection'::text NOT NULL,
    status_history jsonb DEFAULT '[]'::jsonb,
    notes text,
    submitted_at timestamp with time zone,
    decision_at timestamp with time zone,
    decision text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: call_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caller_id uuid NOT NULL,
    callee_id uuid NOT NULL,
    status text DEFAULT 'ringing'::text NOT NULL,
    call_type text DEFAULT 'audio'::text NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: call_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    signal_type text NOT NULL,
    signal_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    staff_id uuid,
    phone_number text NOT NULL,
    direction text DEFAULT 'outgoing'::text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    duration integer DEFAULT 0,
    recording_url text,
    notes text,
    external_call_id text,
    voip_provider text DEFAULT 'manual'::text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lead_id uuid
);


--
-- Name: channel_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    message_type text DEFAULT 'text'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: distribution_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distribution_transfer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_id uuid,
    recipient_name text NOT NULL,
    percentage numeric NOT NULL,
    deducted_amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: distribution_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distribution_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_month text NOT NULL,
    total_amount numeric NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    application_id uuid,
    name text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    file_size integer,
    status text DEFAULT 'uploaded'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    payment_method text,
    recipient text,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_transaction_id uuid
);


--
-- Name: gks_designated_universities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gks_designated_universities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    gks_program_info_id uuid NOT NULL,
    university_type text,
    is_uic boolean DEFAULT false,
    is_rd boolean DEFAULT false,
    is_global_network boolean DEFAULT false,
    slot_allocation integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gks_designated_universities_university_type_check CHECK ((university_type = ANY (ARRAY['A'::text, 'B'::text])))
);


--
-- Name: gks_program_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gks_program_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_level text NOT NULL,
    track_type text NOT NULL,
    sub_track text NOT NULL,
    year integer NOT NULL,
    total_slots integer,
    announcement_date date,
    application_start date,
    application_end date,
    review_period_start date,
    review_period_end date,
    result_date date,
    benefits jsonb DEFAULT '{}'::jsonb,
    eligibility jsonb DEFAULT '{}'::jsonb,
    contact_email text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gks_program_info_program_level_check CHECK ((program_level = ANY (ARRAY['undergraduate'::text, 'graduate'::text]))),
    CONSTRAINT gks_program_info_sub_track_check CHECK ((sub_track = ANY (ARRAY['general'::text, 'r_gks'::text, 'uic'::text, 'associate'::text, 'rd'::text, 'global_network'::text, 'research'::text, 'international_org'::text, 'overseas_korean'::text]))),
    CONSTRAINT gks_program_info_track_type_check CHECK ((track_type = ANY (ARRAY['embassy'::text, 'university'::text])))
);


--
-- Name: income_distribution_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_distribution_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_name text NOT NULL,
    percentage numeric(5,2) NOT NULL,
    recipient_type text DEFAULT 'owner'::text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT income_distribution_settings_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric))),
    CONSTRAINT income_distribution_settings_recipient_type_check CHECK ((recipient_type = ANY (ARRAY['owner'::text, 'charity'::text, 'other'::text])))
);


--
-- Name: income_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid,
    recipient_id uuid,
    recipient_name text NOT NULL,
    percentage numeric(5,2) NOT NULL,
    base_amount numeric NOT NULL,
    distributed_amount numeric NOT NULL,
    distribution_month text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT income_distributions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: intercom_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intercom_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caller_id uuid NOT NULL,
    callee_id uuid NOT NULL,
    channel_name text NOT NULL,
    status text DEFAULT 'ringing'::text NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: interview_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    communication_score integer,
    confidence_score integer,
    content_score integer,
    language_score integer,
    overall_score integer,
    strengths jsonb DEFAULT '[]'::jsonb,
    improvements jsonb DEFAULT '[]'::jsonb,
    detailed_feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_scores jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT interview_feedback_communication_score_check CHECK (((communication_score >= 1) AND (communication_score <= 10))),
    CONSTRAINT interview_feedback_confidence_score_check CHECK (((confidence_score >= 1) AND (confidence_score <= 10))),
    CONSTRAINT interview_feedback_content_score_check CHECK (((content_score >= 1) AND (content_score <= 10))),
    CONSTRAINT interview_feedback_language_score_check CHECK (((language_score >= 1) AND (language_score <= 10))),
    CONSTRAINT interview_feedback_overall_score_check CHECK (((overall_score >= 1) AND (overall_score <= 10)))
);


--
-- Name: interview_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    audio_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT interview_messages_role_check CHECK ((role = ANY (ARRAY['interviewer'::text, 'student'::text])))
);


--
-- Name: interview_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    difficulty text DEFAULT 'medium'::text NOT NULL,
    question_ko text NOT NULL,
    question_en text,
    question_uz text,
    question_ru text,
    sample_answer text,
    tips text,
    university_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT interview_questions_category_check CHECK ((category = ANY (ARRAY['motivation'::text, 'academic'::text, 'personal'::text, 'visa'::text, 'university_specific'::text]))),
    CONSTRAINT interview_questions_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))
);


--
-- Name: interview_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    session_type text DEFAULT 'general'::text NOT NULL,
    target_university_id uuid,
    heygen_session_id text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    focus_topic text,
    timed_mode boolean DEFAULT false,
    time_limit_seconds integer,
    vapi_call_id text,
    CONSTRAINT interview_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['general'::text, 'university_specific'::text, 'visa'::text]))),
    CONSTRAINT interview_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: lead_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contacted_at date,
    contact_type text DEFAULT 'call'::text,
    outcome text,
    duration_minutes integer,
    ai_analysis text
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    phone text,
    email text,
    source text DEFAULT 'manual'::text NOT NULL,
    source_id text,
    status text DEFAULT 'new'::text NOT NULL,
    interest_level text DEFAULT 'medium'::text,
    notes text,
    ai_summary text,
    assigned_to uuid,
    converted_to_student_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    preferred_university text,
    preferred_program text,
    budget_range text,
    city text,
    birth_date date,
    education_level text,
    english_level text,
    korean_level text,
    preferred_start_date text,
    how_heard text,
    priority_score integer DEFAULT 50,
    next_follow_up timestamp with time zone,
    last_contacted_at timestamp with time zone,
    contract_number text,
    contract_date date,
    payment_plan text,
    password text,
    login_count integer DEFAULT 0,
    login_history text[] DEFAULT '{}'::text[]
);


--
-- Name: mentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mentioned_user_id uuid NOT NULL,
    mentioned_by uuid NOT NULL,
    context_type text NOT NULL,
    context_id uuid NOT NULL,
    content_preview text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    sender_id text NOT NULL,
    sender_name text,
    sender_avatar text,
    student_id uuid,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    unread_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_threads_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    external_id text,
    sender_name text,
    sender_id text,
    sender_avatar text,
    content text NOT NULL,
    message_type text DEFAULT 'text'::text NOT NULL,
    direction text DEFAULT 'incoming'::text NOT NULL,
    status text DEFAULT 'unread'::text NOT NULL,
    student_id uuid,
    assigned_to uuid,
    replied_by uuid,
    replied_at timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text]))),
    CONSTRAINT messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'voice'::text]))),
    CONSTRAINT messages_source_check CHECK ((source = ANY (ARRAY['telegram'::text, 'instagram'::text, 'whatsapp'::text, 'manual'::text]))),
    CONSTRAINT messages_status_check CHECK ((status = ANY (ARRAY['unread'::text, 'read'::text, 'replied'::text, 'archived'::text])))
);


--
-- Name: monthly_payment_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_payment_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category_type text DEFAULT 'other'::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    recipient_name text,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT monthly_payment_categories_category_type_check CHECK ((category_type = ANY (ARRAY['salary'::text, 'rent'::text, 'utilities'::text, 'other'::text])))
);


--
-- Name: operational_fund_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_fund_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    payment_id uuid,
    category_id uuid,
    allocated_amount numeric DEFAULT 0 NOT NULL,
    allocation_month text NOT NULL,
    status text DEFAULT 'allocated'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT operational_fund_allocations_status_check CHECK ((status = ANY (ARRAY['allocated'::text, 'spent'::text, 'pending'::text])))
);


--
-- Name: operational_fund_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_fund_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount_per_student numeric DEFAULT 2000000 NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method text,
    transaction_reference text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gateway_fee numeric DEFAULT 0,
    receipt_url text,
    receipt_urls text[] DEFAULT '{}'::text[]
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    application_id uuid,
    payment_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_amount numeric(10,2) DEFAULT 0 NOT NULL,
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    invoice_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_payment_type_check CHECK ((payment_type = ANY (ARRAY['initial_deposit'::text, 'remaining_payment'::text, 'other'::text]))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'completed'::text, 'overdue'::text, 'refunded'::text])))
);


--
-- Name: peer_review_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_review_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_id uuid,
    document_type text NOT NULL,
    language text DEFAULT 'en'::text,
    university_id uuid,
    submitted_at timestamp with time zone DEFAULT now(),
    is_matched boolean DEFAULT false
);


--
-- Name: peer_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_id uuid,
    author_id uuid NOT NULL,
    reviewer_id uuid,
    status text DEFAULT 'pending'::text,
    anonymous_name text,
    review_feedback text,
    rating integer,
    strengths text[],
    improvements text[],
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    CONSTRAINT peer_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT peer_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    avatar_url text,
    preferred_language text DEFAULT 'uz'::text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    birth_date date,
    office_location text,
    contract_date date,
    payment_plan text,
    notes text,
    magic_code text,
    topik_level integer,
    ielts_score numeric(2,1),
    korean_region_preference text,
    study_work_priority text,
    language_track text DEFAULT 'korean'::text,
    payment_mode text DEFAULT 'one_time'::text,
    city text,
    contract_url text,
    is_gks_applicant boolean DEFAULT false,
    status text DEFAULT 'offline'::text,
    sip1_user text,
    sip1_password text,
    sip1_server text,
    sip1_port text DEFAULT '5060'::text,
    sip1_label text,
    sip2_user text,
    sip2_password text,
    sip2_server text,
    sip2_port text DEFAULT '5060'::text,
    sip2_label text,
    university_notes text,
    university_selection_status public.university_selection_status DEFAULT 'none'::public.university_selection_status,
    additional_phone text,
    CONSTRAINT profiles_language_track_check CHECK ((language_track = ANY (ARRAY['english'::text, 'korean'::text, 'both'::text]))),
    CONSTRAINT profiles_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['one_time'::text, 'installment'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'away'::text, 'active'::text, 'cancelled'::text])))
);


--
-- Name: room_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    channel_type text NOT NULL,
    name_uz text NOT NULL,
    name_en text,
    name_ru text,
    name_ko text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT room_channels_channel_type_check CHECK ((channel_type = ANY (ARRAY['discussion'::text, 'announcement'::text])))
);


--
-- Name: room_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'student'::text,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: scheduled_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    payment_type text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    scheduled_date date,
    trigger_type text NOT NULL,
    trigger_application_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    linked_payment_id uuid,
    triggered_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: scholarships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scholarships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid,
    name text NOT NULL,
    name_uz text,
    name_ru text,
    name_ko text,
    name_en text,
    description text,
    description_uz text,
    description_ru text,
    description_ko text,
    description_en text,
    scholarship_type text DEFAULT 'university'::text NOT NULL,
    coverage text,
    amount_krw numeric,
    amount_description text,
    eligibility_criteria jsonb DEFAULT '{}'::jsonb,
    required_documents text[],
    application_deadline date,
    application_url text,
    is_active boolean DEFAULT true,
    program_level text,
    language_track text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: search_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    request jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    progress jsonb,
    CONSTRAINT search_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT search_jobs_type_check CHECK ((type = ANY (ARRAY['faculty'::text, 'university'::text, 'faculty_comprehensive'::text, 'university_import'::text])))
);


--
-- Name: staff_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_bonuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    staff_user_id uuid,
    plan_type text NOT NULL,
    bonus_amount numeric NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    assigned_at timestamp with time zone,
    assigned_by uuid,
    paid_at timestamp with time zone,
    month_year text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_password_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_password_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: staff_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_presence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'online'::text NOT NULL,
    last_seen timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: student_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    achievement_type text NOT NULL,
    achievement_data jsonb DEFAULT '{}'::jsonb,
    earned_at timestamp with time zone DEFAULT now()
);


--
-- Name: student_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    category text,
    allocated_amount integer DEFAULT 0,
    spent_amount integer DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    status text DEFAULT 'pending'::text,
    allocated_from_payment_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: student_code_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_code_status AS
 SELECT p.id AS profile_id,
    p.full_name,
    p.magic_code,
    p.user_id AS profile_user_id,
    u.id AS auth_user_id,
    u.email AS auth_email,
    u.banned_until,
    u.deleted_at,
        CASE
            WHEN (p.magic_code IS NULL) THEN 'NO_CODE'::text
            WHEN (u.id IS NULL) THEN 'AUTH_USER_MISSING'::text
            WHEN ((u.banned_until IS NOT NULL) AND (u.banned_until > now())) THEN 'BANNED'::text
            WHEN (u.deleted_at IS NOT NULL) THEN 'DELETED'::text
            ELSE 'OK'::text
        END AS status
   FROM (public.profiles p
     LEFT JOIN auth.users u ON ((u.id = p.user_id)));


--
-- Name: student_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    university_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: student_university_priorities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_university_priorities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    university_id uuid,
    custom_university_name text,
    search_query text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_selected boolean DEFAULT false
);


--
-- Name: student_university_priority_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_university_priority_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    priority_id uuid NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: study_plan_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    overall_score integer,
    grammar_errors jsonb DEFAULT '[]'::jsonb,
    content_feedback text,
    strengths jsonb DEFAULT '[]'::jsonb,
    improvements jsonb DEFAULT '[]'::jsonb,
    ai_response text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT study_plan_analyses_overall_score_check CHECK (((overall_score >= 1) AND (overall_score <= 10)))
);


--
-- Name: study_plan_chat_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_chat_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT study_plan_chat_history_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: study_plan_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    content text NOT NULL,
    word_count integer,
    source text DEFAULT 'typed'::text NOT NULL,
    file_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT study_plan_drafts_source_check CHECK ((source = ANY (ARRAY['typed'::text, 'uploaded'::text, 'ai_generated'::text])))
);


--
-- Name: study_plan_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    document_type text NOT NULL,
    target_university_id uuid,
    current_step integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT study_plan_sessions_current_step_check CHECK (((current_step >= 1) AND (current_step <= 4))),
    CONSTRAINT study_plan_sessions_document_type_check CHECK ((document_type = ANY (ARRAY['study_plan'::text, 'personal_statement'::text]))),
    CONSTRAINT study_plan_sessions_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: system_map_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_map_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_node text NOT NULL,
    to_node text NOT NULL,
    color text,
    opacity numeric DEFAULT 0.3 NOT NULL,
    dashed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_map_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_map_nodes (
    id text NOT NULL,
    label text NOT NULL,
    ring integer NOT NULL,
    sector integer DEFAULT 0 NOT NULL,
    color text DEFAULT '#666'::text NOT NULL,
    text_color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_map_nodes_ring_check CHECK (((ring >= 0) AND (ring <= 8))),
    CONSTRAINT system_map_nodes_sector_check CHECK (((sector >= 0) AND (sector <= 5)))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id text DEFAULT 'main'::text NOT NULL,
    owner_created boolean DEFAULT false NOT NULL,
    signup_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    due_date timestamp with time zone,
    assigned_to uuid,
    created_by uuid NOT NULL,
    student_id uuid,
    application_id uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    external_task_id text,
    source text DEFAULT 'crm'::text NOT NULL,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['urgent'::text, 'high'::text, 'normal'::text, 'low'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: translation_document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_uz text NOT NULL,
    name_ru text,
    name_en text,
    name_ko text,
    description_uz text,
    description_ru text,
    description_en text,
    code text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: translation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    document_type_id uuid NOT NULL,
    source_document_id uuid,
    source_file_path text NOT NULL,
    translated_file_path text,
    translated_text text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    supporting_documents jsonb DEFAULT '[]'::jsonb,
    auto_triggered boolean DEFAULT false NOT NULL,
    requested_by uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: translation_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type_id uuid NOT NULL,
    required_document_code text NOT NULL,
    required_document_name_uz text NOT NULL,
    required_document_name_ru text,
    required_document_name_en text,
    is_student_document boolean DEFAULT true NOT NULL,
    is_parent_document boolean DEFAULT false NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: translation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type_id uuid NOT NULL,
    original_file_path text NOT NULL,
    translated_file_path text NOT NULL,
    original_text text,
    translated_text text,
    notes text,
    uploaded_by uuid NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: universities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.universities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_uz text NOT NULL,
    name_ko text,
    name_ru text,
    name_en text,
    city_uz text,
    city_ko text,
    city_ru text,
    city_en text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    website text,
    logo_url text,
    description_uz text,
    description_ko text,
    description_ru text,
    description_en text,
    tuition_min integer,
    tuition_max integer,
    ranking integer,
    acceptance_rate numeric(5,2),
    is_partner boolean DEFAULT false,
    programs text[],
    requirements_uz text,
    requirements_ko text,
    requirements_ru text,
    requirements_en text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_visible_on_map boolean DEFAULT true,
    institution_type text DEFAULT 'university'::text,
    global_rank integer,
    local_rank integer,
    enriched_at timestamp with time zone,
    website_url text
);


--
-- Name: university_admission_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_admission_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    semester text NOT NULL,
    year integer NOT NULL,
    application_start date,
    application_end date,
    document_deadline date,
    result_announcement date,
    program_level text NOT NULL,
    language_track text,
    application_fee_krw numeric,
    application_fee_usd numeric,
    application_form_url text,
    application_guide_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    online_application_start date,
    online_application_end date,
    offline_application_start date,
    offline_application_end date,
    interview_start date,
    interview_end date,
    CONSTRAINT university_admission_periods_language_track_check CHECK ((language_track = ANY (ARRAY['english'::text, 'korean'::text, 'both'::text, 'all'::text]))),
    CONSTRAINT university_admission_periods_program_level_check CHECK ((program_level = ANY (ARRAY['undergraduate'::text, 'graduate'::text, 'phd'::text, 'all'::text]))),
    CONSTRAINT university_admission_periods_semester_check CHECK ((semester = ANY (ARRAY['spring'::text, 'fall'::text])))
);


--
-- Name: university_admissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_admissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    semester_name text NOT NULL,
    application_start date,
    application_end date,
    status text DEFAULT 'upcoming'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: university_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    posted_by uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    attachment_url text,
    attachment_name text,
    is_pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: university_document_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_document_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid,
    document_type text NOT NULL,
    min_word_count integer DEFAULT 500,
    max_word_count integer DEFAULT 1000,
    required_sections jsonb DEFAULT '[]'::jsonb,
    language_requirements text,
    formatting_notes text,
    tips text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT university_document_requirements_document_type_check CHECK ((document_type = ANY (ARRAY['study_plan'::text, 'personal_statement'::text])))
);


--
-- Name: university_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_by_ai boolean DEFAULT false NOT NULL
);


--
-- Name: university_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    title_uz text NOT NULL,
    title_en text,
    title_ru text,
    title_ko text,
    description_uz text,
    description_en text,
    description_ru text,
    description_ko text,
    event_type text NOT NULL,
    event_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    is_all_day boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT university_events_event_type_check CHECK ((event_type = ANY (ARRAY['tuition_payment'::text, 'interview'::text, 'deadline'::text, 'orientation'::text, 'other'::text])))
);


--
-- Name: university_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    content text NOT NULL,
    note_type text DEFAULT 'general'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: university_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    program_name text NOT NULL,
    program_level text NOT NULL,
    faculty_name text,
    department_name text,
    language_track text NOT NULL,
    tuition_per_semester numeric,
    tuition_per_year numeric,
    topik_requirement integer,
    ielts_requirement numeric,
    toefl_requirement integer,
    is_available_for_international boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT university_programs_ielts_requirement_check CHECK (((ielts_requirement >= (0)::numeric) AND (ielts_requirement <= (9)::numeric))),
    CONSTRAINT university_programs_language_track_check CHECK ((language_track = ANY (ARRAY['english'::text, 'korean'::text, 'both'::text]))),
    CONSTRAINT university_programs_program_level_check CHECK ((program_level = ANY (ARRAY['undergraduate'::text, 'graduate'::text, 'phd'::text]))),
    CONSTRAINT university_programs_toefl_requirement_check CHECK (((toefl_requirement >= 0) AND (toefl_requirement <= 120))),
    CONSTRAINT university_programs_topik_requirement_check CHECK (((topik_requirement >= 1) AND (topik_requirement <= 6)))
);


--
-- Name: university_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: university_staff_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_staff_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    university_id uuid NOT NULL,
    title text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_secrets (
    user_id uuid NOT NULL,
    plain_password text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: version_distribution; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.version_distribution AS
 SELECT platform,
    version,
    channel,
    count(*) AS device_count,
    min(last_seen_at) AS oldest_ping,
    max(last_seen_at) AS latest_ping
   FROM public.app_version_pings
  GROUP BY platform, version, channel
  ORDER BY platform, version DESC;


--
-- Name: writing_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.writing_streaks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date date,
    total_words_written integer DEFAULT 0,
    total_sessions_completed integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admission_sync_jobs admission_sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_sync_jobs
    ADD CONSTRAINT admission_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: ai_context_cache ai_context_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_context_cache
    ADD CONSTRAINT ai_context_cache_pkey PRIMARY KEY (id);


--
-- Name: ai_context_cache ai_context_cache_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_context_cache
    ADD CONSTRAINT ai_context_cache_user_id_key UNIQUE (user_id);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: app_version_pings app_version_pings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_version_pings
    ADD CONSTRAINT app_version_pings_pkey PRIMARY KEY (user_id);


--
-- Name: app_versions app_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_pkey PRIMARY KEY (id, channel);


--
-- Name: application_form_cache application_form_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_cache
    ADD CONSTRAINT application_form_cache_pkey PRIMARY KEY (id);


--
-- Name: application_form_changes application_form_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_changes
    ADD CONSTRAINT application_form_changes_pkey PRIMARY KEY (id);


--
-- Name: application_form_validations application_form_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_validations
    ADD CONSTRAINT application_form_validations_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: applications applications_student_id_university_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_student_id_university_id_key UNIQUE (student_id, university_id);


--
-- Name: call_sessions call_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_pkey PRIMARY KEY (id);


--
-- Name: call_signals call_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_signals
    ADD CONSTRAINT call_signals_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: channel_messages channel_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_pkey PRIMARY KEY (id);


--
-- Name: distribution_transfer_items distribution_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_transfer_items
    ADD CONSTRAINT distribution_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: distribution_transfers distribution_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_transfers
    ADD CONSTRAINT distribution_transfers_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: gks_designated_universities gks_designated_universities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gks_designated_universities
    ADD CONSTRAINT gks_designated_universities_pkey PRIMARY KEY (id);


--
-- Name: gks_designated_universities gks_designated_universities_university_id_gks_program_info__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gks_designated_universities
    ADD CONSTRAINT gks_designated_universities_university_id_gks_program_info__key UNIQUE (university_id, gks_program_info_id);


--
-- Name: gks_program_info gks_program_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gks_program_info
    ADD CONSTRAINT gks_program_info_pkey PRIMARY KEY (id);


--
-- Name: gks_program_info gks_program_info_program_level_track_type_sub_track_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gks_program_info
    ADD CONSTRAINT gks_program_info_program_level_track_type_sub_track_year_key UNIQUE (program_level, track_type, sub_track, year);


--
-- Name: income_distribution_settings income_distribution_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_distribution_settings
    ADD CONSTRAINT income_distribution_settings_pkey PRIMARY KEY (id);


--
-- Name: income_distributions income_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_distributions
    ADD CONSTRAINT income_distributions_pkey PRIMARY KEY (id);


--
-- Name: intercom_calls intercom_calls_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercom_calls
    ADD CONSTRAINT intercom_calls_channel_name_key UNIQUE (channel_name);


--
-- Name: intercom_calls intercom_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercom_calls
    ADD CONSTRAINT intercom_calls_pkey PRIMARY KEY (id);


--
-- Name: interview_feedback interview_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_pkey PRIMARY KEY (id);


--
-- Name: interview_feedback interview_feedback_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_session_id_key UNIQUE (session_id);


--
-- Name: interview_messages interview_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_messages
    ADD CONSTRAINT interview_messages_pkey PRIMARY KEY (id);


--
-- Name: interview_questions interview_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions
    ADD CONSTRAINT interview_questions_pkey PRIMARY KEY (id);


--
-- Name: interview_sessions interview_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_sessions
    ADD CONSTRAINT interview_sessions_pkey PRIMARY KEY (id);


--
-- Name: lead_notes lead_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: mentions mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_source_sender_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_source_sender_id_key UNIQUE (source, sender_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: monthly_payment_categories monthly_payment_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_payment_categories
    ADD CONSTRAINT monthly_payment_categories_pkey PRIMARY KEY (id);


--
-- Name: operational_fund_allocations operational_fund_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_fund_allocations
    ADD CONSTRAINT operational_fund_allocations_pkey PRIMARY KEY (id);


--
-- Name: operational_fund_settings operational_fund_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_fund_settings
    ADD CONSTRAINT operational_fund_settings_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: peer_review_queue peer_review_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_queue
    ADD CONSTRAINT peer_review_queue_pkey PRIMARY KEY (id);


--
-- Name: peer_reviews peer_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_reviews
    ADD CONSTRAINT peer_reviews_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_magic_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_magic_code_key UNIQUE (magic_code);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: room_channels room_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_channels
    ADD CONSTRAINT room_channels_pkey PRIMARY KEY (id);


--
-- Name: room_members room_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_members
    ADD CONSTRAINT room_members_pkey PRIMARY KEY (id);


--
-- Name: room_members room_members_room_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_members
    ADD CONSTRAINT room_members_room_id_user_id_key UNIQUE (room_id, user_id);


--
-- Name: scheduled_payments scheduled_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_payments
    ADD CONSTRAINT scheduled_payments_pkey PRIMARY KEY (id);


--
-- Name: scholarships scholarships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scholarships
    ADD CONSTRAINT scholarships_pkey PRIMARY KEY (id);


--
-- Name: search_jobs search_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_jobs
    ADD CONSTRAINT search_jobs_pkey PRIMARY KEY (id);


--
-- Name: staff_bonuses staff_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_bonuses
    ADD CONSTRAINT staff_bonuses_pkey PRIMARY KEY (id);


--
-- Name: staff_password_history staff_password_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_password_history
    ADD CONSTRAINT staff_password_history_pkey PRIMARY KEY (id);


--
-- Name: staff_presence staff_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_presence
    ADD CONSTRAINT staff_presence_pkey PRIMARY KEY (id);


--
-- Name: staff_presence staff_presence_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_presence
    ADD CONSTRAINT staff_presence_user_id_key UNIQUE (user_id);


--
-- Name: student_achievements student_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_pkey PRIMARY KEY (id);


--
-- Name: student_achievements student_achievements_student_id_achievement_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_student_id_achievement_type_key UNIQUE (student_id, achievement_type);


--
-- Name: student_budgets student_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_budgets
    ADD CONSTRAINT student_budgets_pkey PRIMARY KEY (id);


--
-- Name: student_comments student_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_comments
    ADD CONSTRAINT student_comments_pkey PRIMARY KEY (id);


--
-- Name: student_notes student_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_pkey PRIMARY KEY (id);


--
-- Name: student_suggestions student_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_suggestions
    ADD CONSTRAINT student_suggestions_pkey PRIMARY KEY (id);


--
-- Name: student_suggestions student_suggestions_student_id_university_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_suggestions
    ADD CONSTRAINT student_suggestions_student_id_university_id_key UNIQUE (student_id, university_id);


--
-- Name: student_university_priorities student_university_priorities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_university_priorities
    ADD CONSTRAINT student_university_priorities_pkey PRIMARY KEY (id);


--
-- Name: student_university_priority_comments student_university_priority_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_university_priority_comments
    ADD CONSTRAINT student_university_priority_comments_pkey PRIMARY KEY (id);


--
-- Name: study_plan_analyses study_plan_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_analyses
    ADD CONSTRAINT study_plan_analyses_pkey PRIMARY KEY (id);


--
-- Name: study_plan_chat_history study_plan_chat_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_chat_history
    ADD CONSTRAINT study_plan_chat_history_pkey PRIMARY KEY (id);


--
-- Name: study_plan_drafts study_plan_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_drafts
    ADD CONSTRAINT study_plan_drafts_pkey PRIMARY KEY (id);


--
-- Name: study_plan_sessions study_plan_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_sessions
    ADD CONSTRAINT study_plan_sessions_pkey PRIMARY KEY (id);


--
-- Name: system_map_connections system_map_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_map_connections
    ADD CONSTRAINT system_map_connections_pkey PRIMARY KEY (id);


--
-- Name: system_map_nodes system_map_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_map_nodes
    ADD CONSTRAINT system_map_nodes_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: translation_document_types translation_document_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_document_types
    ADD CONSTRAINT translation_document_types_code_key UNIQUE (code);


--
-- Name: translation_document_types translation_document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_document_types
    ADD CONSTRAINT translation_document_types_pkey PRIMARY KEY (id);


--
-- Name: translation_jobs translation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_jobs
    ADD CONSTRAINT translation_jobs_pkey PRIMARY KEY (id);


--
-- Name: translation_requirements translation_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_requirements
    ADD CONSTRAINT translation_requirements_pkey PRIMARY KEY (id);


--
-- Name: translation_templates translation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_templates
    ADD CONSTRAINT translation_templates_pkey PRIMARY KEY (id);


--
-- Name: universities universities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universities
    ADD CONSTRAINT universities_pkey PRIMARY KEY (id);


--
-- Name: university_admission_periods university_admission_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_admission_periods
    ADD CONSTRAINT university_admission_periods_pkey PRIMARY KEY (id);


--
-- Name: university_admission_periods university_admission_periods_university_id_semester_year_pr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_admission_periods
    ADD CONSTRAINT university_admission_periods_university_id_semester_year_pr_key UNIQUE (university_id, semester, year, program_level, language_track);


--
-- Name: university_admissions university_admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_admissions
    ADD CONSTRAINT university_admissions_pkey PRIMARY KEY (id);


--
-- Name: university_announcements university_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_announcements
    ADD CONSTRAINT university_announcements_pkey PRIMARY KEY (id);


--
-- Name: university_document_requirements university_document_requirement_university_id_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_document_requirements
    ADD CONSTRAINT university_document_requirement_university_id_document_type_key UNIQUE (university_id, document_type);


--
-- Name: university_document_requirements university_document_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_document_requirements
    ADD CONSTRAINT university_document_requirements_pkey PRIMARY KEY (id);


--
-- Name: university_documents university_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_documents
    ADD CONSTRAINT university_documents_pkey PRIMARY KEY (id);


--
-- Name: university_events university_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_events
    ADD CONSTRAINT university_events_pkey PRIMARY KEY (id);


--
-- Name: university_notes university_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_notes
    ADD CONSTRAINT university_notes_pkey PRIMARY KEY (id);


--
-- Name: university_programs university_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_programs
    ADD CONSTRAINT university_programs_pkey PRIMARY KEY (id);


--
-- Name: university_rooms university_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_rooms
    ADD CONSTRAINT university_rooms_pkey PRIMARY KEY (id);


--
-- Name: university_rooms university_rooms_university_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_rooms
    ADD CONSTRAINT university_rooms_university_id_key UNIQUE (university_id);


--
-- Name: university_staff_assignments university_staff_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_staff_assignments
    ADD CONSTRAINT university_staff_assignments_pkey PRIMARY KEY (id);


--
-- Name: university_staff_assignments university_staff_assignments_user_id_university_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_staff_assignments
    ADD CONSTRAINT university_staff_assignments_user_id_university_id_key UNIQUE (user_id, university_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_secrets user_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_secrets
    ADD CONSTRAINT user_secrets_pkey PRIMARY KEY (user_id);


--
-- Name: writing_streaks writing_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.writing_streaks
    ADD CONSTRAINT writing_streaks_pkey PRIMARY KEY (id);


--
-- Name: writing_streaks writing_streaks_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.writing_streaks
    ADD CONSTRAINT writing_streaks_student_id_key UNIQUE (student_id);


--
-- Name: app_version_pings_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_version_pings_last_seen_idx ON public.app_version_pings USING btree (last_seen_at DESC);


--
-- Name: app_version_pings_platform_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_version_pings_platform_version_idx ON public.app_version_pings USING btree (platform, version);


--
-- Name: documents_student_doc_type_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_student_doc_type_unique ON public.documents USING btree (student_id, public.extract_doc_type_tag(name)) WHERE (public.extract_doc_type_tag(name) IS NOT NULL);


--
-- Name: idx_ai_conversations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_conversations_created_at ON public.ai_conversations USING btree (created_at DESC);


--
-- Name: idx_ai_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations USING btree (user_id);


--
-- Name: idx_application_form_cache_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_form_cache_university_id ON public.application_form_cache USING btree (university_id);


--
-- Name: idx_calls_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_staff_id ON public.calls USING btree (staff_id);


--
-- Name: idx_calls_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_started_at ON public.calls USING btree (started_at DESC);


--
-- Name: idx_calls_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_student_id ON public.calls USING btree (student_id);


--
-- Name: idx_changes_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_changes_acknowledged ON public.application_form_changes USING btree (acknowledged_at);


--
-- Name: idx_changes_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_changes_severity ON public.application_form_changes USING btree (severity);


--
-- Name: idx_changes_university; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_changes_university ON public.application_form_changes USING btree (university_id);


--
-- Name: idx_channel_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_channel_id ON public.channel_messages USING btree (channel_id);


--
-- Name: idx_distribution_transfer_items_transfer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distribution_transfer_items_transfer_id ON public.distribution_transfer_items USING btree (transfer_id);


--
-- Name: idx_distribution_transfers_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distribution_transfers_month ON public.distribution_transfers USING btree (transfer_month);


--
-- Name: idx_expenses_linked_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_linked_transaction_id ON public.expenses USING btree (linked_transaction_id);


--
-- Name: idx_intercom_calls_callee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intercom_calls_callee ON public.intercom_calls USING btree (callee_id, status);


--
-- Name: idx_intercom_calls_caller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intercom_calls_caller ON public.intercom_calls USING btree (caller_id, status);


--
-- Name: idx_interview_messages_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_messages_session_id ON public.interview_messages USING btree (session_id);


--
-- Name: idx_interview_questions_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_questions_category ON public.interview_questions USING btree (category);


--
-- Name: idx_interview_questions_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_questions_university_id ON public.interview_questions USING btree (university_id);


--
-- Name: idx_interview_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_sessions_status ON public.interview_sessions USING btree (status);


--
-- Name: idx_interview_sessions_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_sessions_student_id ON public.interview_sessions USING btree (student_id);


--
-- Name: idx_lead_notes_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes USING btree (lead_id);


--
-- Name: idx_leads_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_city ON public.leads USING btree (city);


--
-- Name: idx_leads_last_contacted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_last_contacted ON public.leads USING btree (last_contacted_at);


--
-- Name: idx_leads_next_follow_up; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_next_follow_up ON public.leads USING btree (next_follow_up);


--
-- Name: idx_leads_priority_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_priority_score ON public.leads USING btree (priority_score DESC);


--
-- Name: idx_mentions_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_context ON public.mentions USING btree (context_type, context_id);


--
-- Name: idx_mentions_mentioned_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_mentioned_user_id ON public.mentions USING btree (mentioned_user_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_source ON public.messages USING btree (source);


--
-- Name: idx_monthly_payment_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_payment_categories_active ON public.monthly_payment_categories USING btree (is_active);


--
-- Name: idx_operational_fund_allocations_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_fund_allocations_category ON public.operational_fund_allocations USING btree (category_id);


--
-- Name: idx_operational_fund_allocations_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_fund_allocations_month ON public.operational_fund_allocations USING btree (allocation_month);


--
-- Name: idx_operational_fund_allocations_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_fund_allocations_student ON public.operational_fund_allocations USING btree (student_id);


--
-- Name: idx_profiles_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_city ON public.profiles USING btree (city);


--
-- Name: idx_profiles_magic_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_magic_code ON public.profiles USING btree (magic_code) WHERE (magic_code IS NOT NULL);


--
-- Name: idx_scheduled_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_payments_status ON public.scheduled_payments USING btree (status);


--
-- Name: idx_scheduled_payments_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_payments_student_id ON public.scheduled_payments USING btree (student_id);


--
-- Name: idx_scheduled_payments_trigger_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_payments_trigger_type ON public.scheduled_payments USING btree (trigger_type);


--
-- Name: idx_search_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_jobs_status ON public.search_jobs USING btree (id, status);


--
-- Name: idx_staff_bonuses_month_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_bonuses_month_year ON public.staff_bonuses USING btree (month_year);


--
-- Name: idx_staff_bonuses_staff_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_bonuses_staff_user_id ON public.staff_bonuses USING btree (staff_user_id);


--
-- Name: idx_staff_bonuses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_bonuses_status ON public.staff_bonuses USING btree (status);


--
-- Name: idx_staff_bonuses_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_bonuses_student_id ON public.staff_bonuses USING btree (student_id);


--
-- Name: idx_staff_presence_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_presence_user ON public.staff_presence USING btree (user_id);


--
-- Name: idx_study_plan_analyses_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_analyses_draft_id ON public.study_plan_analyses USING btree (draft_id);


--
-- Name: idx_study_plan_analyses_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_analyses_session ON public.study_plan_analyses USING btree (session_id);


--
-- Name: idx_study_plan_analyses_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_analyses_session_id ON public.study_plan_analyses USING btree (session_id);


--
-- Name: idx_study_plan_chat_history_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_chat_history_session_id ON public.study_plan_chat_history USING btree (session_id);


--
-- Name: idx_study_plan_chat_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_chat_session ON public.study_plan_chat_history USING btree (session_id);


--
-- Name: idx_study_plan_drafts_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_drafts_session ON public.study_plan_drafts USING btree (session_id);


--
-- Name: idx_study_plan_drafts_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_drafts_session_id ON public.study_plan_drafts USING btree (session_id);


--
-- Name: idx_study_plan_drafts_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_drafts_student_id ON public.study_plan_drafts USING btree (student_id);


--
-- Name: idx_study_plan_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_sessions_status ON public.study_plan_sessions USING btree (status);


--
-- Name: idx_study_plan_sessions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_sessions_student ON public.study_plan_sessions USING btree (student_id);


--
-- Name: idx_study_plan_sessions_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_sessions_student_id ON public.study_plan_sessions USING btree (student_id);


--
-- Name: idx_system_map_connections_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_map_connections_from ON public.system_map_connections USING btree (from_node);


--
-- Name: idx_system_map_connections_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_map_connections_to ON public.system_map_connections USING btree (to_node);


--
-- Name: idx_system_map_nodes_ring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_map_nodes_ring ON public.system_map_nodes USING btree (ring);


--
-- Name: idx_system_map_nodes_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_map_nodes_sector ON public.system_map_nodes USING btree (sector);


--
-- Name: idx_tasks_external_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tasks_external_task_id ON public.tasks USING btree (external_task_id) WHERE (external_task_id IS NOT NULL);


--
-- Name: idx_universities_visible_on_map; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universities_visible_on_map ON public.universities USING btree (is_visible_on_map);


--
-- Name: idx_university_admission_periods_semester_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_admission_periods_semester_year ON public.university_admission_periods USING btree (semester, year);


--
-- Name: idx_university_admission_periods_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_admission_periods_university_id ON public.university_admission_periods USING btree (university_id);


--
-- Name: idx_university_notes_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_notes_university_id ON public.university_notes USING btree (university_id);


--
-- Name: idx_university_programs_level_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_programs_level_track ON public.university_programs USING btree (program_level, language_track);


--
-- Name: idx_university_programs_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_programs_university_id ON public.university_programs USING btree (university_id);


--
-- Name: idx_validations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validations_status ON public.application_form_validations USING btree (status);


--
-- Name: idx_validations_university; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validations_university ON public.application_form_validations USING btree (university_id);


--
-- Name: interview_sessions_vapi_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interview_sessions_vapi_call_id_idx ON public.interview_sessions USING btree (vapi_call_id);


--
-- Name: payments generate_payment_invoice_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_payment_invoice_number BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();


--
-- Name: applications on_application_created_add_to_room; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_application_created_add_to_room AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_new_application_room();


--
-- Name: university_staff_assignments on_staff_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_staff_assignment AFTER INSERT ON public.university_staff_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_university_staff_assignment();


--
-- Name: university_staff_assignments on_university_staff_assigned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_university_staff_assigned AFTER INSERT ON public.university_staff_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_university_staff_assignment();


--
-- Name: tasks set_task_external_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_task_external_id BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_task_external_id();


--
-- Name: university_announcements update_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.university_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: application_form_cache update_application_form_cache_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_application_form_cache_updated_at BEFORE UPDATE ON public.application_form_cache FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: applications update_applications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: call_sessions update_call_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON public.call_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: calls update_calls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: channel_messages update_channel_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_channel_messages_updated_at BEFORE UPDATE ON public.channel_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: documents update_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expenses update_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: gks_program_info update_gks_program_info_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_gks_program_info_updated_at BEFORE UPDATE ON public.gks_program_info FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: income_distribution_settings update_income_distribution_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_income_distribution_settings_updated_at BEFORE UPDATE ON public.income_distribution_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: intercom_calls update_intercom_calls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_intercom_calls_updated_at BEFORE UPDATE ON public.intercom_calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_notes update_lead_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_notes_updated_at BEFORE UPDATE ON public.lead_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: monthly_payment_categories update_monthly_payment_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_monthly_payment_categories_updated_at BEFORE UPDATE ON public.monthly_payment_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: operational_fund_settings update_operational_fund_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_fund_settings_updated_at BEFORE UPDATE ON public.operational_fund_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scheduled_payments update_scheduled_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_scheduled_payments_updated_at BEFORE UPDATE ON public.scheduled_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: search_jobs update_search_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_search_jobs_updated_at BEFORE UPDATE ON public.search_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff_bonuses update_staff_bonuses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_bonuses_updated_at BEFORE UPDATE ON public.staff_bonuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff_presence update_staff_presence_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_presence_updated_at BEFORE UPDATE ON public.staff_presence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: student_notes update_student_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_student_notes_updated_at BEFORE UPDATE ON public.student_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: study_plan_sessions update_study_plan_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_study_plan_sessions_updated_at BEFORE UPDATE ON public.study_plan_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_map_nodes update_system_map_nodes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_map_nodes_updated_at BEFORE UPDATE ON public.system_map_nodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: translation_document_types update_translation_document_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_translation_document_types_updated_at BEFORE UPDATE ON public.translation_document_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: translation_jobs update_translation_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_translation_jobs_updated_at BEFORE UPDATE ON public.translation_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: translation_templates update_translation_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_translation_templates_updated_at BEFORE UPDATE ON public.translation_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: universities update_universities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON public.universities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: university_admission_periods update_university_admission_periods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_university_admission_periods_updated_at BEFORE UPDATE ON public.university_admission_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: university_announcements update_university_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_university_announcements_updated_at BEFORE UPDATE ON public.university_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: university_events update_university_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_university_events_updated_at BEFORE UPDATE ON public.university_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: university_notes update_university_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_university_notes_updated_at BEFORE UPDATE ON public.university_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: university_programs update_university_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_university_programs_updated_at BEFORE UPDATE ON public.university_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_version_pings app_version_pings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_version_pings
    ADD CONSTRAINT app_version_pings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: application_form_cache application_form_cache_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_cache
    ADD CONSTRAINT application_form_cache_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: application_form_changes application_form_changes_cache_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_changes
    ADD CONSTRAINT application_form_changes_cache_id_fkey FOREIGN KEY (cache_id) REFERENCES public.application_form_cache(id) ON DELETE CASCADE;


--
-- Name: application_form_changes application_form_changes_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_changes
    ADD CONSTRAINT application_form_changes_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: application_form_validations application_form_validations_cache_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_validations
    ADD CONSTRAINT application_form_validations_cache_id_fkey FOREIGN KEY (cache_id) REFERENCES public.application_form_cache(id) ON DELETE CASCADE;


--
-- Name: application_form_validations application_form_validations_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_form_validations
    ADD CONSTRAINT application_form_validations_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: applications applications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: applications applications_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: call_signals call_signals_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_signals
    ADD CONSTRAINT call_signals_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.call_sessions(id) ON DELETE CASCADE;


--
-- Name: calls calls_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: calls calls_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calls calls_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: channel_messages channel_messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.room_channels(id) ON DELETE CASCADE;


--
-- Name: distribution_transfer_items distribution_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_transfer_items
    ADD CONSTRAINT distribution_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.distribution_transfers(id) ON DELETE CASCADE;


--
-- Name: distribution_transfers distribution_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_transfers
    ADD CONSTRAINT distribution_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: documents documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: documents documents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: documents documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: expenses expenses_linked_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_linked_transaction_id_fkey FOREIGN KEY (linked_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;


--
-- Name: gks_designated_universities gks_designated_universities_gks_program_info_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gks_designated_universities
    ADD CONSTRAINT gks_designated_universities_gks_program_info_id_fkey FOREIGN KEY (gks_program_info_id) REFERENCES public.gks_program_info(id) ON DELETE CASCADE;


--
-- Name: gks_designated_universities gks_designated_universities_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gks_designated_universities
    ADD CONSTRAINT gks_designated_universities_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: income_distributions income_distributions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_distributions
    ADD CONSTRAINT income_distributions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: income_distributions income_distributions_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_distributions
    ADD CONSTRAINT income_distributions_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.income_distribution_settings(id) ON DELETE SET NULL;


--
-- Name: interview_feedback interview_feedback_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.interview_sessions(id) ON DELETE CASCADE;


--
-- Name: interview_messages interview_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_messages
    ADD CONSTRAINT interview_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.interview_sessions(id) ON DELETE CASCADE;


--
-- Name: interview_questions interview_questions_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_questions
    ADD CONSTRAINT interview_questions_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id);


--
-- Name: interview_sessions interview_sessions_target_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_sessions
    ADD CONSTRAINT interview_sessions_target_university_id_fkey FOREIGN KEY (target_university_id) REFERENCES public.universities(id);


--
-- Name: lead_notes lead_notes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: operational_fund_allocations operational_fund_allocations_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_fund_allocations
    ADD CONSTRAINT operational_fund_allocations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.monthly_payment_categories(id) ON DELETE CASCADE;


--
-- Name: operational_fund_allocations operational_fund_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_fund_allocations
    ADD CONSTRAINT operational_fund_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: operational_fund_settings operational_fund_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_fund_settings
    ADD CONSTRAINT operational_fund_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: payment_transactions payment_transactions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payments payments_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: payments payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: peer_review_queue peer_review_queue_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_queue
    ADD CONSTRAINT peer_review_queue_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.study_plan_drafts(id) ON DELETE CASCADE;


--
-- Name: peer_review_queue peer_review_queue_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_queue
    ADD CONSTRAINT peer_review_queue_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id);


--
-- Name: peer_reviews peer_reviews_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_reviews
    ADD CONSTRAINT peer_reviews_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.study_plan_drafts(id) ON DELETE CASCADE;


--
-- Name: room_channels room_channels_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_channels
    ADD CONSTRAINT room_channels_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.university_rooms(id) ON DELETE CASCADE;


--
-- Name: room_members room_members_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_members
    ADD CONSTRAINT room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.university_rooms(id) ON DELETE CASCADE;


--
-- Name: scheduled_payments scheduled_payments_linked_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_payments
    ADD CONSTRAINT scheduled_payments_linked_payment_id_fkey FOREIGN KEY (linked_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: scheduled_payments scheduled_payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_payments
    ADD CONSTRAINT scheduled_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: scheduled_payments scheduled_payments_trigger_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_payments
    ADD CONSTRAINT scheduled_payments_trigger_application_id_fkey FOREIGN KEY (trigger_application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: scholarships scholarships_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scholarships
    ADD CONSTRAINT scholarships_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: staff_password_history staff_password_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_password_history
    ADD CONSTRAINT staff_password_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: staff_password_history staff_password_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_password_history
    ADD CONSTRAINT staff_password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: student_budgets student_budgets_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_budgets
    ADD CONSTRAINT student_budgets_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: student_comments student_comments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_comments
    ADD CONSTRAINT student_comments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_notes student_notes_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_suggestions student_suggestions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_suggestions
    ADD CONSTRAINT student_suggestions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_suggestions student_suggestions_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_suggestions
    ADD CONSTRAINT student_suggestions_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: student_university_priorities student_university_priorities_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_university_priorities
    ADD CONSTRAINT student_university_priorities_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_university_priorities student_university_priorities_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_university_priorities
    ADD CONSTRAINT student_university_priorities_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE SET NULL;


--
-- Name: student_university_priority_comments student_university_priority_comments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_university_priority_comments
    ADD CONSTRAINT student_university_priority_comments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: student_university_priority_comments student_university_priority_comments_priority_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_university_priority_comments
    ADD CONSTRAINT student_university_priority_comments_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES public.student_university_priorities(id) ON DELETE CASCADE;


--
-- Name: study_plan_analyses study_plan_analyses_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_analyses
    ADD CONSTRAINT study_plan_analyses_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.study_plan_drafts(id) ON DELETE CASCADE;


--
-- Name: study_plan_analyses study_plan_analyses_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_analyses
    ADD CONSTRAINT study_plan_analyses_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.study_plan_sessions(id) ON DELETE CASCADE;


--
-- Name: study_plan_chat_history study_plan_chat_history_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_chat_history
    ADD CONSTRAINT study_plan_chat_history_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.study_plan_sessions(id) ON DELETE CASCADE;


--
-- Name: study_plan_drafts study_plan_drafts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_drafts
    ADD CONSTRAINT study_plan_drafts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.study_plan_sessions(id) ON DELETE CASCADE;


--
-- Name: study_plan_sessions study_plan_sessions_target_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_sessions
    ADD CONSTRAINT study_plan_sessions_target_university_id_fkey FOREIGN KEY (target_university_id) REFERENCES public.universities(id) ON DELETE SET NULL;


--
-- Name: system_map_connections system_map_connections_from_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_map_connections
    ADD CONSTRAINT system_map_connections_from_node_fkey FOREIGN KEY (from_node) REFERENCES public.system_map_nodes(id) ON DELETE CASCADE;


--
-- Name: system_map_connections system_map_connections_to_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_map_connections
    ADD CONSTRAINT system_map_connections_to_node_fkey FOREIGN KEY (to_node) REFERENCES public.system_map_nodes(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: translation_jobs translation_jobs_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_jobs
    ADD CONSTRAINT translation_jobs_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.translation_document_types(id);


--
-- Name: translation_jobs translation_jobs_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_jobs
    ADD CONSTRAINT translation_jobs_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id);


--
-- Name: translation_requirements translation_requirements_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_requirements
    ADD CONSTRAINT translation_requirements_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.translation_document_types(id) ON DELETE CASCADE;


--
-- Name: translation_templates translation_templates_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_templates
    ADD CONSTRAINT translation_templates_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.translation_document_types(id) ON DELETE CASCADE;


--
-- Name: university_admission_periods university_admission_periods_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_admission_periods
    ADD CONSTRAINT university_admission_periods_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_admissions university_admissions_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_admissions
    ADD CONSTRAINT university_admissions_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_announcements university_announcements_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_announcements
    ADD CONSTRAINT university_announcements_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.university_rooms(id) ON DELETE CASCADE;


--
-- Name: university_document_requirements university_document_requirements_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_document_requirements
    ADD CONSTRAINT university_document_requirements_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_documents university_documents_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_documents
    ADD CONSTRAINT university_documents_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_documents university_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_documents
    ADD CONSTRAINT university_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: university_events university_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_events
    ADD CONSTRAINT university_events_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.university_rooms(id) ON DELETE CASCADE;


--
-- Name: university_notes university_notes_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_notes
    ADD CONSTRAINT university_notes_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_programs university_programs_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_programs
    ADD CONSTRAINT university_programs_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_rooms university_rooms_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_rooms
    ADD CONSTRAINT university_rooms_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_staff_assignments university_staff_assignments_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_staff_assignments
    ADD CONSTRAINT university_staff_assignments_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_secrets user_secrets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_secrets
    ADD CONSTRAINT user_secrets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scheduled_payments Admin can delete scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can delete scheduled payments" ON public.scheduled_payments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: scheduled_payments Admin can insert scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can insert scheduled payments" ON public.scheduled_payments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: scheduled_payments Admin can update scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update scheduled payments" ON public.scheduled_payments FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: scheduled_payments Admin can view scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can view scheduled payments" ON public.scheduled_payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: leads Admins can delete leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: profiles Admins can delete profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_map_connections Admins can manage connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage connections" ON public.system_map_connections TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: translation_document_types Admins can manage document types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage document types" ON public.translation_document_types USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: system_map_nodes Admins can manage nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage nodes" ON public.system_map_nodes TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: translation_requirements Admins can manage requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage requirements" ON public.translation_requirements USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_staff_assignments Admins can manage staff assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage staff assignments" ON public.university_staff_assignments USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: universities Admins can manage universities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage universities" ON public.universities USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_announcements Agency staff can manage announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency staff can manage announcements" ON public.university_announcements TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: payments All staff can view payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All staff can view payments" ON public.payments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE (user_roles.user_id = auth.uid()))));


--
-- Name: staff_password_history Allow authenticated inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated inserts" ON public.staff_password_history FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: leads Allow public insert for leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert for leads" ON public.leads FOR INSERT WITH CHECK (true);


--
-- Name: app_versions Allow public read access to app_versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to app_versions" ON public.app_versions FOR SELECT USING (true);


--
-- Name: leads Allow public select for leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select for leads" ON public.leads FOR SELECT USING (true);


--
-- Name: staff_password_history Allow view for admins and owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow view for admins and owners" ON public.staff_password_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'owner'::public.app_role]))))));


--
-- Name: gks_designated_universities Anyone can read GKS designated universities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read GKS designated universities" ON public.gks_designated_universities FOR SELECT USING (true);


--
-- Name: gks_program_info Anyone can read GKS program info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read GKS program info" ON public.gks_program_info FOR SELECT USING (true);


--
-- Name: university_admissions Anyone can read admissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read admissions" ON public.university_admissions FOR SELECT USING (true);


--
-- Name: university_programs Anyone can read programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read programs" ON public.university_programs FOR SELECT USING (true);


--
-- Name: search_jobs Anyone can read search jobs by id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read search jobs by id" ON public.search_jobs FOR SELECT TO anon USING (true);


--
-- Name: system_settings Anyone can read settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read settings" ON public.system_settings FOR SELECT USING (true);


--
-- Name: university_rooms Anyone can view active rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active rooms" ON public.university_rooms FOR SELECT USING ((is_active = true));


--
-- Name: scholarships Anyone can view active scholarships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active scholarships" ON public.scholarships FOR SELECT USING (true);


--
-- Name: university_admission_periods Anyone can view admission periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view admission periods" ON public.university_admission_periods FOR SELECT USING (true);


--
-- Name: university_document_requirements Anyone can view document requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view document requirements" ON public.university_document_requirements FOR SELECT USING (true);


--
-- Name: translation_document_types Anyone can view document types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view document types" ON public.translation_document_types FOR SELECT USING (true);


--
-- Name: translation_requirements Anyone can view requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view requirements" ON public.translation_requirements FOR SELECT USING (true);


--
-- Name: university_programs Anyone can view university programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view university programs" ON public.university_programs FOR SELECT USING (true);


--
-- Name: admission_sync_jobs Authenticated staff can insert sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated staff can insert sync jobs" ON public.admission_sync_jobs FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: mentions Authenticated users can create mentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create mentions" ON public.mentions FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: interview_questions Authenticated users can read active questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read active questions" ON public.interview_questions FOR SELECT USING ((is_active = true));


--
-- Name: system_map_connections Authenticated users can read connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read connections" ON public.system_map_connections FOR SELECT TO authenticated USING (true);


--
-- Name: system_map_nodes Authenticated users can read nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read nodes" ON public.system_map_nodes FOR SELECT TO authenticated USING (true);


--
-- Name: peer_reviews Authors can request reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors can request reviews" ON public.peer_reviews FOR INSERT WITH CHECK ((auth.uid() = author_id));


--
-- Name: peer_reviews Authors can view own reviews received; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors can view own reviews received" ON public.peer_reviews FOR SELECT USING ((auth.uid() = author_id));


--
-- Name: channel_messages Members can send messages to discussion channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can send messages to discussion channels" ON public.channel_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.room_channels rc
  WHERE ((rc.id = channel_messages.channel_id) AND (rc.channel_type = 'discussion'::text)))) OR public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role) OR public.has_role(auth.uid(), 'university_staff'::public.app_role)) AND (EXISTS ( SELECT 1
   FROM (public.room_members rm
     JOIN public.room_channels rc ON ((rc.room_id = rm.room_id)))
  WHERE ((rc.id = channel_messages.channel_id) AND (rm.user_id = auth.uid()))))));


--
-- Name: room_channels Members can view channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view channels" ON public.room_channels FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = room_channels.room_id) AND (rm.user_id = auth.uid())))));


--
-- Name: university_events Members can view events in their rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view events in their rooms" ON public.university_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = university_events.room_id) AND (rm.user_id = auth.uid())))));


--
-- Name: channel_messages Members can view messages in their channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view messages in their channels" ON public.channel_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.room_channels rc
     JOIN public.room_members rm ON ((rm.room_id = rc.room_id)))
  WHERE ((rc.id = channel_messages.channel_id) AND (rm.user_id = auth.uid())))));


--
-- Name: room_members Members can view room members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view room members" ON public.room_members FOR SELECT USING (public.is_room_member(room_id, auth.uid()));


--
-- Name: staff_bonuses Owners can delete bonuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete bonuses" ON public.staff_bonuses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: distribution_transfers Owners can delete distribution transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete distribution transfers" ON public.distribution_transfers FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: monthly_payment_categories Owners can delete monthly payment categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete monthly payment categories" ON public.monthly_payment_categories FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: payment_transactions Owners can delete payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete payment transactions" ON public.payment_transactions FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: payments Owners can delete payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete payments" ON public.payments FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: scheduled_payments Owners can delete scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete scheduled payments" ON public.scheduled_payments FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: student_budgets Owners can delete student budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete student budgets" ON public.student_budgets FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: distribution_transfer_items Owners can delete transfer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete transfer items" ON public.distribution_transfer_items FOR DELETE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: monthly_payment_categories Owners can insert monthly payment categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert monthly payment categories" ON public.monthly_payment_categories FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: operational_fund_allocations Owners can insert operational fund allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert operational fund allocations" ON public.operational_fund_allocations FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: user_roles Owners can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: income_distribution_settings Owners can manage income distribution settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage income distribution settings" ON public.income_distribution_settings TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: income_distributions Owners can manage income distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage income distributions" ON public.income_distributions TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: staff_bonuses Owners can update bonuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update bonuses" ON public.staff_bonuses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: monthly_payment_categories Owners can update monthly payment categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update monthly payment categories" ON public.monthly_payment_categories FOR UPDATE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: operational_fund_allocations Owners can update operational fund allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update operational fund allocations" ON public.operational_fund_allocations FOR UPDATE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: operational_fund_settings Owners can update operational fund settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update operational fund settings" ON public.operational_fund_settings FOR UPDATE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: system_settings Owners can update settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update settings" ON public.system_settings FOR UPDATE USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: income_distributions Owners can view income distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view income distributions" ON public.income_distributions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: monthly_payment_categories Owners can view monthly payment categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view monthly payment categories" ON public.monthly_payment_categories FOR SELECT USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: operational_fund_allocations Owners can view operational fund allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view operational fund allocations" ON public.operational_fund_allocations FOR SELECT USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: operational_fund_settings Owners can view operational fund settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view operational fund settings" ON public.operational_fund_settings FOR SELECT USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: call_signals Participants can create signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can create signals" ON public.call_signals FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.call_sessions
  WHERE ((call_sessions.id = call_signals.session_id) AND ((call_sessions.caller_id = auth.uid()) OR (call_sessions.callee_id = auth.uid())))))));


--
-- Name: call_sessions Participants can delete call sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can delete call sessions" ON public.call_sessions FOR DELETE USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));


--
-- Name: call_sessions Participants can update call sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update call sessions" ON public.call_sessions FOR UPDATE USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));


--
-- Name: call_signals Participants can view signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view signals" ON public.call_signals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.call_sessions
  WHERE ((call_sessions.id = call_signals.session_id) AND ((call_sessions.caller_id = auth.uid()) OR (call_sessions.callee_id = auth.uid()))))));


--
-- Name: system_map_connections Public can read connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read connections" ON public.system_map_connections FOR SELECT TO anon USING (true);


--
-- Name: system_map_nodes Public can read nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read nodes" ON public.system_map_nodes FOR SELECT TO anon USING (true);


--
-- Name: peer_reviews Reviewers can update assigned reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers can update assigned reviews" ON public.peer_reviews FOR UPDATE USING ((auth.uid() = reviewer_id));


--
-- Name: peer_reviews Reviewers can view assigned reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers can view assigned reviews" ON public.peer_reviews FOR SELECT USING ((auth.uid() = reviewer_id));


--
-- Name: channel_messages Room members can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Room members can send messages" ON public.channel_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.room_channels rc
     JOIN public.room_members rm ON ((rm.room_id = rc.room_id)))
  WHERE ((rc.id = channel_messages.channel_id) AND (rm.user_id = auth.uid()))))));


--
-- Name: university_announcements Room members can view announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Room members can view announcements" ON public.university_announcements FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.room_members rm
     JOIN public.university_rooms ur ON ((ur.id = university_announcements.room_id)))
  WHERE ((rm.room_id = ur.id) AND (rm.user_id = auth.uid())))));


--
-- Name: admission_sync_jobs Service role can update sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update sync jobs" ON public.admission_sync_jobs FOR UPDATE USING ((auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text])));


--
-- Name: call_sessions Staff can create call sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create call sessions" ON public.call_sessions FOR INSERT WITH CHECK ((auth.uid() = caller_id));


--
-- Name: intercom_calls Staff can create calls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create calls" ON public.intercom_calls FOR INSERT WITH CHECK ((auth.uid() = caller_id));


--
-- Name: task_comments Staff can create comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create comments" ON public.task_comments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: distribution_transfers Staff can create distribution transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create distribution transfers" ON public.distribution_transfers FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: expenses Staff can create expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create expenses" ON public.expenses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: lead_notes Staff can create lead notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create lead notes" ON public.lead_notes FOR INSERT WITH CHECK (((auth.uid() = created_by) AND (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role])))))));


--
-- Name: leads Staff can create leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create leads" ON public.leads FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role]))))));


--
-- Name: student_comments Staff can create student comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create student comments" ON public.student_comments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_notes Staff can create student notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create student notes" ON public.student_notes FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priorities Staff can create student university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create student university priorities" ON public.student_university_priorities FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priority_comments Staff can create student university priority comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create student university priority comments" ON public.student_university_priority_comments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: tasks Staff can create tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create tasks" ON public.tasks FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: distribution_transfer_items Staff can create transfer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create transfer items" ON public.distribution_transfer_items FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_documents Staff can create university documents metadata; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create university documents metadata" ON public.university_documents FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: university_notes Staff can create university notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create university notes" ON public.university_notes FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role, 'document_handler'::public.app_role]))))) AND (created_by = auth.uid())));


--
-- Name: student_achievements Staff can delete achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete achievements" ON public.student_achievements FOR DELETE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: study_plan_chat_history Staff can delete chat history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete chat history" ON public.study_plan_chat_history FOR DELETE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: distribution_transfer_items Staff can delete distribution items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete distribution items" ON public.distribution_transfer_items FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: distribution_transfers Staff can delete distribution transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete distribution transfers" ON public.distribution_transfers FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: documents Staff can delete documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete documents" ON public.documents FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: expenses Staff can delete expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete expenses" ON public.expenses FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: tasks Staff can delete own or assigned tasks except synced; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete own or assigned tasks except synced" ON public.tasks FOR DELETE USING (((source <> 'command-center'::text) AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (created_by = auth.uid()) OR (assigned_to = auth.uid()))));


--
-- Name: student_university_priorities Staff can delete student university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete student university priorities" ON public.student_university_priorities FOR DELETE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: university_documents Staff can delete university documents metadata; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete university documents metadata" ON public.university_documents FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: university_notes Staff can delete university notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete university notes" ON public.university_notes FOR DELETE USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])))))));


--
-- Name: staff_bonuses Staff can insert bonuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert bonuses" ON public.staff_bonuses FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: distribution_transfer_items Staff can insert distribution items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert distribution items" ON public.distribution_transfer_items FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: distribution_transfers Staff can insert distribution transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert distribution transfers" ON public.distribution_transfers FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: documents Staff can insert documents for students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert documents for students" ON public.documents FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: payment_transactions Staff can insert payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert payment transactions" ON public.payment_transactions FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: payments Staff can insert payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert payments" ON public.payments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: scheduled_payments Staff can insert scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert scheduled payments" ON public.scheduled_payments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_budgets Staff can insert student budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert student budgets" ON public.student_budgets FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: profiles Staff can insert student profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert student profiles" ON public.profiles FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priorities Staff can insert student university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert student university priorities" ON public.student_university_priorities FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priority_comments Staff can insert student university priority comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert student university priority comments" ON public.student_university_priority_comments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: gks_designated_universities Staff can manage GKS designated universities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage GKS designated universities" ON public.gks_designated_universities USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: gks_program_info Staff can manage GKS program info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage GKS program info" ON public.gks_program_info USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: university_admission_periods Staff can manage admission periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage admission periods" ON public.university_admission_periods USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: channel_messages Staff can manage all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage all messages" ON public.channel_messages USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: peer_reviews Staff can manage all reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage all reviews" ON public.peer_reviews USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_announcements Staff can manage announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage announcements" ON public.university_announcements TO authenticated USING ((public.has_role(auth.uid(), 'university_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.university_rooms ur
     JOIN public.university_staff_assignments usa ON ((usa.university_id = ur.university_id)))
  WHERE ((ur.id = university_announcements.room_id) AND (usa.user_id = auth.uid()) AND (usa.is_active = true)))))) WITH CHECK ((public.has_role(auth.uid(), 'university_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.university_rooms ur
     JOIN public.university_staff_assignments usa ON ((usa.university_id = ur.university_id)))
  WHERE ((ur.id = university_announcements.room_id) AND (usa.user_id = auth.uid()) AND (usa.is_active = true))))));


--
-- Name: applications Staff can manage applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage applications" ON public.applications USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: calls Staff can manage calls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage calls" ON public.calls USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role)));


--
-- Name: application_form_changes Staff can manage changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage changes" ON public.application_form_changes USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: room_channels Staff can manage channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage channels" ON public.room_channels USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_document_requirements Staff can manage document requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage document requirements" ON public.university_document_requirements USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: documents Staff can manage documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage documents" ON public.documents USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: university_events Staff can manage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage events" ON public.university_events USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: application_form_cache Staff can manage form cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage form cache" ON public.application_form_cache USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: messages Staff can manage messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage messages" ON public.messages USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role)));


--
-- Name: payments Staff can manage payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage payments" ON public.payments USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: interview_questions Staff can manage questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage questions" ON public.interview_questions USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE (user_roles.user_id = auth.uid()))));


--
-- Name: peer_review_queue Staff can manage queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage queue" ON public.peer_review_queue USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: room_members Staff can manage room members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage room members" ON public.room_members USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: university_rooms Staff can manage rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage rooms" ON public.university_rooms USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: scholarships Staff can manage scholarships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage scholarships" ON public.scholarships USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_suggestions Staff can manage suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage suggestions" ON public.student_suggestions USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'owner'::public.app_role]))))));


--
-- Name: translation_templates Staff can manage templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage templates" ON public.translation_templates USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: message_threads Staff can manage threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage threads" ON public.message_threads USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role)));


--
-- Name: payment_transactions Staff can manage transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage transactions" ON public.payment_transactions USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: translation_jobs Staff can manage translation jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage translation jobs" ON public.translation_jobs USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: university_programs Staff can manage university programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage university programs" ON public.university_programs USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: application_form_validations Staff can manage validations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage validations" ON public.application_form_validations USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: admission_sync_jobs Staff can read sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can read sync jobs" ON public.admission_sync_jobs FOR SELECT USING (true);


--
-- Name: student_achievements Staff can update achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update achievements" ON public.student_achievements FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Staff can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update all profiles" ON public.profiles FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: distribution_transfer_items Staff can update distribution items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update distribution items" ON public.distribution_transfer_items FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: distribution_transfers Staff can update distribution transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update distribution transfers" ON public.distribution_transfers FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: documents Staff can update documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update documents" ON public.documents FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: expenses Staff can update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update expenses" ON public.expenses FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: leads Staff can update leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update leads" ON public.leads FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role]))))));


--
-- Name: student_notes Staff can update own student notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update own student notes" ON public.student_notes FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: university_notes Staff can update own university notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update own university notes" ON public.university_notes FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: payment_transactions Staff can update payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update payment transactions" ON public.payment_transactions FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: payments Staff can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update payments" ON public.payments FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: scheduled_payments Staff can update scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update scheduled payments" ON public.scheduled_payments FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_budgets Staff can update student budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update student budgets" ON public.student_budgets FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priorities Staff can update student university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update student university priorities" ON public.student_university_priorities FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: tasks Staff can update tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update tasks" ON public.tasks FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (assigned_to = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: intercom_calls Staff can update their calls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update their calls" ON public.intercom_calls FOR UPDATE USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));


--
-- Name: distribution_transfer_items Staff can update transfer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update transfer items" ON public.distribution_transfer_items FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_documents Staff can update university documents metadata; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update university documents metadata" ON public.university_documents FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: profiles Staff can update university_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update university_notes" ON public.profiles FOR UPDATE USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_achievements Staff can view all achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all achievements" ON public.student_achievements FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: study_plan_analyses Staff can view all analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all analyses" ON public.study_plan_analyses FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: applications Staff can view all applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all applications" ON public.applications FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: staff_bonuses Staff can view all bonuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all bonuses" ON public.staff_bonuses FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: calls Staff can view all calls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all calls" ON public.calls FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: application_form_changes Staff can view all changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all changes" ON public.application_form_changes FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: study_plan_chat_history Staff can view all chat history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all chat history" ON public.study_plan_chat_history FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: documents Staff can view all documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all documents" ON public.documents FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: study_plan_drafts Staff can view all drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all drafts" ON public.study_plan_drafts FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: interview_feedback Staff can view all interview feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all interview feedback" ON public.interview_feedback FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: interview_messages Staff can view all interview messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all interview messages" ON public.interview_messages FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: interview_sessions Staff can view all interview sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all interview sessions" ON public.interview_sessions FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)));


--
-- Name: leads Staff can view all leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all leads" ON public.leads FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role, 'document_handler'::public.app_role]))))));


--
-- Name: messages Staff can view all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all messages" ON public.messages FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: payment_transactions Staff can view all payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all payment transactions" ON public.payment_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND ((user_roles.role)::text = ANY (ARRAY['owner'::text, 'admin'::text, 'call_operator'::text, 'document_handler'::text]))))));


--
-- Name: payments Staff can view all payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all payments" ON public.payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND ((user_roles.role)::text = ANY (ARRAY['owner'::text, 'admin'::text, 'call_operator'::text, 'document_handler'::text]))))));


--
-- Name: staff_presence Staff can view all presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all presence" ON public.staff_presence FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: profiles Staff can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: user_roles Staff can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all roles" ON public.user_roles FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: room_members Staff can view all room members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all room members" ON public.room_members FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: scheduled_payments Staff can view all scheduled payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all scheduled payments" ON public.scheduled_payments FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: study_plan_sessions Staff can view all sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all sessions" ON public.study_plan_sessions FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: writing_streaks Staff can view all streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all streaks" ON public.writing_streaks FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: student_budgets Staff can view all student budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all student budgets" ON public.student_budgets FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_comments Staff can view all student comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all student comments" ON public.student_comments FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_notes Staff can view all student notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all student notes" ON public.student_notes FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priorities Staff can view all student university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all student university priorities" ON public.student_university_priorities FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: student_university_priority_comments Staff can view all student university priority comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all student university priority comments" ON public.student_university_priority_comments FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: message_threads Staff can view all threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all threads" ON public.message_threads FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: payment_transactions Staff can view all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all transactions" ON public.payment_transactions FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: translation_jobs Staff can view all translation jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all translation jobs" ON public.translation_jobs FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: application_form_validations Staff can view all validations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all validations" ON public.application_form_validations FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: distribution_transfer_items Staff can view distribution items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view distribution items" ON public.distribution_transfer_items FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: distribution_transfers Staff can view distribution transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view distribution transfers" ON public.distribution_transfers FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: expenses Staff can view expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view expenses" ON public.expenses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))));


--
-- Name: application_form_cache Staff can view form cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view form cache" ON public.application_form_cache FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role)));


--
-- Name: income_distribution_settings Staff can view income distribution settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view income distribution settings" ON public.income_distribution_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'::public.app_role));


--
-- Name: lead_notes Staff can view lead notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view lead notes" ON public.lead_notes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role, 'document_handler'::public.app_role]))))));


--
-- Name: tasks Staff can view own or assigned tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view own or assigned tasks" ON public.tasks FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (assigned_to = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: task_comments Staff can view task comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view task comments" ON public.task_comments FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'call_operator'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: translation_templates Staff can view templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view templates" ON public.translation_templates FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role)));


--
-- Name: call_sessions Staff can view their call sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view their call sessions" ON public.call_sessions FOR SELECT USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));


--
-- Name: intercom_calls Staff can view their calls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view their calls" ON public.intercom_calls FOR SELECT USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));


--
-- Name: distribution_transfer_items Staff can view transfer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view transfer items" ON public.distribution_transfer_items FOR SELECT USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: university_documents Staff can view university documents metadata; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view university documents metadata" ON public.university_documents FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'document_handler'::public.app_role) OR public.has_role(auth.uid(), 'university_staff'::public.app_role)));


--
-- Name: university_notes Staff can view university notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view university notes" ON public.university_notes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'call_operator'::public.app_role, 'document_handler'::public.app_role]))))));


--
-- Name: peer_review_queue Students can add to queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can add to queue" ON public.peer_review_queue FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.study_plan_drafts d
     JOIN public.study_plan_sessions s ON ((d.session_id = s.id)))
  WHERE ((d.id = peer_review_queue.draft_id) AND (s.student_id = auth.uid())))));


--
-- Name: study_plan_analyses Students can create analyses for own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create analyses for own sessions" ON public.study_plan_analyses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.study_plan_sessions s
  WHERE ((s.id = study_plan_analyses.session_id) AND (s.student_id = auth.uid())))));


--
-- Name: study_plan_chat_history Students can create chat messages for own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create chat messages for own sessions" ON public.study_plan_chat_history FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.study_plan_sessions s
  WHERE ((s.id = study_plan_chat_history.session_id) AND (s.student_id = auth.uid())))));


--
-- Name: study_plan_drafts Students can create own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create own drafts" ON public.study_plan_drafts FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: study_plan_sessions Students can create own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create own sessions" ON public.study_plan_sessions FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: interview_sessions Students can create their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can create their own sessions" ON public.interview_sessions FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: study_plan_drafts Students can delete own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can delete own drafts" ON public.study_plan_drafts FOR DELETE USING ((auth.uid() = student_id));


--
-- Name: interview_sessions Students can delete own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can delete own sessions" ON public.interview_sessions FOR DELETE USING ((auth.uid() = student_id));


--
-- Name: study_plan_sessions Students can delete own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can delete own sessions" ON public.study_plan_sessions FOR DELETE USING ((auth.uid() = student_id));


--
-- Name: student_suggestions Students can delete their own suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can delete their own suggestions" ON public.student_suggestions FOR DELETE USING ((auth.uid() = student_id));


--
-- Name: student_achievements Students can earn achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can earn achievements" ON public.student_achievements FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: interview_messages Students can insert messages to their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can insert messages to their sessions" ON public.interview_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.interview_sessions
  WHERE ((interview_sessions.id = interview_messages.session_id) AND (interview_sessions.student_id = auth.uid())))));


--
-- Name: applications Students can insert their own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can insert their own applications" ON public.applications FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: writing_streaks Students can modify own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can modify own streaks" ON public.writing_streaks FOR UPDATE USING ((auth.uid() = student_id));


--
-- Name: translation_jobs Students can request translations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can request translations" ON public.translation_jobs FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: interview_messages Students can update messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update messages in their sessions" ON public.interview_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.interview_sessions
  WHERE ((interview_sessions.id = interview_messages.session_id) AND (interview_sessions.student_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.interview_sessions
  WHERE ((interview_sessions.id = interview_messages.session_id) AND (interview_sessions.student_id = auth.uid())))));


--
-- Name: study_plan_drafts Students can update own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update own drafts" ON public.study_plan_drafts FOR UPDATE USING ((auth.uid() = student_id));


--
-- Name: study_plan_sessions Students can update own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update own sessions" ON public.study_plan_sessions FOR UPDATE USING ((auth.uid() = student_id));


--
-- Name: writing_streaks Students can update own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update own streaks" ON public.writing_streaks FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: interview_sessions Students can update their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own sessions" ON public.interview_sessions FOR UPDATE USING ((auth.uid() = student_id));


--
-- Name: student_university_priorities Students can update their own university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own university priorities" ON public.student_university_priorities FOR UPDATE USING ((auth.uid() = student_id)) WITH CHECK ((auth.uid() = student_id));


--
-- Name: student_university_priorities Students can update their own university selection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own university selection" ON public.student_university_priorities FOR UPDATE USING ((auth.uid() = student_id)) WITH CHECK ((auth.uid() = student_id));


--
-- Name: documents Students can upload their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can upload their own documents" ON public.documents FOR INSERT WITH CHECK ((auth.uid() = student_id));


--
-- Name: interview_feedback Students can view feedback for their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view feedback for their sessions" ON public.interview_feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interview_sessions
  WHERE ((interview_sessions.id = interview_feedback.session_id) AND (interview_sessions.student_id = auth.uid())))));


--
-- Name: interview_messages Students can view messages from their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view messages from their sessions" ON public.interview_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interview_sessions
  WHERE ((interview_sessions.id = interview_messages.session_id) AND (interview_sessions.student_id = auth.uid())))));


--
-- Name: student_achievements Students can view own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own achievements" ON public.student_achievements FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: study_plan_analyses Students can view own analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own analyses" ON public.study_plan_analyses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.study_plan_sessions s
  WHERE ((s.id = study_plan_analyses.session_id) AND (s.student_id = auth.uid())))));


--
-- Name: study_plan_chat_history Students can view own chat history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own chat history" ON public.study_plan_chat_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.study_plan_sessions s
  WHERE ((s.id = study_plan_chat_history.session_id) AND (s.student_id = auth.uid())))));


--
-- Name: study_plan_drafts Students can view own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own drafts" ON public.study_plan_drafts FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: study_plan_sessions Students can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own sessions" ON public.study_plan_sessions FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: writing_streaks Students can view own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own streaks" ON public.writing_streaks FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: peer_review_queue Students can view queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view queue" ON public.peer_review_queue FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: applications Students can view their own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own applications" ON public.applications FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: documents Students can view their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own documents" ON public.documents FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: payments Students can view their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own payments" ON public.payments FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: interview_sessions Students can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own sessions" ON public.interview_sessions FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: student_suggestions Students can view their own suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own suggestions" ON public.student_suggestions FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: translation_jobs Students can view their own translation jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own translation jobs" ON public.translation_jobs FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: student_university_priorities Students can view their own university priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own university priorities" ON public.student_university_priorities FOR SELECT USING ((auth.uid() = student_id));


--
-- Name: university_notes Students can view university notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view university notes" ON public.university_notes FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: interview_feedback System can insert feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert feedback" ON public.interview_feedback FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.interview_sessions
  WHERE ((interview_sessions.id = interview_feedback.session_id) AND (interview_sessions.student_id = auth.uid())))));


--
-- Name: universities Universities are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Universities are viewable by everyone" ON public.universities FOR SELECT USING (true);


--
-- Name: documents University staff can view applicant documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "University staff can view applicant documents" ON public.documents FOR SELECT USING ((public.has_role(auth.uid(), 'university_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.university_staff_assignments usa ON ((usa.university_id = a.university_id)))
  WHERE ((a.student_id = documents.student_id) AND (usa.user_id = auth.uid()) AND (usa.is_active = true))))));


--
-- Name: university_staff_assignments University staff can view own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "University staff can view own assignments" ON public.university_staff_assignments FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: applications University staff can view their university applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "University staff can view their university applications" ON public.applications FOR SELECT USING ((public.has_role(auth.uid(), 'university_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.university_staff_assignments usa
  WHERE ((usa.user_id = auth.uid()) AND (usa.university_id = applications.university_id) AND (usa.is_active = true))))));


--
-- Name: search_jobs Users can create their own search jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own search jobs" ON public.search_jobs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: lead_notes Users can delete own lead notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lead notes" ON public.lead_notes FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: mentions Users can delete own mentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own mentions" ON public.mentions FOR DELETE USING ((auth.uid() = mentioned_user_id));


--
-- Name: staff_presence Users can delete own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own presence" ON public.staff_presence FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: student_comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own comments" ON public.student_comments FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: task_comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own comments" ON public.task_comments FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: channel_messages Users can delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own messages" ON public.channel_messages FOR DELETE USING ((sender_id = auth.uid()));


--
-- Name: student_notes Users can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notes" ON public.student_notes FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: student_university_priority_comments Users can delete their own university priority comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own university priority comments" ON public.student_university_priority_comments FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: staff_presence Users can insert own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own presence" ON public.staff_presence FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_conversations Users can insert their own AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own AI conversations" ON public.ai_conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_secrets Users can insert their own secret; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own secret" ON public.user_secrets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: room_members Users can join rooms for their applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can join rooms for their applications" ON public.room_members FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.university_rooms ur ON ((ur.university_id = a.university_id)))
  WHERE ((a.student_id = auth.uid()) AND (ur.id = room_members.room_id))))));


--
-- Name: ai_context_cache Users can manage own ai context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own ai context" ON public.ai_context_cache TO authenticated USING (((auth.uid())::text = (user_id)::text));


--
-- Name: ai_conversations Users can manage own ai conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own ai conversations" ON public.ai_conversations TO authenticated USING (((auth.uid())::text = (user_id)::text));


--
-- Name: ai_context_cache Users can manage their own context cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own context cache" ON public.ai_context_cache USING ((auth.uid() = user_id));


--
-- Name: user_secrets Users can see their own secret; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own secret" ON public.user_secrets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: lead_notes Users can update own lead notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lead notes" ON public.lead_notes FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: staff_presence Users can update own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own presence" ON public.staff_presence FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: task_comments Users can update own task comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own task comments" ON public.task_comments FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: mentions Users can update their own mentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own mentions" ON public.mentions FOR UPDATE USING ((auth.uid() = mentioned_user_id));


--
-- Name: channel_messages Users can update their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own messages" ON public.channel_messages FOR UPDATE USING ((sender_id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profiles" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: search_jobs Users can update their own search jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own search jobs" ON public.search_jobs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_secrets Users can update their own secret; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own secret" ON public.user_secrets FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own status" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_conversations Users can view their own AI conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own AI conversations" ON public.ai_conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_context_cache Users can view their own context cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own context cache" ON public.ai_context_cache FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: mentions Users can view their own mentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own mentions" ON public.mentions FOR SELECT USING ((auth.uid() = mentioned_user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: search_jobs Users can view their own search jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own search jobs" ON public.search_jobs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: admission_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admission_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_context_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_context_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: app_version_pings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_version_pings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: application_form_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_form_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: application_form_changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_form_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: application_form_validations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_form_validations ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: call_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: call_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: distribution_transfer_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.distribution_transfer_items ENABLE ROW LEVEL SECURITY;

--
-- Name: distribution_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.distribution_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: gks_designated_universities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gks_designated_universities ENABLE ROW LEVEL SECURITY;

--
-- Name: gks_program_info; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gks_program_info ENABLE ROW LEVEL SECURITY;

--
-- Name: income_distribution_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.income_distribution_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: income_distributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.income_distributions ENABLE ROW LEVEL SECURITY;

--
-- Name: intercom_calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intercom_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: mentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

--
-- Name: message_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_payment_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.monthly_payment_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_fund_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_fund_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_fund_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_fund_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: peer_review_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.peer_review_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: peer_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: room_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: room_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: scholarships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

--
-- Name: search_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_bonuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_bonuses ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_password_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_password_history ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: student_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: student_budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: student_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: student_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: student_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: student_university_priorities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_university_priorities ENABLE ROW LEVEL SECURITY;

--
-- Name: student_university_priority_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_university_priority_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: study_plan_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_plan_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: study_plan_chat_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_plan_chat_history ENABLE ROW LEVEL SECURITY;

--
-- Name: study_plan_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_plan_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: study_plan_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_plan_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: system_map_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_map_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: system_map_nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_map_nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: translation_document_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.translation_document_types ENABLE ROW LEVEL SECURITY;

--
-- Name: translation_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.translation_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: translation_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.translation_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: translation_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.translation_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: universities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

--
-- Name: university_admission_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_admission_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: university_admissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_admissions ENABLE ROW LEVEL SECURITY;

--
-- Name: university_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: university_document_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_document_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: university_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: university_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_events ENABLE ROW LEVEL SECURITY;

--
-- Name: university_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: university_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: university_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: university_staff_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.university_staff_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: app_version_pings users upsert own ping; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users upsert own ping" ON public.app_version_pings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: writing_streaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.writing_streaks ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
