
-- Create scholarships table
CREATE TABLE public.scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_uz TEXT,
  name_ru TEXT,
  name_ko TEXT,
  name_en TEXT,
  description TEXT,
  description_uz TEXT,
  description_ru TEXT,
  description_ko TEXT,
  description_en TEXT,
  scholarship_type TEXT NOT NULL DEFAULT 'university',
  coverage TEXT,
  amount_krw NUMERIC,
  amount_description TEXT,
  eligibility_criteria JSONB DEFAULT '{}',
  required_documents TEXT[],
  application_deadline DATE,
  application_url TEXT,
  is_active BOOLEAN DEFAULT true,
  program_level TEXT,
  language_track TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

-- Anyone can view active scholarships
CREATE POLICY "Anyone can view active scholarships"
  ON public.scholarships FOR SELECT USING (true);

-- Staff can manage scholarships
CREATE POLICY "Staff can manage scholarships"
  ON public.scholarships FOR ALL USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );
