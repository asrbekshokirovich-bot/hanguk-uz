-- ============================================================================
-- Communication Intelligence Foundation
-- ----------------------------------------------------------------------------
-- Builds the "spine" that ties every communication (phone call, Telegram chat,
-- Instagram DM, …) to a single student or lead, plus the storage + retrieval
-- primitives that let Hanguk AI actually understand those conversations:
--
--   * communication_identities   — maps (channel, identifier) -> student/lead
--   * normalize_phone()          — shared phone canonicaliser (mirrors the JS)
--   * resolve_communication_identity() — lookup used by every webhook
--   * call_transcripts           — diarised, language-tagged call transcripts
--   * call_analyses              — AI summary/intent/sentiment/action-items (UZ+EN)
--   * comm_processing_jobs       — durable queue for the async pipeline
--   * communication_embeddings   — pgvector store for RAG over conversations
--   * match_communication_embeddings() — similarity search RPC
--   * enqueue trigger + backfill — wire existing data into the new model
--
-- Idempotent where practical; safe to re-run the data backfill via ON CONFLICT.
-- ============================================================================

-- pgvector is already installed in this project (schema public, v0.8.0). The
-- IF NOT EXISTS keeps this migration self-describing without re-installing.
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- Phone canonicaliser. Mirrors normalizePhoneNumber() in voip-webhook so a
-- number resolved in SQL and a number resolved in TypeScript land on the same
-- key. Uzbek-first: bare 9-digit local numbers get the +998 country code.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n text;
BEGIN
  IF p IS NULL THEN
    RETURN NULL;
  END IF;
  n := regexp_replace(p, '\D', '', 'g');
  IF n = '' THEN
    RETURN NULL;
  END IF;
  IF left(n, 3) = '998' THEN
    n := '+' || n;
  ELSIF left(n, 1) = '9' AND length(n) = 9 THEN
    n := '+998' || n;
  END IF;
  RETURN n;
END;
$$;

-- ----------------------------------------------------------------------------
-- communication_identities: the identity spine.
-- One row per (channel, identifier). identifier is the canonical key for that
-- channel — a normalised phone (+998…), a Telegram chat id, an Instagram id, …
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_identities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel          text NOT NULL CHECK (channel IN ('phone', 'telegram', 'instagram', 'whatsapp', 'email')),
  identifier       text NOT NULL,                 -- canonical per-channel key
  identifier_label text,                           -- human-friendly original (e.g. "+998 90 123 45 67", "@ali")
  student_id       uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  display_name     text,
  -- confirmed: verified link · inferred: auto-matched · unverified: needs staff check
  confidence       text NOT NULL DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'inferred', 'unverified')),
  -- auto: matched by a webhook · staff: a human attached it · import: backfill
  source           text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'staff', 'import')),
  attached_by      uuid,                           -- staff user_id when source='staff'
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, identifier),
  -- a mapping is useless unless it points at *someone*
  CONSTRAINT communication_identities_has_owner CHECK (student_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_comm_identities_student ON public.communication_identities(student_id);
CREATE INDEX IF NOT EXISTS idx_comm_identities_lead    ON public.communication_identities(lead_id);
CREATE INDEX IF NOT EXISTS idx_comm_identities_lookup  ON public.communication_identities(channel, identifier);

DROP TRIGGER IF EXISTS trg_comm_identities_updated_at ON public.communication_identities;
CREATE TRIGGER trg_comm_identities_updated_at
  BEFORE UPDATE ON public.communication_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lookup used by every ingestion webhook. SECURITY DEFINER so edge functions
-- (and future RLS-restricted callers) get a consistent answer.
CREATE OR REPLACE FUNCTION public.resolve_communication_identity(p_channel text, p_identifier text)
RETURNS TABLE (student_id uuid, lead_id uuid, display_name text, confidence text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id, lead_id, display_name, confidence
  FROM public.communication_identities
  WHERE channel = p_channel
    AND identifier = p_identifier
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- call_transcripts: raw, diarised transcript for a recorded call.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_transcripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  provider      text NOT NULL DEFAULT 'elevenlabs',   -- elevenlabs | gemini
  language_code text,                                  -- detected (e.g. uzb, rus, kor)
  full_text     text,
  -- [{ speaker, start, end, text }] — speaker turns with timestamps
  segments      jsonb,
  word_count    integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id)
);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_call ON public.call_transcripts(call_id);

