-- AI Crawl configuration singleton
CREATE TABLE IF NOT EXISTS public.ai_crawl_config (
  id text PRIMARY KEY DEFAULT 'singleton',
  enabled boolean NOT NULL DEFAULT false,
  interval_hours integer NOT NULL DEFAULT 6,
  batch_size integer NOT NULL DEFAULT 5,
  model text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  auto_approve_threshold numeric NOT NULL DEFAULT 0.9,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_run_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_crawl_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ai_crawl_config (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

CREATE POLICY "Staff can read crawl config" ON public.ai_crawl_config
  FOR SELECT USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner/admin can update crawl config" ON public.ai_crawl_config
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Crawl runs log
CREATE TABLE IF NOT EXISTS public.crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions(id),
  status text DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  http_status_code integer,
  records_seen integer,
  records_new integer,
  error_text text
);

ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read crawl runs" ON public.crawl_runs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Staff write policies for admission data entry tables
-- admission_cycles: staff can insert/update/delete
CREATE POLICY "Staff can manage admission cycles" ON public.admission_cycles
  FOR ALL USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'document_handler')
  );

-- requirements: staff can insert/update/delete
CREATE POLICY "Staff can manage requirements" ON public.requirements
  FOR ALL USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'document_handler')
  );

-- documents_required: staff can insert/update/delete
CREATE POLICY "Staff can manage documents required" ON public.documents_required
  FOR ALL USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'document_handler')
  );
