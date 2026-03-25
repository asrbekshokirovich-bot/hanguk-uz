-- Add contacted_at field to lead_notes for tracking contact dates
ALTER TABLE public.lead_notes 
ADD COLUMN contacted_at DATE;