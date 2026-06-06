-- Richer lead fields so the AI (and staff) can segment by exam plans + intake.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS exam_date     date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS exam_type     text;   -- TOPIK | IELTS | none
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS target_intake text;   -- e.g. "Spring 2027"

CREATE INDEX IF NOT EXISTS idx_leads_exam_date ON public.leads(exam_date);
CREATE INDEX IF NOT EXISTS idx_leads_status    ON public.leads(status);
