
-- Create translation document types table
CREATE TABLE public.translation_document_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_uz TEXT NOT NULL,
  name_ru TEXT,
  name_en TEXT,
  name_ko TEXT,
  description_uz TEXT,
  description_ru TEXT,
  description_en TEXT,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create translation templates table (training pairs)
CREATE TABLE public.translation_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type_id UUID NOT NULL REFERENCES public.translation_document_types(id) ON DELETE CASCADE,
  original_file_path TEXT NOT NULL,
  translated_file_path TEXT NOT NULL,
  original_text TEXT,
  translated_text TEXT,
  notes TEXT,
  uploaded_by UUID NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create translation requirements table (what supporting docs are needed)
CREATE TABLE public.translation_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type_id UUID NOT NULL REFERENCES public.translation_document_types(id) ON DELETE CASCADE,
  required_document_code TEXT NOT NULL,
  required_document_name_uz TEXT NOT NULL,
  required_document_name_ru TEXT,
  required_document_name_en TEXT,
  is_student_document BOOLEAN NOT NULL DEFAULT true,
  is_parent_document BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create translation jobs table
CREATE TABLE public.translation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  document_type_id UUID NOT NULL REFERENCES public.translation_document_types(id),
  source_document_id UUID REFERENCES public.documents(id),
  source_file_path TEXT NOT NULL,
  translated_file_path TEXT,
  translated_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  supporting_documents JSONB DEFAULT '[]'::jsonb,
  auto_triggered BOOLEAN NOT NULL DEFAULT false,
  requested_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.translation_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for translation_document_types (public read, admin write)
CREATE POLICY "Anyone can view document types"
ON public.translation_document_types FOR SELECT
USING (true);

CREATE POLICY "Admins can manage document types"
ON public.translation_document_types FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS policies for translation_templates
CREATE POLICY "Staff can view templates"
ON public.translation_templates FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'document_handler'));

CREATE POLICY "Staff can manage templates"
ON public.translation_templates FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'document_handler'));

-- RLS policies for translation_requirements
CREATE POLICY "Anyone can view requirements"
ON public.translation_requirements FOR SELECT
USING (true);

CREATE POLICY "Admins can manage requirements"
ON public.translation_requirements FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS policies for translation_jobs
CREATE POLICY "Staff can view all translation jobs"
ON public.translation_jobs FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'document_handler'));

CREATE POLICY "Students can view their own translation jobs"
ON public.translation_jobs FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Staff can manage translation jobs"
ON public.translation_jobs FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'document_handler'));

CREATE POLICY "Students can request translations"
ON public.translation_jobs FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Create triggers for updated_at
CREATE TRIGGER update_translation_document_types_updated_at
  BEFORE UPDATE ON public.translation_document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_translation_templates_updated_at
  BEFORE UPDATE ON public.translation_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_translation_jobs_updated_at
  BEFORE UPDATE ON public.translation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for translation documents
INSERT INTO storage.buckets (id, name, public) VALUES ('translation-documents', 'translation-documents', false);

-- Storage policies for translation-documents bucket
CREATE POLICY "Staff can view translation documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'translation-documents' AND (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'document_handler')
));

CREATE POLICY "Staff can upload translation documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'translation-documents' AND (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'document_handler')
));

CREATE POLICY "Staff can update translation documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'translation-documents' AND (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'document_handler')
));

CREATE POLICY "Staff can delete translation documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'translation-documents' AND (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'document_handler')
));

-- Insert default document types
INSERT INTO public.translation_document_types (code, name_uz, name_ru, name_en, name_ko, description_uz) VALUES
('diploma', 'Diplom', 'Диплом', 'Diploma', '졸업장', 'Oliy ta''lim diplomi'),
('attestat', 'Attestat', 'Аттестат', 'School Certificate', '졸업증명서', 'Maktab attestati'),
('birth_certificate', 'Tug''ilganlik haqida guvohnoma', 'Свидетельство о рождении', 'Birth Certificate', '출생증명서', 'Tug''ilganlik to''g''risidagi guvohnoma'),
('passport', 'Pasport', 'Паспорт', 'Passport', '여권', 'Xalqaro pasport'),
('transcript', 'Baholar varaqasi', 'Табель оценок', 'Transcript', '성적증명서', 'Baholar varaqasi yoki transkript'),
('medical_certificate', 'Tibbiy ma''lumotnoma', 'Медицинская справка', 'Medical Certificate', '건강증명서', 'Tibbiy ko''rik ma''lumotnomasi');

-- Insert default requirements
INSERT INTO public.translation_requirements (document_type_id, required_document_code, required_document_name_uz, required_document_name_ru, required_document_name_en, is_student_document, is_parent_document, sort_order) VALUES
((SELECT id FROM translation_document_types WHERE code = 'diploma'), 'student_passport', 'Talaba pasporti', 'Паспорт студента', 'Student Passport', true, false, 1),
((SELECT id FROM translation_document_types WHERE code = 'attestat'), 'student_passport', 'Talaba pasporti', 'Паспорт студента', 'Student Passport', true, false, 1),
((SELECT id FROM translation_document_types WHERE code = 'birth_certificate'), 'student_passport', 'Talaba pasporti', 'Паспорт студента', 'Student Passport', true, false, 1),
((SELECT id FROM translation_document_types WHERE code = 'birth_certificate'), 'parent_passport', 'Ota-ona pasporti', 'Паспорт родителя', 'Parent Passport', false, true, 2);
