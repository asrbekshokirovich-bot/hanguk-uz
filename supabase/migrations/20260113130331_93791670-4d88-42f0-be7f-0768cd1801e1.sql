-- Create university notes table for staff annotations
CREATE TABLE public.university_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'admission', 'scholarship', 'housing', 'tip'
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.university_notes ENABLE ROW LEVEL SECURITY;

-- Staff can view all notes
CREATE POLICY "Staff can view university notes"
ON public.university_notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'call_operator', 'document_handler')
  )
);

-- Students can view notes too (for AI comparison)
CREATE POLICY "Students can view university notes"
ON public.university_notes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Staff can create notes
CREATE POLICY "Staff can create university notes"
ON public.university_notes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'call_operator', 'document_handler')
  )
  AND created_by = auth.uid()
);

-- Staff can update their own notes
CREATE POLICY "Staff can update own university notes"
ON public.university_notes
FOR UPDATE
USING (created_by = auth.uid());

-- Staff can delete their own notes, admins/owners can delete any
CREATE POLICY "Staff can delete university notes"
ON public.university_notes
FOR DELETE
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_university_notes_updated_at
BEFORE UPDATE ON public.university_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_university_notes_university_id ON public.university_notes(university_id);