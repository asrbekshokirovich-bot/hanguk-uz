
-- GKS Program Info table
CREATE TABLE public.gks_program_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_level TEXT NOT NULL CHECK (program_level IN ('undergraduate', 'graduate')),
  track_type TEXT NOT NULL CHECK (track_type IN ('embassy', 'university')),
  sub_track TEXT NOT NULL CHECK (sub_track IN ('general', 'r_gks', 'uic', 'associate', 'rd', 'global_network', 'research', 'international_org', 'overseas_korean')),
  year INTEGER NOT NULL,
  total_slots INTEGER,
  announcement_date DATE,
  application_start DATE,
  application_end DATE,
  review_period_start DATE,
  review_period_end DATE,
  result_date DATE,
  benefits JSONB DEFAULT '{}',
  eligibility JSONB DEFAULT '{}',
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(program_level, track_type, sub_track, year)
);

ALTER TABLE public.gks_program_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read GKS program info"
  ON public.gks_program_info FOR SELECT USING (true);

CREATE POLICY "Staff can manage GKS program info"
  ON public.gks_program_info FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_gks_program_info_updated_at
  BEFORE UPDATE ON public.gks_program_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GKS Designated Universities junction table
CREATE TABLE public.gks_designated_universities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  gks_program_info_id UUID NOT NULL REFERENCES public.gks_program_info(id) ON DELETE CASCADE,
  university_type TEXT CHECK (university_type IN ('A', 'B')),
  is_uic BOOLEAN DEFAULT false,
  is_rd BOOLEAN DEFAULT false,
  is_global_network BOOLEAN DEFAULT false,
  slot_allocation INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(university_id, gks_program_info_id)
);

ALTER TABLE public.gks_designated_universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read GKS designated universities"
  ON public.gks_designated_universities FOR SELECT USING (true);

CREATE POLICY "Staff can manage GKS designated universities"
  ON public.gks_designated_universities FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