DROP TRIGGER IF EXISTS trg_call_transcripts_updated_at ON public.call_transcripts;
CREATE TRIGGER trg_call_transcripts_updated_at
  BEFORE UPDATE ON public.call_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- call_analyses: the AI's understanding of a call. Bilingual summaries because
-- staff work in Uzbek but the data is also consumed by English-first tooling.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_analyses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id           uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  student_id        uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  lead_id           uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  summary_uz        text,
  summary_en        text,
  intent            text,
  sentiment         text,                 -- positive | neutral | negative | frustrated | …
  topics            text[],
  action_items      jsonb,                -- [{ text, owner, due }]
  promises          jsonb,                -- commitments either party made
  entities          jsonb,                -- { documents, payments, universities, dates, people }
  follow_up_needed  boolean NOT NULL DEFAULT false,
  follow_up_reason  text,
  risk_flags        text[],               -- e.g. complaint, refund_request, urgent
  model             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id)
);

CREATE INDEX IF NOT EXISTS idx_call_analyses_call    ON public.call_analyses(call_id);
CREATE INDEX IF NOT EXISTS idx_call_analyses_student ON public.call_analyses(student_id);
CREATE INDEX IF NOT EXISTS idx_call_analyses_lead    ON public.call_analyses(lead_id);

DROP TRIGGER IF EXISTS trg_call_analyses_updated_at ON public.call_analyses;
CREATE TRIGGER trg_call_analyses_updated_at
  BEFORE UPDATE ON public.call_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- comm_processing_jobs: a small, observable, retryable work queue. We keep it
-- as a plain table (rather than pgmq) so staff/ops can SQL-inspect failures.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comm_processing_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type     text NOT NULL,                       -- e.g. call_transcribe_analyze
  ref_table    text NOT NULL,                       -- e.g. calls
  ref_id       uuid NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error   text,
  payload      jsonb,
  locked_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_type, ref_table, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_jobs_pending ON public.comm_processing_jobs(status, created_at)
  WHERE status IN ('pending', 'error');

DROP TRIGGER IF EXISTS trg_comm_jobs_updated_at ON public.comm_processing_jobs;
CREATE TRIGGER trg_comm_jobs_updated_at
  BEFORE UPDATE ON public.comm_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- communication_embeddings: pgvector store powering RAG over conversations.
-- text-embedding-004 (Gemini) emits 768-dim vectors.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,                         -- call | message
  source_id   uuid NOT NULL,
  student_id  uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lead_id     uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  channel     text,                                  -- phone | telegram | instagram | …
  chunk_index integer NOT NULL DEFAULT 0,
  content     text NOT NULL,
  embedding   vector(768),
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_emb_vec
  ON public.communication_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_comm_emb_student ON public.communication_embeddings(student_id);
CREATE INDEX IF NOT EXISTS idx_comm_emb_lead    ON public.communication_embeddings(lead_id);
CREATE INDEX IF NOT EXISTS idx_comm_emb_source  ON public.communication_embeddings(source_type, source_id);

