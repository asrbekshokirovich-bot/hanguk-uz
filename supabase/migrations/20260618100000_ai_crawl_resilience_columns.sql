-- Crawl resilience: circuit breaker + text-hash gate support
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS crawl_cooldown_until timestamptz;

CREATE TABLE IF NOT EXISTS public.crawl_page_cache (
  institution_id uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  page_size_bytes integer
);

ALTER TABLE public.crawl_page_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Staff can read page cache" ON public.crawl_page_cache
    FOR SELECT USING (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.crawl_runs ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.crawl_runs ADD COLUMN IF NOT EXISTS skipped_reason text;
