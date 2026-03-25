-- Phase 1: Extend leads table with new profile and AI fields
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS preferred_university TEXT,
ADD COLUMN IF NOT EXISTS preferred_program TEXT,
ADD COLUMN IF NOT EXISTS budget_range TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS english_level TEXT,
ADD COLUMN IF NOT EXISTS korean_level TEXT,
ADD COLUMN IF NOT EXISTS preferred_start_date TEXT,
ADD COLUMN IF NOT EXISTS how_heard TEXT,
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE;

-- Phase 1: Extend lead_notes table with contact outcome tracking
ALTER TABLE public.lead_notes
ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'call',
ADD COLUMN IF NOT EXISTS outcome TEXT,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- Create index for priority-based queries (Call Today feature)
CREATE INDEX IF NOT EXISTS idx_leads_priority_score ON public.leads(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_last_contacted ON public.leads(last_contacted_at);

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Enable realtime for lead_notes table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_notes;