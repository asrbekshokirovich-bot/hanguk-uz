-- Ledger of which guideline documents have already been announced to the
-- operator, so `uni-db notify-new` can never send the same find twice.
--
-- WHY A SEPARATE TABLE AND NOT A COLUMN ON guideline_documents
--
-- The pipeline writes guideline_documents constantly (fetch, reparse, publish,
-- supersede) and several workers hold it open. A notification ledger is
-- append-only, read by exactly one job, and irrelevant to every one of those
-- writers — keeping it out of the hot table means the notifier can never
-- interfere with ingestion, and dropping the notifier later is a DROP TABLE
-- rather than a schema change to the thing the whole service depends on.
--
-- This is the "already notified" column hitl/watchdog_alerts.py identified as
-- missing on pipeline_watchdog_log (which is why the watchdog fails the CI run
-- instead of paging a chat). Here it exists, so the poller can be a poller.
--
-- Access: service-role only. Nothing user-facing reads it, RLS is on with no
-- policies, so PostgREST exposes nothing to anon/authenticated. The uni_db
-- workers connect with the service role, which bypasses RLS.

CREATE TABLE IF NOT EXISTS public.guideline_notifications (
  -- One row per document, PK doubles as the dedupe key that makes the
  -- worker's INSERT ... ON CONFLICT DO NOTHING idempotent.
  guideline_document_id uuid PRIMARY KEY
    REFERENCES public.guideline_documents (id) ON DELETE CASCADE,
  -- 'telegram' for a real announcement, 'seed' for rows backfilled by
  -- `notify-new --mark-seen` at setup. Keeping them distinguishable means a
  -- later "what did we actually tell them about?" audit is a WHERE clause.
  channel text NOT NULL DEFAULT 'telegram',
  notified_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guideline_notifications IS
  'Append-only ledger: guideline documents already announced to the operator. '
  'Written by `uni-db notify-new`; absence of a row is what makes a document new.';

-- The worker''s hot path is an anti-join from guideline_documents, which the
-- PK index already serves. This one covers the audit direction (what went out
-- recently) without which a "did the 06:00 sweep notify anything?" check is a
-- seq scan.
CREATE INDEX IF NOT EXISTS guideline_notifications_notified_at_idx
  ON public.guideline_notifications (notified_at DESC);

ALTER TABLE public.guideline_notifications ENABLE ROW LEVEL SECURITY;