-- Similarity search, optionally scoped to one student or lead.
CREATE OR REPLACE FUNCTION public.match_communication_embeddings(
  query_embedding   vector(768),
  match_count       integer DEFAULT 8,
  filter_student_id uuid DEFAULT NULL,
  filter_lead_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  source_type text,
  source_id   uuid,
  channel     text,
  content     text,
  metadata    jsonb,
  similarity  double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id,
    e.source_type,
    e.source_id,
    e.channel,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.communication_embeddings e
  WHERE e.embedding IS NOT NULL
    AND (filter_student_id IS NULL OR e.student_id = filter_student_id)
    AND (filter_lead_id IS NULL OR e.lead_id = filter_lead_id)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ----------------------------------------------------------------------------
-- Auto-enqueue: whenever a call lands (or updates) with a recording and a
-- completed status, queue it for transcription + analysis. ON CONFLICT keeps
-- it idempotent so webhook retries / status churn don't create duplicate jobs.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_call_processing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recording_url IS NOT NULL AND NEW.status = 'completed' THEN
    INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
    VALUES (
      'call_transcribe_analyze',
      'calls',
      NEW.id,
      jsonb_build_object('recording_url', NEW.recording_url)
    )
    ON CONFLICT (job_type, ref_table, ref_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_call_processing ON public.calls;
CREATE TRIGGER trg_enqueue_call_processing
  AFTER INSERT OR UPDATE OF recording_url, status ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_call_processing();

-- ============================================================================
-- Row Level Security
-- Service role (used by the edge functions) bypasses RLS entirely. These
-- policies govern what staff can see/do from the browser.
-- ============================================================================
ALTER TABLE public.communication_identities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_analyses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_processing_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_embeddings  ENABLE ROW LEVEL SECURITY;

-- Staff can read everything in these tables.
CREATE POLICY "Staff can view communication identities"
  ON public.communication_identities FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- Staff can attach / re-attach / detach identities (the "staff will attach it"
-- requirement). We don't restrict to a single role beyond the staff set.
CREATE POLICY "Staff can manage communication identities"
  ON public.communication_identities FOR ALL
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view call transcripts"
  ON public.call_transcripts FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view call analyses"
  ON public.call_analyses FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view comm processing jobs"
  ON public.comm_processing_jobs FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view communication embeddings"
  ON public.communication_embeddings FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'call_operator'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- ============================================================================
-- Backfill: seed identities from the people we already know, then link the
-- existing calls, and finally enqueue any already-recorded calls.
-- ============================================================================

-- Students' primary phones (highest trust).
INSERT INTO public.communication_identities (channel, identifier, identifier_label, student_id, display_name, confidence, source)
SELECT 'phone', public.normalize_phone(phone), phone, user_id, full_name, 'confirmed', 'import'
FROM public.profiles
WHERE phone IS NOT NULL AND public.normalize_phone(phone) IS NOT NULL
ON CONFLICT (channel, identifier) DO NOTHING;

-- Students' secondary phones.
INSERT INTO public.communication_identities (channel, identifier, identifier_label, student_id, display_name, confidence, source)
SELECT 'phone', public.normalize_phone(additional_phone), additional_phone, user_id, full_name, 'confirmed', 'import'
FROM public.profiles
WHERE additional_phone IS NOT NULL AND public.normalize_phone(additional_phone) IS NOT NULL
ON CONFLICT (channel, identifier) DO NOTHING;

-- Leads' phones (only where a student hasn't already claimed that number).
INSERT INTO public.communication_identities (channel, identifier, identifier_label, lead_id, display_name, confidence, source)
SELECT 'phone', public.normalize_phone(phone), phone, id, full_name, 'inferred', 'import'
FROM public.leads
WHERE phone IS NOT NULL AND public.normalize_phone(phone) IS NOT NULL
ON CONFLICT (channel, identifier) DO NOTHING;

-- Link existing calls to a student via the freshly-seeded identities.
UPDATE public.calls c
SET student_id = ci.student_id
FROM public.communication_identities ci
WHERE ci.channel = 'phone'
  AND ci.identifier = public.normalize_phone(c.phone_number)
  AND ci.student_id IS NOT NULL
  AND c.student_id IS NULL;

-- Link existing calls to a lead where no student matched.
UPDATE public.calls c
SET lead_id = ci.lead_id
FROM public.communication_identities ci
WHERE ci.channel = 'phone'
  AND ci.identifier = public.normalize_phone(c.phone_number)
  AND ci.lead_id IS NOT NULL
  AND c.lead_id IS NULL
  AND c.student_id IS NULL;

-- Enqueue any already-recorded, completed calls for the new pipeline.
INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
SELECT 'call_transcribe_analyze', 'calls', id, jsonb_build_object('recording_url', recording_url)
FROM public.calls
WHERE recording_url IS NOT NULL AND status = 'completed'
ON CONFLICT (job_type, ref_table, ref_id) DO NOTHING;
