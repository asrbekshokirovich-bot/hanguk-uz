-- Security hardening: tighten RLS so the UI's role model is also enforced at the
-- database layer. Scope: security-critical findings only.
--
-- 1. leads        : remove public (anon) SELECT/INSERT. Guest auth now runs
--                   server-side via the guest-auth edge function (service role),
--                   so the anon key can no longer dump leads (incl. plaintext
--                   passwords). Staff policies are unchanged.
-- 2. staff_bonuses: payroll data — restrict to owners only (was all staff).
-- 3. finance_audit_log : allow owners (not just admins) to read.
-- 4. search_jobs  : remove anon "read any job by id" (IDOR on jsonb request/result).
-- 5. staff_presence    : restrict "view all" to staff (was any authenticated user).
-- 6. voip_webhook_captures : RLS was enabled with no policy; add explicit deny-all
--                   for client roles (service role bypasses RLS for webhooks).

-- 1. leads ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public select for leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public insert for leads" ON public.leads;

-- 2. staff_bonuses -------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view all bonuses" ON public.staff_bonuses;
DROP POLICY IF EXISTS "Staff can insert bonuses" ON public.staff_bonuses;

CREATE POLICY "Owners can view bonuses" ON public.staff_bonuses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can insert bonuses" ON public.staff_bonuses
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
-- (UPDATE/DELETE were already owner-only.)

-- 3. finance_audit_log ---------------------------------------------------------
DROP POLICY IF EXISTS "Admin can view finance audit log" ON public.finance_audit_log;

CREATE POLICY "Owners and admins can view finance audit log" ON public.finance_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 4. search_jobs ---------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read search jobs by id" ON public.search_jobs;
-- "Users can view their own search jobs" (auth.uid() = user_id) remains.

-- 5. staff_presence ------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view all presence" ON public.staff_presence;

CREATE POLICY "Staff can view all presence" ON public.staff_presence
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ));

-- 6. voip_webhook_captures -----------------------------------------------------
CREATE POLICY "No client access to voip captures" ON public.voip_webhook_captures
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
