
-- Fix #2: Remove overly permissive distribution_transfers policies
DROP POLICY IF EXISTS "Authenticated users can create distribution transfers" ON distribution_transfers;
DROP POLICY IF EXISTS "Authenticated users can view distribution transfers" ON distribution_transfers;

-- Fix #3: Remove overly permissive ai_context_cache and ai_conversations policies
DROP POLICY IF EXISTS "Service role can manage context cache" ON ai_context_cache;
DROP POLICY IF EXISTS "Service role can manage AI conversations" ON ai_conversations;
