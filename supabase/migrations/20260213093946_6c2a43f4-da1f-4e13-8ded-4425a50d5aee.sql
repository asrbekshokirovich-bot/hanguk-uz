
-- Drop ALL existing policies on these tables first
DROP POLICY IF EXISTS "Staff can insert distribution transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Staff can update distribution transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Staff can delete distribution transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can insert distribution transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can update distribution transfers" ON public.distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can delete distribution transfers" ON public.distribution_transfers;

CREATE POLICY "Staff can insert distribution transfers"
ON public.distribution_transfers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update distribution transfers"
ON public.distribution_transfers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can delete distribution transfers"
ON public.distribution_transfers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- distribution_transfer_items
DROP POLICY IF EXISTS "Staff can view distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Staff can insert distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Staff can update distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Staff can delete distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can manage distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can view distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can insert distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can update distribution items" ON public.distribution_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can delete distribution items" ON public.distribution_transfer_items;

CREATE POLICY "Staff can view distribution items"
ON public.distribution_transfer_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can insert distribution items"
ON public.distribution_transfer_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update distribution items"
ON public.distribution_transfer_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can delete distribution items"
ON public.distribution_transfer_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ai_context_cache
DROP POLICY IF EXISTS "Users can manage own ai context" ON public.ai_context_cache;
DROP POLICY IF EXISTS "Service role can manage ai context" ON public.ai_context_cache;
DROP POLICY IF EXISTS "Service role can manage" ON public.ai_context_cache;

CREATE POLICY "Users can manage own ai context"
ON public.ai_context_cache FOR ALL TO authenticated
USING (auth.uid()::text = user_id::text);

-- ai_conversations
DROP POLICY IF EXISTS "Users can manage own ai conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Service role can manage ai conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Service role can manage" ON public.ai_conversations;

CREATE POLICY "Users can manage own ai conversations"
ON public.ai_conversations FOR ALL TO authenticated
USING (auth.uid()::text = user_id::text);

-- Atomic increment function for telegram
CREATE OR REPLACE FUNCTION public.increment_thread_unread(p_source text, p_sender_id text, p_sender_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
