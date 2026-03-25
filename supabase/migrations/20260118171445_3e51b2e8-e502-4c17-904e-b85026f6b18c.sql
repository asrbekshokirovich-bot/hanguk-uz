-- 1. University Programs table - stores detailed program/major information
CREATE TABLE public.university_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  program_level TEXT NOT NULL CHECK (program_level IN ('undergraduate', 'graduate', 'phd')),
  faculty_name TEXT,
  department_name TEXT,
  language_track TEXT NOT NULL CHECK (language_track IN ('english', 'korean', 'both')),
  tuition_per_semester NUMERIC,
  tuition_per_year NUMERIC,
  topik_requirement INTEGER CHECK (topik_requirement >= 1 AND topik_requirement <= 6),
  ielts_requirement NUMERIC CHECK (ielts_requirement >= 0 AND ielts_requirement <= 9),
  toefl_requirement INTEGER CHECK (toefl_requirement >= 0 AND toefl_requirement <= 120),
  is_available_for_international BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. University Admission Periods table - stores semester-specific deadlines and fees
CREATE TABLE public.university_admission_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  semester TEXT NOT NULL CHECK (semester IN ('spring', 'fall')),
  year INTEGER NOT NULL,
  application_start DATE,
  application_end DATE,
  document_deadline DATE,
  result_announcement DATE,
  program_level TEXT NOT NULL CHECK (program_level IN ('undergraduate', 'graduate', 'phd', 'all')),
  language_track TEXT CHECK (language_track IN ('english', 'korean', 'both', 'all')),
  application_fee_krw NUMERIC,
  application_fee_usd NUMERIC,
  application_form_url TEXT,
  application_guide_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(university_id, semester, year, program_level, language_track)
);

-- 3. University Requirements table - stores document requirements per semester/track
CREATE TABLE public.university_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  semester TEXT NOT NULL CHECK (semester IN ('spring', 'fall')),
  year INTEGER NOT NULL,
  program_level TEXT NOT NULL CHECK (program_level IN ('undergraduate', 'graduate', 'phd', 'all')),
  language_track TEXT CHECK (language_track IN ('english', 'korean', 'both', 'all')),
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  special_notes TEXT,
  eligibility_criteria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(university_id, semester, year, program_level, language_track)
);

-- 4. Application Form Cache table - stores scraped and analyzed form data
CREATE TABLE public.application_form_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  semester TEXT NOT NULL CHECK (semester IN ('spring', 'fall')),
  year INTEGER NOT NULL,
  program_level TEXT NOT NULL CHECK (program_level IN ('undergraduate', 'graduate', 'phd', 'all')),
  form_url TEXT,
  scraped_content TEXT,
  analyzed_data JSONB,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_valid BOOLEAN NOT NULL DEFAULT true,
  source TEXT CHECK (source IN ('studyinkorea', 'official_website', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.university_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_admission_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for university_programs
CREATE POLICY "Staff can manage university programs"
  ON public.university_programs FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'document_handler'::app_role));

CREATE POLICY "Anyone can view university programs"
  ON public.university_programs FOR SELECT
  USING (true);

-- RLS Policies for university_admission_periods
CREATE POLICY "Staff can manage admission periods"
  ON public.university_admission_periods FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'document_handler'::app_role));

CREATE POLICY "Anyone can view admission periods"
  ON public.university_admission_periods FOR SELECT
  USING (true);

-- RLS Policies for university_requirements
CREATE POLICY "Staff can manage university requirements"
  ON public.university_requirements FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'document_handler'::app_role));

CREATE POLICY "Anyone can view university requirements"
  ON public.university_requirements FOR SELECT
  USING (true);

-- RLS Policies for application_form_cache
CREATE POLICY "Staff can manage form cache"
  ON public.application_form_cache FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'document_handler'::app_role));

CREATE POLICY "Staff can view form cache"
  ON public.application_form_cache FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'document_handler'::app_role) OR has_role(auth.uid(), 'call_operator'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_university_programs_updated_at
  BEFORE UPDATE ON public.university_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_university_admission_periods_updated_at
  BEFORE UPDATE ON public.university_admission_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_university_requirements_updated_at
  BEFORE UPDATE ON public.university_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_application_form_cache_updated_at
  BEFORE UPDATE ON public.application_form_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_university_programs_university_id ON public.university_programs(university_id);
CREATE INDEX idx_university_programs_level_track ON public.university_programs(program_level, language_track);
CREATE INDEX idx_university_admission_periods_university_id ON public.university_admission_periods(university_id);
CREATE INDEX idx_university_admission_periods_semester_year ON public.university_admission_periods(semester, year);
CREATE INDEX idx_university_requirements_university_id ON public.university_requirements(university_id);
CREATE INDEX idx_application_form_cache_university_id ON public.application_form_cache(university_id);