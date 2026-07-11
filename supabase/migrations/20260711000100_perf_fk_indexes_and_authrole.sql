-- Performance follow-up to 20260711000000:
--  1. Wrap the remaining auth.role() RLS calls in (select ...) so they are
--     evaluated once per statement (InitPlan) rather than per row. These three
--     policies use auth.role() instead of auth.uid(), so the previous migration
--     did not cover them.
--  2. Add covering indexes for unindexed foreign keys on the hot public tables
--     (flagged by the Supabase performance advisor). These serve joins and
--     ON DELETE referential checks. The separate `orbit` schema and cold
--     audit/settings tables are intentionally left out.

ALTER POLICY "Authenticated staff can insert sync jobs" ON public.admission_sync_jobs
  WITH CHECK (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Service role can update sync jobs" ON public.admission_sync_jobs
  USING (((select auth.role()) = ANY (ARRAY['authenticated'::text, 'service_role'::text])));

ALTER POLICY "Allow authenticated inserts" ON public.staff_password_history
  WITH CHECK (((select auth.role()) = 'authenticated'::text));

-- Covering indexes for foreign keys on frequently-joined tables.
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON public.documents (application_id);
CREATE INDEX IF NOT EXISTS idx_documents_reviewed_by ON public.documents (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_payments_application_id ON public.payments (application_id);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON public.calls (lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_application_id ON public.tasks (application_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_student_budgets_student_id ON public.student_budgets (student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_student_id ON public.student_notes (student_id);
CREATE INDEX IF NOT EXISTS idx_student_university_priorities_student_id ON public.student_university_priorities (student_id);
CREATE INDEX IF NOT EXISTS idx_supc_priority_id ON public.student_university_priority_comments (priority_id);
CREATE INDEX IF NOT EXISTS idx_income_distributions_payment_id ON public.income_distributions (payment_id);
CREATE INDEX IF NOT EXISTS idx_income_distributions_recipient_id ON public.income_distributions (recipient_id);
CREATE INDEX IF NOT EXISTS idx_operational_fund_allocations_payment_id ON public.operational_fund_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON public.payment_transactions (payment_id);
CREATE INDEX IF NOT EXISTS idx_distribution_transfers_created_by ON public.distribution_transfers (created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_linked_payment_id ON public.scheduled_payments (linked_payment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_trigger_application_id ON public.scheduled_payments (trigger_application_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_draft_id ON public.peer_reviews (draft_id);
CREATE INDEX IF NOT EXISTS idx_peer_review_queue_draft_id ON public.peer_review_queue (draft_id);
CREATE INDEX IF NOT EXISTS idx_planned_transactions_created_by ON public.planned_transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_room_channels_room_id ON public.room_channels (room_id);
