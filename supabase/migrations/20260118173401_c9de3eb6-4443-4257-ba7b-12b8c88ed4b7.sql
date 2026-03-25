-- Table to track detected changes between form versions
CREATE TABLE public.application_form_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_id UUID NOT NULL REFERENCES public.application_form_cache(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('deadline_changed', 'fee_changed', 'document_added', 'document_removed', 'requirement_changed', 'program_added', 'program_removed', 'other')),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  notes TEXT
);

-- Table to store validation results and discrepancies
CREATE TABLE public.application_form_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_id UUID NOT NULL REFERENCES public.application_form_cache(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  validation_type TEXT NOT NULL CHECK (validation_type IN ('cross_reference', 'change_detection', 'manual_review')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'needs_review')),
  discrepancies JSONB DEFAULT '[]'::jsonb,
  field_confidence_scores JSONB DEFAULT '{}'::jsonb,
  overall_confidence INTEGER NOT NULL DEFAULT 0,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT
);

-- Enable RLS
ALTER TABLE public.application_form_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_validations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for changes
CREATE POLICY "Staff can view all changes" ON public.application_form_changes
  FOR SELECT USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can manage changes" ON public.application_form_changes
  FOR ALL USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- RLS Policies for validations
CREATE POLICY "Staff can view all validations" ON public.application_form_validations
  FOR SELECT USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can manage validations" ON public.application_form_validations
  FOR ALL USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- Add field confidence to application_form_cache
ALTER TABLE public.application_form_cache 
  ADD COLUMN IF NOT EXISTS field_confidence JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'needs_review', 'stale')),
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX idx_changes_university ON public.application_form_changes(university_id);
CREATE INDEX idx_changes_severity ON public.application_form_changes(severity);
CREATE INDEX idx_changes_acknowledged ON public.application_form_changes(acknowledged_at);
CREATE INDEX idx_validations_status ON public.application_form_validations(status);
CREATE INDEX idx_validations_university ON public.application_form_validations(university_id);