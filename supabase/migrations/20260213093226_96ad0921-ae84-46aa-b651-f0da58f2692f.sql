
-- ============================================================
-- FIX #2: distribution_transfers & distribution_transfer_items RLS
-- Replace open policies with staff-only access
-- ============================================================

-- Drop existing overly permissive policies on distribution_transfers
DROP POLICY IF EXISTS "Authenticated users can create transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can update transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can delete transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can view transfers" ON public.distribution_transfers;

-- Create staff-only policies for distribution_transfers
CREATE POLICY "Staff can view distribution transfers"
  ON public.distribution_transfers FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can create distribution transfers"
  ON public.distribution_transfers FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update distribution transfers"
  ON public.distribution_transfers FOR UPDATE
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete distribution transfers"
  ON public.distribution_transfers FOR DELETE
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Drop existing overly permissive policies on distribution_transfer_items
DROP POLICY IF EXISTS "Authenticated users can create transfer items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can update transfer items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can delete transfer items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can view transfer items" ON public.distribution_transfer_items;

-- Create staff-only policies for distribution_transfer_items
CREATE POLICY "Staff can view transfer items"
  ON public.distribution_transfer_items FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can create transfer items"
  ON public.distribution_transfer_items FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update transfer items"
  ON public.distribution_transfer_items FOR UPDATE
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete transfer items"
  ON public.distribution_transfer_items FOR DELETE
  USING (has_role(auth.uid(), 'owner'::app_role));

-- ============================================================
-- FIX #10: student_notes — Add UPDATE policy
-- ============================================================
CREATE POLICY "Staff can update own student notes"
  ON public.student_notes FOR UPDATE
  USING (created_by = auth.uid());

-- ============================================================
-- FIX #11: task_comments — Add UPDATE policy
-- ============================================================
CREATE POLICY "Users can update own task comments"
  ON public.task_comments FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- FIX #12: mentions — Add DELETE policy
-- ============================================================
CREATE POLICY "Users can delete own mentions"
  ON public.mentions FOR DELETE
  USING (auth.uid() = mentioned_user_id);

-- ============================================================
-- FIX #13: interview_sessions — Add DELETE policy
-- ============================================================
CREATE POLICY "Students can delete own sessions"
  ON public.interview_sessions FOR DELETE
  USING (auth.uid() = student_id);

-- ============================================================
-- FIX #14: student_achievements — Add UPDATE and DELETE policies
-- ============================================================
CREATE POLICY "Staff can update achievements"
  ON public.student_achievements FOR UPDATE
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can delete achievements"
  ON public.student_achievements FOR DELETE
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX #15: study_plan_chat_history — Add DELETE policy for staff
-- ============================================================
CREATE POLICY "Staff can delete chat history"
  ON public.study_plan_chat_history FOR DELETE
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX #19: scheduled_payments — Add admin INSERT and UPDATE
-- ============================================================
CREATE POLICY "Admin can insert scheduled payments"
  ON public.scheduled_payments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update scheduled payments"
  ON public.scheduled_payments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can view scheduled payments"
  ON public.scheduled_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX #20: Add missing indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_source ON public.messages(source);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_id ON public.channel_messages(channel_id);
