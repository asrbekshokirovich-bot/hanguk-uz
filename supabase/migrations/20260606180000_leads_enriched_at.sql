-- Track which leads the AI enrichment pass has processed.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_enriched_at ON public.leads(enriched_at);
